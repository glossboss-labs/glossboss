/**
 * URL Glossary Fetch Edge Function
 *
 * Proxies requests to fetch glossary CSVs from arbitrary URLs.
 * Validates URL safety (HTTPS only, no private IPs) and returns CSV content.
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

const FETCH_TIMEOUT_MS = 10000;
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5 MB

/** Validate that a URL is safe to fetch (HTTPS, no private IPs). */
function isValidUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);

    // Only allow HTTPS
    if (parsed.protocol !== 'https:') return false;

    // Block obvious private/loopback hostnames
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
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

    if (!isValidUrl(body.url)) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: 'Provide a valid HTTPS URL to a glossary CSV file.',
        },
        { status: 400 },
      );
    }

    const url = (body.url as string).trim();

    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS, {
      method: 'GET',
      headers: {
        Accept: 'text/csv, text/plain, */*',
        'User-Agent': 'GlossBoss/1.0 (Glossary Fetch)',
      },
    });

    if (!response.ok) {
      const message = sanitizeUpstreamError(
        await response.text().catch(() => ''),
        `Remote server returned HTTP ${response.status}.`,
      );

      return jsonResponse(
        req,
        { ok: false, code: 'UPSTREAM_ERROR', message },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502 },
      );
    }

    // Check content length to avoid excessive memory use
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      return jsonResponse(
        req,
        { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Glossary file exceeds 5 MB limit.' },
        { status: 413 },
      );
    }

    const csv = await response.text();
    if (csv.length > MAX_RESPONSE_SIZE) {
      return jsonResponse(
        req,
        { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Glossary file exceeds 5 MB limit.' },
        { status: 413 },
      );
    }

    return jsonResponse(req, { csv, url });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_PAYLOAD', message: 'Request body is not valid JSON.' },
        { status: 400 },
      );
    }

    const message = isAbortError(error)
      ? 'Glossary URL fetch timed out.'
      : 'Failed to fetch glossary from URL.';

    return jsonResponse(req, { ok: false, code: 'INTERNAL_ERROR', message }, { status: 500 });
  }
});
