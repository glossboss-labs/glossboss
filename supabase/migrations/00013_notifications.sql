-- Phase 6: In-app notifications
--
-- Creates a notifications table with RLS, Realtime publication,
-- and database triggers that create notifications from source events
-- (invites, member additions, review changes).
--
-- Structure: table → indexes → RLS → realtime → helper → triggers

-- ============================================================
-- 1. notifications table
-- ============================================================

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references auth.users (id) on delete cascade,
  type          text not null
                  check (type in (
                    'org_invite_received',
                    'org_invite_accepted',
                    'project_invite_received',
                    'project_invite_accepted',
                    'project_member_added',
                    'org_member_added',
                    'review_status_changed',
                    'review_comment_added'
                  )),
  data          jsonb not null default '{}',
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.notifications is
  'In-app notifications delivered via Supabase Realtime postgres_changes.';

-- ============================================================
-- 2. Indexes
-- ============================================================

-- Primary query: unread notifications for a user, newest first
create index notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

-- All notifications for a user (paginated list)
create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

-- ============================================================
-- 3. RLS
-- ============================================================

alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = recipient_id);

create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create policy "Users can delete own notifications"
  on public.notifications for delete
  to authenticated
  using (auth.uid() = recipient_id);

-- No INSERT policy — notifications are created by SECURITY DEFINER triggers only.

-- ============================================================
-- 4. Realtime publication
-- ============================================================

alter publication supabase_realtime add table public.notifications;

-- ============================================================
-- 5. Helper: create_notification
-- ============================================================

create or replace function public.create_notification(
  p_recipient_id uuid,
  p_type text,
  p_data jsonb default '{}'
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_caller uuid;
begin
  -- Don't notify yourself
  v_caller := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  if p_recipient_id = v_caller then
    return null;
  end if;

  insert into public.notifications (recipient_id, type, data)
  values (p_recipient_id, p_type, p_data)
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================
-- 6. Trigger: org invite created → notify invitee
-- ============================================================

create or replace function public.notify_org_invite_created()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_recipient_id uuid;
  v_org_name text;
  v_org_slug text;
  v_inviter_name text;
begin
  -- Find recipient by email
  select id into v_recipient_id
  from public.profiles where email = new.email;

  if v_recipient_id is null then return new; end if;

  select name, slug into v_org_name, v_org_slug
  from public.organizations where id = new.organization_id;

  select coalesce(full_name, email) into v_inviter_name
  from public.profiles where id = new.invited_by;

  perform public.create_notification(
    v_recipient_id,
    'org_invite_received',
    jsonb_build_object(
      'organization_id', new.organization_id,
      'organization_name', coalesce(v_org_name, ''),
      'organization_slug', coalesce(v_org_slug, ''),
      'invite_token', new.token,
      'inviter_name', coalesce(v_inviter_name, ''),
      'role', new.role
    )
  );
  return new;
end;
$$;

create trigger on_org_invite_created
  after insert on public.invites
  for each row execute function public.notify_org_invite_created();

-- ============================================================
-- 7. Trigger: org invite accepted → notify inviter
-- ============================================================

create or replace function public.notify_org_invite_accepted()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_org_name text;
  v_org_slug text;
  v_accepter_name text;
begin
  if old.accepted_at is not null or new.accepted_at is null then return new; end if;

  select name, slug into v_org_name, v_org_slug
  from public.organizations where id = new.organization_id;

  select coalesce(full_name, email) into v_accepter_name
  from public.profiles where id = new.accepted_by;

  if new.invited_by is not null then
    perform public.create_notification(
      new.invited_by,
      'org_invite_accepted',
      jsonb_build_object(
        'organization_id', new.organization_id,
        'organization_name', coalesce(v_org_name, ''),
        'organization_slug', coalesce(v_org_slug, ''),
        'accepter_name', coalesce(v_accepter_name, ''),
        'accepter_id', new.accepted_by
      )
    );
  end if;
  return new;
end;
$$;

create trigger on_org_invite_accepted
  after update on public.invites
  for each row
  when (old.accepted_at is null and new.accepted_at is not null)
  execute function public.notify_org_invite_accepted();

-- ============================================================
-- 8. Trigger: project invite created → notify invitee
-- ============================================================

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
    )
  );
  return new;
end;
$$;

create trigger on_project_invite_created
  after insert on public.project_invites
  for each row execute function public.notify_project_invite_created();

-- ============================================================
-- 9. Trigger: project invite accepted → notify inviter
-- ============================================================

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
      )
    );
  end if;
  return new;
end;
$$;

create trigger on_project_invite_accepted
  after update on public.project_invites
  for each row
  when (old.accepted_at is null and new.accepted_at is not null)
  execute function public.notify_project_invite_accepted();

-- ============================================================
-- 10. Trigger: project member added → notify new member
-- ============================================================

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
    )
  );
  return new;
end;
$$;

create trigger on_project_member_added
  after insert on public.project_members
  for each row execute function public.notify_project_member_added();

-- ============================================================
-- 11. Trigger: org member added → notify new member
-- ============================================================

create or replace function public.notify_org_member_added()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_org_name text;
  v_org_slug text;
begin
  select name, slug into v_org_name, v_org_slug
  from public.organizations where id = new.organization_id;

  perform public.create_notification(
    new.user_id,
    'org_member_added',
    jsonb_build_object(
      'organization_id', new.organization_id,
      'organization_name', coalesce(v_org_name, ''),
      'organization_slug', coalesce(v_org_slug, ''),
      'role', new.role
    )
  );
  return new;
end;
$$;

create trigger on_org_member_added
  after insert on public.organization_members
  for each row execute function public.notify_org_member_added();

-- ============================================================
-- 12. Trigger: review status changed → notify reviewer+ members
-- ============================================================

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
      )
    );
  end loop;
  return new;
end;
$$;

create trigger on_review_status_changed
  after update on public.project_entries
  for each row
  when (old.review_status is distinct from new.review_status)
  execute function public.notify_review_status_changed();

-- ============================================================
-- 13. Trigger: review comment added → notify reviewer+ members
-- ============================================================

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
      )
    );
  end loop;
  return new;
end;
$$;

create trigger on_review_comment_added
  after update on public.project_entries
  for each row
  when (
    coalesce(jsonb_array_length(new.review_comments), 0)
    > coalesce(jsonb_array_length(old.review_comments), 0)
  )
  execute function public.notify_review_comment_added();
