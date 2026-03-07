/**
 * DeepL Integration Types
 *
 * Types for DeepL API requests and responses.
 * The actual API calls go through an Edge Function to keep the API key secure.
 */

/** Supported source languages */
export type SourceLanguage =
  | 'BG'
  | 'CS'
  | 'DA'
  | 'DE'
  | 'EL'
  | 'EN'
  | 'ES'
  | 'ET'
  | 'FI'
  | 'FR'
  | 'HU'
  | 'ID'
  | 'IT'
  | 'JA'
  | 'KO'
  | 'LT'
  | 'LV'
  | 'NB'
  | 'NL'
  | 'PL'
  | 'PT'
  | 'RO'
  | 'RU'
  | 'SK'
  | 'SL'
  | 'SV'
  | 'TR'
  | 'UK'
  | 'ZH';

/** Supported target languages */
export type TargetLanguage =
  | 'BG'
  | 'CS'
  | 'DA'
  | 'DE'
  | 'EL'
  | 'EN-GB'
  | 'EN-US'
  | 'ES'
  | 'ET'
  | 'FI'
  | 'FR'
  | 'HU'
  | 'ID'
  | 'IT'
  | 'JA'
  | 'KO'
  | 'LT'
  | 'LV'
  | 'NB'
  | 'NL'
  | 'PL'
  | 'PT-BR'
  | 'PT-PT'
  | 'RO'
  | 'RU'
  | 'SK'
  | 'SL'
  | 'SV'
  | 'TR'
  | 'UK'
  | 'ZH';

/** Request to translate text */
export interface TranslateRequest {
  /** Text to translate (can be array for batch) */
  text: string | string[];

  /** Target language code */
  targetLang: TargetLanguage;

  /** Source language code (optional, auto-detect if omitted) */
  sourceLang?: SourceLanguage;

  /** Preserve formatting */
  preserveFormatting?: boolean;

  /** Handle XML tags */
  tagHandling?: 'xml' | 'html';

  /** Formality preference */
  formality?: 'default' | 'more' | 'less' | 'prefer_more' | 'prefer_less';

  /** Glossary ID to apply */
  glossaryId?: string;
}

/** Single translation result */
export interface Translation {
  /** Detected source language */
  detectedSourceLanguage: string;

  /** Translated text */
  text: string;
}

/** Response from translation API */
export interface TranslateResponse {
  /** Array of translations */
  translations: Translation[];
}

/** Error response */
export interface TranslateError {
  /** Error message */
  message: string;

  /** Error code */
  code?: string;
}

/** Usage statistics */
export interface UsageStats {
  /** Characters used this billing period */
  characterCount: number;

  /** Character limit for billing period */
  characterLimit: number;
}

/** Client configuration */
export interface DeepLClientConfig {
  /** Edge function URL (defaults to relative path) */
  functionUrl?: string;

  /** Request timeout in ms */
  timeout?: number;
}

/** Glossary entry for creation */
export interface GlossaryEntryInput {
  /** Source term */
  source: string;
  /** Target translation */
  target: string;
}

/** DeepL Glossary info */
export interface DeepLGlossary {
  /** Unique glossary ID */
  glossaryId: string;
  /** Glossary name */
  name: string;
  /** Source language */
  sourceLang: string;
  /** Target language */
  targetLang: string;
  /** Number of entries */
  entryCount: number;
  /** Creation timestamp */
  creationTime: string;
}

/** Request to create a glossary */
export interface CreateGlossaryRequest {
  /** Name for the glossary */
  name: string;
  /** Source language code (e.g., 'EN') */
  sourceLang: string;
  /** Target language code (e.g., 'NL') */
  targetLang: string;
  /** Glossary entries */
  entries: GlossaryEntryInput[];
}
