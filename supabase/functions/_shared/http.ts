export interface JsonResponseInit {
  status?: number;
  headers?: HeadersInit;
}

export interface OriginValidationResult {
  allowed: boolean;
  origin: string | null;
  allowedOrigins: string[];
}

const DEFAULT_ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type';
const DEFAULT_ALLOWED_METHODS = 'POST, OPTIONS';

export function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? '';
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(
  origin: string | null,
  allowedOrigins = getAllowedOrigins(),
): boolean {
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

export function validateRequestOrigin(req: Request): OriginValidationResult {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.get('origin');

  if (allowedOrigins.length === 0) {
    return { allowed: false, origin, allowedOrigins };
  }

  return {
    allowed: isAllowedOrigin(origin, allowedOrigins),
    origin,
    allowedOrigins,
  };
}

export function buildCorsHeaders(origin: string | null): HeadersInit {
  const allowedOrigins = getAllowedOrigins();
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : 'null';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': DEFAULT_ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': DEFAULT_ALLOWED_METHODS,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function jsonResponse(
  req: Request,
  body: Record<string, unknown>,
  init: JsonResponseInit = {},
): Response {
  const headers = new Headers(buildCorsHeaders(req.headers.get('origin')));
  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => {
      const lowerKey = key.toLowerCase();

      if (lowerKey === 'vary') {
        const existing = headers.get('Vary');
        headers.set('Vary', existing ? `${existing}, ${value}` : value);
        return;
      }

      if (lowerKey.startsWith('access-control-')) {
        return;
      }

      headers.set(key, value);
    });
  }
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

export function optionsResponse(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(req.headers.get('origin')),
  });
}

export function methodNotAllowed(req: Request, method = 'POST'): Response {
  return jsonResponse(
    req,
    {
      ok: false,
      code: 'METHOD_NOT_ALLOWED',
      message: `Only ${method} is allowed.`,
    },
    { status: 405 },
  );
}

export function unsupportedMediaType(req: Request): Response {
  return jsonResponse(
    req,
    {
      ok: false,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'Requests must use Content-Type: application/json.',
    },
    { status: 415 },
  );
}

export function forbiddenOrigin(req: Request): Response {
  return jsonResponse(
    req,
    {
      ok: false,
      code: 'FORBIDDEN_ORIGIN',
      message: 'This origin is not allowed to access the API.',
    },
    { status: 403 },
  );
}

export function requireJsonRequest(req: Request): Response | null {
  if (req.method === 'OPTIONS') return null;
  const contentType = req.headers.get('content-type') ?? '';
  return contentType.toLowerCase().includes('application/json') ? null : unsupportedMediaType(req);
}

export async function parseJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new SyntaxError('Request body is not valid JSON.');
  }
}

export async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  let listenerAdded = false;

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      abortFromUpstream();
    } else {
      upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true });
      listenerAdded = true;
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    if (listenerAdded) {
      upstreamSignal!.removeEventListener('abort', abortFromUpstream);
    }
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export function sanitizeUpstreamError(message: string, fallback: string): string {
  const trimmed = message.trim();
  if (!trimmed) return fallback;
  const singleLine = trimmed.replace(/\s+/g, ' ').slice(0, 300);
  return singleLine || fallback;
}
