import { getApplicableTerms } from '@/lib/glossary/enforcer';
import { getDeepLClient, hasUserApiKey } from '@/lib/deepl';
import { getAzureClient, hasAzureApiKey } from '@/lib/azure';
import { getLlmClient, hasLlmApiKey, hasCustomApiKey, isLlmProvider } from '@/lib/llm';
import { getActiveTranslationProvider } from './settings';
import type {
  LlmProviderId,
  ProviderTranslation,
  ProviderTranslationRequest,
  ProviderTranslationResponse,
  TranslationProviderCapabilities,
  TranslationProviderId,
} from './types';

/** All available translation providers (for UI dropdowns). */
export const ALL_TRANSLATION_PROVIDERS: TranslationProviderId[] = [
  'deepl',
  'azure',
  'openai',
  'anthropic',
  'google',
  'mistral',
  'deepseek',
];

const LLM_CAPABILITIES: TranslationProviderCapabilities = {
  nativeGlossary: false,
  promptGlossary: true,
  supportsProjectContext: true,
};

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
  openai: LLM_CAPABILITIES,
  anthropic: LLM_CAPABILITIES,
  google: LLM_CAPABILITIES,
  mistral: LLM_CAPABILITIES,
  deepseek: LLM_CAPABILITIES,
  custom: LLM_CAPABILITIES,
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
    case 'openai':
      return 'OpenAI';
    case 'anthropic':
      return 'Claude';
    case 'google':
      return 'Gemini';
    case 'mistral':
      return 'Mistral';
    case 'deepseek':
      return 'DeepSeek';
    case 'custom':
      return 'Custom';
    default:
      return 'DeepL';
  }
}

export function hasProviderCredentials(provider: TranslationProviderId): boolean {
  switch (provider) {
    case 'azure':
      return hasAzureApiKey();
    case 'custom':
      return hasCustomApiKey();
    case 'deepl':
      return hasUserApiKey();
    default:
      // All LLM providers
      if (isLlmProvider(provider)) {
        return hasLlmApiKey(provider as LlmProviderId);
      }
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

    case 'deepl': {
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

    // All LLM providers route through the unified client
    case 'openai':
    case 'anthropic':
    case 'google':
    case 'mistral':
    case 'deepseek':
    case 'custom':
    default: {
      const glossaryEntries =
        request.glossaryEntries ??
        (request.glossary
          ? Array.isArray(request.text)
            ? request.text.flatMap((t) => getApplicableTerms(t, request.glossary!))
            : getApplicableTerms(request.text, request.glossary)
          : []);
      return await getLlmClient(provider).translate({
        ...request,
        glossaryEntries,
      });
    }
  }
}

export async function translateWithActiveProvider(
  request: ProviderTranslationRequest,
): Promise<ProviderTranslationResponse> {
  return await translateWithProvider(getActiveTranslationProvider(), request);
}
