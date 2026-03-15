--
--
-- Structure: tables → helper functions → RLS → triggers → alter projects

-- ============================================================
-- 1. organizations table
-- ============================================================

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text not null default '',
  avatar_url  text,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint organizations_slug_format
    check (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' and length(slug) >= 2 and length(slug) <= 63)
);

comment on table public.organizations is
  'Organizations that own projects and manage team membership.';

create index organizations_owner_id_idx on public.organizations (owner_id);

-- ============================================================
-- 2. organization_members table
-- ============================================================

create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null default 'member'
                    check (role in ('owner', 'admin', 'member')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (organization_id, user_id)
);

comment on table public.organization_members is
  'User membership and org-level role within an organization.';

create index organization_members_user_id_idx on public.organization_members (user_id);
create index organization_members_org_id_idx  on public.organization_members (organization_id);

-- ============================================================
-- 3. invites table
-- ============================================================

create table public.invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null,
  role            text not null default 'member'
                    check (role in ('admin', 'member')),
  token           uuid not null default gen_random_uuid() unique,
  invited_by      uuid references auth.users (id) on delete set null,
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users (id) on delete set null,
  expires_at      timestamptz not null default (now() + interval '7 days'),
  created_at      timestamptz not null default now(),

  unique (organization_id, email)
);

comment on table public.invites is
  'Email invite records with token-based acceptance and expiry.';

create index invites_token_idx  on public.invites (token);
create index invites_org_id_idx on public.invites (organization_id);
create index invites_email_idx  on public.invites (email);

-- ============================================================
-- 4. Helper functions
-- ============================================================

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language plpgsql
security definer stable set search_path = ''
as $$
begin
  return exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = auth.uid()
  );
end;
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language plpgsql
security definer stable set search_path = ''
as $$
begin
  return exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
end;
$$;

-- ============================================================
-- 5. RLS: organizations
-- ============================================================

alter table public.organizations enable row level security;

create policy "Authenticated users can create organizations"
  on public.organizations for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Members can read organizations"
  on public.organizations for select
  to authenticated
  using (public.is_org_member(id));

create policy "Owner can read own organizations"
  on public.organizations for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "Admins can update organizations"
  on public.organizations for update
  to authenticated
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

create policy "Owner can delete organizations"
  on public.organizations for delete
  to authenticated
  using (auth.uid() = owner_id);

-- ============================================================
-- 6. RLS: organization_members
-- ============================================================

alter table public.organization_members enable row level security;

create policy "Members can view org membership"
  on public.organization_members for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "Admins can add org members"
  on public.organization_members for insert
  to authenticated
  with check (public.is_org_admin(organization_id));

create policy "Admins can update org member roles"
  on public.organization_members for update
  to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "Admins or self can remove org membership"
  on public.organization_members for delete
  to authenticated
  using (public.is_org_admin(organization_id) or auth.uid() = user_id);

-- ============================================================
-- 7. RLS: invites
-- ============================================================

alter table public.invites enable row level security;

create policy "Admins can view org invites"
  on public.invites for select
  to authenticated
  using (public.is_org_admin(organization_id));

create policy "Invited users can read own invites"
  on public.invites for select
  to authenticated
  using (
    email = (select p.email from public.profiles p where p.id = auth.uid())
  );

create policy "Admins can create invites"
  on public.invites for insert
  to authenticated
  with check (public.is_org_admin(organization_id));

create policy "Admins can delete invites"
  on public.invites for delete
  to authenticated
  using (public.is_org_admin(organization_id));

-- ============================================================
-- 8. Triggers
-- ============================================================

-- updated_at triggers
create trigger set_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger set_organization_members_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

-- Auto-add org creator as 'owner' member
create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- ============================================================
-- 9. Link projects to organizations (optional FK)
-- ============================================================

alter table public.projects
  add column organization_id uuid references public.organizations (id) on delete set null;

create index projects_organization_id_idx on public.projects (organization_id);

-- Org members can read org projects
create policy "Org members can read org projects"
  on public.projects for select
  to authenticated
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

-- Org admins can update org projects
create policy "Org admins can update org projects"
  on public.projects for update
  to authenticated
  using (
    organization_id is not null
    and public.is_org_admin(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_admin(organization_id)
  );

-- Org admins can delete org projects
create policy "Org admins can delete org projects"
  on public.projects for delete
  to authenticated
  using (
    organization_id is not null
    and public.is_org_admin(organization_id)
  );

-- ============================================================
-- 10. Accept-invite RPC
-- ============================================================

create or replace function public.accept_invite(p_token uuid)
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
  from public.invites
  where token = p_token
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'Invite not found or expired';
  end if;

  -- Verify the authenticated user's email matches the invite
  if v_invite.email <> v_email then
    raise exception 'Email mismatch';
  end if;

  -- Add user as org member
  insert into public.organization_members (organization_id, user_id, role)
  values (v_invite.organization_id, v_user_id, v_invite.role)
  on conflict (organization_id, user_id) do nothing;

  -- Mark invite as accepted
  update public.invites
  set accepted_at = now(), accepted_by = v_user_id
  where id = v_invite.id;

  return v_invite.organization_id;
end;
$$;
