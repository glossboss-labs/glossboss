/**
 * WordPress Plugin Source Proxy Edge Function
 *
 * Proxies requests to plugins.svn.wordpress.org for source files and
 * directory listings. Required because SVN doesn't allow CORS.
 *
 * Modes:
 * - { slug, path } → fetch raw file content
 * - { slug, path: "", list: true } → fetch directory listing, parse HTML
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Validate slug format (alphanumeric + hyphens only) */
function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

/**
 * Normalize an incoming source path and detect embedded base-path prefixes.
 * Accepts references that may include slug prefixes and/or "trunk"/"tags/x.y.z".
 */
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

/** Parse SVN HTML directory listing into entries */
function parseDirectoryListing(html: string): { name: string; isDir: boolean }[] {
  const entries: { name: string; isDir: boolean }[] = [];

  // SVN directory listings use <li> elements with links
  // Pattern: <a href="name/">name/</a> for dirs, <a href="name">name</a> for files
  const linkRegex = /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].trim();

    // Skip parent directory link and non-relative links
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

const SVN_BASE = 'https://plugins.svn.wordpress.org';
const FETCH_HEADERS = { 'User-Agent': 'GlossBoss/1.0 (WordPress Translation Editor)' };
const FETCH_TIMEOUT_MS = 8000;

/** Cache of resolved base paths (slug → "trunk" or "tags/x.y.z") */
const basePathCache = new Map<string, string>();
const tagsCache = new Map<string, string[]>();
const fileExistsCache = new Map<string, boolean>();
const legacyTagPathCache = new Map<string, string | null>();

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Compare version-like tag names ("8.4.2" > "7.4.8") */
function compareTagVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v.split(/[.-]/).map((p) => (/^\d+$/.test(p) ? Number(p) : p.toLowerCase()));
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

/** Fetch and cache tags sorted newest first */
async function getPluginTags(slug: string): Promise<string[]> {
  const cached = tagsCache.get(slug);
  if (cached) return cached;

  const res = await fetchWithTimeout(`${SVN_BASE}/${slug}/tags/`, { headers: FETCH_HEADERS });
  if (!res.ok) return [];

  const html = await res.text();
  const tags = parseDirectoryListing(html)
    .filter((e) => e.isDir && /^[\d]/.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => compareTagVersions(b, a));

  tagsCache.set(slug, tags);
  return tags;
}

/** Check file existence with cache */
async function fileExists(url: string): Promise<boolean> {
  const cached = fileExistsCache.get(url);
  if (cached !== undefined) return cached;

  try {
    const res = await fetchWithTimeout(url, { method: 'HEAD', headers: FETCH_HEADERS });
    const exists = res.ok;
    fileExistsCache.set(url, exists);
    return exists;
  } catch {
    fileExistsCache.set(url, false);
    return false;
  }
}

/**
 * Find a closest older tag that still contains `cleanPath`.
 * Useful when references were generated from older source trees.
 */
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
  if (tags.length === 0) {
    legacyTagPathCache.set(cacheKey, null);
    return null;
  }

  // Search newest→oldest, but skip tags newer than current tag.
  const candidates = tags.filter((tag) => compareTagVersions(tag, currentTag) <= 0).slice(0, 160);
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

/**
 * Resolve the base path for a plugin.
 * Tries trunk first; if trunk is empty, falls back to the latest tag.
 */
