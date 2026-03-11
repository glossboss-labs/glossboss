const STORAGE_KEY = 'glossboss-gemini-settings';
const PERSIST_KEY = 'glossboss-gemini-persist';
const DEFAULT_MODEL = 'gemini-flash-lite-latest';

export interface GeminiSettings {
  apiKey: string;
  modelId: string;
  useProjectContext: boolean;
  updatedAt: number;
}

const DEFAULT_SETTINGS: GeminiSettings = {
  apiKey: '',
  modelId: DEFAULT_MODEL,
  useProjectContext: false,
  updatedAt: 0,
};

export function isGeminiPersistEnabled(): boolean {
  try {
    return localStorage.getItem(PERSIST_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setGeminiPersistEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      const session = sessionStorage.getItem(STORAGE_KEY);
      if (session) {
        localStorage.setItem(STORAGE_KEY, session);
        sessionStorage.removeItem(STORAGE_KEY);
      }
      localStorage.setItem(PERSIST_KEY, 'true');
      return;
    }

    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      sessionStorage.setItem(STORAGE_KEY, local);
      localStorage.removeItem(STORAGE_KEY);
    }
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function getStore(): Storage {
  return isGeminiPersistEnabled() ? localStorage : sessionStorage;
}

export function getGeminiSettings(): GeminiSettings {
  try {
    const stored = getStore().getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(stored);
    return {
      ...DEFAULT_SETTINGS,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      modelId:
        typeof parsed.modelId === 'string' && parsed.modelId.trim()
          ? parsed.modelId.trim()
          : DEFAULT_MODEL,
      useProjectContext: Boolean(parsed.useProjectContext),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveGeminiSettings(settings: Partial<GeminiSettings>): void {
  try {
    const next: GeminiSettings = {
      ...getGeminiSettings(),
      ...settings,
      updatedAt: Date.now(),
    };
    getStore().setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors.
  }
}

export function clearGeminiSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export function hasGeminiApiKey(): boolean {
  return Boolean(getGeminiSettings().apiKey.trim());
}

export function getDefaultGeminiModel(): string {
  return DEFAULT_MODEL;
}
