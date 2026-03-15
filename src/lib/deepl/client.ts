/**
 * DeepL API Client
 *
 * Client-side wrapper for DeepL translation.
 * All requests go through the Edge Function to keep the API key secure.
 */

import type {
  TranslateRequest,
  TranslateResponse,
  TranslateError,
  UsageStats,
  DeepLClientConfig,
  CreateGlossaryRequest,
  DeepLGlossary,
} from './types';
import { getDeepLSettings } from './settings';
import { maskPlaceholders, unmaskPlaceholders } from './placeholder-mask';
import {
  invokeSupabaseFunction,
  readSupabaseFunctionError,
  type InvokeSupabaseFunctionOptions,
} from '@/lib/supabase/client';

/** Default configuration */
const DEFAULT_CONFIG: Omit<Required<DeepLClientConfig>, 'functionUrl'> = {
  timeout: 30000,
};

/**
 * DeepL API client
 *
 * @example
 * ```ts
 * const client = createDeepLClient();
 * const result = await client.translate({
 *   text: 'Hello world',
 *   targetLang: 'DE',
 * });
 * ```
 */
export function createDeepLClient(config: DeepLClientConfig = {}) {
  const timeout = config.timeout ?? DEFAULT_CONFIG.timeout;

  /**
   * Make a request to the Edge Function
   */
  async function request<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Get user's API key settings
    const settings = getDeepLSettings();

    try {
      // Include user's API key and type if configured
      const requestBody: Record<string, unknown> = {
        action,
        ...params,
      };

      if (settings.apiKey) {
        requestBody.userApiKey = settings.apiKey;
        requestBody.apiType = settings.apiType;
      }

      const invokeOptions: InvokeSupabaseFunctionOptions = {
        featureLabel: 'Translation',
        signal: controller.signal,
      };

      const { data, error, response } = await invokeSupabaseFunction<T>('deepl-translate', {
        ...invokeOptions,
        body: requestBody,
      });

      if (error) {
        if (controller.signal.aborted) {
          throw new Error('Request timed out');
        }

        const payload = (await readSupabaseFunctionError(response)) as Partial<TranslateError>;
        throw new Error(payload.message || `Request failed: ${response?.status ?? 'unknown'}`);
      }

      return data as T;
    } catch (error) {
      if (error instanceof Error && error.message === 'Request timed out') {
        throw new Error('Request timed out', { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Translate text using DeepL
   */
  async function translate(req: TranslateRequest): Promise<TranslateResponse> {
    // Apply formality from settings if not explicitly set in request
    const settings = getDeepLSettings();
    const prepared: TranslateRequest = {
      ...req,
      tagHandling: 'xml',
    };

    if (prepared.formality == null) {
      prepared.formality = settings.formality;
    }

    // Mask printf/ICU placeholders so DeepL preserves them
    const texts = Array.isArray(prepared.text) ? prepared.text : [prepared.text];
    const masked = texts.map((t) => maskPlaceholders(t));
    prepared.text = masked.map((m) => m.text);

    const response = await request<TranslateResponse>('translate', { ...prepared });

    // Restore original placeholders in translated text
    response.translations = response.translations.map((translation, i) => ({
      ...translation,
      text: unmaskPlaceholders(translation.text, masked[i].tokens),
    }));

    return response;
  }

  /**
   * Translate a single string (convenience method)
   */
  async function translateText(
    text: string,
    targetLang: TranslateRequest['targetLang'],
    sourceLang?: TranslateRequest['sourceLang'],
    glossaryId?: string,
  ): Promise<string> {
    const response = await translate({
      text,
      targetLang,
      sourceLang,
      glossaryId,
    });

    return response.translations[0]?.text ?? '';
  }

  /**
   * Translate multiple strings in batch
   */
  async function translateBatch(
    texts: string[],
    targetLang: TranslateRequest['targetLang'],
    sourceLang?: TranslateRequest['sourceLang'],
    glossaryId?: string,
  ): Promise<string[]> {
    const response = await translate({
      text: texts,
      targetLang,
      sourceLang,
      glossaryId,
    });

    return response.translations.map((t) => t.text);
  }

  /**
   * Get usage statistics
   */
  async function getUsage(): Promise<UsageStats> {
    return request<UsageStats>('usage');
  }

  /**
   * Create a glossary in DeepL
   */
  async function createGlossary(req: CreateGlossaryRequest): Promise<DeepLGlossary> {
    return request<DeepLGlossary>('createGlossary', { ...req });
  }

  /**
   * List all glossaries
   */
  async function listGlossaries(): Promise<DeepLGlossary[]> {
    const result = await request<{ glossaries: DeepLGlossary[] }>('listGlossaries');
    return result.glossaries;
  }

  /**
   * Delete a glossary
   */
  async function deleteGlossary(glossaryId: string): Promise<void> {
    await request('deleteGlossary', { glossaryId });
  }

  /**
   * Get glossary details
   */
  async function getGlossary(glossaryId: string): Promise<DeepLGlossary> {
    return request<DeepLGlossary>('getGlossary', { glossaryId });
  }

  return {
    translate,
    translateText,
    translateBatch,
    getUsage,
    createGlossary,
    listGlossaries,
    deleteGlossary,
    getGlossary,
  };
}

/** Singleton client instance */
let clientInstance: ReturnType<typeof createDeepLClient> | null = null;

/**
 * Get the shared DeepL client instance
 */
export function getDeepLClient(): ReturnType<typeof createDeepLClient> {
  if (!clientInstance) {
    clientInstance = createDeepLClient();
  }
  return clientInstance;
}
