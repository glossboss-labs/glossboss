-- Lightweight trigger that logs string updates to a staging table
-- for batched digest notifications.
--
-- Does NOT create individual notifications — the notify-digest
-- edge function reads this table on a schedule and creates
-- grouped strings_updated notifications per project.

create or replace function public.log_string_update()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.notification_string_update_log
    (project_id, language_id, updated_by, update_count, first_at, last_at)
  values
    (new.project_id, new.language_id, auth.uid(), 1, now(), now())
  on conflict (project_id, language_id) do update set
    update_count = public.notification_string_update_log.update_count + 1,
    last_at = now(),
    updated_by = coalesce(auth.uid(), public.notification_string_update_log.updated_by);
  return new;
end;
$$;

-- Fire on translation updates (msgstr changed, flags changed)
create trigger on_project_entry_updated_for_digest
  after update on public.project_entries
  for each row
  when (
    old.msgstr is distinct from new.msgstr
    or old.msgstr_plural is distinct from new.msgstr_plural
    or old.flags is distinct from new.flags
  )
  execute function public.log_string_update();

-- Fire on new entries inserted
create trigger on_project_entry_inserted_for_digest
  after insert on public.project_entries
  for each row
  execute function public.log_string_update();
