import { msgid } from '@/lib/app-language';
import { getSupabaseAnonKey, getSupabaseFunctionBaseUrl } from '@/lib/cloud-backend';
import { buildSupabaseFunctionHeaders } from '@/lib/supabase-function-headers';
import { getApplicableTerms } from '@/lib/glossary/enforcer';
import { getGeminiSettings } from './settings';
import { resolveGeminiContextExcerpts } from './context';
import type {
  ProviderTranslationRequest,
  ProviderTranslationResponse,
} from '@/lib/translation/types';

function getDefaultFunctionUrl(): string {
  return `${getSupabaseFunctionBaseUrl('Translation')}/gemini-translate`;
}

export function createGeminiClient(functionUrl: string = getDefaultFunctionUrl()) {
  const anonKey = getSupabaseAnonKey();

  async function translate(
    request: ProviderTranslationRequest,
  ): Promise<ProviderTranslationResponse> {
    const settings = getGeminiSettings();
    const glossaryEntries =
      request.glossaryEntries ??
      (request.glossary
        ? getApplicableTerms(
            Array.isArray(request.text) ? (request.text[0] ?? '') : request.text,
            request.glossary,
          )
        : []);
    const contextExcerpts =
      settings.useProjectContext && request.references?.length
        ? await resolveGeminiContextExcerpts(
            request.references,
            request.projectSlug,
            request.projectType,
          )
        : [];

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: buildSupabaseFunctionHeaders(anonKey),
      body: JSON.stringify({
        text: request.text,
        sourceLang: request.sourceLang,
        targetLang: request.targetLang,
        userApiKey: settings.apiKey,
        modelId: settings.modelId,
        glossaryEntries,
        projectSlug: request.projectSlug,
        contextExcerpts,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof payload?.message === 'string' ? payload.message : msgid('Gemini translation failed'),
      );
    }

    return payload as ProviderTranslationResponse;
  }

  async function testKey(): Promise<void> {
    await translate({
      text: 'Hello world',
      sourceLang: 'EN',
      targetLang: 'DE',
      glossaryEntries: [],
    });
  }

  return {
    translate,
    testKey,
  };
}

let clientInstance: ReturnType<typeof createGeminiClient> | null = null;

export function getGeminiClient(): ReturnType<typeof createGeminiClient> {
  if (!clientInstance) {
    clientInstance = createGeminiClient();
  }

  return clientInstance;
}
