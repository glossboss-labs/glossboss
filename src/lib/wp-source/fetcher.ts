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

/** In-memory cache for source files and directory listings (stores JSON strings) */
const fileCache = new Map<string, string>();
const dirCache = new Map<string, string>();

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

/** Result from fetching a source file */
export interface FetchSourceResult {
  content: string;
  basePath: string;
}

/** Result from fetching a directory listing */
export interface FetchDirResult {
  entries: DirectoryEntry[];
  basePath: string;
}

/**
 * Fetch a source file's contents.
 * Results are cached in memory.
 */
export async function fetchSourceFile(
  slug: string,
  path: string,
  version?: string | null,
): Promise<FetchSourceResult> {
  const cacheKey = `${slug}/${path}`;

  const cached = fileCache.get(cacheKey);
  if (cached !== undefined) return JSON.parse(cached);

  const body: Record<string, unknown> = { slug, path };
  if (version) body.version = version;
  const response = await fetchFromEdge(body);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const result: FetchSourceResult = {
    content: data.content as string,
    basePath: (data.basePath as string) || 'trunk',
  };

  fileCache.set(cacheKey, JSON.stringify(result));
  return result;
}

/**
 * Fetch a directory listing.
 * Results are cached in memory.
 */
export async function fetchDirectoryListing(
  slug: string,
  path: string,
  version?: string | null,
): Promise<FetchDirResult> {
  const cacheKey = `${slug}/${path}`;

  const cached = dirCache.get(cacheKey);
  if (cached !== undefined) return JSON.parse(cached);

  const body: Record<string, unknown> = { slug, path: path || '', list: true };
  if (version) body.version = version;
  const response = await fetchFromEdge(body);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const result: FetchDirResult = {
    entries: data.entries as DirectoryEntry[],
    basePath: (data.basePath as string) || 'trunk',
  };

  dirCache.set(cacheKey, JSON.stringify(result));
  return result;
}

/**
 * Clear all cached data (call when slug changes)
 */
export function clearCache(): void {
  fileCache.clear();
  dirCache.clear();
}

/**
 * Check if a plugin slug exists on WordPress.org.
 * Uses the public Plugin API which supports CORS (no proxy needed).
 */
export async function validateSlug(slug: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&slug=${encodeURIComponent(slug)}`,
    );

    if (!response.ok) return false;

    const data = await response.json();
    // The API returns an object with "error" for invalid slugs
    return !data.error;
  } catch {
    return false;
  }
}
