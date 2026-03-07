/**
 * DeepL Translation Edge Function
 *
 * Proxies translation requests to DeepL API.
 * Keeps DEEPL_KEY secure on the server side.
 *
 * Endpoints:
 * - POST { action: 'translate', text, targetLang, ... } -> Translate text
 * - POST { action: 'usage' } -> Get usage statistics
 * - POST { action: 'createGlossary', name, sourceLang, targetLang, entries } -> Create glossary
 * - POST { action: 'listGlossaries' } -> List all glossaries
 * - POST { action: 'deleteGlossary', glossaryId } -> Delete a glossary
 * - POST { action: 'getGlossary', glossaryId } -> Get glossary details
 */

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Convert glossary entries to TSV format for DeepL
 * Format: source\ttarget\n
 */
function entriesToTSV(entries: Array<{ source: string; target: string }>): string {
  return entries
    .filter((e) => e.source && e.target)
    .map((e) => `${e.source}\t${e.target}`)
    .join('\n');
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, userApiKey, apiType, ...params } = body;

    // Use user-provided API key if available, otherwise fall back to server key
    const apiKey = userApiKey || Deno.env.get('DEEPL_KEY');

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          message: 'No API key configured. Please add your DeepL API key in Settings.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Determine API URL based on apiType (free vs pro)
    const baseUrl =
      apiType === 'pro' ? 'https://api.deepl.com/v2' : 'https://api-free.deepl.com/v2';

    // ==================== TRANSLATE ====================
    if (action === 'translate') {
      const { text, targetLang, sourceLang, formality, glossaryId } = params;

      if (!text || !targetLang) {
        return new Response(
          JSON.stringify({ message: 'Missing required fields: text, targetLang' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Build request body
      const translateBody: Record<string, unknown> = {
        text: Array.isArray(text) ? text : [text],
        target_lang: targetLang,
      };

      if (sourceLang) translateBody.source_lang = sourceLang;
      if (formality) translateBody.formality = formality;
      if (glossaryId) translateBody.glossary_id = glossaryId;

      const response = await fetch(`${baseUrl}/translate`, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(translateBody),
      });

      if (!response.ok) {
        const error = await response.text();
        return new Response(JSON.stringify({ message: `DeepL API error: ${error}` }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== USAGE ====================
    if (action === 'usage') {
      const response = await fetch(`${baseUrl}/usage`, {
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
        },
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ message: 'Failed to fetch usage' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({
          characterCount: data.character_count,
          characterLimit: data.character_limit,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ==================== CREATE GLOSSARY ====================
    if (action === 'createGlossary') {
      const { name, sourceLang, targetLang, entries } = params;

      if (!name || !sourceLang || !targetLang || !entries || !entries.length) {
        return new Response(
          JSON.stringify({
            message: 'Missing required fields: name, sourceLang, targetLang, entries',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Convert entries to TSV format
      const entriesTsv = entriesToTSV(entries);

      if (!entriesTsv) {
        return new Response(JSON.stringify({ message: 'No valid entries provided' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create glossary via DeepL API using JSON
      // Note: DeepL API also accepts JSON format for glossary creation
      const glossaryBody = {
        name,
        source_lang: sourceLang,
        target_lang: targetLang,
        entries: entriesTsv,
        entries_format: 'tsv',
      };

      const response = await fetch(`${baseUrl}/glossaries`, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(glossaryBody),
      });

      if (!response.ok) {
        const error = await response.text();
        return new Response(JSON.stringify({ message: `Failed to create glossary: ${error}` }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({
          glossaryId: data.glossary_id,
          name: data.name,
          sourceLang: data.source_lang,
          targetLang: data.target_lang,
          entryCount: data.entry_count,
          creationTime: data.creation_time,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ==================== LIST GLOSSARIES ====================
    if (action === 'listGlossaries') {
      const response = await fetch(`${baseUrl}/glossaries`, {
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
        },
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ message: 'Failed to list glossaries' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      const glossaries = (data.glossaries || []).map((g: Record<string, unknown>) => ({
        glossaryId: g.glossary_id,
        name: g.name,
        sourceLang: g.source_lang,
        targetLang: g.target_lang,
        entryCount: g.entry_count,
        creationTime: g.creation_time,
      }));

      return new Response(JSON.stringify({ glossaries }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== DELETE GLOSSARY ====================
    if (action === 'deleteGlossary') {
      const { glossaryId } = params;

      if (!glossaryId) {
        return new Response(JSON.stringify({ message: 'Missing required field: glossaryId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await fetch(`${baseUrl}/glossaries/${glossaryId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        return new Response(JSON.stringify({ message: 'Failed to delete glossary' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== GET GLOSSARY ====================
    if (action === 'getGlossary') {
      const { glossaryId } = params;

      if (!glossaryId) {
        return new Response(JSON.stringify({ message: 'Missing required field: glossaryId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await fetch(`${baseUrl}/glossaries/${glossaryId}`, {
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
        },
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ message: 'Glossary not found' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({
          glossaryId: data.glossary_id,
          name: data.name,
          sourceLang: data.source_lang,
          targetLang: data.target_lang,
          entryCount: data.entry_count,
          creationTime: data.creation_time,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ message: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
