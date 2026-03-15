--
--
-- Adds RLS policies to allow unauthenticated and authenticated users
-- to read public and unlisted projects (and their languages/entries).
--
-- Public vs unlisted: both are readable by anyone via direct link,
-- but only public projects appear in the /explore discovery page.
-- The distinction is enforced at the application layer, not in RLS.

-- ============================================================
-- 1. Public read policies for projects
-- ============================================================

create policy "Anyone can read public or unlisted projects"
  on public.projects for select
  using (visibility in ('public', 'unlisted'));

-- ============================================================
-- 2. Public read policies for project_languages
-- ============================================================

create policy "Anyone can read public project languages"
  on public.project_languages for select
  using (
    exists (
      select 1 from public.projects
      where id = project_id
        and visibility in ('public', 'unlisted')
    )
  );

-- ============================================================
-- 3. Public read policies for project_entries
-- ============================================================

create policy "Anyone can read public project entries"
  on public.project_entries for select
  using (
    exists (
      select 1 from public.projects
      where id = project_id
        and visibility in ('public', 'unlisted')
    )
  );

-- ============================================================
-- 4. Public read policies for project_members (member list only)
-- ============================================================

create policy "Anyone can view public project members"
  on public.project_members for select
  using (
    exists (
      select 1 from public.projects
      where id = project_id
        and visibility in ('public', 'unlisted')
    )
  );

-- ============================================================
-- 5. Self-join: authenticated users can join public projects as translator
-- ============================================================

create policy "Users can join public projects as translator"
  on public.project_members for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and role = 'translator'
    and exists (
      select 1 from public.projects
      where id = project_id
        and visibility = 'public'
    )
  );
