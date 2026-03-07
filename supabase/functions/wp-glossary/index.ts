/**
 * WordPress Glossary Proxy Edge Function
 *
 * Proxies requests to WordPress.org glossary CSV exports with input validation
 * and origin restrictions.
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
const LOCALE_RE = /^[a-z]{2,3}(?:[-_][a-z0-9]{2,8})?$/;
const WP_GLOSSARY_URL = 'https://translate.wordpress.org/locale/{locale}/default/glossary/-export/';

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseLocale(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const locale = value.trim().toLowerCase();
  return locale && locale.length <= 32 && LOCALE_RE.test(locale) ? locale : null;
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

    const locale = parseLocale(body.locale);
    if (!locale) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_PAYLOAD', message: 'Provide a valid WordPress locale.' },
        { status: 400 },
      );
    }

    const response = await fetchWithTimeout(
      WP_GLOSSARY_URL.replace('{locale}', locale),
      FETCH_TIMEOUT_MS,
      {
        method: 'GET',
        headers: {
          Accept: 'text/csv, text/plain, */*',
          'User-Agent': 'GlossBoss/1.0 (WordPress Translation Editor)',
        },
      },
    );

    if (!response.ok) {
      const message =
        response.status === 404
          ? `Glossary not found for locale "${locale}".`
          : sanitizeUpstreamError(
              await response.text().catch(() => ''),
              `WordPress.org returned HTTP ${response.status}.`,
            );

      return jsonResponse(
        req,
        { ok: false, code: 'UPSTREAM_ERROR', message },
        { status: response.status },
      );
    }

    return jsonResponse(req, {
      csv: await response.text(),
      locale,
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
      ? 'WordPress glossary request timed out.'
      : 'Failed to fetch WordPress glossary.';

    return jsonResponse(req, { ok: false, code: 'INTERNAL_ERROR', message }, { status: 500 });
  }
});
