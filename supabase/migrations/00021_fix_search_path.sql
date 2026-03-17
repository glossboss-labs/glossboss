-- Fix "Function Search Path Mutable" security advisor warnings.
-- Adds SET search_path = '' to functions that were missing it.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.entry_translation_status(
  p_msgstr text,
  p_msgstr_plural text[],
  p_flags text[]
) returns text
language sql
immutable
set search_path = ''
as $$
  select case
    -- Plural entry: untranslated if array is empty or any form is blank/null
    when p_msgstr_plural is not null and (
      cardinality(p_msgstr_plural) = 0
      or exists (
        select 1 from unnest(p_msgstr_plural) as f
        where f is null or trim(f) = ''
      )
    ) then 'untranslated'
    -- Singular entry: untranslated if msgstr is blank
    when p_msgstr_plural is null and trim(p_msgstr) = '' then 'untranslated'
    -- Fuzzy
    when 'fuzzy' = any(p_flags) then 'fuzzy'
    else 'translated'
  end;
$$;

create or replace function public.plan_limit(p_plan text, p_resource text)
returns integer
language sql
immutable
set search_path = ''
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
