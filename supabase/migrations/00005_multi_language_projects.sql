-- Multi-language projects: one project holds N target languages, each with
-- their own entries, PO header, stats, and sync config.
--
-- Structure: new table → alter existing → data migration → triggers → RLS → RPC

-- ============================================================
-- 1. New table: project_languages
-- ============================================================

create table public.project_languages (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects (id) on delete cascade,
  locale              text not null,
  source_filename     text,
  po_header           jsonb,
  wp_locale           text,
  repo_provider       text check (repo_provider in ('github', 'gitlab')),
  repo_owner          text,
  repo_name           text,
  repo_branch         text,
  repo_file_path      text,
  repo_default_branch text,
  stats_total         int not null default 0,
  stats_translated    int not null default 0,
  stats_fuzzy         int not null default 0,
  stats_untranslated  int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (project_id, locale)
);

comment on table public.project_languages is
  'Per-language configuration within a multi-language project.';

create index project_languages_project_id_idx
  on public.project_languages (project_id);

-- ============================================================
-- 2. Alter projects — add WP metadata columns
-- ============================================================

alter table public.projects
  add column wp_project_type text check (wp_project_type in ('plugin', 'theme')),
  add column wp_slug         text,
  add column wp_track        text default 'stable' check (wp_track in ('stable', 'dev'));

-- ============================================================
-- 3. Alter project_entries — add language_id (nullable first)
-- ============================================================

alter table public.project_entries
  add column language_id uuid references public.project_languages (id) on delete cascade;

-- ============================================================
-- 4. Data migration: create one project_language per existing project
-- ============================================================

insert into public.project_languages (project_id, locale, source_filename, po_header,
  stats_total, stats_translated, stats_fuzzy, stats_untranslated)
select
  id,
  coalesce(target_language, 'unknown'),
  source_filename,
  po_header,
  stats_total,
  stats_translated,
  stats_fuzzy,
  stats_untranslated
from public.projects;

-- Backfill language_id on existing entries
update public.project_entries pe
set language_id = pl.id
from public.project_languages pl
where pl.project_id = pe.project_id;

-- Now enforce NOT NULL
alter table public.project_entries
  alter column language_id set not null;

-- ============================================================
-- 5. Re-index project_entries for language-scoped uniqueness
-- ============================================================

drop index if exists public.project_entries_unique_msg;

create unique index project_entries_unique_msg
  on public.project_entries (language_id, coalesce(msgctxt, ''), msgid);

create index project_entries_language_id_idx
  on public.project_entries (language_id);

-- ============================================================
-- 6. Updated triggers
-- ============================================================

-- updated_at on project_languages
create trigger project_languages_set_updated_at
  before update on public.project_languages
  for each row execute function public.set_updated_at();

-- Replace stats trigger to update BOTH project_languages AND projects
create or replace function public.update_project_stats()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  old_status text;
  new_status text;
  v_language_id uuid;
  v_project_id uuid;
begin
  if TG_OP = 'DELETE' then
    v_language_id := old.language_id;
    v_project_id := old.project_id;
    old_status := public.entry_translation_status(old.msgstr, old.msgstr_plural, old.flags);

    -- Update project_languages stats
    update public.project_languages set
      stats_total        = greatest(stats_total - 1, 0),
      stats_translated   = greatest(stats_translated   - (case when old_status = 'translated'   then 1 else 0 end), 0),
      stats_fuzzy        = greatest(stats_fuzzy        - (case when old_status = 'fuzzy'        then 1 else 0 end), 0),
      stats_untranslated = greatest(stats_untranslated - (case when old_status = 'untranslated' then 1 else 0 end), 0)
    where id = v_language_id;

    -- Update project aggregate stats
    update public.projects set
      stats_total        = greatest(stats_total - 1, 0),
      stats_translated   = greatest(stats_translated   - (case when old_status = 'translated'   then 1 else 0 end), 0),
      stats_fuzzy        = greatest(stats_fuzzy        - (case when old_status = 'fuzzy'        then 1 else 0 end), 0),
      stats_untranslated = greatest(stats_untranslated - (case when old_status = 'untranslated' then 1 else 0 end), 0)
    where id = v_project_id;

    return old;

  elsif TG_OP = 'INSERT' then
    v_language_id := new.language_id;
    v_project_id := new.project_id;
    new_status := public.entry_translation_status(new.msgstr, new.msgstr_plural, new.flags);

    update public.project_languages set
      stats_total        = stats_total + 1,
      stats_translated   = stats_translated   + (case when new_status = 'translated'   then 1 else 0 end),
      stats_fuzzy        = stats_fuzzy        + (case when new_status = 'fuzzy'        then 1 else 0 end),
      stats_untranslated = stats_untranslated + (case when new_status = 'untranslated' then 1 else 0 end)
    where id = v_language_id;

    update public.projects set
      stats_total        = stats_total + 1,
      stats_translated   = stats_translated   + (case when new_status = 'translated'   then 1 else 0 end),
      stats_fuzzy        = stats_fuzzy        + (case when new_status = 'fuzzy'        then 1 else 0 end),
      stats_untranslated = stats_untranslated + (case when new_status = 'untranslated' then 1 else 0 end)
    where id = v_project_id;

    return new;

  elsif TG_OP = 'UPDATE' then
    v_language_id := new.language_id;
    v_project_id := new.project_id;
    old_status := public.entry_translation_status(old.msgstr, old.msgstr_plural, old.flags);
    new_status := public.entry_translation_status(new.msgstr, new.msgstr_plural, new.flags);

    if old_status is distinct from new_status then
      update public.project_languages set
        stats_translated   = stats_translated
          - (case when old_status = 'translated'   then 1 else 0 end)
          + (case when new_status = 'translated'   then 1 else 0 end),
        stats_fuzzy        = stats_fuzzy
          - (case when old_status = 'fuzzy'        then 1 else 0 end)
          + (case when new_status = 'fuzzy'        then 1 else 0 end),
        stats_untranslated = stats_untranslated
          - (case when old_status = 'untranslated' then 1 else 0 end)
          + (case when new_status = 'untranslated' then 1 else 0 end)
      where id = v_language_id;

      update public.projects set
        stats_translated   = stats_translated
          - (case when old_status = 'translated'   then 1 else 0 end)
          + (case when new_status = 'translated'   then 1 else 0 end),
        stats_fuzzy        = stats_fuzzy
          - (case when old_status = 'fuzzy'        then 1 else 0 end)
          + (case when new_status = 'fuzzy'        then 1 else 0 end),
        stats_untranslated = stats_untranslated
          - (case when old_status = 'untranslated' then 1 else 0 end)
          + (case when new_status = 'untranslated' then 1 else 0 end)
      where id = v_project_id;
    end if;

    return new;
  end if;

  return null;
