--
--
-- Mirrors the org-level invites pattern but uses project-level roles
-- (admin|maintainer|reviewer|translator|viewer) and project_members.

-- ============================================================
-- 1. project_invites table
-- ============================================================

create table public.project_invites (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  email       text not null,
  role        text not null default 'translator'
                check (role in ('admin', 'maintainer', 'reviewer', 'translator', 'viewer')),
  token       uuid not null default gen_random_uuid() unique,
  invited_by  uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz not null default now(),

  unique (project_id, email)
);

comment on table public.project_invites is
  'Email invite records for adding collaborators to projects.';

create index project_invites_token_idx      on public.project_invites (token);
create index project_invites_project_id_idx on public.project_invites (project_id);
create index project_invites_email_idx      on public.project_invites (email);

-- ============================================================
-- 2. RLS
-- ============================================================

alter table public.project_invites enable row level security;

create policy "Project admins can view invites"
  on public.project_invites for select
  to authenticated
  using (public.is_project_admin(project_id));

create policy "Invited users can read own project invites"
  on public.project_invites for select
  to authenticated
  using (
    email = (select p.email from public.profiles p where p.id = auth.uid())
  );

create policy "Project admins can create invites"
  on public.project_invites for insert
  to authenticated
  with check (public.is_project_admin(project_id));

create policy "Project admins can delete invites"
  on public.project_invites for delete
  to authenticated
  using (public.is_project_admin(project_id));

-- ============================================================
-- 3. accept_project_invite RPC
-- ============================================================

create or replace function public.accept_project_invite(p_token uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_invite   record;
  v_user_id  uuid;
  v_email    text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select p.email into v_email
  from public.profiles p
  where p.id = v_user_id;

  -- Find valid, unexpired, unaccepted invite
  select * into v_invite
  from public.project_invites
  where token = p_token
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'Invite not found or expired';
  end if;

  -- Verify email match
  if v_invite.email <> v_email then
    raise exception 'Email mismatch';
  end if;

  -- Add user as project member
  insert into public.project_members (project_id, user_id, role)
  values (v_invite.project_id, v_user_id, v_invite.role)
  on conflict (project_id, user_id) do nothing;

  -- Mark invite as accepted
  update public.project_invites
  set accepted_at = now(), accepted_by = v_user_id
  where id = v_invite.id;

  return v_invite.project_id;
end;
$$;
