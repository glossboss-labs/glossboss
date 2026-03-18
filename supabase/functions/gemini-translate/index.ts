import {
  fetchWithTimeout,
  handleJsonPost,
  jsonResponse,
  sanitizeUpstreamError,
} from '../_shared/http.ts';
import {
  isNonEmptyString,
  isObject,
  isValidLanguageCode,
  trimAndLimit,
} from '../_shared/validation.ts';

const GEMINI_FETCH_TIMEOUT_MS = 30000;
const MAX_TRANSLATE_TEXTS = 25;
const MAX_TEXT_LENGTH = 5000;
const MAX_GLOSSARY_ENTRIES = 32;
const MAX_CONTEXT_EXCERPTS = 3;
const MAX_CONTEXT_CHARS = 9000;
const DEFAULT_MODEL = 'gemini-flash-lite-latest';

interface GlossaryEntry {
  term: string;
  translation: string;
  comment?: string;
}

interface ContextExcerpt {
  path: string;
  line: number | null;
  content: string;
}

interface GeminiPayload {
  text: string[];
  sourceLang?: string;
  targetLang: string;
  userApiKey?: string;
  modelId?: string;
  glossaryEntries: GlossaryEntry[];
  contextExcerpts: ContextExcerpt[];
  projectSlug?: string;
}

function parseGlossaryEntries(value: unknown): GlossaryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => isObject(entry))
    .map((entry) => ({
      term: isNonEmptyString(entry.term) ? trimAndLimit(entry.term, 120) : '',
      translation: isNonEmptyString(entry.translation) ? trimAndLimit(entry.translation, 120) : '',
      comment: isNonEmptyString(entry.comment) ? trimAndLimit(entry.comment, 240) : undefined,
    }))
    .filter((entry) => entry.term && entry.translation)
    .slice(0, MAX_GLOSSARY_ENTRIES);
}

function parseContextExcerpts(value: unknown): ContextExcerpt[] {
  if (!Array.isArray(value)) {
    return [];
  }

  let usedChars = 0;
  const excerpts: ContextExcerpt[] = [];

  for (const item of value) {
    if (!isObject(item)) {
      continue;
    }

    const path = isNonEmptyString(item.path) ? trimAndLimit(item.path, 200) : '';
    const content = isNonEmptyString(item.content) ? item.content.slice(0, 3000) : '';
    if (!path || !content) {
      continue;
    }

    usedChars += content.length;
    if (usedChars > MAX_CONTEXT_CHARS) {
      break;
    }

    excerpts.push({
      path,
      line: typeof item.line === 'number' ? item.line : null,
      content,
    });

    if (excerpts.length >= MAX_CONTEXT_EXCERPTS) {
      break;
    }
  }

  return excerpts;
}

export function parseGeminiPayload(value: Record<string, unknown>): GeminiPayload | null {
  const rawText = Array.isArray(value.text) ? value.text : [value.text];
  const text = rawText
    .filter((item): item is string => typeof item === 'string')
    .map((item) => trimAndLimit(item, MAX_TEXT_LENGTH))
    .filter(Boolean);

  if (text.length === 0 || text.length > MAX_TRANSLATE_TEXTS) {
    return null;
  }

  const targetLang = isNonEmptyString(value.targetLang)
    ? value.targetLang.trim().toUpperCase()
    : '';
  if (!targetLang || !isValidLanguageCode(targetLang)) {
    return null;
  }

  const sourceLang =
    isNonEmptyString(value.sourceLang) && isValidLanguageCode(value.sourceLang)
      ? value.sourceLang.trim().toUpperCase()
      : undefined;

  return {
    text,
    sourceLang,
    targetLang,
    userApiKey: isNonEmptyString(value.userApiKey) ? value.userApiKey.trim() : undefined,
    modelId: isNonEmptyString(value.modelId) ? trimAndLimit(value.modelId, 80) : undefined,
    glossaryEntries: parseGlossaryEntries(value.glossaryEntries),
    contextExcerpts: parseContextExcerpts(value.contextExcerpts),
    projectSlug: isNonEmptyString(value.projectSlug)
      ? trimAndLimit(value.projectSlug, 100)
      : undefined,
  };
}

function buildInstruction(payload: GeminiPayload, strictGlossary: boolean): string {
  const lines: string[] = [
    'You are translating software localization strings.',
    'Return JSON only.',
    'Preserve printf placeholders (%s, %d, %1$s), template variables ({{name}}), ICU syntax ({count,plural,...}), HTML tags, and Markdown exactly as they appear.',
    "Match the source string's leading/trailing whitespace and newlines.",
    'Keep the same terminal punctuation as the source (. ! ? … : ;).',
    'Do not add explanations inside translated strings.',
    `Translate into ${payload.targetLang}.`,
  ];

  if (payload.sourceLang) {
    lines.push(`Source language is ${payload.sourceLang}.`);
  }

  if (payload.projectSlug) {
    lines.push(`Project slug: ${payload.projectSlug}.`);
  }

  if (payload.glossaryEntries.length > 0) {
    lines.push(
      strictGlossary
        ? 'Glossary rules are mandatory. Every matching source term must use the required target term exactly.'
        : 'Use the glossary rules whenever the source term appears.',
    );
    lines.push(
      ...payload.glossaryEntries.map(
        (entry) =>
          `- ${entry.term} => ${entry.translation}${entry.comment ? ` (${entry.comment})` : ''}`,
      ),
    );
  }

  if (payload.contextExcerpts.length > 0) {
    lines.push('Use the source excerpts as project context for terminology and tone.');
  }

  lines.push(
    'Respond with {"translations":[{"text":"...","warnings":["..."],"usedGlossaryTerms":["..."]}]} matching the input order.',
  );

  return lines.join('\n');
}

