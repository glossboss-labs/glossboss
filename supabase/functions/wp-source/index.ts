/**
 * WordPress.org source proxy edge function.
 *
 * Supports plugin and theme source browsing plus release listing.
 */

import {
  fetchWithTimeout,
  forbiddenOrigin,
  isAbortError,
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
  parseJsonBody,
  requireJsonRequest,
  sanitizeUpstreamError,
  validateRequestOrigin,
} from '../_shared/http.ts';

type WordPressProjectType = 'plugin' | 'theme';

const SVN_BASE: Record<WordPressProjectType, string> = {
  plugin: 'https://plugins.svn.wordpress.org',
  theme: 'https://themes.svn.wordpress.org',
};

const FETCH_HEADERS = { 'User-Agent': 'GlossBoss/1.0 (WordPress Translation Editor)' };
const FETCH_TIMEOUT_MS = 8000;
const MAX_SLUG_LENGTH = 120;
const MAX_PATH_LENGTH = 500;
const MAX_VERSION_LENGTH = 64;
const MAX_LEGACY_RELEASE_CANDIDATES = 40;

const basePathCache = new Map<string, string>();
const releasesCache = new Map<string, string[]>();
const fileExistsCache = new Map<string, boolean>();
const legacyPathCache = new Map<string, string | null>();

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isValidProjectType(value: unknown): value is WordPressProjectType {
  return value === 'plugin' || value === 'theme';
}

function isValidSlug(slug: string): boolean {
  return slug.length <= MAX_SLUG_LENGTH && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

function isValidVersion(version: string): boolean {
  return version.length <= MAX_VERSION_LENGTH && /^[\d][\w.-]*$/.test(version);
}

function normalizeRequestPath(
  rawPath: string,
  slug: string,
  projectType: WordPressProjectType,
): { cleanPath: string; basePathOverride: string | null } {
  let clean = rawPath.replace(/\\/g, '/').trim();
  clean = clean.replace(/^\/+/, '').replace(/\/{2,}/g, '/');

  while (clean.startsWith('./')) {
    clean = clean.slice(2);
  }

  const wpPrefix =
    projectType === 'theme' ? `wp-content/themes/${slug}/` : `wp-content/plugins/${slug}/`;
  if (clean.toLowerCase().startsWith(wpPrefix.toLowerCase())) {
    clean = clean.slice(wpPrefix.length);
  }

  const slugPrefix = `${slug}/`;
  if (clean.toLowerCase().startsWith(slugPrefix.toLowerCase())) {
    clean = clean.slice(slugPrefix.length);
  }

  if (projectType === 'plugin') {
    if (clean === 'trunk') {
      return { cleanPath: '', basePathOverride: 'trunk' };
    }

    if (clean.startsWith('trunk/')) {
      return { cleanPath: clean.slice('trunk/'.length), basePathOverride: 'trunk' };
    }

    const tagMatch = clean.match(/^tags\/([^/]+)(?:\/(.*))?$/);
    if (tagMatch) {
      return {
        cleanPath: tagMatch[2] ?? '',
        basePathOverride: `tags/${tagMatch[1]}`,
      };
    }

    return { cleanPath: clean, basePathOverride: null };
  }

  const segments = clean.split('/');
  if (segments.length > 1 && isValidVersion(segments[0])) {
    return {
      cleanPath: segments.slice(1).join('/'),
      basePathOverride: segments[0],
    };
  }

  return { cleanPath: clean, basePathOverride: null };
}

function isSafePath(path: string): boolean {
  return path.length <= MAX_PATH_LENGTH && !path.includes('..') && !path.includes('\0');
}

function parseDirectoryListing(html: string): { name: string; isDir: boolean }[] {
  const entries: { name: string; isDir: boolean }[] = [];
  const linkRegex = /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].trim();

    if (text === '..' || text === '../' || href.startsWith('http') || href.startsWith('/')) {
      continue;
    }

    const isDir = href.endsWith('/');
    const name = text.replace(/\/$/, '');
    if (name) {
      entries.push({ name, isDir });
    }
  }

  return entries;
}

async function fetchFromSvn(url: string, init?: RequestInit): Promise<Response> {
  return await fetchWithTimeout(url, FETCH_TIMEOUT_MS, {
    ...init,
    headers: {
      ...FETCH_HEADERS,
      ...(init?.headers ?? {}),
    },
  });
}

