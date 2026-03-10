import {
  buildCorsHeaders,
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

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io';
const ELEVENLABS_TIMEOUT_MS = 20000;
const MAX_TEXT_LENGTH = 500;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_PER_IP = 30;
const RATE_LIMIT_GLOBAL = 300;
const API_KEY_RE = /^[A-Za-z0-9_-]{16,128}$/;
const VOICE_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;

const ipRequestLog = new Map<string, number[]>();
const globalRequestLog: number[] = [];

type Action = 'usage' | 'listVoices' | 'speak';

interface UsageResponse {
  characterCount: number;
  characterLimit: number;
  tier?: string | null;
  status?: string | null;
  nextResetUnix?: number | null;
}

function nowMs(): number {
  return Date.now();
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

function pruneOldRequests(timestamp: number): void {
  const threshold = timestamp - RATE_LIMIT_WINDOW_MS;

  for (const [ip, entries] of ipRequestLog.entries()) {
    const filtered = entries.filter((entry) => entry >= threshold);
    if (filtered.length === 0) {
      ipRequestLog.delete(ip);
      continue;
    }
    ipRequestLog.set(ip, filtered);
  }

  const filteredGlobalEntries = globalRequestLog.filter((entry) => entry >= threshold);
  globalRequestLog.length = 0;
  globalRequestLog.push(...filteredGlobalEntries);
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const timestamp = nowMs();
  pruneOldRequests(timestamp);

  const ipEntries = ipRequestLog.get(ip) ?? [];
  if (ipEntries.length >= RATE_LIMIT_PER_IP) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (timestamp - ipEntries[0]);
    return { allowed: false, retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  if (globalRequestLog.length >= RATE_LIMIT_GLOBAL) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (timestamp - globalRequestLog[0]);
    return { allowed: false, retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  ipEntries.push(timestamp);
  ipRequestLog.set(ip, ipEntries);
  globalRequestLog.push(timestamp);

  return { allowed: true };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function trimAndLimit(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function parseAction(value: unknown): Action | null {
  switch (value) {
    case 'usage':
    case 'listVoices':
    case 'speak':
      return value;
    default:
      return null;
  }
}

function parseApiKey(value: unknown): string | null {
  if (!isNonEmptyString(value)) return null;
  const apiKey = value.trim();
  return API_KEY_RE.test(apiKey) ? apiKey : null;
}

function parseVoiceId(value: unknown): string | null {
  if (!isNonEmptyString(value)) return null;
  const voiceId = value.trim();
  return VOICE_ID_RE.test(voiceId) ? voiceId : null;
}

function normalizeUsage(value: Record<string, unknown>): UsageResponse {
  const nextInvoice = isObject(value.next_invoice)
    ? (value.next_invoice as Record<string, unknown>)
    : null;
  const nextResetValue =
    typeof value.next_character_count_reset_unix === 'number'
      ? value.next_character_count_reset_unix
      : typeof nextInvoice?.next_invoice_due_date_unix === 'number'
        ? nextInvoice.next_invoice_due_date_unix
        : null;

  return {
    characterCount:
      typeof value.character_count === 'number'
        ? value.character_count
        : typeof value.characterCount === 'number'
          ? value.characterCount
          : 0,
    characterLimit:
      typeof value.character_limit === 'number'
        ? value.character_limit
        : typeof value.characterLimit === 'number'
          ? value.characterLimit
          : 0,
    tier: typeof value.tier === 'string' ? value.tier : null,
    status: typeof value.status === 'string' ? value.status : null,
    nextResetUnix: nextResetValue,
  };
}

function redactApiKey(message: string, apiKey: string): string {
  return message.replaceAll(apiKey, '[redacted]');
}

async function sendElevenLabsRequest(
  url: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('xi-api-key', apiKey);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  return await fetchWithTimeout(url, ELEVENLABS_TIMEOUT_MS, {
    ...init,
    headers,
  });
}

async function proxyElevenLabsError(
  req: Request,
  response: Response,
  apiKey: string,
  fallback: string,
): Promise<Response> {
  const errorText = await response.text().catch(() => '');
  return jsonResponse(
    req,
    {
      ok: false,
      code: 'UPSTREAM_ERROR',
      message: sanitizeUpstreamError(redactApiKey(errorText, apiKey), fallback),
    },
    { status: response.status },
  );
}

export async function handleTtsElevenLabsRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return optionsResponse(req);
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(req);
  }

  if (!validateRequestOrigin(req).allowed) {
    return forbiddenOrigin(req);
  }

  const rateLimit = checkRateLimit(getClientIp(req));
  if (!rateLimit.allowed) {
    return jsonResponse(
      req,
      {
        ok: false,
        code: 'RATE_LIMITED',
        message: 'Too many text-to-speech requests. Please try again later.',
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) },
      },
    );
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

    const action = parseAction(body.action);
    if (!action) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_ACTION', message: 'Unsupported TTS action.' },
        { status: 400 },
      );
    }

    const apiKey = parseApiKey(body.apiKey);
    if (!apiKey) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'MISSING_API_KEY',
          message: 'Add your ElevenLabs API key in Settings before using cloud speech.',
        },
        { status: 400 },
      );
    }

    if (action === 'usage') {
      const response = await sendElevenLabsRequest(
        `${ELEVENLABS_API_BASE}/v1/user/subscription`,
        apiKey,
      );
      if (!response.ok) {
        return await proxyElevenLabsError(
          req,
          response,
          apiKey,
          'Failed to fetch ElevenLabs usage.',
        );
      }

      const data = await response.json();
      return jsonResponse(req, normalizeUsage(isObject(data) ? data : {}));
    }

    if (action === 'listVoices') {
      const response = await sendElevenLabsRequest(`${ELEVENLABS_API_BASE}/v1/voices`, apiKey);
      if (!response.ok) {
        return await proxyElevenLabsError(
          req,
          response,
          apiKey,
          'Failed to load ElevenLabs voices.',
        );
      }

      const data = await response.json();
      const voices = Array.isArray(data.voices)
        ? data.voices
            .filter((voice): voice is Record<string, unknown> => isObject(voice))
            .map((voice) => ({
              voiceId: typeof voice.voice_id === 'string' ? voice.voice_id : '',
              name: typeof voice.name === 'string' ? voice.name : 'Unnamed voice',
              labels: isObject(voice.labels)
                ? Object.fromEntries(
                    Object.entries(voice.labels).filter((entry): entry is [string, string] => {
                      return typeof entry[1] === 'string';
                    }),
                  )
                : undefined,
              previewUrl: typeof voice.preview_url === 'string' ? voice.preview_url : null,
            }))
            .filter((voice) => Boolean(voice.voiceId))
        : [];

      return jsonResponse(req, { voices });
    }

    const voiceId = parseVoiceId(body.voiceId);
    if (!voiceId) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_PAYLOAD', message: 'Provide a valid ElevenLabs voiceId.' },
        { status: 400 },
      );
    }

    const text = isNonEmptyString(body.text) ? trimAndLimit(body.text, MAX_TEXT_LENGTH) : '';
    if (!text) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_PAYLOAD', message: 'Field "text" is required.' },
        { status: 400 },
      );
    }

    const requestBody: Record<string, unknown> = {
      text,
      model_id: isNonEmptyString(body.modelId)
        ? trimAndLimit(body.modelId, 64)
        : 'eleven_multilingual_v2',
    };

    if (isNonEmptyString(body.languageCode)) {
      requestBody.language_code = trimAndLimit(body.languageCode, 24);
    }

    const response = await sendElevenLabsRequest(
      `${ELEVENLABS_API_BASE}/v1/text-to-speech/${voiceId}`,
      apiKey,
      {
        method: 'POST',
        headers: { Accept: 'audio/mpeg' },
        body: JSON.stringify(requestBody),
      },
    );

    if (!response.ok) {
      return await proxyElevenLabsError(req, response, apiKey, 'Failed to synthesize speech.');
    }

    const headers = new Headers(buildCorsHeaders(req.headers.get('origin')));
    headers.set('Content-Type', response.headers.get('Content-Type') ?? 'audio/mpeg');
    headers.set('Cache-Control', 'no-store');

    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_PAYLOAD', message: 'Request body must be valid JSON.' },
        { status: 400 },
      );
    }
    const message = isAbortError(error)
      ? 'ElevenLabs request timed out.'
      : 'ElevenLabs proxy request failed.';
    return jsonResponse(req, { ok: false, code: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}

if (import.meta.main && typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleTtsElevenLabsRequest);
}
