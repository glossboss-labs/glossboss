import { getSupabaseAnonKey, getSupabaseFunctionBaseUrl } from '@/lib/cloud-backend';
import { buildSupabaseFunctionHeaders } from '@/lib/supabase-function-headers';
import { getAzureSettings } from './settings';
import type { SourceLanguage, TargetLanguage } from '@/lib/deepl/types';
import type { ProviderTranslationResponse } from '@/lib/translation/types';

export interface AzureTranslateRequest {
  text: string | string[];
  sourceLang?: SourceLanguage;
  targetLang: TargetLanguage;
}

function getDefaultFunctionUrl(): string {
  return `${getSupabaseFunctionBaseUrl('Translation')}/azure-translate`;
}

function mapAzureLanguageCode(language: SourceLanguage | TargetLanguage): string {
  switch (language) {
    case 'EN-GB':
      return 'en-gb';
    case 'EN-US':
      return 'en';
    case 'PT-BR':
      return 'pt-br';
    case 'PT-PT':
      return 'pt-pt';
    default:
      return language.toLowerCase();
  }
}

export function createAzureClient(functionUrl: string = getDefaultFunctionUrl()) {
  const anonKey = getSupabaseAnonKey();

  async function translate(request: AzureTranslateRequest): Promise<ProviderTranslationResponse> {
    const settings = getAzureSettings();
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: buildSupabaseFunctionHeaders(anonKey),
      body: JSON.stringify({
        text: request.text,
        sourceLang: request.sourceLang ? mapAzureLanguageCode(request.sourceLang) : undefined,
        targetLang: mapAzureLanguageCode(request.targetLang),
        userApiKey: settings.apiKey,
        userRegion: settings.region,
        endpoint: settings.endpoint,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof payload?.message === 'string' ? payload.message : 'Azure translation failed',
      );
    }

    return payload as ProviderTranslationResponse;
  }

  async function testKey(): Promise<void> {
    await translate({
      text: 'Hello world',
      sourceLang: 'EN',
      targetLang: 'DE',
    });
  }

  return {
    translate,
    testKey,
  };
}

let clientInstance: ReturnType<typeof createAzureClient> | null = null;

export function getAzureClient(): ReturnType<typeof createAzureClient> {
  if (!clientInstance) {
    clientInstance = createAzureClient();
  }

  return clientInstance;
}
