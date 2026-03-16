--
--
-- Flex is a pay-as-you-go plan billed via Polar metered billing.
-- All resource limits are unlimited (billing handled externally by Polar).
-- String counts are reported to Polar for usage-based invoicing.

-- ============================================================
-- 1. Widen plan check constraint to include 'flex'
-- ============================================================

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
    check (plan in ('free', 'pro', 'organization', 'flex'));

-- ============================================================
-- 2. Update plan_limit to handle 'flex'
-- ============================================================

create or replace function public.plan_limit(p_plan text, p_resource text)
returns integer
language sql
immutable
as $$
  select case
    -- Projects
    when p_resource = 'projects' then
      case p_plan
        when 'free' then 1
        when 'pro' then 25
        when 'organization' then 2147483647
        when 'flex' then 2147483647
        else 1
      end
    -- Strings (total across all projects)
    when p_resource = 'strings' then
      case p_plan
        when 'free' then 5000
        when 'pro' then 100000
        when 'organization' then 2147483647
        when 'flex' then 2147483647
        else 5000
      end
    -- Members (unique members across projects, or org members)
    when p_resource = 'members' then
      case p_plan
        when 'free' then 1
        when 'pro' then 10
        when 'organization' then 2147483647
        when 'flex' then 2147483647
        else 1
      end
    else 0
  end;
$$;

-- ============================================================
-- 3. Update get_user_plan to rank 'flex' in plan hierarchy
-- ============================================================

-- Flex ranks between pro and organization:
-- organization (3) > flex (2) > pro (2) > free (1)
-- Flex and pro are equivalent in priority — if a user has both,
-- the most recently created subscription wins (order by created_at desc).

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
      when 'organization' then 4
      when 'flex' then 3
      when 'pro' then 2
      else 1
    end desc,
    s.created_at desc
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
      when 'organization' then 4
      when 'flex' then 3
      when 'pro' then 2
      else 1
    end desc,
    s.created_at desc
  limit 1;

  return coalesce(v_plan, 'free');
end;
$$;

-- ============================================================
-- 4. Update get_project_owner_plan with same ranking
-- ============================================================

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
        when 'organization' then 4
        when 'flex' then 3
        when 'pro' then 2
        else 1
      end desc,
      s.created_at desc
    limit 1;
  else
    select s.plan into v_plan
    from public.subscriptions s
    where s.user_id = v_owner_id
      and s.status = 'active'
    order by
      case s.plan
        when 'organization' then 4
        when 'flex' then 3
        when 'pro' then 2
        else 1
      end desc,
      s.created_at desc
    limit 1;
  end if;

  return coalesce(v_plan, 'free');
end;
$$;
