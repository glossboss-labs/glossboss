import type { TtsSettings, TtsUsageStats } from './types';

const STORAGE_KEY = 'glossboss-tts-settings';
const PERSIST_KEY = 'glossboss-tts-persist';
const SETTINGS_EVENT = 'glossboss:tts-settings-changed';

const DEFAULT_SETTINGS: TtsSettings = {
  enabled: true,
  provider: 'browser',
  apiKey: '',
  rate: 1,
  updatedAt: 0,
  sourceBrowserVoiceURI: null,
  translationBrowserVoiceURI: null,
  sourceElevenLabsVoiceId: null,
  translationElevenLabsVoiceId: null,
  elevenLabsUsage: null,
  elevenLabsUsageFetchedAt: null,
};
let cachedSettings: TtsSettings | null = null;

function getStorage(): Storage {
  return isTtsPersistEnabled() ? localStorage : sessionStorage;
}

function readSettingsFromStorage(): TtsSettings {
  try {
    const stored = getStorage().getItem(STORAGE_KEY);
    if (stored) {
      return {
        ...DEFAULT_SETTINGS,
        ...JSON.parse(stored),
      };
    }
  } catch (error) {
    console.warn('[TTS Settings] Failed to load settings:', error);
  }

  return { ...DEFAULT_SETTINGS };
}

function notifySettingsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT));
}

export function isTtsPersistEnabled(): boolean {
  try {
    return localStorage.getItem(PERSIST_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setTtsPersistEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      const session = sessionStorage.getItem(STORAGE_KEY);
      if (session) {
        localStorage.setItem(STORAGE_KEY, session);
        sessionStorage.removeItem(STORAGE_KEY);
      }
      localStorage.setItem(PERSIST_KEY, 'true');
    } else {
      const persisted = localStorage.getItem(STORAGE_KEY);
      if (persisted) {
        sessionStorage.setItem(STORAGE_KEY, persisted);
        localStorage.removeItem(STORAGE_KEY);
      }
      localStorage.removeItem(PERSIST_KEY);
    }
  } catch {
    return;
  }

  cachedSettings = readSettingsFromStorage();
  notifySettingsChanged();
}

export function getTtsSettings(): TtsSettings {
  if (!cachedSettings) {
    cachedSettings = readSettingsFromStorage();
  }

  return cachedSettings;
}

export function saveTtsSettings(settings: Partial<TtsSettings>): void {
  try {
    const current = getTtsSettings();
    cachedSettings = {
      ...current,
      ...settings,
      updatedAt: Date.now(),
    };
    getStorage().setItem(STORAGE_KEY, JSON.stringify(cachedSettings));
  } catch (error) {
    console.error('[TTS Settings] Failed to save settings:', error);
  }

  notifySettingsChanged();
}

export function clearTtsSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PERSIST_KEY);
    cachedSettings = { ...DEFAULT_SETTINGS };
  } catch (error) {
    console.error('[TTS Settings] Failed to clear settings:', error);
  }

  notifySettingsChanged();
}

export function saveTtsUsage(usage: TtsUsageStats | null): void {
  saveTtsSettings({
    elevenLabsUsage: usage,
    elevenLabsUsageFetchedAt: usage ? Date.now() : null,
  });
}

export function hasElevenLabsApiKey(): boolean {
  return Boolean(getTtsSettings().apiKey.trim());
}

export function isElevenLabsQuotaExceeded(usage: TtsUsageStats | null | undefined): boolean {
  if (!usage) return false;
  return usage.characterLimit > 0 && usage.characterCount >= usage.characterLimit;
}

export function subscribeToTtsSettings(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === STORAGE_KEY || event.key === PERSIST_KEY) {
      cachedSettings = readSettingsFromStorage();
      listener();
    }
  };

  window.addEventListener(SETTINGS_EVENT, listener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(SETTINGS_EVENT, listener);
    window.removeEventListener('storage', handleStorage);
  };
}
