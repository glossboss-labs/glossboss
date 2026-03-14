import { msgid } from '@/lib/app-language';
import { invokeSupabaseFunction, readSupabaseFunctionError } from '@/lib/supabase/client';
import { getApplicableTerms } from '@/lib/glossary/enforcer';
import { getGeminiSettings } from './settings';
import { resolveGeminiContextExcerpts } from './context';
import type {
  ProviderTranslationRequest,
  ProviderTranslationResponse,
} from '@/lib/translation/types';

export function createGeminiClient() {
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

    const { data, error, response } = await invokeSupabaseFunction<ProviderTranslationResponse>(
      'gemini-translate',
      {
        featureLabel: 'Translation',
        body: {
          text: request.text,
          sourceLang: request.sourceLang,
          targetLang: request.targetLang,
          userApiKey: settings.apiKey,
          modelId: settings.modelId,
          glossaryEntries,
          projectSlug: request.projectSlug,
          contextExcerpts,
        },
      },
    );

    if (error) {
      const payload = await readSupabaseFunctionError(response);
      throw new Error(
        typeof payload.message === 'string' ? payload.message : msgid('Gemini translation failed'),
      );
    }

    return data as ProviderTranslationResponse;
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
