-- Add website field to projects and organizations
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS website TEXT DEFAULT '';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS website TEXT DEFAULT '';
