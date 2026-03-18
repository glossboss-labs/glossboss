/**
 * Unified LLM translation client.
 *
 * All LLM providers route through the single `llm-translate` edge function.
 * Provider-specific details (API format, model selection) are handled server-side.
 */

import { msgid } from '@/lib/app-language';
import { invokeSupabaseFunction, readSupabaseFunctionError } from '@/lib/supabase/client';
import { getApplicableTerms } from '@/lib/glossary/enforcer';
import { getLlmSettings, getCustomSettings } from './settings';
import { resolveLlmContextExcerpts } from './context';
import type { LlmProviderId } from '@/lib/translation/types';
import type {
  ProviderTranslationRequest,
  ProviderTranslationResponse,
} from '@/lib/translation/types';

function createLlmClient(provider: LlmProviderId | 'custom') {
  async function translate(
    request: ProviderTranslationRequest,
  ): Promise<ProviderTranslationResponse> {
    const isCustom = provider === 'custom';
    const settings = isCustom ? getCustomSettings() : getLlmSettings(provider);

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
        ? await resolveLlmContextExcerpts(
            request.references,
            request.projectSlug,
            request.projectType,
          )
        : [];

    const body: Record<string, unknown> = {
      provider,
      text: request.text,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      userApiKey: settings.apiKey,
      modelId: settings.modelId,
      temperature: settings.temperature,
      glossaryEntries,
      projectSlug: request.projectSlug,
      contextExcerpts,
      additionalInstructions: request.additionalInstructions,
    };

    // Custom provider includes baseURL
    if (isCustom && 'baseURL' in settings) {
      body.baseURL = (settings as { baseURL: string }).baseURL;
    }

    const { data, error, response } = await invokeSupabaseFunction<ProviderTranslationResponse>(
      'llm-translate',
      {
        featureLabel: 'Translation',
        body,
      },
    );

    if (error) {
      const payload = await readSupabaseFunctionError(response);
      throw new Error(
        typeof payload.message === 'string' ? payload.message : msgid('LLM translation failed'),
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

  return { translate, testKey };
}

// Client cache per provider
const clients = new Map<string, ReturnType<typeof createLlmClient>>();

export function getLlmClient(
  provider: LlmProviderId | 'custom',
): ReturnType<typeof createLlmClient> {
  let client = clients.get(provider);
  if (!client) {
    client = createLlmClient(provider);
    clients.set(provider, client);
  }
  return client;
}
