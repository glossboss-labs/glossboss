import { getApplicableTerms } from '@/lib/glossary/enforcer';
import { getDeepLClient, hasUserApiKey } from '@/lib/deepl';
import { getAzureClient, hasAzureApiKey } from '@/lib/azure';
import { getGeminiClient, hasGeminiApiKey } from '@/lib/gemini';
import { getActiveTranslationProvider } from './settings';
import type {
  ProviderTranslation,
  ProviderTranslationRequest,
  ProviderTranslationResponse,
  TranslationProviderCapabilities,
  TranslationProviderId,
} from './types';

export const TRANSLATION_PROVIDER_CAPABILITIES: Record<
  TranslationProviderId,
  TranslationProviderCapabilities
> = {
  deepl: {
    nativeGlossary: true,
    promptGlossary: false,
    supportsProjectContext: false,
  },
  azure: {
    nativeGlossary: false,
    promptGlossary: false,
    supportsProjectContext: false,
  },
  gemini: {
    nativeGlossary: false,
    promptGlossary: true,
    supportsProjectContext: true,
  },
};

function createTranslation(
  provider: TranslationProviderId,
  text: string,
  overrides: Partial<ProviderTranslation['metadata']> = {},
): ProviderTranslation {
  return {
    text,
    metadata: {
      provider,
      usedGlossary: false,
      glossaryMode: 'none',
      contextUsed: false,
      warnings: [],
      ...overrides,
    },
  };
}

export function getTranslationProviderLabel(provider: TranslationProviderId): string {
  switch (provider) {
    case 'azure':
      return 'Azure Translator';
    case 'gemini':
      return 'Gemini';
    default:
      return 'DeepL';
  }
}

export function hasProviderCredentials(provider: TranslationProviderId): boolean {
  switch (provider) {
    case 'azure':
      return hasAzureApiKey();
    case 'gemini':
      return hasGeminiApiKey();
    default:
      return hasUserApiKey();
  }
}

export function hasActiveProviderCredentials(): boolean {
  return hasProviderCredentials(getActiveTranslationProvider());
}

export async function translateWithProvider(
  provider: TranslationProviderId,
  request: ProviderTranslationRequest,
): Promise<ProviderTranslationResponse> {
  switch (provider) {
    case 'azure': {
      return await getAzureClient().translate({
        text: request.text,
        sourceLang: request.sourceLang,
        targetLang: request.targetLang,
      });
    }

    case 'gemini': {
      const glossaryEntries =
        request.glossaryEntries ??
        (request.glossary
          ? Array.isArray(request.text)
            ? request.text.flatMap((t) => getApplicableTerms(t, request.glossary!))
            : getApplicableTerms(request.text, request.glossary)
          : []);
      return await getGeminiClient().translate({
        ...request,
        glossaryEntries,
      });
    }

    case 'deepl':
    default: {
      const texts = Array.isArray(request.text) ? request.text : [request.text];
      const effectiveSourceLang = request.deeplGlossaryId
        ? request.sourceLang || 'EN'
        : request.sourceLang;
      const translations = await getDeepLClient().translateBatch(
        texts,
        request.targetLang,
        effectiveSourceLang,
        request.deeplGlossaryId,
      );
      return {
        translations: translations.map((text) =>
          createTranslation('deepl', text, {
            usedGlossary: Boolean(request.deeplGlossaryId),
            glossaryMode: request.deeplGlossaryId ? 'native' : 'none',
          }),
        ),
      };
    }
  }
}

export async function translateWithActiveProvider(
  request: ProviderTranslationRequest,
): Promise<ProviderTranslationResponse> {
  return await translateWithProvider(getActiveTranslationProvider(), request);
}
