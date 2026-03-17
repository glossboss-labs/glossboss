import type { TranslationProviderId } from './types';

export const TRANSLATION_PROVIDER_STORAGE_KEY = 'glossboss-translation-provider-settings';

export interface TranslationProviderSettings {
  provider: TranslationProviderId;
  updatedAt: number;
}

const DEFAULT_SETTINGS: TranslationProviderSettings = {
  provider: 'deepl',
  updatedAt: 0,
};

const VALID_PROVIDERS = new Set<string>([
  'deepl',
  'azure',
  'openai',
  'anthropic',
  'google',
  'mistral',
  'deepseek',
  'custom',
]);

function isProvider(value: unknown): value is TranslationProviderId {
  if (typeof value !== 'string') return false;
  // Migrate legacy 'gemini' → 'google'
  if (value === 'gemini') return true;
  return VALID_PROVIDERS.has(value);
}

export function getTranslationProviderSettings(): TranslationProviderSettings {
  try {
    const stored = localStorage.getItem(TRANSLATION_PROVIDER_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(stored);
    if (!isProvider(parsed?.provider)) {
      return DEFAULT_SETTINGS;
    }

    // Migrate legacy 'gemini' → 'google'
    const provider: TranslationProviderId =
      parsed.provider === 'gemini' ? 'google' : parsed.provider;

    return {
      provider,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveTranslationProviderSettings(
  settings: Partial<TranslationProviderSettings>,
): void {
  try {
    const next: TranslationProviderSettings = {
      ...getTranslationProviderSettings(),
      ...settings,
      updatedAt: Date.now(),
    };
    localStorage.setItem(TRANSLATION_PROVIDER_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors.
  }
}

export function getActiveTranslationProvider(): TranslationProviderId {
  return getTranslationProviderSettings().provider;
}

export function saveActiveTranslationProvider(provider: TranslationProviderId): void {
  saveTranslationProviderSettings({ provider });
}
