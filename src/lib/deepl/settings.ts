/**
 * DeepL Settings Storage
 *
 * Manages user's DeepL API key and preferences in localStorage.
 */

/** Storage keys */
const STORAGE_KEY = 'glossboss-deepl-settings';

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
 * Get DeepL settings from localStorage
 */
export function getDeepLSettings(): DeepLSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
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
 * Save DeepL settings to localStorage
 */
export function saveDeepLSettings(settings: Partial<DeepLSettings>): void {
  try {
    const current = getDeepLSettings();
    const updated: DeepLSettings = {
      ...current,
      ...settings,
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('[DeepL Settings] Failed to save settings:', error);
  }
}

/**
 * Clear DeepL settings from localStorage
 */
export function clearDeepLSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
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