function compareVersions(a: string, b: string): number {
  const parse = (value: string) =>
    value.split(/[.-]/).map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()));
  const parsedA = parse(a);
  const parsedB = parse(b);
  const length = Math.max(parsedA.length, parsedB.length);

  for (let index = 0; index < length; index += 1) {
    const left = parsedA[index] ?? 0;
    const right = parsedB[index] ?? 0;

    if (typeof left === 'number' && typeof right === 'number') {
      if (left !== right) return left - right;
      continue;
    }

    const leftString = String(left);
    const rightString = String(right);
    if (leftString !== rightString) return leftString < rightString ? -1 : 1;
  }

  return 0;
}

async function getProjectReleases(
  projectType: WordPressProjectType,
  slug: string,
): Promise<string[]> {
  const cacheKey = `${projectType}:${slug}`;
  const cached = releasesCache.get(cacheKey);
  if (cached) return cached;

  const response =
    projectType === 'plugin'
      ? await fetchFromSvn(`${SVN_BASE.plugin}/${slug}/tags/`)
      : await fetchFromSvn(`${SVN_BASE.theme}/${slug}/`);
  if (!response.ok) return [];

  const releases = parseDirectoryListing(await response.text())
    .filter((entry) => entry.isDir && /^[\d]/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => compareVersions(right, left));

  releasesCache.set(cacheKey, releases);
  return releases;
}

async function fileExists(url: string): Promise<boolean> {
  const cached = fileExistsCache.get(url);
  if (cached !== undefined) return cached;

  try {
    const response = await fetchFromSvn(url, { method: 'HEAD' });
    const exists = response.ok;
    fileExistsCache.set(url, exists);
    return exists;
  } catch {
    fileExistsCache.set(url, false);
    return false;
  }
}

