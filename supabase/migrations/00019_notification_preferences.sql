-- Phase 7: Notification preferences, email queue, and string-update digest
--
-- Adds user-configurable notification preferences (global + per-project),
-- an email queue for edge-function delivery via Resend, and a staging table
-- for batched string-update digests.
--
-- Structure: tables → indexes → RLS → triggers → create_notification v2

-- ============================================================
-- 1. notification_preferences (global per-user)
-- ============================================================

create table public.notification_preferences (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  preferences   jsonb not null default '{}'::jsonb,
  digest_frequency text not null default 'daily'
                  check (digest_frequency in ('hourly', 'daily', 'weekly', 'off')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.notification_preferences is
  'Global per-user notification preferences. JSONB shape: { "<type>": { "in_app": bool, "email": bool } }';

-- ============================================================
-- 2. project_notification_preferences (per-project overrides)
-- ============================================================

create table public.project_notification_preferences (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  preferences   jsonb not null default '{}'::jsonb,
  digest_frequency text default null
                  check (digest_frequency is null or digest_frequency in ('hourly', 'daily', 'weekly', 'off')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, project_id)
);

comment on table public.project_notification_preferences is
  'Per-project notification overrides. null values inherit from global. digest_frequency null = inherit.';

-- ============================================================
-- 3. pending_notification_emails (queue for edge function)
-- ============================================================

create table public.pending_notification_emails (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  recipient_id    uuid not null references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now()
);

comment on table public.pending_notification_emails is
  'Email queue drained by the notify-email edge function. No user RLS — service role only.';

-- ============================================================
-- 4. notification_string_update_log (digest staging)
-- ============================================================

create table public.notification_string_update_log (
  project_id    uuid not null references public.projects (id) on delete cascade,
  language_id   uuid not null references public.project_languages (id) on delete cascade,
  updated_by    uuid references auth.users (id) on delete set null,
  update_count  int not null default 1,
  first_at      timestamptz not null default now(),
  last_at       timestamptz not null default now(),
  primary key (project_id, language_id)
);

comment on table public.notification_string_update_log is
  'Staging table for batched string-update digests. Deduped per (project, language).';

-- ============================================================
-- 5. Indexes
-- ============================================================

create index pending_emails_created_idx
  on public.pending_notification_emails (created_at);

create index project_notif_prefs_user_idx
  on public.project_notification_preferences (user_id);

-- ============================================================
-- 6. RLS
-- ============================================================

-- notification_preferences: users manage their own
alter table public.notification_preferences enable row level security;

create policy "Users can read own preferences"
  on public.notification_preferences for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own preferences"
  on public.notification_preferences for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own preferences"
  on public.notification_preferences for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- project_notification_preferences: users manage their own
alter table public.project_notification_preferences enable row level security;

create policy "Users can read own project prefs"
  on public.project_notification_preferences for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own project prefs"
  on public.project_notification_preferences for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own project prefs"
  on public.project_notification_preferences for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete own project prefs"
  on public.project_notification_preferences for delete to authenticated
  using (auth.uid() = user_id);

-- pending_notification_emails: service role only (edge function)
alter table public.pending_notification_emails enable row level security;

-- notification_string_update_log: service role only (triggers write, edge function reads)
alter table public.notification_string_update_log enable row level security;

-- ============================================================
-- 7. updated_at triggers (reuse existing set_updated_at)
-- ============================================================

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create trigger project_notification_preferences_set_updated_at
  before update on public.project_notification_preferences
  for each row execute function public.set_updated_at();

-- ============================================================
-- 8. Expand notifications type enum to include strings_updated
-- ============================================================

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'org_invite_received',
    'org_invite_accepted',
    'project_invite_received',
    'project_invite_accepted',
    'project_member_added',
    'org_member_added',
    'review_status_changed',
    'review_comment_added',
    'strings_updated'
  ));

-- ============================================================
-- 9. Upgrade create_notification to check prefs and queue emails
-- ============================================================

