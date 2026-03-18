/**
 * Unified LLM translation edge function.
 *
 * Handles all LLM-based translation providers (OpenAI, Anthropic, Google,
 * Mistral, DeepSeek, and custom OpenAI-compatible endpoints) through a
 * single function using the Vercel AI SDK.
 *
 * BYOK: the user's API key is required in the request body.
 */

import { generateText, Output } from 'npm:ai@^4';
import { createOpenAI } from 'npm:@ai-sdk/openai@^1';
import { createAnthropic } from 'npm:@ai-sdk/anthropic@^1';
import { createGoogleGenerativeAI } from 'npm:@ai-sdk/google@^1';
import { createMistral } from 'npm:@ai-sdk/mistral@^1';
import { z } from 'npm:zod@^3';

import {
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
import { isObject } from '../_shared/validation.ts';
import {
  buildInstruction,
  buildUserPayload,
  findMissingGlossaryTerms,
  parseLlmTranslatePayload,
  type LlmTranslatePayload,
} from '../_shared/llm-prompt.ts';
import { resolveProvider, type LlmProviderDef, type SdkType } from '../_shared/llm-providers.ts';

const DEFAULT_TEMPERATURE = 0.2;

// ── Model factory ──────────────────────────────────────────

function createModel(
  providerDef: LlmProviderDef,
  modelId: string,
  apiKey: string,
  customBaseURL?: string,
) {
  const baseURL = customBaseURL ?? providerDef.baseURL;

  const factories: Record<SdkType, () => ReturnType<ReturnType<typeof createOpenAI>>> = {
    openai: () => createOpenAI({ apiKey, baseURL: baseURL ?? undefined })(modelId),
    anthropic: () =>
      createAnthropic({ apiKey })(modelId) as ReturnType<ReturnType<typeof createOpenAI>>,
    google: () =>
      createGoogleGenerativeAI({ apiKey })(modelId) as ReturnType<ReturnType<typeof createOpenAI>>,
    mistral: () =>
      createMistral({ apiKey })(modelId) as ReturnType<ReturnType<typeof createOpenAI>>,
  };

  return factories[providerDef.sdk]();
}

// ── Translation core ───────────────────────────────────────

async function translateWithLlm(
  providerDef: LlmProviderDef,
  payload: LlmTranslatePayload,
  apiKey: string,
  strictGlossary: boolean,
): Promise<{
  translations: Array<{ text: string; warnings?: string[]; usedGlossaryTerms?: string[] }>;
}> {
  const modelId = payload.modelId ?? providerDef.defaultModel;
  const model = createModel(providerDef, modelId, apiKey, payload.baseURL);

  const systemPrompt = buildInstruction(payload, strictGlossary);
  const userPrompt = buildUserPayload(payload);

  const { object } = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: payload.temperature ?? DEFAULT_TEMPERATURE,
    output: Output.object({
      schema: z.object({
        translations: z.array(
          z.object({
            text: z.string(),
            warnings: z.array(z.string()).optional(),
            usedGlossaryTerms: z.array(z.string()).optional(),
          }),
        ),
      }),
    }),
    maxRetries: 1,
  });

  if (!object || !Array.isArray(object.translations)) {
    throw new Error('LLM response did not include translations.');
  }

  return {
    translations: object.translations.map((t) => ({
      text: typeof t.text === 'string' ? t.text : '',
      warnings: Array.isArray(t.warnings)
        ? t.warnings.filter((w): w is string => typeof w === 'string')
        : [],
      usedGlossaryTerms: Array.isArray(t.usedGlossaryTerms)
        ? t.usedGlossaryTerms.filter((term): term is string => typeof term === 'string')
        : [],
    })),
  };
}

// ── Custom baseURL validation ──────────────────────────────

function isValidCustomBaseURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;

    // Block private/internal IPs
    const hostname = parsed.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname.startsWith('192.168.') ||
      hostname.endsWith('.local')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ── Error classification ───────────────────────────────────

