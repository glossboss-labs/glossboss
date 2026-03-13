export type WordPressProjectType = 'plugin' | 'theme';

export interface WordPressProjectSearchResult {
  slug: string;
  name: string;
  version: string | null;
}

const DEFAULT_LIMIT = 8;

function clampLimit(limit: number): number {
  return Math.max(1, Math.min(limit, DEFAULT_LIMIT));
}

export function buildWordPressProjectSearchUrl(
  projectType: WordPressProjectType,
  query: string,
  limit: number = DEFAULT_LIMIT,
): string {
  const url = new URL(
    projectType === 'theme'
      ? 'https://api.wordpress.org/themes/info/1.2/'
      : 'https://api.wordpress.org/plugins/info/1.2/',
  );

  url.searchParams.set('action', projectType === 'theme' ? 'query_themes' : 'query_plugins');
  url.searchParams.set('request[search]', query.trim());
  url.searchParams.set('request[page]', '1');
  url.searchParams.set('request[per_page]', String(clampLimit(limit)));

  return url.toString();
}

export function parseWordPressProjectSearchResults(
  projectType: WordPressProjectType,
  payload: unknown,
): WordPressProjectSearchResult[] {
  const items =
    projectType === 'theme'
      ? (payload as { themes?: unknown[] } | null | undefined)?.themes
      : (payload as { plugins?: unknown[] } | null | undefined)?.plugins;

  if (!Array.isArray(items)) {
    return [];
  }

  const results = new Map<string, WordPressProjectSearchResult>();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    const slug =
      typeof (item as { slug?: unknown }).slug === 'string'
        ? (item as { slug: string }).slug.trim().toLowerCase()
        : '';
    const name =
      typeof (item as { name?: unknown }).name === 'string'
        ? (item as { name: string }).name.trim()
        : '';
    const version =
      typeof (item as { version?: unknown }).version === 'string'
        ? (item as { version: string }).version.trim()
        : null;

    if (!slug || !name || results.has(slug)) continue;
    results.set(slug, { slug, name, version: version || null });
  }

  return Array.from(results.values());
}
