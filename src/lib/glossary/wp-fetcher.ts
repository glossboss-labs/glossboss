/**
 * WordPress.org Glossary Fetcher
 *
 * Fetches glossary CSV exports via edge function proxy.
 * Includes caching to reduce network requests.
 *
 * @see https://translate.wordpress.org/locale/{lang}/default/glossary/-export/
 */

import type { Glossary } from './types';
import { parseGlossaryCSV, isValidGlossaryCSV } from './csv-parser';
import { invokeSupabaseFunction, readSupabaseFunctionError } from '@/lib/supabase/client';
import { WP_GLOSSARY_CACHE_PREFIX } from '@/lib/constants/storage-keys';

/** Cache key prefix for localStorage */
const CACHE_KEY_PREFIX = WP_GLOSSARY_CACHE_PREFIX;

/** Cache TTL in milliseconds (24 hours) */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Fetch timeout in milliseconds */
const FETCH_TIMEOUT_MS = 30000;

/** Result of a glossary fetch operation */
export interface FetchResult {
  /** The fetched glossary (null if failed) */
  glossary: Glossary | null;

  /** Whether this came from cache */
  fromCache: boolean;

  /** Error message if fetch failed */
  error?: string;
}

/** Cached glossary data structure */
interface CachedGlossary {
  glossary: Glossary;
  timestamp: number;
}

/**
 * Build the WordPress.org glossary URL for a locale (for display/linking)
 */
export function buildGlossaryURL(locale: string): string {
  return `https://translate.wordpress.org/locale/${locale.toLowerCase()}/default/glossary/-export/`;
}

/**
 * Fetch glossary from WordPress.org via edge function proxy
 *
 * @param locale - Language code (e.g., 'nl', 'de', 'fr')
 * @param forceRefresh - Skip cache and fetch fresh data
 * @returns Fetch result with glossary data or error
 */
export async function fetchWPGlossary(locale: string, forceRefresh = false): Promise<FetchResult> {
  const normalizedLocale = locale.toLowerCase().trim();

  if (!normalizedLocale) {
    return { glossary: null, fromCache: false, error: 'No locale specified' };
  }

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = getCachedGlossary(normalizedLocale);
    if (cached) {
      return { glossary: cached, fromCache: true };
    }
  }

  // Fetch via edge function
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const { data, error, response } = await invokeSupabaseFunction<{
      ok?: boolean;
      csv?: string;
      error?: string;
      message?: string;
    }>('wp-glossary', {
      featureLabel: 'WordPress glossary loading',
      signal: controller.signal,
      body: { locale: normalizedLocale },
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
        error: data?.message || data?.error || 'Glossary backend returned ok:false',
      };
    }

    const csvText = data.csv ?? '';

    // Validate it looks like a glossary CSV
    if (!isValidGlossaryCSV(csvText)) {
      return {
        glossary: null,
        fromCache: false,
        error: 'Response does not appear to be a valid glossary CSV',
      };
    }

    // Parse the CSV
    const parseResult = parseGlossaryCSV(csvText);

    if (parseResult.entries.length === 0 && parseResult.errorCount > 0) {
      return {
        glossary: null,
        fromCache: false,
        error: `Failed to parse glossary: ${parseResult.errors[0] ?? 'Unknown error'}`,
      };
    }

    // Build glossary object
    const glossary: Glossary = {
      sourceLocale: 'en',
      targetLocale: normalizedLocale,
      project: 'wordpress',
      entries: parseResult.entries,
      fetchedAt: new Date().toISOString(),
    };

    // Cache the result
    cacheGlossary(normalizedLocale, glossary);

    return { glossary, fromCache: false };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { glossary: null, fromCache: false, error: 'Request timed out' };
    }

    // Network error - try to return cached version if available
    const cached = getCachedGlossary(normalizedLocale);
    if (cached) {
      return {
        glossary: cached,
        fromCache: true,
        error: 'Network error, using cached version',
      };
    }

    return {
      glossary: null,
      fromCache: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/**
 * Get cached glossary for a locale
 */
function getCachedGlossary(locale: string): Glossary | null {
  try {
    const key = `${CACHE_KEY_PREFIX}${locale}`;
    const cached = localStorage.getItem(key);

    if (!cached) return null;

    const data: CachedGlossary = JSON.parse(cached);

    // Check if expired
    if (Date.now() - data.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return data.glossary;
  } catch {
    return null;
  }
}

/**
 * Cache a glossary in localStorage
 */
function cacheGlossary(locale: string, glossary: Glossary): void {
  try {
    const key = `${CACHE_KEY_PREFIX}${locale}`;
    const data: CachedGlossary = {
      glossary,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to cache glossary:', err);
  }
}

function getMatchingStorageKeys(prefix: string): string[] {
  const keys: string[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) {
      keys.push(key);
    }
  }

  return keys;
}

/**
 * Clear cached glossary for a locale (or all if no locale specified)
 */
export function clearWPGlossaryCache(locale?: string): void {
  if (locale) {
    const key = `${CACHE_KEY_PREFIX}${locale.toLowerCase()}`;
    localStorage.removeItem(key);
  } else {
    const keys = getMatchingStorageKeys(CACHE_KEY_PREFIX);
    keys.forEach((k) => localStorage.removeItem(k));
  }
}

/**
 * Get list of cached glossary locales
 */
export function getCachedWPGlossaryLocales(): string[] {
  const keys = getMatchingStorageKeys(CACHE_KEY_PREFIX);
  return keys.map((k) => k.replace(CACHE_KEY_PREFIX, ''));
}

/**
 * Check if a glossary is cached for a locale
 */
export function hasGlossaryCache(locale: string): boolean {
  return getCachedGlossary(locale.toLowerCase()) !== null;
}
