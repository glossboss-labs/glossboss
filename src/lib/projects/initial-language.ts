import type { ProjectLanguageInsert, ProjectLanguageRow, ProjectLanguageUpdate } from './types';

interface CreateOrReuseInitialProjectLanguageDeps {
  createLanguage: (insert: ProjectLanguageInsert) => Promise<ProjectLanguageRow>;
  getLanguageByLocale: (projectId: string, locale: string) => Promise<ProjectLanguageRow | null>;
  updateLanguage: (id: string, updates: ProjectLanguageUpdate) => Promise<ProjectLanguageRow>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isProjectLanguageLocaleConflict(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  return (
    error.code === '23505' &&
    typeof error.message === 'string' &&
    error.message.includes('project_languages_project_id_locale_key')
  );
}

function toProjectLanguageUpdate(insert: ProjectLanguageInsert): ProjectLanguageUpdate {
  const { project_id: _projectId, ...updates } = insert;
  return updates;
}

export async function createOrReuseInitialProjectLanguage(
  insert: ProjectLanguageInsert,
  deps: CreateOrReuseInitialProjectLanguageDeps,
): Promise<ProjectLanguageRow> {
  try {
    return await deps.createLanguage(insert);
  } catch (error) {
    if (!isProjectLanguageLocaleConflict(error)) {
      throw error;
    }

    const existing = await deps.getLanguageByLocale(insert.project_id, insert.locale);
    if (!existing) {
      throw error;
    }

    return await deps.updateLanguage(existing.id, toProjectLanguageUpdate(insert));
  }
}
