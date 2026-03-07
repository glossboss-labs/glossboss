/**
 * WordPress Plugin Source Code Fetcher
 *
 * Fetches source files and directory listings from plugins.svn.wordpress.org
 * via edge function proxy. Includes in-memory caching.
 */
import { debugInfo, debugWarn } from '@/lib/debug';
import { buildSupabaseFunctionHeaders } from '@/lib/supabase-function-headers';
import { normalizeSourcePath } from '@/lib/wp-source/references';

/** Directory entry from SVN listing */
export interface DirectoryEntry {
  name: string;
  isDir: boolean;
}

/** In-memory cache for source files and directory listings (stores JSON strings) */
const fileCache = new Map<string, string>();
const dirCache = new Map<string, string>();
const pluginVersionsCache = new Map<string, string[]>();
const legacyVersionCache = new Map<string, string | null>();

/** Fetch timeout in milliseconds */
const FETCH_TIMEOUT_MS = 30000;

/** Build a version-aware cache key */
function getCacheKey(slug: string, path: string, version?: string | null): string {
  const normalizedPath = path.replace(/^\/+/, '');
  const versionPart = version ?? 'auto';
  return `${slug}@${versionPart}/${normalizedPath}`;
}

function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v.split(/[.-]/).map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()));
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const xa = pa[i] ?? 0;
    const xb = pb[i] ?? 0;

    if (typeof xa === 'number' && typeof xb === 'number') {
      if (xa !== xb) return xa - xb;
      continue;
    }

    const sa = String(xa);
    const sb = String(xb);
    if (sa !== sb) return sa < sb ? -1 : 1;
  }

  return 0;
}

/** Parse and format error payload from edge function response */
async function readEdgeError(response: Response): Promise<string> {
  const data = await response.json().catch(() => ({}));
  const attempts = Array.isArray(data?.details?.attemptedBasePaths)
    ? ` Tried: ${data.details.attemptedBasePaths.join(', ')}.`
    : '';
  const message =
    typeof data?.message === 'string'
      ? data.message
      : typeof data?.error === 'string'
        ? data.error
        : `HTTP ${response.status}`;
  return `${message}${attempts}`;
}

async function fetchPluginVersions(slug: string): Promise<string[]> {
  const cached = pluginVersionsCache.get(slug);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&slug=${encodeURIComponent(slug)}`,
    );
    if (!response.ok) return [];

    const data = await response.json();
    const versionsObj = data?.versions as Record<string, string> | undefined;
    if (!versionsObj || typeof versionsObj !== 'object') return [];

    const versions = Object.keys(versionsObj)
      .filter((v) => /^[\d]/.test(v))
      .sort((a, b) => compareVersions(b, a));

    pluginVersionsCache.set(slug, versions);
    return versions;
  } catch {
    return [];
  }
}

function extractVersionFromError(message: string): string | null {
  const match = message.match(/\/tags\/([^/]+)\//);
  return match ? match[1] : null;
}

async function findLegacySourceInBatches(
  slug: string,
  path: string,
  candidates: string[],
  batchSize: number = 10,
): Promise<{ version: string; result: FetchSourceResult } | null> {
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (candidateVersion) => ({
        candidateVersion,
        response: await tryFetchSource(slug, path, candidateVersion),
      })),
    );

    for (const item of batchResults) {
      if (item.response.ok) {
        return { version: item.candidateVersion, result: item.response.result };
      }
    }
  }

  return null;
}

async function tryFetchSource(
  slug: string,
  path: string,
  version?: string | null,
): Promise<
  { ok: true; result: FetchSourceResult } | { ok: false; status: number; message: string }
> {
  const body: Record<string, unknown> = { slug, path };
  if (version) body.version = version;

  const response = await fetchFromEdge(body);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: await readEdgeError(response),
    };
  }

  const data = await response.json();
  return {
    ok: true,
    result: {
      content: data.content as string,
      basePath: (data.basePath as string) || 'trunk',
    },
  };
}

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

  const headers = buildSupabaseFunctionHeaders(anonKey);

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
  const normalized = normalizeSourcePath(path, slug);
  const pathVersion = normalized.basePath?.startsWith('tags/')
    ? normalized.basePath.slice('tags/'.length)
    : null;
  const effectiveVersion = version ?? pathVersion;
  const requestPath = normalized.path;

  const cacheKey = getCacheKey(slug, requestPath, effectiveVersion);

  const cached = fileCache.get(cacheKey);
  if (cached !== undefined) return JSON.parse(cached);

  const firstAttempt = await tryFetchSource(slug, requestPath, effectiveVersion);
  if (firstAttempt.ok) {
    fileCache.set(cacheKey, JSON.stringify(firstAttempt.result));
    return firstAttempt.result;
  }

  // Legacy fallback for stale references: try older plugin versions when
  // a file no longer exists in the current tagged release.
  if (firstAttempt.status === 404) {
    const inferredVersion = extractVersionFromError(firstAttempt.message);
    const referenceVersion = effectiveVersion ?? inferredVersion;
    const legacyKey = `${slug}|${referenceVersion ?? 'auto'}|${requestPath}`;
    const hasLegacyCache = legacyVersionCache.has(legacyKey);
    const cachedLegacyVersion = legacyVersionCache.get(legacyKey);

    if (hasLegacyCache) {
      if (cachedLegacyVersion) {
        const cachedAttempt = await tryFetchSource(slug, requestPath, cachedLegacyVersion);
        if (cachedAttempt.ok) {
          fileCache.set(cacheKey, JSON.stringify(cachedAttempt.result));
          return cachedAttempt.result;
        }
      } else {
        throw new Error(firstAttempt.message);
      }
    }

    const versions = await fetchPluginVersions(slug);
    const candidates =
      referenceVersion !== null
        ? versions.filter((v) => compareVersions(v, referenceVersion) < 0).slice(0, 180)
        : versions.slice(0, 180);

    const legacyHit = await findLegacySourceInBatches(slug, requestPath, candidates, 10);
    if (legacyHit) {
      debugInfo(
        `[Source] Using legacy tag ${legacyHit.version} for missing reference ${slug}:${requestPath}`,
      );
      legacyVersionCache.set(legacyKey, legacyHit.version);
      fileCache.set(cacheKey, JSON.stringify(legacyHit.result));
      return legacyHit.result;
    }

    debugWarn(
      `[Source] Could not resolve missing reference via legacy tags ${slug}:${requestPath} (from ${referenceVersion ?? 'auto'})`,
    );
    legacyVersionCache.set(legacyKey, null);
  }

  throw new Error(firstAttempt.message);
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
  const cacheKey = getCacheKey(slug, path, version);

  const cached = dirCache.get(cacheKey);
  if (cached !== undefined) return JSON.parse(cached);

  const body: Record<string, unknown> = { slug, path: path || '', list: true };
  if (version) body.version = version;
  const response = await fetchFromEdge(body);

  if (!response.ok) {
    throw new Error(await readEdgeError(response));
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
  legacyVersionCache.clear();
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