function buildContextBlock(payload: GeminiPayload): string {
  if (payload.contextExcerpts.length === 0) {
    return '';
  }

  const blocks = payload.contextExcerpts.map((excerpt) => {
    const lineInfo = excerpt.line ? `:${excerpt.line}` : '';
    return `FILE ${excerpt.path}${lineInfo}\n${excerpt.content}`;
  });

  return `Project context:\n${blocks.join('\n\n')}`;
}

function buildUserPayload(payload: GeminiPayload): string {
  const contextBlock = buildContextBlock(payload);
  const input = payload.text.map((text, index) => `${index + 1}. ${text}`).join('\n');
  return contextBlock ? `${contextBlock}\n\nStrings:\n${input}` : `Strings:\n${input}`;
}

function findMissingGlossaryTerms(
  translations: Array<{ text: string }>,
  glossaryEntries: GlossaryEntry[],
): string[] {
  if (glossaryEntries.length === 0) {
    return [];
  }

  const translationBlob = translations.map((entry) => entry.text.toLowerCase()).join('\n');
  return glossaryEntries
    .filter((entry) => !translationBlob.includes(entry.translation.toLowerCase()))
    .map((entry) => entry.translation);
}

function parseModelJson(responseText: string): {
  translations: Array<{ text: string; warnings?: string[]; usedGlossaryTerms?: string[] }>;
} {
  const parsed = JSON.parse(responseText);
  const translations = Array.isArray(parsed?.translations) ? parsed.translations : null;
  if (!translations) {
    throw new Error('Gemini response did not include translations.');
  }

  return {
    translations: translations.map((translation) => ({
      text: typeof translation?.text === 'string' ? translation.text : '',
      warnings: Array.isArray(translation?.warnings)
        ? translation.warnings.filter(
            (warning: unknown): warning is string => typeof warning === 'string',
          )
        : [],
      usedGlossaryTerms: Array.isArray(translation?.usedGlossaryTerms)
        ? translation.usedGlossaryTerms.filter(
            (term: unknown): term is string => typeof term === 'string',
          )
        : [],
    })),
  };
}

async function generateGeminiResponse(
  apiKey: string,
  modelId: string,
  payload: GeminiPayload,
  strictGlossary: boolean,
): Promise<{
  translations: Array<{ text: string; warnings?: string[]; usedGlossaryTerms?: string[] }>;
}> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;
  const response = await fetchWithTimeout(url, GEMINI_FETCH_TIMEOUT_MS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${buildInstruction(payload, strictGlossary)}\n\n${buildUserPayload(payload)}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(sanitizeUpstreamError(errorText, 'Gemini translation request failed.'));
  }

  const data = await response.json();
  const responseText =
    data?.candidates?.[0]?.content?.parts?.find(
      (part: Record<string, unknown>) => typeof part?.text === 'string',
    )?.text ?? '';

  if (!responseText) {
    throw new Error('Gemini returned an empty response.');
  }

  return parseModelJson(responseText);
}

export const handleGeminiTranslateRequest = handleJsonPost('Gemini', async (req, body) => {
  const payload = parseGeminiPayload(body);
  if (!payload) {
    return jsonResponse(
      req,
      {
        ok: false,
        code: 'INVALID_PAYLOAD',
        message: 'Provide 1-25 texts, a valid target language, and valid Gemini settings.',
      },
      { status: 400 },
    );
  }

  const apiKey = payload.userApiKey || Deno.env.get('GEMINI_API_KEY') || '';
  if (!apiKey) {
    return jsonResponse(
      req,
      {
        ok: false,
        code: 'MISSING_API_KEY',
        message: 'Add your Gemini API key in Settings.',
      },
      { status: 400 },
    );
  }

  const modelId = payload.modelId || DEFAULT_MODEL;
  let result = await generateGeminiResponse(apiKey, modelId, payload, false);

  const missingTerms = findMissingGlossaryTerms(result.translations, payload.glossaryEntries);
  if (missingTerms.length > 0) {
    result = await generateGeminiResponse(apiKey, modelId, payload, true);
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
          message: `Gemini response missed required glossary terms: ${retriedMissingTerms.join(', ')}`,
        },
        { status: 422 },
      );
    }
  }

  return jsonResponse(req, {
    translations: result.translations.map((translation) => ({
      text: translation.text,
      metadata: {
        provider: 'gemini',
        usedGlossary: payload.glossaryEntries.length > 0,
        glossaryMode: payload.glossaryEntries.length > 0 ? 'prompt' : 'none',
        contextUsed: payload.contextExcerpts.length > 0,
        warnings: translation.warnings ?? [],
      },
    })),
  });
});

if (import.meta.main && typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handleGeminiTranslateRequest);
}
