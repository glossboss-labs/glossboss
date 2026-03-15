import { invokeSupabaseFunction, readSupabaseFunctionError } from '@/lib/supabase/client';
import { getTtsSettings, saveTtsUsage } from './settings';
import type { TtsUsageStats, TtsVoiceSummary } from './types';

export interface ElevenLabsClientConfig {
  functionUrl?: string;
  timeout?: number;
}

const DEFAULT_TIMEOUT_MS = 30000;

async function parseError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { message?: string };
    return new Error(body.message || `Request failed: ${response.status}`);
  } catch {
    return new Error(`Request failed: ${response.status}`);
  }
}

export function createElevenLabsClient(config: ElevenLabsClientConfig = {}) {
  const timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;

  async function request<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const settings = getTtsSettings();
      const { data, error, response } = await invokeSupabaseFunction<T>('tts-elevenlabs', {
        featureLabel: 'Speech',
        signal: controller.signal,
        body: {
          action,
          apiKey: settings.apiKey,
          ...params,
        },
      });

      if (error) {
        if (controller.signal.aborted) {
          throw new Error('Request timed out');
        }

        throw await parseError(
          new Response(JSON.stringify(await readSupabaseFunctionError(response)), {
            status: response?.status ?? 500,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
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

  async function getUsage(): Promise<TtsUsageStats> {
    return await request<TtsUsageStats>('usage');
  }

  async function testKey(): Promise<TtsUsageStats> {
    const usage = await getUsage();
    saveTtsUsage(usage);
    return usage;
  }

  async function listVoices(): Promise<TtsVoiceSummary[]> {
    const result = await request<{ voices: TtsVoiceSummary[] }>('listVoices');
    return result.voices;
  }

  async function speak(params: {
    voiceId: string;
    text: string;
    modelId?: string;
    languageCode?: string | null;
  }): Promise<Blob> {
    const settings = getTtsSettings();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const body: Record<string, unknown> = {
        text: params.text.slice(0, 500),
        model_id: params.modelId ?? 'eleven_multilingual_v2',
      };
      if (params.languageCode) {
        body.language_code = params.languageCode;
      }

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(params.voiceId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': settings.apiKey,
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw await parseError(response);
      }

      return await response.blob();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    getUsage,
    testKey,
    listVoices,
    speak,
  };
}

let clientInstance: ReturnType<typeof createElevenLabsClient> | null = null;

export function getElevenLabsClient(): ReturnType<typeof createElevenLabsClient> {
  if (!clientInstance) {
    clientInstance = createElevenLabsClient();
  }

  return clientInstance;
}
