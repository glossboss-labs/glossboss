-- Fix: allow project owners to read their own projects immediately after creation.
--
-- The existing "Members can read projects" policy uses is_project_member(id),
-- which depends on the project_members row created by the AFTER INSERT trigger.
-- But PostgREST's INSERT...RETURNING evaluates SELECT policies before AFTER
-- triggers fire, so the owner can't read back the row they just created.
--
-- This policy provides a direct path: auth.uid() = owner_id.

create policy "Owner can read own projects"
  on public.projects for select
  using (auth.uid() = owner_id);
