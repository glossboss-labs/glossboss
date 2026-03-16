/**
 * Polar Checkout Edge Function
 *
 * Creates a Polar checkout session for a given product and redirects.
 * Links the Polar customer to the Supabase user via externalId.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  forbiddenOrigin,
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
  validateRequestOrigin,
} from '../_shared/http.ts';

const POLAR_API_URL = 'https://api.polar.sh/v1';

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return optionsResponse(req);
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(req);
  }

  const originValidation = validateRequestOrigin(req);
  if (originValidation.allowedOrigins.length === 0) {
    return jsonResponse(
      req,
      { ok: false, code: 'SERVER_MISCONFIGURED', message: 'Checkout is not configured correctly.' },
      { status: 500 },
    );
  }
  if (!originValidation.allowed) {
    return forbiddenOrigin(req);
  }

  const polarAccessToken = Deno.env.get('POLAR_ACCESS_TOKEN');
  if (!polarAccessToken) {
    return jsonResponse(
      req,
      { ok: false, code: 'SERVER_MISCONFIGURED', message: 'Checkout is not configured correctly.' },
      { status: 500 },
    );
  }

  // Authenticate the Supabase user
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return jsonResponse(
      req,
      { ok: false, code: 'UNAUTHORIZED', message: 'Missing authorization header.' },
      { status: 401 },
    );
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
    return jsonResponse(
      req,
      { ok: false, code: 'UNAUTHORIZED', message: 'Unauthorized.' },
      { status: 401 },
    );
  }

  // Parse request body
  let body: { productId: string; successUrl?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(
      req,
      { ok: false, code: 'INVALID_PAYLOAD', message: 'Invalid JSON.' },
      { status: 400 },
    );
  }

  if (!body.productId) {
    return jsonResponse(
      req,
      { ok: false, code: 'INVALID_PAYLOAD', message: 'Missing productId.' },
      { status: 400 },
    );
  }

  const appUrl = Deno.env.get('APP_URL');
  if (!appUrl && !body.successUrl) {
    return jsonResponse(
      req,
      { ok: false, code: 'SERVER_MISCONFIGURED', message: 'Checkout is not configured correctly.' },
      { status: 500 },
    );
  }
  const successUrl = body.successUrl || `${appUrl}/settings?tab=billing`;

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
    return jsonResponse(
      req,
      { ok: false, code: 'CHECKOUT_FAILED', message: 'Failed to create checkout session.' },
      { status: 502 },
    );
  }

  const checkout = await checkoutResponse.json();

  return jsonResponse(req, { ok: true, url: checkout.url });
}

if (import.meta.main && typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleRequest);
}

export { handleRequest };
