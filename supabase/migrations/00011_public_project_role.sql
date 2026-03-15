-- Public project role: controls what non-members can do on public projects.
--
-- Values:
--   'viewer'     — read-only (default, current behavior)
--   'translator' — can join and edit translations
--   'reviewer'   — can join, translate, and approve reviews
--
-- The public_role only applies when visibility = 'public'.
-- Unlisted and private projects ignore this field.

-- ============================================================
-- 1. Add public_role column to projects
-- ============================================================

alter table public.projects
  add column public_role text not null default 'viewer'
  check (public_role in ('viewer', 'translator', 'reviewer'));

comment on column public.projects.public_role is
  'Role assigned to non-member users accessing public projects. Only applies when visibility = public.';

-- ============================================================
-- 2. Update the self-join policy to respect public_role
-- ============================================================

-- Drop the old policy that only allowed translator joins
drop policy if exists "Users can join public projects as translator" on public.project_members;

-- New policy: users can self-join with any role up to the public_role level
create policy "Users can join public projects"
  on public.project_members for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects
      where id = project_id
        and visibility = 'public'
        and (
          -- Can always join as viewer
          role = 'viewer'
          -- Can join as translator if public_role is translator or reviewer
          or (role = 'translator' and public_role in ('translator', 'reviewer'))
          -- Can join as reviewer if public_role is reviewer
          or (role = 'reviewer' and public_role = 'reviewer')
        )
    )
  );
