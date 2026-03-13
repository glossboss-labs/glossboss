/**
 * WordPress.org source browser and release fetch helpers.
 */
import { debugInfo, debugWarn } from '@/lib/debug';
import { getSupabaseAnonKey, getSupabaseFunctionBaseUrl } from '@/lib/cloud-backend';
import { buildSupabaseFunctionHeaders } from '@/lib/supabase-function-headers';
import { normalizeSourcePath, type WordPressProjectType } from '@/lib/wp-source/references';
import {
  buildWordPressReleaseList,
  compareVersions,
  sortWordPressReleases,
  validateWordPressProjectSlug,
} from '@/lib/wp-source/project';

export interface DirectoryEntry {
  name: string;
  isDir: boolean;
}

export interface WordPressProjectLocale {
  value: string;
  label: string;
}

export interface WordPressProjectSuggestion {
  value: string;
  label: string;
  slug: string;
  name: string;
  latestVersion: string | null;
}

const fileCache = new Map<string, string>();
const dirCache = new Map<string, string>();
const releasesCache = new Map<string, string[]>();
const localesCache = new Map<string, WordPressProjectLocale[]>();
const legacyVersionCache = new Map<string, string | null>();
const searchCache = new Map<string, { expiresAt: number; results: WordPressProjectSuggestion[] }>();

const FETCH_TIMEOUT_MS = 30000;
const SEARCH_CACHE_TTL_MS = 30 * 60 * 1000;

function getProjectCacheKey(
  projectType: WordPressProjectType,
  slug: string,
  path: string,
  version?: string | null,
): string {
  const normalizedPath = path.replace(/^\/+/, '');
  const versionPart = version ?? 'auto';
  return `${projectType}:${slug}@${versionPart}/${normalizedPath}`;
}

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

