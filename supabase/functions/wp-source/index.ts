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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { slug, path, list } = body;

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

    const cleanPath = (path || '').replace(/^\/+/, '');
    const svnUrl = `https://plugins.svn.wordpress.org/${slug}/trunk/${cleanPath}`;

    console.log(`Fetching: ${svnUrl} (list: ${!!list})`);

    const response = await fetch(svnUrl, {
      headers: {
        'User-Agent': 'GlossBoss/1.0 (WordPress Translation Editor)',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(JSON.stringify({ error: `Not found: ${slug}/trunk/${cleanPath}` }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
      return new Response(JSON.stringify({ entries }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // File content mode
    const content = await response.text();
    return new Response(JSON.stringify({ content }), {
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
