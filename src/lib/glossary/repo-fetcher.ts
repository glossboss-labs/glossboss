/**
 * Repository Glossary Fetcher
 *
 * Fetches a glossary CSV from a linked GitHub/GitLab repository.
 * Reuses the existing repo-sync client infrastructure.
 */

import type { Glossary } from './types';
import { parseGlossaryCSV, isValidGlossaryCSV } from './csv-parser';
import { createRepoClient } from '@/lib/repo-sync/client';
import type { FetchResult } from './wp-fetcher';

/**
 * Fetch a glossary CSV from a linked repository.
 *
 * @param provider - 'github' or 'gitlab'
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name
 * @param filePath - Path to the glossary CSV file within the repo
 * @returns Fetch result with glossary data or error
 */
export async function fetchGlossaryFromRepo(
  provider: 'github' | 'gitlab',
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
): Promise<FetchResult> {
  if (!filePath.trim()) {
    return { glossary: null, fromCache: false, error: 'No file path specified' };
  }

  try {
    const client = createRepoClient(provider);
    const file = await client.getFileContent(owner, repo, branch, filePath.trim());

    if (!file.content) {
      return { glossary: null, fromCache: false, error: 'File is empty' };
    }

    if (!isValidGlossaryCSV(file.content)) {
      return {
        glossary: null,
        fromCache: false,
        error: 'File does not appear to be a valid glossary CSV',
      };
    }

    const parseResult = parseGlossaryCSV(file.content);
    if (parseResult.entries.length === 0) {
      return {
        glossary: null,
        fromCache: false,
        error: parseResult.errors[0] || 'No entries found in glossary CSV',
      };
    }

    const glossary: Glossary = {
      sourceLocale: parseResult.sourceLocale || 'en',
      targetLocale: parseResult.targetLocale || '',
      project: `${provider}:${owner}/${repo}`,
      entries: parseResult.entries,
      fetchedAt: new Date().toISOString(),
    };

    return { glossary, fromCache: false };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to fetch glossary from repository.';
    return { glossary: null, fromCache: false, error: message };
  }
}
