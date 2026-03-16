-- Add onboarding tracking fields to profiles
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists role text;

comment on column public.profiles.onboarding_completed_at is
  'Timestamp when user completed the onboarding flow. NULL = not yet onboarded.';
comment on column public.profiles.role is
  'Self-identified role during onboarding: individual, team_lead, agency, developer.';

-- Mark all existing users as already onboarded so they skip the flow
update public.profiles
set onboarding_completed_at = created_at
where onboarding_completed_at is null;
