-- Prevent organizations from becoming orphaned by deleting the owner
-- or the final remaining membership row. Owners must delete the
-- organization instead of leaving it.

drop policy if exists "Admins or self can remove org membership" on public.organization_members;

create policy "Admins or self can remove org membership safely"
  on public.organization_members for delete
  to authenticated
  using (
    (public.is_org_admin(organization_id) or auth.uid() = user_id)
    and organization_members.role <> 'owner'
    and exists (
      select 1
      from public.organization_members remaining
      where remaining.organization_id = organization_members.organization_id
        and remaining.id <> organization_members.id
    )
  );