async function findLegacyBasePath(
  projectType: WordPressProjectType,
  slug: string,
  cleanPath: string,
  currentBasePath: string,
): Promise<string | null> {
  if (!cleanPath) return null;

  const currentVersion =
    projectType === 'plugin' ? currentBasePath.replace(/^tags\//, '') : currentBasePath;
  if (!currentVersion || (projectType === 'plugin' && currentBasePath === 'trunk')) {
    return null;
  }

  const cacheKey = `${projectType}:${slug}|${currentBasePath}|${cleanPath}`;
  const cached = legacyPathCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const candidates = (await getProjectReleases(projectType, slug))
    .filter((release) => compareVersions(release, currentVersion) <= 0)
    .slice(0, MAX_LEGACY_RELEASE_CANDIDATES);

  for (const candidate of candidates) {
    const candidateBasePath = projectType === 'plugin' ? `tags/${candidate}` : candidate;
    const url = `${SVN_BASE[projectType]}/${slug}/${candidateBasePath}/${cleanPath}`;
    if (await fileExists(url)) {
      legacyPathCache.set(cacheKey, candidateBasePath);
      return candidateBasePath;
    }
  }

  legacyPathCache.set(cacheKey, null);
  return null;
}

async function resolveBasePath(projectType: WordPressProjectType, slug: string): Promise<string> {
  const cacheKey = `${projectType}:${slug}`;
  const cached = basePathCache.get(cacheKey);
  if (cached) return cached;

  if (projectType === 'plugin') {
    const trunkResponse = await fetchFromSvn(`${SVN_BASE.plugin}/${slug}/trunk/`);
    if (trunkResponse.ok) {
      const entries = parseDirectoryListing(await trunkResponse.text());
      if (entries.length > 0) {
        basePathCache.set(cacheKey, 'trunk');
        return 'trunk';
      }
    }
  }

  const releases = await getProjectReleases(projectType, slug);
  const basePath =
    projectType === 'plugin'
      ? releases.length > 0
        ? `tags/${releases[0]}`
        : 'trunk'
      : (releases[0] ?? '');

  basePathCache.set(cacheKey, basePath);
  return basePath;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return optionsResponse(req);
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(req);
  }

  if (!validateRequestOrigin(req).allowed) {
    return forbiddenOrigin(req);
  }

  const jsonError = requireJsonRequest(req);
  if (jsonError) {
    return jsonError;
  }

  try {
    const body = await parseJsonBody(req);
    if (!isObject(body)) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_PAYLOAD', message: 'Request body must be a JSON object.' },
        { status: 400 },
      );
    }

    const projectType = isValidProjectType(body.projectType) ? body.projectType : 'plugin';
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const rawPath = typeof body.path === 'string' ? body.path : '';
    const list = body.list === true;
    const releasesOnly = body.releases === true;
    const version = typeof body.version === 'string' ? body.version.trim() : '';

    if (!isValidSlug(slug)) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: `Provide a valid WordPress ${projectType} slug using lowercase letters, numbers, and hyphens.`,
        },
        { status: 400 },
      );
    }

    if (version && !isValidVersion(version)) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: `Provide a valid WordPress ${projectType} release.`,
        },
        { status: 400 },
      );
    }

    if (releasesOnly) {
      return jsonResponse(req, {
        releases: await getProjectReleases(projectType, slug),
      });
    }

    const { cleanPath, basePathOverride } = normalizeRequestPath(rawPath, slug, projectType);
    if (!isSafePath(cleanPath)) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_PAYLOAD', message: 'Provide a valid source path.' },
        { status: 400 },
      );
    }

    let basePath: string;
    if (basePathOverride) {
      basePath = basePathOverride;
    } else if (version) {
      const candidateBasePath = projectType === 'plugin' ? `tags/${version}` : version;
      const candidateUrl = `${SVN_BASE[projectType]}/${slug}/${candidateBasePath}/`;
      const candidateResponse = await fetchFromSvn(candidateUrl);
      if (!candidateResponse.ok) {
        if (candidateResponse.status === 404) {
          return jsonResponse(
            req,
            {
              ok: false,
              code: 'NOT_FOUND',
              message: `Release "${version}" was not found for this ${projectType}.`,
            },
            { status: 404 },
          );
        }

        return jsonResponse(
          req,
          {
            ok: false,
            code: 'UPSTREAM_ERROR',
            message: sanitizeUpstreamError(
              await candidateResponse.text().catch(() => ''),
              `WordPress SVN returned HTTP ${candidateResponse.status}.`,
            ),
          },
          { status: candidateResponse.status },
        );
      }
      basePath = candidateBasePath;
    } else {
      basePath = await resolveBasePath(projectType, slug);
    }

    let svnUrl = cleanPath
      ? `${SVN_BASE[projectType]}/${slug}/${basePath}/${cleanPath}`
      : `${SVN_BASE[projectType]}/${slug}/${basePath}/`;
    const attemptedBasePaths = [basePath];
    let response = await fetchFromSvn(svnUrl);

    if (
      projectType === 'plugin' &&
      response.status === 404 &&
      cleanPath &&
      !basePathOverride &&
      basePath.startsWith('tags/')
    ) {
      const fallbackBasePath = 'trunk';
      const fallbackUrl = `${SVN_BASE.plugin}/${slug}/${fallbackBasePath}/${cleanPath}`;
      const fallbackResponse = await fetchFromSvn(fallbackUrl);
      if (fallbackResponse.ok) {
        basePath = fallbackBasePath;
        svnUrl = fallbackUrl;
        response = fallbackResponse;
        attemptedBasePaths.push(fallbackBasePath);
      }
    }

    if (response.status === 404 && cleanPath) {
      const legacyBasePath = await findLegacyBasePath(projectType, slug, cleanPath, basePath);
      if (legacyBasePath) {
        const legacyUrl = `${SVN_BASE[projectType]}/${slug}/${legacyBasePath}/${cleanPath}`;
        const legacyResponse = await fetchFromSvn(legacyUrl);
        if (legacyResponse.ok) {
          basePath = legacyBasePath;
          svnUrl = legacyUrl;
          response = legacyResponse;
          attemptedBasePaths.push(legacyBasePath);
        }
      }
    }

    if (!response.ok) {
      const fallbackMessage =
        response.status === 404
          ? `Source path not found for "${slug}" (${basePath}).`
          : `WordPress SVN returned HTTP ${response.status}.`;

      return jsonResponse(
        req,
        {
          ok: false,
          code: response.status === 404 ? 'NOT_FOUND' : 'UPSTREAM_ERROR',
          message: sanitizeUpstreamError(await response.text().catch(() => ''), fallbackMessage),
          details: {
            projectType,
            attemptedBasePaths,
            url: svnUrl,
          },
        },
        { status: response.status },
      );
    }

    if (list) {
      return jsonResponse(req, {
        entries: parseDirectoryListing(await response.text()),
        basePath,
      });
    }

    return jsonResponse(req, {
      content: await response.text(),
      basePath,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_PAYLOAD', message: 'Request body is not valid JSON.' },
        { status: 400 },
      );
    }

    const message = isAbortError(error)
      ? 'WordPress source request timed out.'
      : 'Failed to fetch WordPress source.';

    return jsonResponse(req, { ok: false, code: 'INTERNAL_ERROR', message }, { status: 500 });
  }
});
