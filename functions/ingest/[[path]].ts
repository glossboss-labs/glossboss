/**
 * Cloudflare Pages Function — PostHog reverse proxy.
 *
 * Forwards `/ingest/*` requests to `eu.i.posthog.com` so that analytics
 * traffic looks like first-party requests and isn't blocked by ad blockers.
 *
 * The PostHog JS SDK is configured with `api_host: '/ingest'` so all capture,
 * decide, and flag requests hit this proxy transparently.
 */

const POSTHOG_HOST = 'https://eu.i.posthog.com';
const POSTHOG_ASSETS_HOST = 'https://eu-assets.i.posthog.com';

export const onRequest: PagesFunction = async ({ request, params }) => {
  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path ?? '');
  const url = new URL(request.url);

  // Asset requests (config.js, surveys.js, etc.) go to the assets host.
  const isAsset = path.startsWith('static/') || path.startsWith('array/') || path.endsWith('.js');
  const upstream = isAsset ? POSTHOG_ASSETS_HOST : POSTHOG_HOST;
  const target = new URL(`/${path}${url.search}`, upstream);

  const headers = new Headers(request.headers);
  headers.set('host', target.hostname);
  // Strip all Cloudflare-specific headers — no client IP or identity data is
  // forwarded to PostHog. Geo-location insights are sacrificed in favour of
  // not sharing user IP addresses with a third party.
  headers.delete('cf-connecting-ip');
  headers.delete('x-forwarded-for');
  headers.delete('cf-ipcountry');
  headers.delete('cf-ray');
  headers.delete('cf-visitor');

  const response = await fetch(target.toString(), {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'follow',
  });

  const responseHeaders = new Headers(response.headers);
  // Allow CORS for the proxied response.
  responseHeaders.set('access-control-allow-origin', url.origin);
  responseHeaders.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  responseHeaders.set('access-control-allow-headers', 'Content-Type');
  // Remove any upstream CSP that might interfere.
  responseHeaders.delete('content-security-policy');

  // Handle CORS preflight.
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};
