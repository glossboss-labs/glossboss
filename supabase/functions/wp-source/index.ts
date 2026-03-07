/**
 * WordPress Plugin Source Proxy Edge Function
 *
 * Proxies requests to plugins.svn.wordpress.org for source files and
 * directory listings. Required because SVN does not allow CORS.
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

const SVN_BASE = 'https://plugins.svn.wordpress.org';
const FETCH_HEADERS = { 'User-Agent': 'GlossBoss/1.0 (WordPress Translation Editor)' };
const FETCH_TIMEOUT_MS = 8000;
const MAX_SLUG_LENGTH = 120;
const MAX_PATH_LENGTH = 500;
const MAX_VERSION_LENGTH = 64;
const MAX_LEGACY_TAG_CANDIDATES = 40;

const basePathCache = new Map<string, string>();
const tagsCache = new Map<string, string[]>();
const fileExistsCache = new Map<string, boolean>();
const legacyTagPathCache = new Map<string, string | null>();

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
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
): { cleanPath: string; basePathOverride: string | null } {
  let clean = rawPath.replace(/\\/g, '/').trim();
  clean = clean.replace(/^\/+/, '').replace(/\/{2,}/g, '/');

  while (clean.startsWith('./')) {
    clean = clean.slice(2);
  }

  const wpPrefix = `wp-content/plugins/${slug}/`;
  if (clean.toLowerCase().startsWith(wpPrefix.toLowerCase())) {
    clean = clean.slice(wpPrefix.length);
  }

  const slugPrefix = `${slug}/`;
  if (clean.toLowerCase().startsWith(slugPrefix.toLowerCase())) {
    clean = clean.slice(slugPrefix.length);
  }

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

function compareTagVersions(a: string, b: string): number {
  const parse = (value: string) =>
    value.split(/[.-]/).map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()));
  const parsedA = parse(a);
  const parsedB = parse(b);
  const len = Math.max(parsedA.length, parsedB.length);

  for (let index = 0; index < len; index++) {
    const aPart = parsedA[index] ?? 0;
    const bPart = parsedB[index] ?? 0;

    if (typeof aPart === 'number' && typeof bPart === 'number') {
      if (aPart !== bPart) return aPart - bPart;
      continue;
    }

    const aString = String(aPart);
    const bString = String(bPart);
    if (aString !== bString) return aString < bString ? -1 : 1;
  }

  return 0;
}

async function getPluginTags(slug: string): Promise<string[]> {
  const cached = tagsCache.get(slug);
  if (cached) return cached;

  const response = await fetchFromSvn(`${SVN_BASE}/${slug}/tags/`);
  if (!response.ok) return [];

  const tags = parseDirectoryListing(await response.text())
    .filter((entry) => entry.isDir && /^[\d]/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => compareTagVersions(b, a));

  tagsCache.set(slug, tags);
  return tags;
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

async function findLegacyTagPath(
  slug: string,
  cleanPath: string,
  currentBasePath: string,
): Promise<string | null> {
  if (!currentBasePath.startsWith('tags/') || !cleanPath) return null;

  const cacheKey = `${slug}|${currentBasePath}|${cleanPath}`;
  const cached = legacyTagPathCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const currentTag = currentBasePath.replace(/^tags\//, '');
  const tags = await getPluginTags(slug);
  const candidates = tags
    .filter((tag) => compareTagVersions(tag, currentTag) <= 0)
    .slice(0, MAX_LEGACY_TAG_CANDIDATES);

  for (const tag of candidates) {
    const url = `${SVN_BASE}/${slug}/tags/${tag}/${cleanPath}`;
    if (await fileExists(url)) {
      const resolved = `tags/${tag}`;
      legacyTagPathCache.set(cacheKey, resolved);
      return resolved;
    }
  }

  legacyTagPathCache.set(cacheKey, null);
  return null;
}

async function resolveBasePath(slug: string): Promise<string> {
  const cached = basePathCache.get(slug);
  if (cached) return cached;

  const trunkResponse = await fetchFromSvn(`${SVN_BASE}/${slug}/trunk/`);
  if (trunkResponse.ok) {
    const entries = parseDirectoryListing(await trunkResponse.text());
    if (entries.length > 0) {
      basePathCache.set(slug, 'trunk');
      return 'trunk';
    }
  }

  const tags = await getPluginTags(slug);
  if (tags.length > 0) {
    const basePath = `tags/${tags[0]}`;
    basePathCache.set(slug, basePath);
    return basePath;
  }

  basePathCache.set(slug, 'trunk');
  return 'trunk';
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

    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const rawPath = typeof body.path === 'string' ? body.path : '';
    const list = body.list === true;
    const version = typeof body.version === 'string' ? body.version.trim() : '';

    if (!isValidSlug(slug)) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: 'Provide a valid plugin slug using lowercase letters, numbers, and hyphens.',
        },
        { status: 400 },
      );
    }

    if (version && !isValidVersion(version)) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_PAYLOAD', message: 'Provide a valid plugin version.' },
        { status: 400 },
      );
    }

    const { cleanPath, basePathOverride } = normalizeRequestPath(rawPath, slug);
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
      const candidate = `${SVN_BASE}/${slug}/tags/${version}/`;
      const candidateResponse = await fetchFromSvn(candidate);
      if (!candidateResponse.ok) {
        if (candidateResponse.status === 404) {
          return jsonResponse(
            req,
            {
              ok: false,
              code: 'NOT_FOUND',
              message: `Version "${version}" was not found for this plugin.`,
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
      basePath = `tags/${version}`;
    } else {
      basePath = await resolveBasePath(slug);
    }

    let svnUrl = cleanPath
      ? `${SVN_BASE}/${slug}/${basePath}/${cleanPath}`
      : `${SVN_BASE}/${slug}/${basePath}/`;
    const attemptedBasePaths = [basePath];
    let response = await fetchFromSvn(svnUrl);

    if (response.status === 404 && cleanPath && !basePathOverride && basePath.startsWith('tags/')) {
      const fallbackBasePath = 'trunk';
      const fallbackUrl = `${SVN_BASE}/${slug}/${fallbackBasePath}/${cleanPath}`;
      const fallbackResponse = await fetchFromSvn(fallbackUrl);
      if (fallbackResponse.ok) {
        basePath = fallbackBasePath;
        svnUrl = fallbackUrl;
        response = fallbackResponse;
        attemptedBasePaths.push(fallbackBasePath);
      }
    }

    if (response.status === 404 && cleanPath && basePath.startsWith('tags/')) {
      const legacyBasePath = await findLegacyTagPath(slug, cleanPath, basePath);
      if (legacyBasePath) {
        const legacyUrl = `${SVN_BASE}/${slug}/${legacyBasePath}/${cleanPath}`;
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
      if (response.status === 404) {
        return jsonResponse(
          req,
          {
            ok: false,
            code: 'NOT_FOUND',
            message: 'Requested source path was not found in the plugin repository.',
            details: {
              slug,
              path: cleanPath,
              attemptedBasePaths,
              requestedVersion: version || null,
            },
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
            await response.text().catch(() => ''),
            `WordPress SVN returned HTTP ${response.status}.`,
          ),
        },
        { status: response.status },
      );
    }

    if (list || !cleanPath || cleanPath.endsWith('/')) {
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
