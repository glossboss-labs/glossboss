/**
 * Settings Key Edge Function
 *
 * Derives a per-user AES-256 encryption key for encrypting credentials
 * stored in profiles.settings. The key is derived from HMAC-SHA256 of
 * the user's ID with a server-side secret, ensuring:
 * - The key never lives in the database
 * - Each user gets a unique, deterministic key
 * - A database dump cannot decrypt credentials
 */

import { requireAuth } from '../_shared/auth.ts';
import {
  jsonResponse,
  optionsResponse,
  methodNotAllowed,
  forbiddenOrigin,
  validateRequestOrigin,
} from '../_shared/http.ts';

const encoder = new TextEncoder();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse(req);
  if (req.method !== 'POST') return methodNotAllowed(req);

  const origin = validateRequestOrigin(req);
  if (!origin.allowed) return forbiddenOrigin(req);

  // Authenticate
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  const secret = Deno.env.get('SETTINGS_ENCRYPTION_KEY');
  if (!secret) {
    return jsonResponse(
      req,
      { ok: false, code: 'SERVER_ERROR', message: 'Encryption not configured.' },
      { status: 500 },
    );
  }

  // Derive per-user key: HMAC-SHA256(server_secret, user_id) → 32 bytes
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const derived = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(auth.user.id));

  // Return as base64
  const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(derived)));

  return jsonResponse(req, { ok: true, key: keyBase64 });
});
