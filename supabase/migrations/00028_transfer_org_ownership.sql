-- Allow an organization owner to transfer ownership to another existing member.
-- Keeps exactly one owner membership row in normal operation and updates the
-- organizations.owner_id field atomically.

create or replace function public.transfer_org_ownership(
  p_org_id uuid,
  p_new_owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := auth.uid();
begin
  if v_current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.organizations
    where id = p_org_id
      and owner_id = v_current_user_id
  ) then
    raise exception 'Only the organization owner can transfer ownership';
  end if;

  if p_new_owner_user_id = v_current_user_id then
    return;
  end if;

  if not exists (
    select 1
    from public.organization_members
    where organization_id = p_org_id
      and user_id = p_new_owner_user_id
  ) then
    raise exception 'The new owner must already be a member of the organization';
  end if;

  update public.organizations
  set owner_id = p_new_owner_user_id
  where id = p_org_id;

  update public.organization_members
  set role = 'admin'
  where organization_id = p_org_id
    and user_id = v_current_user_id
    and role = 'owner';

  update public.organization_members
  set role = 'owner'
  where organization_id = p_org_id
    and user_id = p_new_owner_user_id;
end;
$$;
