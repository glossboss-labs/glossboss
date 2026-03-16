-- Phase 2.1: Cloud projects — projects, project_entries, project_members
--
-- Core tables for cloud-based PO translation projects.
-- Includes RLS policies, indexes, incremental stats triggers,
-- and auto-membership for project owners.
--
-- Structure: tables → functions → triggers → RLS policies → stats

-- ============================================================
-- 1. Tables
-- ============================================================

create table public.projects (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users (id) on delete cascade,
  name               text not null,
  description        text not null default '',
  visibility         text not null default 'private'
                       check (visibility in ('private', 'public', 'unlisted')),
  source_language    text,
  target_language    text,
  source_format      text not null default 'po'
                       check (source_format in ('po', 'i18next')),
  source_filename    text,
  po_header          jsonb,
  -- Denormalized stats (maintained by trigger on project_entries)
  stats_total        int not null default 0,
  stats_translated   int not null default 0,
  stats_fuzzy        int not null default 0,
  stats_untranslated int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.projects is
  'Translation projects with PO file metadata and denormalized entry stats.';

create table public.project_members (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'translator'
                check (role in ('admin', 'maintainer', 'reviewer', 'translator', 'viewer')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (project_id, user_id)
);

comment on table public.project_members is
  'User-to-project membership with role-based access.';

create table public.project_entries (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects (id) on delete cascade,
  entry_index         int not null,
  msgctxt             text,
  msgid               text not null,
  msgid_plural        text,
  msgstr              text not null default '',
  msgstr_plural       text[],
  flags               text[] not null default '{}',
  translator_comments text[] not null default '{}',
  extracted_comments  text[] not null default '{}',
  file_references     text[] not null default '{}',
  previous_msgid      text,
  previous_msgctxt    text,
  -- Review workflow
  review_status       text not null default 'draft'
                        check (review_status in ('draft', 'in-review', 'approved', 'needs-changes')),
  review_comments     jsonb not null default '[]',
  review_history      jsonb not null default '[]',
  -- Machine translation metadata
  mt_provider         text,
  mt_used_glossary    boolean not null default false,
  mt_glossary_mode    text,
  mt_context_used     boolean not null default false,
  mt_timestamp        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.project_entries is
  'PO translation entries belonging to a project.';

-- ============================================================
-- 2. Indexes
-- ============================================================

create index projects_owner_id_idx on public.projects (owner_id);

create index project_members_user_id_idx on public.project_members (user_id);
create index project_members_project_id_idx on public.project_members (project_id);

-- Unique message identity within a project (coalesce handles NULL msgctxt)
create unique index project_entries_unique_msg
  on public.project_entries (project_id, coalesce(msgctxt, ''), msgid);

create index project_entries_project_id_idx
  on public.project_entries (project_id);

create index project_entries_ordering_idx
  on public.project_entries (project_id, entry_index);

-- ============================================================
-- 3. Helper functions
-- ============================================================

-- Compute translation status for a single entry (mirrors frontend getTranslationStatus)
create or replace function public.entry_translation_status(
  p_msgstr text,
  p_msgstr_plural text[],
  p_flags text[]
) returns text
language sql
immutable
as $$
  select case
    -- Plural entry: untranslated if array is empty or any form is blank/null
    when p_msgstr_plural is not null and (
      cardinality(p_msgstr_plural) = 0
      or exists (
        select 1 from unnest(p_msgstr_plural) as f
        where f is null or trim(f) = ''
      )
    ) then 'untranslated'
    -- Singular entry: untranslated if msgstr is blank
    when p_msgstr_plural is null and trim(p_msgstr) = '' then 'untranslated'
    -- Fuzzy
    when 'fuzzy' = any(p_flags) then 'fuzzy'
    else 'translated'
  end;
$$;

-- Check if current user is a member of a project
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id
      and user_id = auth.uid()
  );
$$;

-- Check if current user is a project admin
create or replace function public.is_project_admin(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- ============================================================
-- 4. Triggers
-- ============================================================

-- updated_at triggers (reuse set_updated_at from 00002)
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger project_members_set_updated_at
  before update on public.project_members
  for each row execute function public.set_updated_at();

create trigger project_entries_set_updated_at
  before update on public.project_entries
  for each row execute function public.set_updated_at();

-- Auto-add project owner as admin member
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'admin');
  return new;
end;
$$;

create trigger on_project_created
  after insert on public.projects
  for each row
  execute function public.handle_new_project();

-- Incremental stats trigger
create or replace function public.update_project_stats()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  old_status text;
  new_status text;
begin
  if TG_OP = 'DELETE' then
    old_status := public.entry_translation_status(old.msgstr, old.msgstr_plural, old.flags);
    update public.projects set
      stats_total        = greatest(stats_total - 1, 0),
      stats_translated   = greatest(stats_translated   - (case when old_status = 'translated'   then 1 else 0 end), 0),
      stats_fuzzy        = greatest(stats_fuzzy        - (case when old_status = 'fuzzy'        then 1 else 0 end), 0),
      stats_untranslated = greatest(stats_untranslated - (case when old_status = 'untranslated' then 1 else 0 end), 0)
    where id = old.project_id;
    return old;

  elsif TG_OP = 'INSERT' then
    new_status := public.entry_translation_status(new.msgstr, new.msgstr_plural, new.flags);
    update public.projects set
      stats_total        = stats_total + 1,
      stats_translated   = stats_translated   + (case when new_status = 'translated'   then 1 else 0 end),
      stats_fuzzy        = stats_fuzzy        + (case when new_status = 'fuzzy'        then 1 else 0 end),
      stats_untranslated = stats_untranslated + (case when new_status = 'untranslated' then 1 else 0 end)
    where id = new.project_id;
    return new;

  elsif TG_OP = 'UPDATE' then
    old_status := public.entry_translation_status(old.msgstr, old.msgstr_plural, old.flags);
    new_status := public.entry_translation_status(new.msgstr, new.msgstr_plural, new.flags);

    if old_status is distinct from new_status then
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
      where id = new.project_id;
    end if;
    return new;
  end if;

  return null;
end;
$$;

create trigger project_entries_stats
  after insert or update or delete on public.project_entries
  for each row
  execute function public.update_project_stats();

-- Full recount helper (call if stats drift out of sync)
create or replace function public.recount_project_stats(p_project_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
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
-- 5. RLS policies
-- ============================================================

-- projects
alter table public.projects enable row level security;

create policy "Users can create own projects"
  on public.projects for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Members can read projects"
  on public.projects for select
  using (public.is_project_member(id));

create policy "Admins can update projects"
  on public.projects for update
  using (public.is_project_admin(id))
  with check (public.is_project_admin(id));

create policy "Owner can delete projects"
  on public.projects for delete
  using (auth.uid() = owner_id);

-- project_members
alter table public.project_members enable row level security;

create policy "Members can view project membership"
  on public.project_members for select
  using (public.is_project_member(project_id));

create policy "Admins can add members"
  on public.project_members for insert
  to authenticated
  with check (public.is_project_admin(project_id));

create policy "Admins can update member roles"
  on public.project_members for update
  using (public.is_project_admin(project_id));

create policy "Admins or self can remove membership"
  on public.project_members for delete
  using (
    public.is_project_admin(project_id)
    or auth.uid() = user_id
  );

-- project_entries (Phase 2: any member can CRUD; Phase 3 adds role-based restrictions)
alter table public.project_entries enable row level security;

create policy "Members can read entries"
  on public.project_entries for select
  using (public.is_project_member(project_id));

create policy "Members can create entries"
  on public.project_entries for insert
  to authenticated
  with check (public.is_project_member(project_id));

create policy "Members can update entries"
  on public.project_entries for update
  using (public.is_project_member(project_id));

create policy "Members can delete entries"
  on public.project_entries for delete
  using (public.is_project_member(project_id));
