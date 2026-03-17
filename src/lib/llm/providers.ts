/**
 * LLM provider registry — frontend side.
 *
 * Adding a new preset provider: add one entry here, one in
 * supabase/functions/_shared/llm-providers.ts, and the string
 * literal to LlmProviderId in src/lib/translation/types.ts.
 */

import type { LlmProviderId } from '@/lib/translation/types';

export interface LlmModelMeta {
  id: string;
  label: string;
}

export interface LlmProviderMeta {
  id: LlmProviderId;
  label: string;
  defaultModel: string;
  models: LlmModelMeta[];
  apiKeyUrl: string;
  description: string;
  defaultTemperature: number;
}

export const LLM_PROVIDERS: LlmProviderMeta[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'o3-mini', label: 'o3 Mini' },
    ],
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    description: 'OpenAI models for translation. Strong across most languages.',
    defaultTemperature: 0.2,
  },
  {
    id: 'anthropic',
    label: 'Claude',
    defaultModel: 'claude-sonnet-4-20250514',
    models: [
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
      { id: 'claude-sonnet-4-20250514', label: 'Sonnet 4' },
      { id: 'claude-opus-4-20250514', label: 'Opus 4' },
    ],
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    description: 'Anthropic Claude models. Excellent for nuanced translations.',
    defaultTemperature: 0.2,
  },
  {
    id: 'google',
    label: 'Gemini',
    defaultModel: 'gemini-2.0-flash-lite',
    models: [
      { id: 'gemini-2.0-flash-lite', label: 'Flash Lite 2.0' },
      { id: 'gemini-2.0-flash', label: 'Flash 2.0' },
      { id: 'gemini-2.5-flash-preview-05-20', label: 'Flash 2.5 Preview' },
    ],
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    description: 'Google Gemini. Best value for translation with project context support.',
    defaultTemperature: 0.2,
  },
  {
    id: 'mistral',
    label: 'Mistral',
    defaultModel: 'mistral-small-latest',
    models: [
      { id: 'mistral-small-latest', label: 'Small' },
      { id: 'mistral-medium-latest', label: 'Medium' },
      { id: 'mistral-large-latest', label: 'Large' },
    ],
    apiKeyUrl: 'https://console.mistral.ai/api-keys/',
    description: 'Mistral AI. Strong for European languages, especially French.',
    defaultTemperature: 0.2,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
    ],
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    description: 'DeepSeek. Excellent for Chinese and CJK languages, very competitive pricing.',
    defaultTemperature: 0.2,
  },
];

/** Look up a provider by ID. */
export function getLlmProviderMeta(id: LlmProviderId): LlmProviderMeta | undefined {
  return LLM_PROVIDERS.find((p) => p.id === id);
}

/** Get the default model for a provider. */
export function getLlmDefaultModel(id: LlmProviderId): string {
  return getLlmProviderMeta(id)?.defaultModel ?? 'gpt-4o-mini';
}

/** Check if a provider ID is an LLM provider (not deepl/azure). */
export function isLlmProvider(id: string): id is LlmProviderId {
  return LLM_PROVIDERS.some((p) => p.id === id) || id === 'custom';
}
