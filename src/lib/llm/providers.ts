/**
 * LLM provider registry — frontend side.
 *
 * Adding a new preset provider: add one entry here, one in
 * supabase/functions/_shared/llm-providers.ts, and the string
 * literal to LlmProviderId in src/lib/translation/types.ts.
 */

import type { LlmProviderId } from '@/lib/translation/types';
import { TRANSLATION_DEFAULT_TEMPERATURE } from '@/lib/translation/constants';

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
    defaultModel: 'gpt-5.4-mini',
    models: [
      { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano' },
      { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
      { id: 'gpt-5.4', label: 'GPT-5.4' },
      { id: 'gpt-5-mini', label: 'GPT-5 Mini' },
    ],
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    description: 'OpenAI models for translation. Strong across most languages.',
    defaultTemperature: TRANSLATION_DEFAULT_TEMPERATURE,
  },
  {
    id: 'anthropic',
    label: 'Claude',
    defaultModel: 'claude-sonnet-4-6',
    models: [
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
      { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
      { id: 'claude-opus-4-6', label: 'Opus 4.6' },
    ],
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    description: 'Anthropic Claude models. Excellent for nuanced translations.',
    defaultTemperature: TRANSLATION_DEFAULT_TEMPERATURE,
  },
  {
    id: 'google',
    label: 'Gemini',
    defaultModel: 'gemini-3.1-flash-lite-preview',
    models: [
      { id: 'gemini-3.1-flash-lite-preview', label: 'Flash Lite 3.1' },
      { id: 'gemini-3-flash-preview', label: 'Flash 3' },
      { id: 'gemini-3.1-pro-preview', label: 'Pro 3.1' },
    ],
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    description: 'Google Gemini. Best value for translation with project context support.',
    defaultTemperature: TRANSLATION_DEFAULT_TEMPERATURE,
  },
  {
    id: 'mistral',
    label: 'Mistral',
    defaultModel: 'mistral-small-latest',
    models: [
      { id: 'mistral-small-latest', label: 'Small 4' },
      { id: 'mistral-large-latest', label: 'Large 3' },
      { id: 'magistral-medium-latest', label: 'Magistral Medium' },
    ],
    apiKeyUrl: 'https://console.mistral.ai/api-keys/',
    description: 'Mistral AI. Strong for European languages, especially French.',
    defaultTemperature: TRANSLATION_DEFAULT_TEMPERATURE,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek V3.2' },
      { id: 'deepseek-reasoner', label: 'DeepSeek R1' },
    ],
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    description: 'DeepSeek. Excellent for Chinese and CJK languages, very competitive pricing.',
    defaultTemperature: TRANSLATION_DEFAULT_TEMPERATURE,
  },
];

/** Look up a provider by ID. */
export function getLlmProviderMeta(id: LlmProviderId): LlmProviderMeta | undefined {
  return LLM_PROVIDERS.find((p) => p.id === id);
}

/** Get the default model for a provider. */
export function getLlmDefaultModel(id: LlmProviderId): string {
  return getLlmProviderMeta(id)?.defaultModel ?? 'gpt-5.4-mini';
}

/** Check if a provider ID is an LLM provider (not deepl/azure). */
export function isLlmProvider(id: string): id is LlmProviderId {
  return LLM_PROVIDERS.some((p) => p.id === id) || id === 'custom';
}
