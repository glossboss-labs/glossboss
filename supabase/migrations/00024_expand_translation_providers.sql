-- Expand translation provider CHECK constraints to support new LLM providers.
--
-- Adds: openai, anthropic, google (replaces gemini), mistral, deepseek, custom.
-- The frontend migrates stored 'gemini' → 'google' on read; both remain valid in DB.

-- ============================================================
-- 1. organization_settings: expand provider CHECK
-- ============================================================

ALTER TABLE public.organization_settings
  DROP CONSTRAINT IF EXISTS organization_settings_default_translation_provider_check;

ALTER TABLE public.organization_settings
  ADD CONSTRAINT organization_settings_default_translation_provider_check
  CHECK (default_translation_provider IN (
    'deepl', 'azure', 'gemini',
    'openai', 'anthropic', 'google', 'mistral', 'deepseek', 'custom'
  ));

-- ============================================================
-- 2. shared_credentials: expand provider CHECK
-- ============================================================

ALTER TABLE public.shared_credentials
  DROP CONSTRAINT IF EXISTS shared_credentials_provider_check;

ALTER TABLE public.shared_credentials
  ADD CONSTRAINT shared_credentials_provider_check
  CHECK (provider IN (
    'deepl', 'azure', 'gemini',
    'openai', 'anthropic', 'google', 'mistral', 'deepseek', 'custom',
    'elevenlabs'
  ));

-- ============================================================
-- 3. Annotate project_languages.translation_provider (text, no CHECK)
-- ============================================================

COMMENT ON COLUMN public.project_languages.translation_provider
  IS 'TranslationProviderId: deepl | azure | openai | anthropic | google | mistral | deepseek | custom';
