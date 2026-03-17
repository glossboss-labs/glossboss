/**
 * LLM provider registry for the llm-translate edge function.
 *
 * Adding a new provider: add one entry here and one AI SDK import
 * in the edge function. OpenAI-compatible APIs reuse sdk: 'openai'
 * with a custom baseURL — no extra SDK package needed.
 */

export type SdkType = 'openai' | 'anthropic' | 'google' | 'mistral';

export interface LlmProviderDef {
  /** Which AI SDK factory to use. */
  sdk: SdkType;
  /** Custom API base URL (for OpenAI-compatible providers like DeepSeek). */
  baseURL?: string;
  /** Fallback model if none specified in the request. */
  defaultModel: string;
}

export const LLM_PROVIDERS: Record<string, LlmProviderDef> = {
  openai: {
    sdk: 'openai',
    defaultModel: 'gpt-4o-mini',
  },
  anthropic: {
    sdk: 'anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
  },
  google: {
    sdk: 'google',
    defaultModel: 'gemini-2.0-flash-lite',
  },
  mistral: {
    sdk: 'mistral',
    defaultModel: 'mistral-small-latest',
  },
  deepseek: {
    sdk: 'openai',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
};

/**
 * Resolve a provider definition from the registry or treat as custom.
 * Returns null if the provider is unknown and no baseURL is supplied.
 */
export function resolveProvider(providerId: string, customBaseURL?: string): LlmProviderDef | null {
  // Known preset provider
  const preset = LLM_PROVIDERS[providerId];
  if (preset) {
    return preset;
  }

  // 'custom' or unknown — requires a baseURL
  if (providerId === 'custom' && customBaseURL) {
    return {
      sdk: 'openai',
      baseURL: customBaseURL,
      defaultModel: 'gpt-4o-mini',
    };
  }

  return null;
}
