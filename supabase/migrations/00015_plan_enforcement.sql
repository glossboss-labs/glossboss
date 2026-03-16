-- Phase 7.4: Plan limit enforcement via RLS
--
-- Adds plan-aware checks to project creation, entry insertion, and member addition.
-- Limits are enforced on the project/org OWNER's plan, not the acting user.

-- ============================================================
-- 1. Plan limit lookup function
-- ============================================================

-- Returns the limit for a given plan and resource.
-- Infinity is represented as 2147483647 (max int).
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
        else 1
      end
    -- Strings (total across all projects)
    when p_resource = 'strings' then
      case p_plan
        when 'free' then 5000
        when 'pro' then 100000
        when 'organization' then 2147483647
        else 5000
      end
    -- Members (unique members across projects, or org members)
    when p_resource = 'members' then
      case p_plan
        when 'free' then 1
        when 'pro' then 10
        when 'organization' then 2147483647
        else 1
      end
    else 0
  end;
$$;

-- ============================================================
-- 2. Limit check functions
-- ============================================================

-- Can the current user create another personal (non-org) project?
create or replace function public.can_create_project()
returns boolean
language plpgsql
security definer stable set search_path = ''
as $$
declare
  v_plan  text;
  v_count integer;
  v_limit integer;
begin
  v_plan  := public.get_user_plan();
  v_count := public.count_user_projects(auth.uid());
  v_limit := public.plan_limit(v_plan, 'projects');
  return v_count < v_limit;
end;
$$;

-- Can another project be created in this organization?
create or replace function public.can_create_org_project(p_org_id uuid)
returns boolean
language plpgsql
security definer stable set search_path = ''
as $$
declare
  v_plan  text;
  v_count integer;
  v_limit integer;
begin
  -- Get org's plan
  select coalesce(s.plan, 'free') into v_plan
  from public.subscriptions s
  where s.organization_id = p_org_id
    and s.status = 'active'
  order by case s.plan
    when 'organization' then 3
    when 'pro' then 2
    else 1
  end desc
  limit 1;

  v_plan  := coalesce(v_plan, 'free');
  v_count := public.count_org_projects(p_org_id);
  v_limit := public.plan_limit(v_plan, 'projects');
  return v_count < v_limit;
end;
$$;

-- Can entries be added to this project (string limit)?
create or replace function public.can_add_entries(p_project_id uuid)
returns boolean
language plpgsql
security definer stable set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_org_id   uuid;
  v_plan     text;
  v_count    integer;
  v_limit    integer;
begin
  select owner_id, organization_id into v_owner_id, v_org_id
  from public.projects where id = p_project_id;

  if v_org_id is not null then
    select coalesce(s.plan, 'free') into v_plan
    from public.subscriptions s
    where s.organization_id = v_org_id and s.status = 'active'
    order by case s.plan when 'organization' then 3 when 'pro' then 2 else 1 end desc
    limit 1;
    v_plan  := coalesce(v_plan, 'free');
    v_count := public.count_org_strings(v_org_id);
  else
    v_plan  := coalesce((
      select s.plan from public.subscriptions s
      where s.user_id = v_owner_id and s.status = 'active'
      order by case s.plan when 'organization' then 3 when 'pro' then 2 else 1 end desc
      limit 1
    ), 'free');
    v_count := public.count_user_strings(v_owner_id);
  end if;

  v_limit := public.plan_limit(v_plan, 'strings');
  return v_count < v_limit;
end;
$$;

-- Can a member be added to this project (member limit)?
create or replace function public.can_add_member(p_project_id uuid)
returns boolean
language plpgsql
security definer stable set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_org_id   uuid;
  v_plan     text;
  v_count    integer;
  v_limit    integer;
begin
  select owner_id, organization_id into v_owner_id, v_org_id
  from public.projects where id = p_project_id;

  if v_org_id is not null then
    select coalesce(s.plan, 'free') into v_plan
    from public.subscriptions s
    where s.organization_id = v_org_id and s.status = 'active'
    order by case s.plan when 'organization' then 3 when 'pro' then 2 else 1 end desc
    limit 1;
    v_plan  := coalesce(v_plan, 'free');
    v_count := public.count_org_members(v_org_id);
  else
    v_plan  := coalesce((
      select s.plan from public.subscriptions s
      where s.user_id = v_owner_id and s.status = 'active'
      order by case s.plan when 'organization' then 3 when 'pro' then 2 else 1 end desc
      limit 1
    ), 'free');
    v_count := public.count_user_members(v_owner_id);
  end if;

  v_limit := public.plan_limit(v_plan, 'members');
  return v_count < v_limit;
end;
$$;

-- ============================================================
-- 3. Update RLS policies to enforce limits
-- ============================================================

-- Replace project creation policy with limit-aware version
drop policy if exists "Users can create own projects" on public.projects;

create policy "Users can create projects within plan limits"
  on public.projects for insert
  to authenticated
  with check (
    auth.uid() = owner_id
    and (
      -- Org projects: check org plan limit
      (organization_id is not null and public.can_create_org_project(organization_id))
      or
      -- Personal projects: check user plan limit
      (organization_id is null and public.can_create_project())
    )
  );

-- Replace entry creation policy with limit-aware version
drop policy if exists "Contributors can create entries" on public.project_entries;

create policy "Contributors can create entries within plan limits"
  on public.project_entries for insert
  to authenticated
  with check (
    public.is_project_contributor(project_id)
    and public.can_add_entries(project_id)
  );

-- Replace member addition policy with limit-aware version
drop policy if exists "Admins can add members" on public.project_members;

create policy "Admins can add members within plan limits"
  on public.project_members for insert
  to authenticated
  with check (
    public.is_project_admin(project_id)
    and public.can_add_member(project_id)
  );
