/**
 * WordPress Glossary Proxy Edge Function
 * 
 * Proxies requests to WordPress.org glossary CSV exports.
 * Required because WordPress.org doesn't allow CORS for CSV downloads.
 */

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** WordPress.org glossary export URL template */
const WP_GLOSSARY_URL = 'https://translate.wordpress.org/locale/{locale}/default/glossary/-export/';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const body = await req.json();
    const { locale } = body;
    
    if (!locale) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: locale' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const normalizedLocale = locale.toLowerCase().trim();
    const url = WP_GLOSSARY_URL.replace('{locale}', normalizedLocale);
    
    console.log(`Fetching glossary for locale: ${normalizedLocale}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv, text/plain, */*',
        'User-Agent': 'GlossBoss/1.0 (WordPress Translation Editor)',
      },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ 
            error: `Glossary not found for locale "${normalizedLocale}". Check if this locale exists on WordPress.org.` 
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `WordPress.org returned HTTP ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const csvText = await response.text();
    
    // Return the raw CSV text
    return new Response(
      JSON.stringify({ csv: csvText, locale: normalizedLocale }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Glossary fetch error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
