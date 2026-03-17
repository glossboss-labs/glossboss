/**
 * Shared LLM prompt builder for software localization translation.
 *
 * Extracted from gemini-translate — provider-agnostic prompt construction,
 * glossary validation, and payload parsing shared by all LLM translation providers.
 */

import { isNonEmptyString, isObject, isValidLanguageCode, trimAndLimit } from './validation.ts';

// ── Constants ──────────────────────────────────────────────

export const MAX_TRANSLATE_TEXTS = 25;
export const MAX_TEXT_LENGTH = 5000;
export const MAX_GLOSSARY_ENTRIES = 32;
export const MAX_CONTEXT_EXCERPTS = 3;
export const MAX_CONTEXT_CHARS = 9000;
export const MAX_INSTRUCTIONS_LENGTH = 2000;

// ── Types ──────────────────────────────────────────────────

export interface GlossaryEntry {
  term: string;
  translation: string;
  comment?: string;
}

export interface ContextExcerpt {
  path: string;
  line: number | null;
  content: string;
}

export interface LlmTranslatePayload {
  provider: string;
  text: string[];
  sourceLang?: string;
  targetLang: string;
  userApiKey?: string;
  modelId?: string;
  baseURL?: string;
  temperature?: number;
  glossaryEntries: GlossaryEntry[];
  contextExcerpts: ContextExcerpt[];
  projectSlug?: string;
  additionalInstructions?: string;
}

// ── Parsing ────────────────────────────────────────────────

export function parseGlossaryEntries(value: unknown): GlossaryEntry[] {
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

export function parseContextExcerpts(value: unknown): ContextExcerpt[] {
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

export function parseLlmTranslatePayload(
  value: Record<string, unknown>,
): LlmTranslatePayload | null {
  // Provider
  const provider = isNonEmptyString(value.provider) ? value.provider.trim() : '';
  if (!provider) {
    return null;
  }

  // Texts
  const rawText = Array.isArray(value.text) ? value.text : [value.text];
  const text = rawText
    .filter((item): item is string => typeof item === 'string')
    .map((item) => trimAndLimit(item, MAX_TEXT_LENGTH))
    .filter(Boolean);

  if (text.length === 0 || text.length > MAX_TRANSLATE_TEXTS) {
    return null;
  }

  // Target language
  const targetLang = isNonEmptyString(value.targetLang)
    ? value.targetLang.trim().toUpperCase()
    : '';
  if (!targetLang || !isValidLanguageCode(targetLang)) {
    return null;
  }

  // Source language (optional)
  const sourceLang =
    isNonEmptyString(value.sourceLang) && isValidLanguageCode(value.sourceLang)
      ? value.sourceLang.trim().toUpperCase()
      : undefined;

  // Temperature
  const temperature =
    typeof value.temperature === 'number' &&
    Number.isFinite(value.temperature) &&
    value.temperature >= 0 &&
    value.temperature <= 2
      ? value.temperature
      : undefined;

  return {
    provider,
    text,
    sourceLang,
    targetLang,
    userApiKey: isNonEmptyString(value.userApiKey) ? value.userApiKey.trim() : undefined,
    modelId: isNonEmptyString(value.modelId) ? trimAndLimit(value.modelId, 80) : undefined,
    baseURL: isNonEmptyString(value.baseURL) ? trimAndLimit(value.baseURL, 500) : undefined,
    temperature,
    glossaryEntries: parseGlossaryEntries(value.glossaryEntries),
    contextExcerpts: parseContextExcerpts(value.contextExcerpts),
    projectSlug: isNonEmptyString(value.projectSlug)
      ? trimAndLimit(value.projectSlug, 100)
      : undefined,
    additionalInstructions: isNonEmptyString(value.additionalInstructions)
      ? trimAndLimit(value.additionalInstructions, MAX_INSTRUCTIONS_LENGTH)
      : undefined,
  };
}

// ── Prompt building ────────────────────────────────────────

export function buildInstruction(payload: LlmTranslatePayload, strictGlossary: boolean): string {
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

  if (payload.additionalInstructions) {
    lines.push('Additional project instructions:');
    lines.push(payload.additionalInstructions);
  }

  lines.push(
    'Respond with {"translations":[{"text":"...","warnings":["..."],"usedGlossaryTerms":["..."]}]} matching the input order.',
  );

  return lines.join('\n');
}

export function buildContextBlock(payload: LlmTranslatePayload): string {
  if (payload.contextExcerpts.length === 0) {
    return '';
  }

  const blocks = payload.contextExcerpts.map((excerpt) => {
    const lineInfo = excerpt.line ? `:${excerpt.line}` : '';
    return `FILE ${excerpt.path}${lineInfo}\n${excerpt.content}`;
  });

  return `Project context:\n${blocks.join('\n\n')}`;
}

export function buildUserPayload(payload: LlmTranslatePayload): string {
  const contextBlock = buildContextBlock(payload);
  const input = payload.text.map((text, index) => `${index + 1}. ${text}`).join('\n');
  return contextBlock ? `${contextBlock}\n\nStrings:\n${input}` : `Strings:\n${input}`;
}

// ── Glossary validation ────────────────────────────────────

export function findMissingGlossaryTerms(
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
