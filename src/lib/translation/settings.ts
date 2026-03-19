import type { TranslationProviderId } from './types';
import { LEGACY_PROVIDER_ALIASES, VALID_PROVIDER_SET } from './types';
import { TRANSLATION_PROVIDER_SETTINGS_KEY } from '@/lib/constants/storage-keys';

export const TRANSLATION_PROVIDER_STORAGE_KEY = TRANSLATION_PROVIDER_SETTINGS_KEY;
export const TRANSLATION_PROVIDER_SETTINGS_EVENT =
  'glossboss:translation-provider-settings-changed';

export interface TranslationProviderSettings {
  provider: TranslationProviderId;
  updatedAt: number;
}

const DEFAULT_SETTINGS: TranslationProviderSettings = {
  provider: 'deepl',
  updatedAt: 0,
};

let cachedSettings: TranslationProviderSettings = DEFAULT_SETTINGS;

function isProvider(value: unknown): value is TranslationProviderId {
  if (typeof value !== 'string') return false;
  if (value in LEGACY_PROVIDER_ALIASES) return true;
  return VALID_PROVIDER_SET.has(value);
}

function readTranslationProviderSettings(): TranslationProviderSettings {
  try {
    const stored = localStorage.getItem(TRANSLATION_PROVIDER_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(stored);
    if (!isProvider(parsed?.provider)) {
      return DEFAULT_SETTINGS;
    }

    // Migrate legacy aliases (e.g. 'gemini' → 'google')
    const provider: TranslationProviderId =
      LEGACY_PROVIDER_ALIASES[parsed.provider] ?? parsed.provider;

    return {
      provider,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function getTranslationProviderSettings(): TranslationProviderSettings {
  return cachedSettings;
}

export function refreshTranslationProviderSettings(): TranslationProviderSettings {
  cachedSettings = readTranslationProviderSettings();
  return cachedSettings;
}

export function saveTranslationProviderSettings(
  settings: Partial<TranslationProviderSettings>,
): void {
  try {
    const next: TranslationProviderSettings = {
      ...readTranslationProviderSettings(),
      ...settings,
      updatedAt: Date.now(),
    };
    localStorage.setItem(TRANSLATION_PROVIDER_STORAGE_KEY, JSON.stringify(next));
    cachedSettings = next;
    window.dispatchEvent(new CustomEvent(TRANSLATION_PROVIDER_SETTINGS_EVENT));
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

refreshTranslationProviderSettings();
