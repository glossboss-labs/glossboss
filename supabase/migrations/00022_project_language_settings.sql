-- Per-language glossary configuration and translation provider override.
-- Glossary source/config stored per-language so it persists across devices
-- and is visible to all project members.

ALTER TABLE public.project_languages
  ADD COLUMN glossary_source text
    CHECK (glossary_source IN ('wordpress', 'repo', 'url')),
  ADD COLUMN glossary_url text,
  ADD COLUMN glossary_repo_provider text
    CHECK (glossary_repo_provider IN ('github', 'gitlab')),
  ADD COLUMN glossary_repo_owner text,
  ADD COLUMN glossary_repo_name text,
  ADD COLUMN glossary_repo_branch text,
  ADD COLUMN glossary_repo_file_path text,
  ADD COLUMN glossary_repo_default_branch text,
  ADD COLUMN glossary_enforcement boolean NOT NULL DEFAULT true,
  ADD COLUMN translation_provider text
    CHECK (translation_provider IN ('deepl', 'azure', 'gemini'));
