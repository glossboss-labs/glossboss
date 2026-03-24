-- Fix ambiguous create_notification overload resolution.
--
-- We support both:
--   create_notification(recipient, type, data)
--   create_notification(recipient, type, data, project_id)
--
-- The 4-arg variant previously had a default for p_project_id, which made
-- 3-arg calls ambiguous once both overloads existed.

drop function if exists public.create_notification(uuid, text, jsonb, uuid);

create function public.create_notification(
  p_recipient_id uuid,
  p_type text,
  p_data jsonb,
  p_project_id uuid
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

create or replace function public.create_notification(
  p_recipient_id uuid,
  p_type text,
  p_data jsonb default '{}'
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
begin
  return public.create_notification(
    p_recipient_id,
    p_type,
    p_data,
    null::uuid
  );
end;
$$;
