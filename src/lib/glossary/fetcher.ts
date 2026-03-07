/**
 * WordPress Glossary Fetcher
 *
 * Fetches glossary data from WordPress translate API via Edge Function.
 *
 * TODO: Implement caching strategy
 * - Cache glossaries in localStorage
 * - Refresh periodically or on-demand
 */

import type { Glossary, FetchGlossaryRequest, FetchGlossaryResponse } from './types';

/** Edge function URL for glossary fetching */
const GLOSSARY_FUNCTION_URL = '/functions/v1/fetch-glossary';

/** Cache key prefix */
const CACHE_KEY_PREFIX = 'po-editor-glossary-';

/** Cache TTL in milliseconds (24 hours) */
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Fetch glossary from WordPress translate API
 *
 * @param request - Fetch request with locale and optional project
 * @returns Glossary data
 */
export async function fetchGlossary(request: FetchGlossaryRequest): Promise<FetchGlossaryResponse> {
  const { locale, project = 'wp' } = request;

  // Check cache first
  const cached = getCachedGlossary(locale, project);
  if (cached) {
    return { glossary: cached, cached: true };
  }

  // Fetch from edge function
  const response = await fetch(GLOSSARY_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ locale, project }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch glossary: ${response.status}`);
  }

  const glossary: Glossary = await response.json();

  // Cache the result
  cacheGlossary(locale, project, glossary);

  return { glossary, cached: false };
}

/**
 * Get cached glossary if available and not expired
 */
function getCachedGlossary(locale: string, project: string): Glossary | null {
  try {
    const key = `${CACHE_KEY_PREFIX}${project}-${locale}`;
    const cached = localStorage.getItem(key);

    if (!cached) return null;

    const { glossary, timestamp } = JSON.parse(cached);

    // Check if expired
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }

    return glossary;
  } catch {
    return null;
  }
}

/**
 * Cache glossary in localStorage
 */
function cacheGlossary(locale: string, project: string, glossary: Glossary): void {
  try {
    const key = `${CACHE_KEY_PREFIX}${project}-${locale}`;
    const data = JSON.stringify({
      glossary,
      timestamp: Date.now(),
    });
    localStorage.setItem(key, data);
  } catch (error) {
    // localStorage might be full or disabled
    console.warn('Failed to cache glossary:', error);
  }
}

/**
 * Clear cached glossary
 */
export function clearGlossaryCache(locale?: string, project?: string): void {
  if (locale && project) {
    const key = `${CACHE_KEY_PREFIX}${project}-${locale}`;
    localStorage.removeItem(key);
  } else {
    // Clear all glossary caches
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_KEY_PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
  }
}

/**
 * Get list of cached glossary locales
 */
export function getCachedLocales(): string[] {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_KEY_PREFIX));

  return keys.map((k) => {
    const parts = k.replace(CACHE_KEY_PREFIX, '').split('-');
    return parts[parts.length - 1];
  });
}
