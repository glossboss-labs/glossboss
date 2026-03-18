/**
 * URL Glossary Fetcher
 *
 * Fetches a glossary CSV from an arbitrary URL via edge function proxy (CORS bypass).
 */

import type { Glossary } from './types';
import { parseGlossaryCSV, isValidGlossaryCSV } from './csv-parser';
import { invokeSupabaseFunction, readSupabaseFunctionError } from '@/lib/supabase/client';
import type { FetchResult } from './wp-fetcher';

const FETCH_TIMEOUT_MS = 30000;

/**
 * Fetch a glossary CSV from a URL via edge function proxy.
 *
 * @param url - URL to a CSV glossary file
 * @returns Fetch result with glossary data or error
 */
export async function fetchGlossaryFromUrl(url: string): Promise<FetchResult> {
  if (!url.trim()) {
    return { glossary: null, fromCache: false, error: 'No URL specified' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const { data, error, response } = await invokeSupabaseFunction<{
      ok?: boolean;
      csv?: string;
      error?: string;
      message?: string;
    }>('fetch-glossary-url', {
      featureLabel: 'URL glossary loading',
      signal: controller.signal,
      body: { url: url.trim() },
    });

    clearTimeout(timeoutId);

    if (error) {
      const errorData = await readSupabaseFunctionError(response);
      return {
        glossary: null,
        fromCache: false,
        error:
          (typeof errorData.message === 'string' && errorData.message) ||
          (typeof errorData.error === 'string' && errorData.error) ||
          `HTTP ${response?.status ?? 'unknown'}`,
      };
    }

    if (!data || data.ok === false || data.error) {
      return {
        glossary: null,
        fromCache: false,
        error: data?.message || data?.error || 'Glossary URL fetch returned ok:false',
      };
    }

    const csvText = data.csv;
    if (!csvText || typeof csvText !== 'string') {
      return { glossary: null, fromCache: false, error: 'No CSV data returned' };
    }

    if (!isValidGlossaryCSV(csvText)) {
      return { glossary: null, fromCache: false, error: 'Response is not a valid glossary CSV' };
    }

    const parseResult = parseGlossaryCSV(csvText);
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
      project: 'url',
      entries: parseResult.entries,
      fetchedAt: new Date().toISOString(),
    };

    return { glossary, fromCache: false };
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'Glossary URL fetch timed out.'
        : 'Failed to fetch glossary from URL.';
    return { glossary: null, fromCache: false, error: message };
  }
}
