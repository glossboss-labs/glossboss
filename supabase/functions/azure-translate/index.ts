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

const AZURE_FETCH_TIMEOUT_MS = 15000;
const MAX_TRANSLATE_TEXTS = 50;
const MAX_TEXT_LENGTH = 5000;
const MAX_REGION_LENGTH = 64;
const MAX_ENDPOINT_LENGTH = 160;
const DEFAULT_ENDPOINT = 'https://api.cognitive.microsofttranslator.com';

const ALLOWED_AZURE_HOSTS = [
  '.cognitive.microsofttranslator.com',
  '.cognitiveservices.azure.com',
  '.api.cognitive.microsoft.com',
];

interface AzureTranslatePayload {
  text: string[];
  targetLang: string;
  sourceLang?: string;
  userApiKey?: string;
  userRegion?: string;
  endpoint?: string;
}

function isAllowedAzureEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;
    const hostname = url.hostname.toLowerCase();
    return ALLOWED_AZURE_HOSTS.some(
      (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix),
    );
  } catch {
    return false;
  }
}

export function parseAzureTranslatePayload(
  value: Record<string, unknown>,
): AzureTranslatePayload | null {
  const rawText = Array.isArray(value.text) ? value.text : [value.text];

  if (rawText.length === 0 || rawText.length > MAX_TRANSLATE_TEXTS) {
    return null;
  }
  const text = rawText.map((item) =>
    typeof item === 'string' ? trimAndLimit(item, MAX_TEXT_LENGTH) : '',
  );
  if (text.some((item) => !item)) {
    return null;
  }

  const targetLang = isNonEmptyString(value.targetLang) ? value.targetLang.trim() : '';
  if (!targetLang || !isValidLanguageCode(targetLang)) {
    return null;
  }

  const sourceLang =
    isNonEmptyString(value.sourceLang) && isValidLanguageCode(value.sourceLang)
      ? value.sourceLang.trim()
      : undefined;

  const userApiKey = isNonEmptyString(value.userApiKey) ? value.userApiKey.trim() : undefined;
  const userRegion = isNonEmptyString(value.userRegion)
    ? trimAndLimit(value.userRegion, MAX_REGION_LENGTH)
    : undefined;
  const endpoint = isNonEmptyString(value.endpoint)
    ? trimAndLimit(value.endpoint, MAX_ENDPOINT_LENGTH)
    : undefined;

  return {
    text,
    targetLang,
    sourceLang,
    userApiKey,
    userRegion,
    endpoint,
  };
}

async function sendAzureRequest(
  endpoint: string,
  apiKey: string,
  region: string,
  payload: AzureTranslatePayload,
): Promise<Response> {
  const url = new URL('/translate', endpoint);
  url.searchParams.set('api-version', '3.0');
  url.searchParams.set('to', payload.targetLang);
  if (payload.sourceLang) {
    url.searchParams.set('from', payload.sourceLang);
  }

  return await fetchWithTimeout(url.toString(), AZURE_FETCH_TIMEOUT_MS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': apiKey,
      'Ocp-Apim-Subscription-Region': region,
    },
    body: JSON.stringify(payload.text.map((text) => ({ text }))),
  });
}

export async function handleAzureTranslateRequest(req: Request): Promise<Response> {
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

    const payload = parseAzureTranslatePayload(body);
    if (!payload) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: 'Provide 1-50 texts, a valid target language, and valid Azure settings.',
        },
        { status: 400 },
      );
    }

    const apiKey = payload.userApiKey || Deno.env.get('AZURE_TRANSLATOR_KEY') || '';
    const region = payload.userRegion || Deno.env.get('AZURE_TRANSLATOR_REGION') || '';
    const endpoint =
      payload.endpoint || Deno.env.get('AZURE_TRANSLATOR_ENDPOINT') || DEFAULT_ENDPOINT;

    if (!isAllowedAzureEndpoint(endpoint)) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: 'Azure endpoint must be an HTTPS URL on a known Azure Translator domain.',
        },
        { status: 400 },
      );
    }

    if (!apiKey || !region) {
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'MISSING_API_KEY',
          message: 'Add your Azure Translator key and region in Settings.',
        },
        { status: 400 },
      );
    }

    const response = await sendAzureRequest(endpoint, apiKey, region, payload);
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return jsonResponse(
        req,
        {
          ok: false,
          code: 'UPSTREAM_ERROR',
          message: sanitizeUpstreamError(errorText, 'Azure translation request failed.'),
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    const translations = (Array.isArray(data) ? data : []).flatMap(
      (item: Record<string, unknown>) => {
        const candidateTranslations = Array.isArray(item?.translations) ? item.translations : [];
        return candidateTranslations.slice(0, 1).map((translation: Record<string, unknown>) => ({
          text: typeof translation.text === 'string' ? translation.text : '',
          detectedSourceLanguage:
            typeof item?.detectedLanguage?.language === 'string'
              ? item.detectedLanguage.language
              : undefined,
          metadata: {
            provider: 'azure',
            usedGlossary: false,
            glossaryMode: 'none',
            contextUsed: false,
            warnings: [],
          },
        }));
      },
    );

    return jsonResponse(req, { translations });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse(
        req,
        { ok: false, code: 'INVALID_PAYLOAD', message: 'Request body is not valid JSON.' },
        { status: 400 },
      );
    }

    const message = isAbortError(error)
      ? 'Azure translation request timed out.'
      : 'Azure translation proxy failed.';

    return jsonResponse(req, { ok: false, code: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}

if (import.meta.main && typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleAzureTranslateRequest);
}
