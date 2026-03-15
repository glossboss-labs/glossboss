-- Role hardening: add granular role-check helpers and tighten RLS policies.
-- Also adds a JSONB settings column to profiles for cloud settings sync.
--
-- Role hierarchy (project):
--   admin > maintainer > reviewer > translator > viewer
--
-- Helper functions:
--   is_project_admin(id)       → admin only (already exists, unchanged)
--   is_project_manager(id)     → admin | maintainer
--   is_project_reviewer(id)    → admin | maintainer | reviewer
--   is_project_contributor(id) → admin | maintainer | reviewer | translator
--   is_project_member(id)      → any role (already exists, unchanged)

-- ============================================================
-- 1. New role-check functions
-- ============================================================

-- Manager: can manage project settings, languages, repo sync
create or replace function public.is_project_manager(p_project_id uuid)
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
      and role in ('admin', 'maintainer')
  );
$$;

-- Reviewer: can approve/reject review entries
create or replace function public.is_project_reviewer(p_project_id uuid)
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
      and role in ('admin', 'maintainer', 'reviewer')
  );
$$;

-- Contributor: can edit translations (everyone except viewer)
create or replace function public.is_project_contributor(p_project_id uuid)
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
      and role in ('admin', 'maintainer', 'reviewer', 'translator')
  );
$$;

-- ============================================================
-- 2. Tighten project_languages policies (admin → manager)
-- ============================================================

drop policy if exists "Admins can insert project languages" on public.project_languages;
create policy "Managers can insert project languages"
  on public.project_languages for insert
  to authenticated
  with check (public.is_project_manager(project_id));

drop policy if exists "Admins can update project languages" on public.project_languages;
create policy "Managers can update project languages"
  on public.project_languages for update
  using (public.is_project_manager(project_id))
  with check (public.is_project_manager(project_id));

drop policy if exists "Admins can delete project languages" on public.project_languages;
create policy "Managers can delete project languages"
  on public.project_languages for delete
  using (public.is_project_manager(project_id));

-- ============================================================
-- 3. Tighten projects update policy (admin → manager)
-- ============================================================

drop policy if exists "Admins can update projects" on public.projects;
create policy "Managers can update projects"
  on public.projects for update
  using (public.is_project_manager(id))
  with check (public.is_project_manager(id));

-- ============================================================
-- 4. Tighten project_entries policies (member → contributor)
--    Viewers become truly read-only at the DB level.
-- ============================================================

drop policy if exists "Members can create entries" on public.project_entries;
create policy "Contributors can create entries"
  on public.project_entries for insert
  to authenticated
  with check (public.is_project_contributor(project_id));

drop policy if exists "Members can update entries" on public.project_entries;
create policy "Contributors can update entries"
  on public.project_entries for update
  using (public.is_project_contributor(project_id));

drop policy if exists "Members can delete entries" on public.project_entries;
create policy "Contributors can delete entries"
  on public.project_entries for delete
  using (public.is_project_contributor(project_id));

-- Read policy stays as-is: any member can read.

-- ============================================================
-- 5. Add settings JSONB column to profiles (cloud settings sync)
-- ============================================================

alter table public.profiles
  add column if not exists settings jsonb default '{}'::jsonb;

comment on column public.profiles.settings is
  'User settings synced from the client. Preferences, provider config, and opt-in credentials.';
