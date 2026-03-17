import type { SourceLanguage, TargetLanguage } from '@/lib/deepl/types';
import type { Glossary, GlossaryEntry } from '@/lib/glossary/types';
import type { WordPressProjectType } from '@/lib/wp-source';

/** Preset LLM-based translation providers. */
export type LlmProviderId = 'openai' | 'anthropic' | 'google' | 'mistral' | 'deepseek';

/** All translation providers — traditional APIs + LLM + custom endpoints. */
export type TranslationProviderId = 'deepl' | 'azure' | LlmProviderId | 'custom';

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

export interface ProviderTranslationResponse {
  translations: ProviderTranslation[];
}

export interface TranslationProviderCapabilities {
  nativeGlossary: boolean;
  promptGlossary: boolean;
  supportsProjectContext: boolean;
}
