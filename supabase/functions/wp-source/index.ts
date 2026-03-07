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

/** Cache of resolved base paths (slug → "trunk" or "tags/x.y.z") */
const basePathCache = new Map<string, string>();

/**
 * Resolve the base path for a plugin.
 * Tries trunk first; if trunk is empty, falls back to the latest tag.
 */
async function resolveBasePath(slug: string): Promise<string> {
  const cached = basePathCache.get(slug);
  if (cached) return cached;

  // Check if trunk has content
  const trunkRes = await fetch(`${SVN_BASE}/${slug}/trunk/`, { headers: FETCH_HEADERS });
  if (trunkRes.ok) {
    const html = await trunkRes.text();
    const entries = parseDirectoryListing(html);
    if (entries.length > 0) {
      basePathCache.set(slug, 'trunk');
      return 'trunk';
    }
  }

  // Trunk is empty or missing — find the latest tag
  const tagsRes = await fetch(`${SVN_BASE}/${slug}/tags/`, { headers: FETCH_HEADERS });
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

    // If a specific version is requested, try that tag first
    let basePath: string;
    if (version && /^[\d][\d.]*(-[\w.]+)?$/.test(version)) {
      // Check if the requested tag exists
      const tagUrl = `${SVN_BASE}/${slug}/tags/${version}/`;
      const tagRes = await fetch(tagUrl, { headers: FETCH_HEADERS });
      if (tagRes.ok) {
        basePath = `tags/${version}`;
      } else {
        // Fall back to auto-resolution
        basePath = await resolveBasePath(slug);
      }
    } else {
      basePath = await resolveBasePath(slug);
    }
    const cleanPath = (path || '').replace(/^\/+/, '');
    const svnUrl = `${SVN_BASE}/${slug}/${basePath}/${cleanPath}`;

    console.log(`Fetching: ${svnUrl} (list: ${!!list}, base: ${basePath})`);

    const response = await fetch(svnUrl, { headers: FETCH_HEADERS });

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ error: `Not found: ${slug}/${basePath}/${cleanPath}` }),
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
