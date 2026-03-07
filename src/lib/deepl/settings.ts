/**
 * DeepL Settings Storage
 *
 * Manages user's DeepL API key and preferences.
 * By default, the key lives in sessionStorage (cleared on browser close).
 * When the user explicitly opts in, it is persisted in localStorage.
 */

/** Storage keys */
const STORAGE_KEY = 'glossboss-deepl-settings';

/** Key that tracks whether the user opted into persistent storage */
const PERSIST_KEY = 'glossboss-deepl-persist';

/** API types */
export type DeepLApiType = 'free' | 'pro';

/** Settings structure */
export interface DeepLSettings {
  /** User's DeepL API key */
  apiKey: string;
  /** API type (free or pro) */
  apiType: DeepLApiType;
  /** When the settings were last updated */
  updatedAt: number;
}

/** Default settings */
const DEFAULT_SETTINGS: DeepLSettings = {
  apiKey: '',
  apiType: 'free',
  updatedAt: 0,
};

/**
 * Whether the user opted into persistent (localStorage) key storage.
 */
export function isPersistEnabled(): boolean {
  try {
    return localStorage.getItem(PERSIST_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Enable or disable persistent key storage.
 * When switching from persistent → session, migrates the key to sessionStorage and removes it from localStorage.
 */
export function setPersistEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      // Migrate from session → local
      const session = sessionStorage.getItem(STORAGE_KEY);
      if (session) {
        localStorage.setItem(STORAGE_KEY, session);
        sessionStorage.removeItem(STORAGE_KEY);
      }
      localStorage.setItem(PERSIST_KEY, 'true');
    } else {
      // Migrate from local → session
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) {
        sessionStorage.setItem(STORAGE_KEY, local);
        localStorage.removeItem(STORAGE_KEY);
      }
      localStorage.removeItem(PERSIST_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

/** Return the active storage backend based on the persist flag. */
function getStore(): Storage {
  return isPersistEnabled() ? localStorage : sessionStorage;
}

/**
 * Get DeepL settings from the active storage backend
 */
export function getDeepLSettings(): DeepLSettings {
  try {
    const stored = getStore().getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };
    }
  } catch (error) {
    console.warn('[DeepL Settings] Failed to load settings:', error);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save DeepL settings to the active storage backend
 */
export function saveDeepLSettings(settings: Partial<DeepLSettings>): void {
  try {
    const current = getDeepLSettings();
    const updated: DeepLSettings = {
      ...current,
      ...settings,
      updatedAt: Date.now(),
    };
    getStore().setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('[DeepL Settings] Failed to save settings:', error);
  }
}

/**
 * Clear DeepL settings from both storage backends
 */
export function clearDeepLSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PERSIST_KEY);
  } catch (error) {
    console.error('[DeepL Settings] Failed to clear settings:', error);
  }
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
