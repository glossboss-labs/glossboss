import { describe, expect, it, vi } from 'vitest';
import {
  createOrReuseInitialProjectLanguage,
  isProjectLanguageLocaleConflict,
} from './initial-language';
import type { ProjectLanguageInsert, ProjectLanguageRow } from './types';

const languageInsert: ProjectLanguageInsert = {
  project_id: 'project-1',
  locale: 'nl',
  source_filename: 'messages.po',
  po_header: { Language: 'nl' },
  wp_locale: null,
  repo_provider: null,
  repo_owner: null,
  repo_name: null,
  repo_branch: null,
  repo_file_path: null,
  repo_default_branch: null,
  glossary_source: null,
  glossary_url: null,
  glossary_repo_provider: null,
  glossary_repo_owner: null,
  glossary_repo_name: null,
  glossary_repo_branch: null,
  glossary_repo_file_path: null,
  glossary_repo_default_branch: null,
  translation_provider: null,
  translation_instructions: '',
};

const createdLanguage: ProjectLanguageRow = {
  id: 'lang-1',
  project_id: 'project-1',
  locale: 'nl',
  source_filename: 'messages.po',
  po_header: { Language: 'nl' },
  wp_locale: null,
  repo_provider: null,
  repo_owner: null,
  repo_name: null,
  repo_branch: null,
  repo_file_path: null,
  repo_default_branch: null,
  glossary_source: null,
  glossary_url: null,
  glossary_repo_provider: null,
  glossary_repo_owner: null,
  glossary_repo_name: null,
  glossary_repo_branch: null,
  glossary_repo_file_path: null,
  glossary_repo_default_branch: null,
  glossary_enforcement: false,
  translation_provider: null,
  translation_instructions: '',
  stats_total: 0,
  stats_translated: 0,
  stats_fuzzy: 0,
  stats_untranslated: 0,
  created_at: '2026-03-20T00:00:00.000Z',
  updated_at: '2026-03-20T00:00:00.000Z',
};

describe('createOrReuseInitialProjectLanguage', () => {
  it('creates the language when there is no conflict', async () => {
    const createLanguage = vi.fn().mockResolvedValue(createdLanguage);

    const result = await createOrReuseInitialProjectLanguage(languageInsert, {
      createLanguage,
      getLanguageByLocale: vi.fn(),
      updateLanguage: vi.fn(),
    });

    expect(result).toEqual(createdLanguage);
    expect(createLanguage).toHaveBeenCalledWith(languageInsert);
  });

  it('reuses and updates an existing language on locale conflict', async () => {
    const existingLanguage = { ...createdLanguage, id: 'lang-existing', source_filename: null };
    const createLanguage = vi.fn().mockRejectedValue({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "project_languages_project_id_locale_key"',
    });
    const getLanguageByLocale = vi.fn().mockResolvedValue(existingLanguage);
    const updateLanguage = vi.fn().mockResolvedValue(createdLanguage);

    const result = await createOrReuseInitialProjectLanguage(languageInsert, {
      createLanguage,
      getLanguageByLocale,
      updateLanguage,
    });

    expect(getLanguageByLocale).toHaveBeenCalledWith('project-1', 'nl');
    expect(updateLanguage).toHaveBeenCalledWith('lang-existing', {
      locale: 'nl',
      source_filename: 'messages.po',
      po_header: { Language: 'nl' },
      wp_locale: null,
      repo_provider: null,
      repo_owner: null,
      repo_name: null,
      repo_branch: null,
      repo_file_path: null,
      repo_default_branch: null,
      glossary_source: null,
      glossary_url: null,
      glossary_repo_provider: null,
      glossary_repo_owner: null,
      glossary_repo_name: null,
      glossary_repo_branch: null,
      glossary_repo_file_path: null,
      glossary_repo_default_branch: null,
      translation_provider: null,
      translation_instructions: '',
    });
    expect(result).toEqual(createdLanguage);
  });

  it('rethrows non-conflict errors', async () => {
    const error = new Error('boom');

    await expect(
      createOrReuseInitialProjectLanguage(languageInsert, {
        createLanguage: vi.fn().mockRejectedValue(error),
        getLanguageByLocale: vi.fn(),
        updateLanguage: vi.fn(),
      }),
    ).rejects.toThrow(error);
  });
});

describe('isProjectLanguageLocaleConflict', () => {
  it('matches the project-language locale unique violation', () => {
    expect(
      isProjectLanguageLocaleConflict({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "project_languages_project_id_locale_key"',
      }),
    ).toBe(true);
  });
});
