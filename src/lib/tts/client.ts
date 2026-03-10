import { getSupabaseAnonKey, getSupabaseFunctionBaseUrl } from '@/lib/cloud-backend';
import { buildSupabaseFunctionHeaders } from '@/lib/supabase-function-headers';
import { getTtsSettings, saveTtsUsage } from './settings';
import type { TtsUsageStats, TtsVoiceSummary } from './types';

export interface ElevenLabsClientConfig {
  functionUrl?: string;
  timeout?: number;
}

const DEFAULT_TIMEOUT_MS = 30000;

function getDefaultFunctionUrl(): string {
  return `${getSupabaseFunctionBaseUrl('Speech')}/tts-elevenlabs`;
}

async function parseError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { message?: string };
    return new Error(body.message || `Request failed: ${response.status}`);
  } catch {
    return new Error(`Request failed: ${response.status}`);
  }
}

export function createElevenLabsClient(config: ElevenLabsClientConfig = {}) {
  const functionUrl = config.functionUrl ?? getDefaultFunctionUrl();
  const timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
  const anonKey = getSupabaseAnonKey();

  async function request<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const settings = getTtsSettings();
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: buildSupabaseFunctionHeaders(anonKey),
        body: JSON.stringify({
          action,
          apiKey: settings.apiKey,
          ...params,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw await parseError(response);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function requestBlob(action: string, params: Record<string, unknown> = {}): Promise<Blob> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const settings = getTtsSettings();
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: buildSupabaseFunctionHeaders(anonKey),
        body: JSON.stringify({
          action,
          apiKey: settings.apiKey,
          ...params,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw await parseError(response);
      }

      return await response.blob();
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
    return await requestBlob('speak', params);
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
