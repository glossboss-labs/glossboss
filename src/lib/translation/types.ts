import type { SourceLanguage, TargetLanguage } from '@/lib/deepl/types';
import type { Glossary, GlossaryEntry } from '@/lib/glossary/types';
import type { WordPressProjectType } from '@/lib/wp-source';

/** Preset LLM-based translation providers. */
export type LlmProviderId = 'openai' | 'anthropic' | 'google' | 'mistral' | 'deepseek';

/** All translation providers — traditional APIs + LLM + custom endpoints. */
export type TranslationProviderId = 'deepl' | 'azure' | LlmProviderId | 'custom';

/** Canonical list of valid provider IDs (single source of truth). */
export const VALID_PROVIDER_IDS = [
  'deepl',
  'azure',
  'google',
  'openai',
  'anthropic',
  'mistral',
  'deepseek',
  'custom',
] as const satisfies readonly TranslationProviderId[];

/** Set form for O(1) membership checks. */
export const VALID_PROVIDER_SET = new Set<string>(VALID_PROVIDER_IDS);

/** Legacy provider names that should be migrated to a canonical ID. */
export const LEGACY_PROVIDER_ALIASES: Record<string, TranslationProviderId> = {
  gemini: 'google',
};

export type TranslationGlossaryMode = 'native' | 'prompt' | 'none';

export interface TranslationContextExcerpt {
  path: string;
  line: number | null;
  content: string;
}

export interface ProviderTranslationRequest {
  text: string | string[];
  targetLang: TargetLanguage;
  sourceLang?: SourceLanguage;
  glossary?: Glossary | null;
  glossaryEntries?: GlossaryEntry[];
  deeplGlossaryId?: string;
  references?: string[];
  projectSlug?: string | null;
  projectType?: WordPressProjectType | null;
  /** Custom instructions from project/org settings, sent to LLM providers. */
  additionalInstructions?: string;
}

export interface ProviderTranslationMetadata {
  provider: TranslationProviderId;
  usedGlossary: boolean;
  glossaryMode: TranslationGlossaryMode;
  contextUsed: boolean;
  warnings: string[];
}

export interface ProviderTranslation {
  text: string;
  detectedSourceLanguage?: string;
  metadata: ProviderTranslationMetadata;
}

/** Token usage returned by LLM providers (from AI SDK). */
export interface ProviderTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ProviderTranslationResponse {
  translations: ProviderTranslation[];
  /** Token usage from LLM providers (not available for DeepL/Azure). */
  usage?: ProviderTokenUsage;
}

export interface TranslationProviderCapabilities {
  nativeGlossary: boolean;
  promptGlossary: boolean;
  supportsProjectContext: boolean;
}