async function resolveBasePath(slug: string): Promise<string> {
  const cached = basePathCache.get(slug);
  if (cached) return cached;

  // Check if trunk has content
  const trunkRes = await fetchWithTimeout(`${SVN_BASE}/${slug}/trunk/`, { headers: FETCH_HEADERS });
  if (trunkRes.ok) {
    const html = await trunkRes.text();
    const entries = parseDirectoryListing(html);
    if (entries.length > 0) {
      basePathCache.set(slug, 'trunk');
      return 'trunk';
    }
  }

  // Trunk is empty or missing — find the latest tag
  const tagsRes = await fetchWithTimeout(`${SVN_BASE}/${slug}/tags/`, { headers: FETCH_HEADERS });
  if (tagsRes.ok) {
    const html = await tagsRes.text();
    const tags = parseDirectoryListing(html)
      .filter((e) => e.isDir)
      .map((e) => e.name);

    if (tags.length > 0) {
      // Sort by version (semver-like), pick the last one
      const latest = tags
        .sort((a, b) => {
          const pa = a.split('.').map(Number);
          const pb = b.split('.').map(Number);
          for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const diff = (pa[i] || 0) - (pb[i] || 0);
            if (diff !== 0) return diff;
          }
          return 0;
        })
        .pop()!;

      const basePath = `tags/${latest}`;
      basePathCache.set(slug, basePath);
      return basePath;
    }
  }

  // Default to trunk even if empty
  basePathCache.set(slug, 'trunk');
  return 'trunk';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { slug, path, list, version } = body;

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Missing required field: slug' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isValidSlug(slug)) {
      return new Response(
        JSON.stringify({ error: 'Invalid slug format. Use lowercase alphanumeric with hyphens.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { cleanPath, basePathOverride } = normalizeRequestPath(path || '', slug);

    // If path already specifies trunk/tags, trust that explicit base path.
    let basePath: string;
    if (basePathOverride) {
      basePath = basePathOverride;
    } else if (version && /^[\d][\d.]*(-[\w.]+)?$/.test(version)) {
      // If a specific version is requested, try that tag first.
      const tagUrl = `${SVN_BASE}/${slug}/tags/${version}/`;
      const tagRes = await fetchWithTimeout(tagUrl, { headers: FETCH_HEADERS });
      basePath = tagRes.ok ? `tags/${version}` : await resolveBasePath(slug);
    } else {
      basePath = await resolveBasePath(slug);
    }

    let svnUrl = cleanPath
      ? `${SVN_BASE}/${slug}/${basePath}/${cleanPath}`
      : `${SVN_BASE}/${slug}/${basePath}/`;

    console.log(`Fetching: ${svnUrl} (list: ${!!list}, base: ${basePath})`);

    const attemptedBasePaths = [basePath];
    let response = await fetchWithTimeout(svnUrl, { headers: FETCH_HEADERS });

    // If a tagged version misses a file, retry trunk as a pragmatic fallback.
    if (response.status === 404 && cleanPath && !basePathOverride && basePath.startsWith('tags/')) {
      const fallbackBasePath = 'trunk';
      const fallbackUrl = `${SVN_BASE}/${slug}/${fallbackBasePath}/${cleanPath}`;
      console.log(`Retrying with fallback: ${fallbackUrl}`);
      const fallbackRes = await fetchWithTimeout(fallbackUrl, { headers: FETCH_HEADERS });
      if (fallbackRes.ok) {
        basePath = fallbackBasePath;
        svnUrl = fallbackUrl;
        response = fallbackRes;
        attemptedBasePaths.push(fallbackBasePath);
      }
    }

    // If still not found, attempt to locate the same path in the closest older tag.
    if (response.status === 404 && cleanPath && basePath.startsWith('tags/')) {
      const legacyBasePath = await findLegacyTagPath(slug, cleanPath, basePath);
      if (legacyBasePath) {
        const legacyUrl = `${SVN_BASE}/${slug}/${legacyBasePath}/${cleanPath}`;
        console.log(`Retrying with legacy tag: ${legacyUrl}`);
        const legacyRes = await fetchWithTimeout(legacyUrl, { headers: FETCH_HEADERS });
        if (legacyRes.ok) {
          basePath = legacyBasePath;
          svnUrl = legacyUrl;
          response = legacyRes;
          attemptedBasePaths.push(legacyBasePath);
        }
      }
    }

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({
            error: `Not found: ${slug}/${basePath}/${cleanPath}`,
            hint: 'This source reference may point to a file removed in newer plugin versions.',
            details: {
              slug,
              path: cleanPath,
              attemptedBasePaths,
              requestedVersion: version ?? null,
            },
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ error: `SVN returned HTTP ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Directory listing mode
    if (list || !cleanPath || cleanPath.endsWith('/')) {
      const html = await response.text();
      const entries = parseDirectoryListing(html);
      return new Response(JSON.stringify({ entries, basePath }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // File content mode
    const content = await response.text();
    return new Response(JSON.stringify({ content, basePath }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Source fetch error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