create or replace function public.create_notification(
  p_recipient_id uuid,
  p_type text,
  p_data jsonb default '{}',
  p_project_id uuid default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_caller uuid;
  v_global_prefs jsonb;
  v_project_prefs jsonb;
  v_in_app boolean;
  v_email boolean;
begin
  -- Don't notify yourself
  v_caller := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  if p_recipient_id = v_caller then
    return null;
  end if;

  -- Resolve global preferences for this type
  select preferences -> p_type into v_global_prefs
  from public.notification_preferences
  where user_id = p_recipient_id;

  -- Resolve per-project overrides (if project provided)
  if p_project_id is not null then
    select preferences -> p_type into v_project_prefs
    from public.project_notification_preferences
    where user_id = p_recipient_id and project_id = p_project_id;
  end if;

  -- Three-state resolution: project_pref ?? global_pref ?? default(true)
  v_in_app := coalesce(
    (v_project_prefs ->> 'in_app')::boolean,
    (v_global_prefs ->> 'in_app')::boolean,
    true
  );
  v_email := coalesce(
    (v_project_prefs ->> 'email')::boolean,
    (v_global_prefs ->> 'email')::boolean,
    true
  );

  -- Create in-app notification if enabled
  if v_in_app then
    insert into public.notifications (recipient_id, type, data)
    values (p_recipient_id, p_type, p_data)
    returning id into v_id;
  end if;

  -- Queue email if enabled (create notification row if we didn't already)
  if v_email then
    if v_id is null then
      insert into public.notifications (recipient_id, type, data)
      values (p_recipient_id, p_type, p_data)
      returning id into v_id;
    end if;

    insert into public.pending_notification_emails (notification_id, recipient_id)
    values (v_id, p_recipient_id);
  end if;

  return v_id;
end;
$$;

-- ============================================================
-- 10. Update existing triggers to pass project_id where available
-- ============================================================

-- Project invite created
create or replace function public.notify_project_invite_created()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_recipient_id uuid;
  v_project_name text;
  v_inviter_name text;
begin
  select id into v_recipient_id
  from public.profiles where email = new.email;

  if v_recipient_id is null then return new; end if;

  select name into v_project_name
  from public.projects where id = new.project_id;

  select coalesce(full_name, email) into v_inviter_name
  from public.profiles where id = new.invited_by;

  perform public.create_notification(
    v_recipient_id,
    'project_invite_received',
    jsonb_build_object(
      'project_id', new.project_id,
      'project_name', coalesce(v_project_name, ''),
      'invite_token', new.token,
      'inviter_name', coalesce(v_inviter_name, ''),
      'role', new.role
    ),
    new.project_id
  );
  return new;
end;
$$;

-- Project invite accepted
create or replace function public.notify_project_invite_accepted()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_project_name text;
  v_accepter_name text;
begin
  if old.accepted_at is not null or new.accepted_at is null then return new; end if;

  select name into v_accepter_name
  from public.profiles where id = new.accepted_by;

  select name into v_project_name
  from public.projects where id = new.project_id;

  if new.invited_by is not null then
    perform public.create_notification(
      new.invited_by,
      'project_invite_accepted',
      jsonb_build_object(
        'project_id', new.project_id,
        'project_name', coalesce(v_project_name, ''),
        'accepter_name', coalesce(v_accepter_name, ''),
        'accepter_id', new.accepted_by
      ),
      new.project_id
    );
  end if;
  return new;
end;
$$;

-- Project member added
create or replace function public.notify_project_member_added()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_project_name text;
begin
  select name into v_project_name
  from public.projects where id = new.project_id;

  perform public.create_notification(
    new.user_id,
    'project_member_added',
    jsonb_build_object(
      'project_id', new.project_id,
      'project_name', coalesce(v_project_name, ''),
      'role', new.role
    ),
    new.project_id
  );
  return new;
end;
$$;

-- Review status changed
create or replace function public.notify_review_status_changed()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_project_name text;
  v_member record;
begin
  if old.review_status is not distinct from new.review_status then return new; end if;

  select p.name into v_project_name
  from public.projects p where p.id = new.project_id;

  for v_member in
    select pm.user_id from public.project_members pm
    where pm.project_id = new.project_id
      and pm.role in ('admin', 'maintainer', 'reviewer')
  loop
    perform public.create_notification(
      v_member.user_id,
      'review_status_changed',
      jsonb_build_object(
        'project_id', new.project_id,
        'project_name', coalesce(v_project_name, ''),
        'entry_id', new.id,
        'language_id', new.language_id,
        'msgid', left(new.msgid, 100),
        'old_status', old.review_status,
        'new_status', new.review_status
      ),
      new.project_id
    );
  end loop;
  return new;
end;
$$;

-- Review comment added
create or replace function public.notify_review_comment_added()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_old_len int;
  v_new_len int;
  v_new_comment jsonb;
  v_project_name text;
  v_member record;
begin
  v_old_len := coalesce(jsonb_array_length(old.review_comments), 0);
  v_new_len := coalesce(jsonb_array_length(new.review_comments), 0);

  if v_new_len <= v_old_len then return new; end if;

  v_new_comment := new.review_comments -> (v_new_len - 1);

  select p.name into v_project_name
  from public.projects p where p.id = new.project_id;

  for v_member in
    select pm.user_id from public.project_members pm
    where pm.project_id = new.project_id
      and pm.role in ('admin', 'maintainer', 'reviewer')
  loop
    perform public.create_notification(
      v_member.user_id,
      'review_comment_added',
      jsonb_build_object(
        'project_id', new.project_id,
        'project_name', coalesce(v_project_name, ''),
        'entry_id', new.id,
        'language_id', new.language_id,
        'msgid', left(new.msgid, 100),
        'comment_author', v_new_comment ->> 'author',
        'comment_message', left(v_new_comment ->> 'message', 200)
      ),
      new.project_id
    );
  end loop;
  return new;
end;
$$;
