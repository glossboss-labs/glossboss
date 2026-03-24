-- Add CSV and XLIFF to the allowed source_format values
ALTER TABLE projects
  DROP CONSTRAINT projects_source_format_check,
  ADD CONSTRAINT projects_source_format_check
    CHECK (source_format IN ('po', 'i18next', 'csv', 'xliff'));
