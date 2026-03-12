import type { SourceLanguage, TargetLanguage } from '@/lib/deepl/types';
import type { Glossary, GlossaryEntry } from '@/lib/glossary/types';
import type { WordPressProjectType } from '@/lib/wp-source';

export type TranslationProviderId = 'deepl' | 'azure' | 'gemini';
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
