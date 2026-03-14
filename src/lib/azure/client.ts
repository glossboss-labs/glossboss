import { msgid } from '@/lib/app-language';
import { invokeSupabaseFunction, readSupabaseFunctionError } from '@/lib/supabase/client';
import { getAzureSettings } from './settings';
import type { SourceLanguage, TargetLanguage } from '@/lib/deepl/types';
import type { ProviderTranslationResponse } from '@/lib/translation/types';

export interface AzureTranslateRequest {
  text: string | string[];
  sourceLang?: SourceLanguage;
  targetLang: TargetLanguage;
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

export function createAzureClient() {
  async function translate(request: AzureTranslateRequest): Promise<ProviderTranslationResponse> {
    const settings = getAzureSettings();
    const { data, error, response } = await invokeSupabaseFunction<ProviderTranslationResponse>(
      'azure-translate',
      {
        featureLabel: 'Translation',
        body: {
          text: request.text,
          sourceLang: request.sourceLang ? mapAzureLanguageCode(request.sourceLang) : undefined,
          targetLang: mapAzureLanguageCode(request.targetLang),
          userApiKey: settings.apiKey,
          userRegion: settings.region,
          endpoint: settings.endpoint,
        },
      },
    );

    if (error) {
      const payload = await readSupabaseFunctionError(response);
      throw new Error(
        typeof payload.message === 'string' ? payload.message : msgid('Azure translation failed'),
      );
    }

    return data as ProviderTranslationResponse;
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