function classifyLlmError(message: string): { status: number; code: string; message: string } {
  const lower = message.toLowerCase();

  // Authentication errors
  if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('401')) {
    return {
      status: 401,
      code: 'AUTH_ERROR',
      message: sanitizeUpstreamError(message, 'Invalid API key. Check your key in Settings.'),
    };
  }

  // Model or endpoint not found
  if (lower.includes('not found') || lower.includes('404') || lower.includes('does not exist')) {
    return {
      status: 404,
      code: 'NOT_FOUND',
      message: sanitizeUpstreamError(
        message,
        'Model or endpoint not found. Check your model ID and base URL in Settings.',
      ),
    };
  }

  // Rate limiting
  if (lower.includes('rate limit') || lower.includes('429') || lower.includes('too many')) {
    return {
      status: 429,
      code: 'RATE_LIMITED',
      message: sanitizeUpstreamError(
        message,
        'Rate limited by the LLM provider. Try again shortly.',
      ),
    };
  }

  // Quota / billing
  if (lower.includes('quota') || lower.includes('billing') || lower.includes('insufficient')) {
    return {
      status: 402,
      code: 'QUOTA_EXCEEDED',
      message: sanitizeUpstreamError(
        message,
        'LLM provider quota exceeded. Check your billing or plan.',
      ),
    };
  }

  // Fallback
  return {
    status: 502,
    code: 'UPSTREAM_ERROR',
    message: sanitizeUpstreamError(
      message,
      'LLM translation failed. Check your provider settings.',
    ),
  };
}

// ── Request handler ────────────────────────────────────────

export async function handleLlmTranslateRequest(req: Request): Promise<Response> {
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

    const payload = parseLlmTranslatePayload(body);
    if (!payload) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message:
            'Provide a valid provider, 1-25 texts, a valid target language, and valid settings.',
        },
        { status: 400 },
      );
    }

    // Validate custom baseURL
    if (payload.baseURL && !isValidCustomBaseURL(payload.baseURL)) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'INVALID_BASE_URL',
          message: 'Custom base URL must use HTTPS and cannot point to private networks.',
        },
        { status: 400 },
      );
    }

    // Resolve provider
    const providerDef = resolveProvider(payload.provider, payload.baseURL);
    if (!providerDef) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'UNKNOWN_PROVIDER',
          message: `Unknown provider: ${payload.provider}. Use a preset provider or supply a custom baseURL.`,
        },
        { status: 400 },
      );
    }

    // API key: BYOK required (no server-side fallback for unified LLM function)
    const apiKey = payload.userApiKey ?? '';
    if (!apiKey) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'MISSING_API_KEY',
          message: 'Add your API key in Settings.',
        },
        { status: 400 },
      );
    }

    // Translate with two-pass glossary validation
    let result = await translateWithLlm(providerDef, payload, apiKey, false);

    const missingTerms = findMissingGlossaryTerms(result.translations, payload.glossaryEntries);
    if (missingTerms.length > 0) {
      result = await translateWithLlm(providerDef, payload, apiKey, true);
      const retriedMissingTerms = findMissingGlossaryTerms(
        result.translations,
        payload.glossaryEntries,
      );
      if (retriedMissingTerms.length > 0) {
        return jsonResponse(
          req,
          {
            ok: false,
            code: 'GLOSSARY_VALIDATION_FAILED',
            message: `LLM response missed required glossary terms: ${retriedMissingTerms.join(', ')}`,
          },
          { status: 422 },
        );
      }
    }

    return jsonResponse(req, {
      translations: result.translations.map((translation) => ({
        text: translation.text,
        metadata: {
          provider: payload.provider,
          usedGlossary: payload.glossaryEntries.length > 0,
          glossaryMode: payload.glossaryEntries.length > 0 ? 'prompt' : 'none',
          contextUsed: payload.contextExcerpts.length > 0,
          warnings: translation.warnings ?? [],
        },
      })),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_PAYLOAD', message: 'Request body is not valid JSON.' },
        { status: 400 },
      );
    }

    if (isAbortError(error)) {
      return jsonResponse(
        req,
        { ok: false, code: 'TIMEOUT', message: 'LLM translation request timed out.' },
        { status: 504 },
      );
    }

    // Extract upstream HTTP status from AI SDK errors (e.g. 401, 404, 429)
    const rawMessage = error instanceof Error ? error.message : '';
    const { status, code, message } = classifyLlmError(rawMessage);
    return jsonResponse(req, { ok: false, code, message }, { status });
  }
}

if (import.meta.main && typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleLlmTranslateRequest);
}
