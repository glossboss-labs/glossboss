/**
 * WordPress Plugin Source Code Fetcher
 *
 * Fetches source files and directory listings from plugins.svn.wordpress.org
 * via edge function proxy. Includes in-memory caching.
 */

/** Directory entry from SVN listing */
export interface DirectoryEntry {
  name: string;
  isDir: boolean;
}

/** In-memory cache for source files and directory listings */
const fileCache = new Map<string, string>();
const dirCache = new Map<string, DirectoryEntry[]>();

/** Fetch timeout in milliseconds */
const FETCH_TIMEOUT_MS = 30000;

/**
 * Get the edge function URL for wp-source
 */
function getEdgeFunctionUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Cloud Backend not configured');
  }
  return `${supabaseUrl}/functions/v1/wp-source`;
}

/**
 * Make a request to the wp-source edge function
 */
async function fetchFromEdge(body: Record<string, unknown>): Promise<Response> {
  const functionUrl = getEdgeFunctionUrl();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (anonKey) {
    headers['Authorization'] = `Bearer ${anonKey}`;
    headers['apikey'] = anonKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch a source file's contents.
 * Results are cached in memory.
 */
export async function fetchSourceFile(slug: string, path: string): Promise<string> {
  const cacheKey = `${slug}/${path}`;

  const cached = fileCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const response = await fetchFromEdge({ slug, path });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data.content as string;

  fileCache.set(cacheKey, content);
  return content;
}

/**
 * Fetch a directory listing.
 * Results are cached in memory.
 */
export async function fetchDirectoryListing(slug: string, path: string): Promise<DirectoryEntry[]> {
  const cacheKey = `${slug}/${path}`;

  const cached = dirCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetchFromEdge({ slug, path: path || '', list: true });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const entries = data.entries as DirectoryEntry[];

  dirCache.set(cacheKey, entries);
  return entries;
}

/**
 * Clear all cached data (call when slug changes)
 */
export function clearCache(): void {
  fileCache.clear();
  dirCache.clear();
}

/**
 * Check if a plugin slug exists on plugins.svn.wordpress.org.
 * Returns true if the slug's root directory is accessible.
 */
export async function validateSlug(slug: string): Promise<boolean> {
  try {
    await fetchDirectoryListing(slug, '');
    return true;
  } catch {
    return false;
  }
}
