/**
 * Unified Glossary Loader
 *
 * Dispatches to the correct fetcher based on a project language's glossary_source config.
 * Used by ProjectEditor to load the glossary for a cloud project language.
 */

import type { ProjectLanguageRow } from '@/lib/projects/types';
import type { FetchResult } from './wp-fetcher';
import { fetchWPGlossary } from './wp-fetcher';
import { fetchGlossaryFromUrl } from './url-fetcher';
import { fetchGlossaryFromRepo } from './repo-fetcher';

/**
 * Load glossary for a project language based on its configured source.
 *
 * - `'wordpress'` → fetch from translate.wordpress.org by locale
 * - `'repo'` → fetch CSV from the language's linked repository
 * - `'url'` → fetch CSV from glossary_url via edge function
 * - `null` → no glossary configured
 */
export async function loadGlossaryForLanguage(language: ProjectLanguageRow): Promise<FetchResult> {
  switch (language.glossary_source) {
    case 'wordpress':
      return fetchWPGlossary(language.locale);

    case 'repo': {
      if (
        !language.glossary_repo_provider ||
        !language.glossary_repo_owner ||
        !language.glossary_repo_name
      ) {
        return { glossary: null, fromCache: false, error: 'No glossary repository linked' };
      }
      if (!language.glossary_repo_file_path) {
        return { glossary: null, fromCache: false, error: 'No glossary file path configured' };
      }
      return fetchGlossaryFromRepo(
        language.glossary_repo_provider,
        language.glossary_repo_owner,
        language.glossary_repo_name,
        language.glossary_repo_branch ?? 'main',
        language.glossary_repo_file_path,
      );
    }

    case 'url': {
      if (!language.glossary_url) {
        return { glossary: null, fromCache: false, error: 'No glossary URL configured' };
      }
      return fetchGlossaryFromUrl(language.glossary_url);
    }

    default:
      return { glossary: null, fromCache: false };
  }
}
