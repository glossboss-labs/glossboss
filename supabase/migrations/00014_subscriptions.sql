--
--
-- Structure: table → helper functions → RLS → trigger

-- ============================================================
-- 1. subscriptions table
-- ============================================================

create table public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users (id) on delete cascade,
  organization_id       uuid references public.organizations (id) on delete cascade,
  polar_subscription_id text unique,
  polar_customer_id     text,
  polar_product_id      text,
  plan                  text not null default 'free'
                          check (plan in ('free', 'pro', 'organization')),
  billing_interval      text
                          check (billing_interval is null or billing_interval in ('month', 'year')),
  status                text not null default 'active'
                          check (status in ('active', 'canceled', 'past_due', 'revoked')),
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Either user_id or organization_id must be set, not both
  constraint subscriptions_owner_check
    check (
      (user_id is not null and organization_id is null)
      or (user_id is null and organization_id is not null)
    )
);

comment on table public.subscriptions is
  'Links Supabase users/orgs to Polar.sh subscription state for plan enforcement.';

create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index subscriptions_org_id_idx  on public.subscriptions (organization_id);
create index subscriptions_polar_sub_idx on public.subscriptions (polar_subscription_id);
create index subscriptions_polar_cust_idx on public.subscriptions (polar_customer_id);

-- ============================================================
-- 2. Helper functions
-- ============================================================

-- Get the active plan tier for the current user.
-- Checks both personal subscriptions and org subscriptions.
create or replace function public.get_user_plan()
returns text
language plpgsql
security definer stable set search_path = ''
as $$
declare
  v_plan text := 'free';
begin
  -- Check personal subscription first
  select s.plan into v_plan
  from public.subscriptions s
  where s.user_id = auth.uid()
    and s.status = 'active'
  order by
    case s.plan
      when 'organization' then 3
      when 'pro' then 2
      else 1
    end desc
  limit 1;

  if v_plan is not null and v_plan <> 'free' then
    return v_plan;
  end if;

  -- Check if user belongs to an org with an active subscription
  select s.plan into v_plan
  from public.subscriptions s
  join public.organization_members om on om.organization_id = s.organization_id
  where om.user_id = auth.uid()
    and s.status = 'active'
  order by
    case s.plan
      when 'organization' then 3
      when 'pro' then 2
      else 1
    end desc
  limit 1;

  return coalesce(v_plan, 'free');
end;
$$;

-- Get plan tier for a specific project owner (used in RLS limit checks).
create or replace function public.get_project_owner_plan(p_project_id uuid)
returns text
language plpgsql
security definer stable set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_org_id   uuid;
  v_plan     text := 'free';
begin
  select owner_id, organization_id into v_owner_id, v_org_id
  from public.projects
  where id = p_project_id;

  if v_org_id is not null then
    select s.plan into v_plan
    from public.subscriptions s
    where s.organization_id = v_org_id
      and s.status = 'active'
    order by
      case s.plan
        when 'organization' then 3
        when 'pro' then 2
        else 1
      end desc
    limit 1;
  else
    select s.plan into v_plan
    from public.subscriptions s
    where s.user_id = v_owner_id
      and s.status = 'active'
    order by
      case s.plan
        when 'organization' then 3
        when 'pro' then 2
        else 1
      end desc
    limit 1;
  end if;

  return coalesce(v_plan, 'free');
end;
$$;

-- Count projects owned by a user (personal, non-org projects).
create or replace function public.count_user_projects(p_user_id uuid)
returns integer
language plpgsql
security definer stable set search_path = ''
as $$
begin
  return (
    select count(*)::integer
    from public.projects
    where owner_id = p_user_id
      and organization_id is null
  );
end;
$$;

-- Count projects owned by an organization.
create or replace function public.count_org_projects(p_org_id uuid)
returns integer
language plpgsql
security definer stable set search_path = ''
as $$
begin
  return (
    select count(*)::integer
    from public.projects
    where organization_id = p_org_id
  );
end;
$$;

-- Count total strings across all projects for a user.
create or replace function public.count_user_strings(p_user_id uuid)
returns integer
language plpgsql
security definer stable set search_path = ''
as $$
begin
  return (
    select coalesce(sum(p.stats_total), 0)::integer
    from public.projects p
    where p.owner_id = p_user_id
      and p.organization_id is null
  );
end;
$$;

-- Count total strings across all projects for an organization.
create or replace function public.count_org_strings(p_org_id uuid)
returns integer
language plpgsql
security definer stable set search_path = ''
as $$
begin
  return (
    select coalesce(sum(p.stats_total), 0)::integer
    from public.projects p
    where p.organization_id = p_org_id
  );
end;
$$;

-- Count members for a user's personal projects.
create or replace function public.count_user_members(p_user_id uuid)
returns integer
language plpgsql
security definer stable set search_path = ''
as $$
begin
  return (
    select count(distinct pm.user_id)::integer
    from public.project_members pm
    join public.projects p on p.id = pm.project_id
    where p.owner_id = p_user_id
      and p.organization_id is null
  );
end;
$$;

-- Count members for an organization.
create or replace function public.count_org_members(p_org_id uuid)
returns integer
language plpgsql
security definer stable set search_path = ''
as $$
begin
  return (
    select count(*)::integer
    from public.organization_members
    where organization_id = p_org_id
  );
end;
$$;

-- ============================================================
-- 3. RLS
-- ============================================================

alter table public.subscriptions enable row level security;

-- Users can read their own personal subscription
create policy "Users can read own subscription"
  on public.subscriptions for select
  to authenticated
  using (user_id = auth.uid());

-- Users can read their org's subscription
create policy "Org members can read org subscription"
  on public.subscriptions for select
  to authenticated
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

-- Writes are done via service role key from the webhook edge function,
-- which bypasses RLS. No insert/update/delete policies needed for
-- authenticated users.

-- ============================================================
-- 4. Trigger
-- ============================================================

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();
