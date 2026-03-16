/**
 * Polar Checkout Edge Function
 *
 * Creates a Polar checkout session for a given product and redirects.
 * Links the Polar customer to the Supabase user via externalId.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const POLAR_API_URL = 'https://api.polar.sh/v1';

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const polarAccessToken = Deno.env.get('POLAR_ACCESS_TOKEN');
  if (!polarAccessToken) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  // Authenticate the Supabase user
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization header' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // Parse request body
  let body: { productId: string; successUrl?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.productId) {
    return jsonResponse({ error: 'Missing productId' }, 400);
  }

  const successUrl =
    body.successUrl || `${supabaseUrl.replace('.supabase.co', '.pages.dev')}/settings?tab=billing`;

  // Create Polar checkout session
  const checkoutResponse = await fetch(`${POLAR_API_URL}/checkouts/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${polarAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      products: [body.productId],
      customer_external_id: user.id,
      customer_email: user.email,
      success_url: successUrl,
    }),
  });

  if (!checkoutResponse.ok) {
    const errorText = await checkoutResponse.text();
    console.error('Polar checkout creation failed:', checkoutResponse.status, errorText);
    return jsonResponse({ error: 'Failed to create checkout session' }, 502);
  }

  const checkout = await checkoutResponse.json();

  return jsonResponse({ url: checkout.url });
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
