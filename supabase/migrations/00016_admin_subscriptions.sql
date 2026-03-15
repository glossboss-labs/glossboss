-- Grant unlimited (organization-tier) access to admin users.
-- These are inserted as "manual" subscriptions without a Polar subscription ID,
-- so they won't be affected by webhook upserts.

-- Insert subscription for bjorn@lammers.media
insert into public.subscriptions (user_id, plan, status, billing_interval)
select id, 'organization', 'active', null
from auth.users
where email = 'bjorn@lammers.media'
on conflict do nothing;

-- Insert subscription for hi@toine.zip
insert into public.subscriptions (user_id, plan, status, billing_interval)
select id, 'organization', 'active', null
from auth.users
where email = 'hi@toine.zip'
on conflict do nothing;