end;
$$;

-- Update recount helper to also recount project_languages
create or replace function public.recount_project_stats(p_project_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  -- Recount each language
  update public.project_languages pl set
    stats_total        = s.total,
    stats_translated   = s.translated,
    stats_fuzzy        = s.fuzzy,
    stats_untranslated = s.untranslated
  from (
    select
      language_id,
      count(*)::int as total,
      count(*) filter (
        where public.entry_translation_status(msgstr, msgstr_plural, flags) = 'translated'
      )::int as translated,
      count(*) filter (
        where public.entry_translation_status(msgstr, msgstr_plural, flags) = 'fuzzy'
      )::int as fuzzy,
      count(*) filter (
        where public.entry_translation_status(msgstr, msgstr_plural, flags) = 'untranslated'
      )::int as untranslated
    from public.project_entries
    where project_id = p_project_id
    group by language_id
  ) s
  where pl.id = s.language_id
    and pl.project_id = p_project_id;

  -- Recount project aggregate
  update public.projects set
    stats_total        = s.total,
    stats_translated   = s.translated,
    stats_fuzzy        = s.fuzzy,
    stats_untranslated = s.untranslated
  from (
    select
      count(*)::int as total,
      count(*) filter (
        where public.entry_translation_status(msgstr, msgstr_plural, flags) = 'translated'
      )::int as translated,
      count(*) filter (
        where public.entry_translation_status(msgstr, msgstr_plural, flags) = 'fuzzy'
      )::int as fuzzy,
      count(*) filter (
        where public.entry_translation_status(msgstr, msgstr_plural, flags) = 'untranslated'
      )::int as untranslated
    from public.project_entries
    where project_id = p_project_id
  ) s
  where id = p_project_id;
end;
$$;

-- ============================================================
-- 7. RLS on project_languages
-- ============================================================

alter table public.project_languages enable row level security;

create policy "Members can read project languages"
  on public.project_languages for select
  using (public.is_project_member(project_id));

create policy "Owner can read own project languages"
  on public.project_languages for select
  using (auth.uid() = (select owner_id from public.projects where id = project_id));

create policy "Admins can insert project languages"
  on public.project_languages for insert
  to authenticated
  with check (public.is_project_admin(project_id));

create policy "Admins can update project languages"
  on public.project_languages for update
  using (public.is_project_admin(project_id))
  with check (public.is_project_admin(project_id));

create policy "Admins can delete project languages"
  on public.project_languages for delete
  using (public.is_project_admin(project_id));

-- ============================================================
-- 8. Server function: clone_language_entries
-- ============================================================

create or replace function public.clone_language_entries(
  p_source_language_id uuid,
  p_target_language_id uuid
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.project_entries (
    project_id, language_id, entry_index,
    msgctxt, msgid, msgid_plural,
    msgstr, msgstr_plural,
    flags, translator_comments, extracted_comments, file_references,
    previous_msgid, previous_msgctxt,
    review_status, review_comments, review_history,
    mt_provider, mt_used_glossary, mt_glossary_mode, mt_context_used, mt_timestamp
  )
  select
    project_id, p_target_language_id, entry_index,
    msgctxt, msgid, msgid_plural,
    '', null,
    '{}', '{}', extracted_comments, file_references,
    null, null,
    'draft', '[]', '[]',
    null, false, null, false, null
  from public.project_entries
  where language_id = p_source_language_id;
end;
$$;
