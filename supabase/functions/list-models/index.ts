/**
 * List available models for a given LLM provider.
 *
 * BYOK: the user's API key is required. Returns a normalised list of
 * model IDs and display names, filtered to text-generation models only.
 */

import {
  forbiddenOrigin,
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
  parseJsonBody,
  requireJsonRequest,
  sanitizeUpstreamError,
  validateRequestOrigin,
} from '../_shared/http.ts';
import { isObject } from '../_shared/validation.ts';

interface ModelEntry {
  id: string;
  name: string;
}

// ── Provider-specific fetchers ────────────────────────────────

const FETCH_TIMEOUT = 10_000;

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/** OpenAI and OpenAI-compatible APIs (DeepSeek, custom). */
async function fetchOpenAIModels(apiKey: string, baseURL?: string): Promise<ModelEntry[]> {
  const url = `${(baseURL ?? 'https://api.openai.com/v1').replace(/\/+$/, '')}/models`;
  const data = await fetchJson(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!isObject(data) || !Array.isArray((data as Record<string, unknown>).data)) return [];

  const CHAT_PREFIXES = ['gpt-', 'o1', 'o3', 'o4', 'chatgpt-'];
  const EXCLUDE = ['whisper', 'dall-e', 'tts', 'embedding', 'babbage', 'davinci', 'moderation'];

  return ((data as Record<string, unknown>).data as Array<Record<string, unknown>>)
    .filter((m) => {
      const id = String(m.id ?? '').toLowerCase();
      // For custom/DeepSeek endpoints, include everything
      if (baseURL) return true;
      // For OpenAI, filter to chat models
      const isChat = CHAT_PREFIXES.some((p) => id.startsWith(p));
      const isExcluded = EXCLUDE.some((e) => id.includes(e));
      return isChat && !isExcluded;
    })
    .map((m) => ({ id: String(m.id), name: String(m.id) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Anthropic models API. */
async function fetchAnthropicModels(apiKey: string): Promise<ModelEntry[]> {
  const data = await fetchJson('https://api.anthropic.com/v1/models?limit=100', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });

  if (!isObject(data) || !Array.isArray((data as Record<string, unknown>).data)) return [];

  return ((data as Record<string, unknown>).data as Array<Record<string, unknown>>)
    .map((m) => ({
      id: String(m.id),
      name: String((m as Record<string, unknown>).display_name ?? m.id),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Google Generative AI (Gemini). */
async function fetchGoogleModels(apiKey: string): Promise<ModelEntry[]> {
  const data = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=100`,
  );

  if (!isObject(data) || !Array.isArray((data as Record<string, unknown>).models)) return [];

  return ((data as Record<string, unknown>).models as Array<Record<string, unknown>>)
    .filter((m) => {
      const methods = m.supportedGenerationMethods;
      return Array.isArray(methods) && methods.includes('generateContent');
    })
    .map((m) => {
      const fullName = String(m.name ?? '');
      const id = fullName.replace(/^models\//, '');
      return { id, name: String(m.displayName ?? id) };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Mistral models API. */
async function fetchMistralModels(apiKey: string): Promise<ModelEntry[]> {
  const data = await fetchJson('https://api.mistral.ai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!isObject(data) || !Array.isArray((data as Record<string, unknown>).data)) return [];

  return ((data as Record<string, unknown>).data as Array<Record<string, unknown>>)
    .filter((m) => {
      const caps = m.capabilities;
      if (!isObject(caps)) return true;
      return (caps as Record<string, unknown>).completion_chat !== false;
    })
    .map((m) => ({
      id: String(m.id),
      name: String(m.id),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// ── Provider dispatch ─────────────────────────────────────────

type ProviderFetcher = (apiKey: string, baseURL?: string) => Promise<ModelEntry[]>;

const FETCHERS: Record<string, ProviderFetcher> = {
  openai: (key) => fetchOpenAIModels(key),
  anthropic: (key) => fetchAnthropicModels(key),
  google: (key) => fetchGoogleModels(key),
  mistral: (key) => fetchMistralModels(key),
  deepseek: (key) => fetchOpenAIModels(key, 'https://api.deepseek.com/v1'),
  custom: (key, baseURL) => fetchOpenAIModels(key, baseURL),
};

// ── Request handler ───────────────────────────────────────────

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return optionsResponse(req);
  if (req.method !== 'POST') return methodNotAllowed(req);
  if (!validateRequestOrigin(req).allowed) return forbiddenOrigin(req);

  const jsonError = requireJsonRequest(req);
  if (jsonError) return jsonError;

  try {
    const body = await parseJsonBody(req);
    if (!isObject(body)) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_PAYLOAD', message: 'Expected JSON object.' },
        { status: 400 },
      );
    }

    const { provider, apiKey, baseURL } = body as Record<string, unknown>;

    if (typeof provider !== 'string' || !provider.trim()) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_PAYLOAD', message: 'Missing provider.' },
        { status: 400 },
      );
    }

    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      return jsonResponse(
        req,
        { ok: false, code: 'MISSING_API_KEY', message: 'Missing API key.' },
        { status: 400 },
      );
    }

    const fetcher = FETCHERS[provider];
    if (!fetcher) {
      return jsonResponse(
        req,
        { ok: false, code: 'UNKNOWN_PROVIDER', message: `Unknown provider: ${provider}` },
        { status: 400 },
      );
    }

    const parsedBaseURL =
      typeof baseURL === 'string' && baseURL.trim() ? baseURL.trim() : undefined;
    const models = await fetcher(apiKey, parsedBaseURL);

    return jsonResponse(req, { ok: true, models });
  } catch (error) {
    const message =
      error instanceof Error
        ? sanitizeUpstreamError(error.message, 'Failed to list models.')
        : 'Failed to list models.';
    return jsonResponse(req, { ok: false, code: 'UPSTREAM_ERROR', message }, { status: 502 });
  }
}

if (import.meta.main && typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleRequest);
}
