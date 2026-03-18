/**
 * DeepL Settings Storage
 *
 * Manages user's DeepL API key and preferences.
 * By default, the key lives in sessionStorage (cleared on browser close).
 * When the user explicitly opts in, it is persisted in localStorage.
 */

import { createPersistenceManager } from '@/lib/settings/storage-persistence';
import { DEEPL_SETTINGS_KEY, DEEPL_PERSIST_KEY } from '@/lib/constants/storage-keys';

/** API types */
export type DeepLApiType = 'free' | 'pro';

/** Formality preference for DeepL translations */
export type DeepLFormality = 'prefer_less' | 'prefer_more';

/** Settings structure */
export interface DeepLSettings {
  /** User's DeepL API key */
  apiKey: string;
  /** API type (free or pro) */
  apiType: DeepLApiType;
  /** Formality preference */
  formality: DeepLFormality;
  /** When the settings were last updated */
  updatedAt: number;
}

/** Default settings */
const DEFAULT_SETTINGS: DeepLSettings = {
  apiKey: '',
  apiType: 'free',
  formality: 'prefer_less',
  updatedAt: 0,
};

const manager = createPersistenceManager<DeepLSettings>({
  storageKey: DEEPL_SETTINGS_KEY,
  persistKey: DEEPL_PERSIST_KEY,
  defaults: DEFAULT_SETTINGS,
  label: 'DeepL Settings',
});

/**
 * Whether the user opted into persistent (localStorage) key storage.
 */
export function isPersistEnabled(): boolean {
  return manager.isPersistEnabled();
}

/**
 * Enable or disable persistent key storage.
 */
export function setPersistEnabled(enabled: boolean): void {
  manager.setPersistEnabled(enabled);
}

/**
 * Get DeepL settings from the active storage backend
 */
export function getDeepLSettings(): DeepLSettings {
  return manager.get();
}

/**
 * Save DeepL settings to the active storage backend
 */
export function saveDeepLSettings(settings: Partial<DeepLSettings>): void {
  manager.save(settings);
}

/**
 * Clear DeepL settings from both storage backends
 */
export function clearDeepLSettings(): void {
  manager.clear();
}

/**
 * Check if user has configured their own API key
 */
export function hasUserApiKey(): boolean {
  const settings = getDeepLSettings();
  return Boolean(settings.apiKey && settings.apiKey.trim());
}

/**
 * Get the DeepL API base URL for the configured API type
 */
export function getDeepLApiUrl(apiType: DeepLApiType = 'free'): string {
  return apiType === 'pro' ? 'https://api.deepl.com/v2' : 'https://api-free.deepl.com/v2';
}
