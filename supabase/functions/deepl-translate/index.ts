/**
 * DeepL Translation Edge Function
 *
 * Proxies translation requests to DeepL API while validating payloads and
 * keeping server-managed credentials private.
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
import {
  isNonEmptyString,
  isObject,
  isValidLanguageCode,
  trimAndLimit,
} from '../_shared/validation.ts';

const DEEPL_FETCH_TIMEOUT_MS = 15000;
const MAX_TRANSLATE_TEXTS = 50;
const MAX_TEXT_LENGTH = 5000;
const MAX_GLOSSARY_ENTRIES = 10000;
const MAX_GLOSSARY_NAME_LENGTH = 120;
const MAX_GLOSSARY_TERM_LENGTH = 250;
const MAX_GLOSSARY_ID_LENGTH = 128;
const GLOSSARY_ID_RE = /^[a-zA-Z0-9-]{1,128}$/;
const DEEPL_USER_API_KEY_RE = /^[A-Za-z0-9._:-]{20,128}$/;

type ApiType = 'free' | 'pro';
type Action =
  | 'translate'
  | 'usage'
  | 'createGlossary'
  | 'listGlossaries'
  | 'deleteGlossary'
  | 'getGlossary';

interface GlossaryEntry {
  source: string;
  target: string;
}

interface TranslatePayload {
  text: string[];
  targetLang: string;
  sourceLang?: string;
  formality?: string;
  glossaryId?: string;
  tagHandling?: 'xml' | 'html';
}

interface CreateGlossaryPayload {
  name: string;
  sourceLang: string;
  targetLang: string;
  entries: GlossaryEntry[];
}

export function parseAction(value: unknown): Action | null {
  switch (value) {
    case 'translate':
    case 'usage':
    case 'createGlossary':
    case 'listGlossaries':
    case 'deleteGlossary':
    case 'getGlossary':
      return value;
    default:
      return null;
  }
}

export function parseApiType(value: unknown): ApiType | null {
  if (value === undefined || value === null || value === '') {
    return 'free';
  }

  return value === 'free' || value === 'pro' ? value : null;
}

function isValidGlossaryId(value: string): boolean {
  return GLOSSARY_ID_RE.test(value);
}

const TSV_CONTROL_RE = /[\t\r\n]/;

export function entriesToTSV(entries: GlossaryEntry[]): string {
  return entries
    .filter(
      (entry) =>
        entry.source &&
        entry.target &&
        !TSV_CONTROL_RE.test(entry.source) &&
        !TSV_CONTROL_RE.test(entry.target),
    )
    .map((entry) => `${entry.source}\t${entry.target}`)
    .join('\n');
}

export function parseTranslatePayload(value: Record<string, unknown>): TranslatePayload | null {
  const rawText = value.text;
  const targetLang = value.targetLang;

  if (!isNonEmptyString(targetLang) || !isValidLanguageCode(targetLang)) {
    return null;
  }

  const textItems = Array.isArray(rawText) ? rawText : [rawText];
  const texts = textItems
    .filter((item): item is string => typeof item === 'string')
    .map((item) => trimAndLimit(item, MAX_TEXT_LENGTH))
    .filter(Boolean);

  if (texts.length === 0 || texts.length > MAX_TRANSLATE_TEXTS) {
    return null;
  }

  const sourceLang =
    isNonEmptyString(value.sourceLang) && isValidLanguageCode(value.sourceLang)
      ? value.sourceLang
      : undefined;
  const formality = isNonEmptyString(value.formality)
    ? trimAndLimit(value.formality, 20)
    : undefined;
  const glossaryId =
    isNonEmptyString(value.glossaryId) && isValidGlossaryId(value.glossaryId)
      ? value.glossaryId
      : undefined;
  const tagHandling =
    value.tagHandling === 'xml' || value.tagHandling === 'html' ? value.tagHandling : undefined;

  return {
    text: texts,
    targetLang,
    sourceLang,
    formality,
    glossaryId,
    tagHandling,
  };
}

export function parseGlossaryEntries(value: unknown): GlossaryEntry[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_GLOSSARY_ENTRIES) {
    return null;
  }

  const entries = value
    .filter((item): item is Record<string, unknown> => isObject(item))
    .map((item) => ({
      source: isNonEmptyString(item.source)
        ? trimAndLimit(item.source, MAX_GLOSSARY_TERM_LENGTH)
        : '',
      target: isNonEmptyString(item.target)
        ? trimAndLimit(item.target, MAX_GLOSSARY_TERM_LENGTH)
        : '',
    }))
    .filter(
      (entry) =>
        entry.source &&
        entry.target &&
        !TSV_CONTROL_RE.test(entry.source) &&
        !TSV_CONTROL_RE.test(entry.target),
    );

  return entries.length > 0 ? entries : null;
}

export function parseCreateGlossaryPayload(
  value: Record<string, unknown>,
): CreateGlossaryPayload | null {
  const name = isNonEmptyString(value.name)
    ? trimAndLimit(value.name, MAX_GLOSSARY_NAME_LENGTH)
    : '';
  const sourceLang = isNonEmptyString(value.sourceLang) ? value.sourceLang : '';
  const targetLang = isNonEmptyString(value.targetLang) ? value.targetLang : '';
  const entries = parseGlossaryEntries(value.entries);

  if (!name || !entries || !isValidLanguageCode(sourceLang) || !isValidLanguageCode(targetLang)) {
    return null;
  }

  return {
    name,
    sourceLang,
    targetLang,
    entries,
  };
}

export function parseGlossaryId(value: unknown): string | null {
  if (!isNonEmptyString(value)) return null;
  const glossaryId = value.trim();
  if (glossaryId.length > MAX_GLOSSARY_ID_LENGTH) return null;
  return isValidGlossaryId(glossaryId) ? glossaryId : null;
}

function getApiBaseUrl(apiType: ApiType): string {
  return apiType === 'pro' ? 'https://api.deepl.com/v2' : 'https://api-free.deepl.com/v2';
}

async function sendDeepLRequest(
  url: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `DeepL-Auth-Key ${apiKey}`);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  return await fetchWithTimeout(url, DEEPL_FETCH_TIMEOUT_MS, {
    ...init,
    headers,
  });
}

async function proxyDeepLError(
  req: Request,
  response: Response,
  fallback: string,
): Promise<Response> {
  const errorText = await response.text().catch(() => '');
  return jsonResponse(
    req,
    {
      ok: false,
      code: 'UPSTREAM_ERROR',
      message: sanitizeUpstreamError(errorText, fallback),
    },
    { status: response.status },
  );
}

export async function handleDeepLTranslateRequest(req: Request): Promise<Response> {
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

    const action = parseAction(body.action);
    if (!action) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_ACTION', message: 'Unsupported DeepL action.' },
        { status: 400 },
      );
    }

    const apiType = parseApiType(body.apiType);
    if (!apiType) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: 'Field "apiType" must be either "free" or "pro".',
        },
        { status: 400 },
      );
    }

    const userApiKey = isNonEmptyString(body.userApiKey) ? trimAndLimit(body.userApiKey, 128) : '';
    if (userApiKey && !DEEPL_USER_API_KEY_RE.test(userApiKey)) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: 'Field "userApiKey" must look like a valid DeepL API key.',
        },
        { status: 400 },
      );
    }

    const apiKey = userApiKey || Deno.env.get('DEEPL_KEY') || '';

    if (!apiKey) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'MISSING_API_KEY',
          message: 'No API key configured. Add your DeepL API key in Settings.',
        },
        { status: 400 },
      );
    }

    const baseUrl = getApiBaseUrl(apiType);

    if (action === 'translate') {
      const payload = parseTranslatePayload(body);
      if (!payload) {
        return jsonResponse(
          req,
          {
            ok: false,
            code: 'INVALID_PAYLOAD',
            message: 'Provide 1-50 texts and valid DeepL language codes.',
          },
          { status: 400 },
        );
      }

      const translateBody: Record<string, unknown> = {
        text: payload.text,
        target_lang: payload.targetLang,
      };

      if (payload.sourceLang) translateBody.source_lang = payload.sourceLang;
      if (payload.formality) translateBody.formality = payload.formality;
      if (payload.glossaryId) translateBody.glossary_id = payload.glossaryId;
      if (payload.tagHandling) translateBody.tag_handling = payload.tagHandling;

      const response = await sendDeepLRequest(`${baseUrl}/translate`, apiKey, {
        method: 'POST',
        body: JSON.stringify(translateBody),
      });

      if (!response.ok) {
        return await proxyDeepLError(req, response, 'DeepL translation request failed.');
      }

      return jsonResponse(req, await response.json());
    }

    if (action === 'usage') {
      const response = await sendDeepLRequest(`${baseUrl}/usage`, apiKey);
      if (!response.ok) {
        return await proxyDeepLError(req, response, 'Failed to fetch DeepL usage.');
      }

      const data = await response.json();
      return jsonResponse(req, {
        characterCount: data.character_count,
        characterLimit: data.character_limit,
      });
    }

    if (action === 'createGlossary') {
      const payload = parseCreateGlossaryPayload(body);
      if (!payload) {
        return jsonResponse(
          req,
          {
            ok: false,
            code: 'INVALID_PAYLOAD',
            message: 'Provide a glossary name, valid language codes, and valid glossary entries.',
          },
          { status: 400 },
        );
      }

      const entriesTsv = entriesToTSV(payload.entries);
      if (!entriesTsv) {
        return jsonResponse(
          req,
          { ok: false, code: 'INVALID_PAYLOAD', message: 'No valid glossary entries provided.' },
          { status: 400 },
        );
      }

      const response = await sendDeepLRequest(`${baseUrl}/glossaries`, apiKey, {
        method: 'POST',
        body: JSON.stringify({
          name: payload.name,
          source_lang: payload.sourceLang,
          target_lang: payload.targetLang,
          entries: entriesTsv,
          entries_format: 'tsv',
        }),
      });

      if (!response.ok) {
        return await proxyDeepLError(req, response, 'Failed to create glossary.');
      }

      const data = await response.json();
      return jsonResponse(req, {
        glossaryId: data.glossary_id,
        name: data.name,
        sourceLang: data.source_lang,
        targetLang: data.target_lang,
        entryCount: data.entry_count,
        creationTime: data.creation_time,
      });
    }

    if (action === 'listGlossaries') {
      const response = await sendDeepLRequest(`${baseUrl}/glossaries`, apiKey);
      if (!response.ok) {
        return await proxyDeepLError(req, response, 'Failed to list glossaries.');
      }

      const data = await response.json();
      const glossaries = (Array.isArray(data.glossaries) ? data.glossaries : []).map(
        (glossary: Record<string, unknown>) => ({
          glossaryId: glossary.glossary_id,
          name: glossary.name,
          sourceLang: glossary.source_lang,
          targetLang: glossary.target_lang,
          entryCount: glossary.entry_count,
          creationTime: glossary.creation_time,
        }),
      );

      return jsonResponse(req, { glossaries });
    }

    if (action === 'deleteGlossary') {
      const glossaryId = parseGlossaryId(body.glossaryId);
      if (!glossaryId) {
        return jsonResponse(
          req,
          { ok: false, code: 'INVALID_PAYLOAD', message: 'Provide a valid glossaryId.' },
          { status: 400 },
        );
      }

      const response = await sendDeepLRequest(`${baseUrl}/glossaries/${glossaryId}`, apiKey, {
        method: 'DELETE',
      });

      if (!response.ok && response.status !== 404) {
        return await proxyDeepLError(req, response, 'Failed to delete glossary.');
      }

      return jsonResponse(req, { success: true });
    }

    const glossaryId = parseGlossaryId(body.glossaryId);
    if (!glossaryId) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_PAYLOAD', message: 'Provide a valid glossaryId.' },
        { status: 400 },
      );
    }

    const response = await sendDeepLRequest(`${baseUrl}/glossaries/${glossaryId}`, apiKey);
    if (!response.ok) {
      return await proxyDeepLError(req, response, 'Failed to fetch glossary details.');
    }

    const data = await response.json();
    return jsonResponse(req, {
      glossaryId: data.glossary_id,
      name: data.name,
      sourceLang: data.source_lang,
      targetLang: data.target_lang,
      entryCount: data.entry_count,
      creationTime: data.creation_time,
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
      ? 'DeepL request timed out.'
      : 'DeepL proxy request failed.';

    return jsonResponse(req, { ok: false, code: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}

if (import.meta.main && typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleDeepLTranslateRequest);
}