function extractVersionFromError(message: string): string | null {
  const pluginMatch = message.match(/\/tags\/([^/]+)\//);
  if (pluginMatch) return pluginMatch[1];

  const themeMatch = message.match(/themes\.svn\.wordpress\.org\/[^/]+\/([^/]+)\//);
  return themeMatch ? themeMatch[1] : null;
}

async function findLegacySourceInBatches(
  projectType: WordPressProjectType,
  slug: string,
  path: string,
  candidates: string[],
  batchSize: number = 10,
): Promise<{ version: string; result: FetchSourceResult } | null> {
  for (let index = 0; index < candidates.length; index += batchSize) {
    const batch = candidates.slice(index, index + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (candidateVersion) => ({
        candidateVersion,
        response: await tryFetchSource(projectType, slug, path, candidateVersion),
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
  projectType: WordPressProjectType,
  slug: string,
  path: string,
  version?: string | null,
): Promise<
  { ok: true; result: FetchSourceResult } | { ok: false; status: number; message: string }
> {
  const body: Record<string, unknown> = { projectType, slug, path };
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
      basePath: (data.basePath as string) || (projectType === 'plugin' ? 'trunk' : (version ?? '')),
    },
  };
}

function getEdgeFunctionUrl(): string {
  return `${getSupabaseFunctionBaseUrl('WordPress source browsing')}/wp-source`;
}

async function fetchFromEdge(body: Record<string, unknown>): Promise<Response> {
  const functionUrl = getEdgeFunctionUrl();
  const anonKey = getSupabaseAnonKey();
  const headers = buildSupabaseFunctionHeaders(anonKey);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(functionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface FetchSourceResult {
  content: string;
  basePath: string;
}

export interface FetchDirResult {
  entries: DirectoryEntry[];
  basePath: string;
}

export async function fetchProjectReleases(
  projectType: WordPressProjectType,
  slug: string,
): Promise<string[]> {
  const cacheKey = `${projectType}:${slug}`;
  const cached = releasesCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetchFromEdge({ projectType, slug, releases: true });
  if (!response.ok) {
    throw new Error(await readEdgeError(response));
  }

  const data = await response.json();
  let releases = sortWordPressReleases(Array.isArray(data.releases) ? data.releases : []);

  if (releases.length === 0) {
    const fallbackPath = projectType === 'plugin' ? 'tags' : '';
    const fallbackResponse = await fetchFromEdge({
      projectType,
      slug,
      path: fallbackPath,
      list: true,
    });

    if (fallbackResponse.ok) {
      const fallbackData = await fallbackResponse.json();
      const entries = Array.isArray(fallbackData.entries)
        ? (fallbackData.entries as DirectoryEntry[])
        : [];
      releases = buildWordPressReleaseList(
        entries.filter((entry) => entry?.isDir).map((entry) => entry.name),
      );
    }
  }

  releasesCache.set(cacheKey, releases);
  return releases;
}

export async function fetchProjectLocales(
  projectType: WordPressProjectType,
  slug: string,
  track: 'stable' | 'dev' = 'stable',
): Promise<WordPressProjectLocale[]> {
  const cacheKey = `${projectType}:${slug}:${track}`;
  const cached = localesCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetchFromEdge({ projectType, slug, locales: true, track });
  if (!response.ok) {
    throw new Error(await readEdgeError(response));
  }

  const data = await response.json();
  if (!Array.isArray(data.locales)) {
    throw new Error('WordPress locale discovery is unavailable in this deployment.');
  }

  const locales = Array.isArray(data.locales)
    ? (data.locales as Array<{ locale?: unknown; label?: unknown }>)
        .filter(
          (item): item is { locale: string; label: string } =>
            typeof item?.locale === 'string' && typeof item?.label === 'string',
        )
        .map((item) => ({
          value: item.locale,
          label: `${item.label} (${item.locale})`,
        }))
    : [];

  localesCache.set(cacheKey, locales);
  return locales;
}

export async function searchWordPressProjects(
  projectType: WordPressProjectType,
  query: string,
): Promise<WordPressProjectSuggestion[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 3) {
    return [];
  }

  const cacheKey = `${projectType}:${normalizedQuery}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.results;
  }

  const response = await fetchFromEdge({ projectType, search: true, searchQuery: normalizedQuery });
  if (!response.ok) {
    throw new Error(await readEdgeError(response));
  }

  const data = await response.json();
  const results = Array.isArray(data.results)
    ? (data.results as Array<{ slug?: unknown; name?: unknown; version?: unknown }>)
        .filter(
          (item): item is { slug: string; name: string; version?: string | null } =>
            typeof item?.slug === 'string' && typeof item?.name === 'string',
        )
        .map((item) => ({
          value: item.slug,
          label: item.slug,
          slug: item.slug,
          name: item.name,
          latestVersion: typeof item.version === 'string' ? item.version : null,
        }))
    : [];

  searchCache.set(cacheKey, {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    results,
  });
  return results;
}

export async function fetchSourceFile(
  projectType: WordPressProjectType,
  slug: string,
  path: string,
  version?: string | null,
): Promise<FetchSourceResult> {
  const normalized = normalizeSourcePath(path, slug, projectType);
  const pathVersion = normalized.basePath?.startsWith('tags/')
    ? normalized.basePath.slice('tags/'.length)
    : normalized.basePath;
  const effectiveVersion = version ?? pathVersion;
  const requestPath = normalized.path;
  const cacheKey = getProjectCacheKey(projectType, slug, requestPath, effectiveVersion);
  const cached = fileCache.get(cacheKey);
  if (cached !== undefined) return JSON.parse(cached);

  const firstAttempt = await tryFetchSource(projectType, slug, requestPath, effectiveVersion);
  if (firstAttempt.ok) {
    fileCache.set(cacheKey, JSON.stringify(firstAttempt.result));
    return firstAttempt.result;
  }

  if (firstAttempt.status === 404) {
    const inferredVersion = extractVersionFromError(firstAttempt.message);
    const referenceVersion = effectiveVersion ?? inferredVersion;
    const legacyKey = `${projectType}:${slug}|${referenceVersion ?? 'auto'}|${requestPath}`;
    const hasLegacyCache = legacyVersionCache.has(legacyKey);
    const cachedLegacyVersion = legacyVersionCache.get(legacyKey);

    if (hasLegacyCache) {
      if (cachedLegacyVersion) {
        const cachedAttempt = await tryFetchSource(
          projectType,
          slug,
          requestPath,
          cachedLegacyVersion,
        );
        if (cachedAttempt.ok) {
          fileCache.set(cacheKey, JSON.stringify(cachedAttempt.result));
          return cachedAttempt.result;
        }
      } else {
        throw new Error(firstAttempt.message);
      }
    }

    const versions = await fetchProjectReleases(projectType, slug);
    const candidates =
      referenceVersion !== null
        ? versions.filter((release) => compareVersions(release, referenceVersion) < 0).slice(0, 180)
        : versions.slice(0, 180);

    const legacyHit = await findLegacySourceInBatches(
      projectType,
      slug,
      requestPath,
      candidates,
      10,
    );
    if (legacyHit) {
      debugInfo(
        `[Source] Using legacy release ${legacyHit.version} for missing reference ${projectType}:${slug}:${requestPath}`,
      );
      legacyVersionCache.set(legacyKey, legacyHit.version);
      fileCache.set(cacheKey, JSON.stringify(legacyHit.result));
      return legacyHit.result;
    }

    debugWarn(
      `[Source] Could not resolve missing reference via older releases ${projectType}:${slug}:${requestPath} (from ${referenceVersion ?? 'auto'})`,
    );
    legacyVersionCache.set(legacyKey, null);
  }

  throw new Error(firstAttempt.message);
}

export async function fetchDirectoryListing(
  projectType: WordPressProjectType,
  slug: string,
  path: string,
  version?: string | null,
): Promise<FetchDirResult> {
  const cacheKey = getProjectCacheKey(projectType, slug, path, version);
  const cached = dirCache.get(cacheKey);
  if (cached !== undefined) return JSON.parse(cached);

  const body: Record<string, unknown> = { projectType, slug, path: path || '', list: true };
  if (version) body.version = version;
  const response = await fetchFromEdge(body);

  if (!response.ok) {
    throw new Error(await readEdgeError(response));
  }

  const data = await response.json();
  const result: FetchDirResult = {
    entries: data.entries as DirectoryEntry[],
    basePath: (data.basePath as string) || (projectType === 'plugin' ? 'trunk' : (version ?? '')),
  };

  dirCache.set(cacheKey, JSON.stringify(result));
  return result;
}

export function clearCache(): void {
  fileCache.clear();
  dirCache.clear();
  releasesCache.clear();
  localesCache.clear();
  legacyVersionCache.clear();
  searchCache.clear();
}

export async function validateWordPressProject(
  projectType: WordPressProjectType,
  slug: string,
): Promise<boolean> {
  return await validateWordPressProjectSlug(projectType, slug);
}
