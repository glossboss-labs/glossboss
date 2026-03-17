-- Add custom translation instructions at org and project level.
--
-- Org instructions apply to all projects (e.g., "Always use formal register").
-- Per-language instructions override/extend for specific use cases.
-- Both are combined and sent to the LLM as additional context.

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS translation_instructions text NOT NULL DEFAULT '';

ALTER TABLE public.project_languages
  ADD COLUMN IF NOT EXISTS translation_instructions text NOT NULL DEFAULT '';
