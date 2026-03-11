const STORAGE_KEY = 'glossboss-azure-settings';
const PERSIST_KEY = 'glossboss-azure-persist';
const DEFAULT_ENDPOINT = 'https://api.cognitive.microsofttranslator.com';

export interface AzureSettings {
  apiKey: string;
  region: string;
  endpoint: string;
  updatedAt: number;
}

const DEFAULT_SETTINGS: AzureSettings = {
  apiKey: '',
  region: '',
  endpoint: DEFAULT_ENDPOINT,
  updatedAt: 0,
};

export function isAzurePersistEnabled(): boolean {
  try {
    return localStorage.getItem(PERSIST_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAzurePersistEnabled(enabled: boolean): void {
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
  return isAzurePersistEnabled() ? localStorage : sessionStorage;
}

export function getAzureSettings(): AzureSettings {
  try {
    const stored = getStore().getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(stored);
    return {
      ...DEFAULT_SETTINGS,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      region: typeof parsed.region === 'string' ? parsed.region : '',
      endpoint:
        typeof parsed.endpoint === 'string' && parsed.endpoint.trim()
          ? parsed.endpoint.trim()
          : DEFAULT_ENDPOINT,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAzureSettings(settings: Partial<AzureSettings>): void {
  try {
    const next: AzureSettings = {
      ...getAzureSettings(),
      ...settings,
      updatedAt: Date.now(),
    };
    getStore().setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors.
  }
}

export function clearAzureSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export function hasAzureApiKey(): boolean {
  const settings = getAzureSettings();
  return Boolean(settings.apiKey.trim() && settings.region.trim());
}

export function getDefaultAzureEndpoint(): string {
  return DEFAULT_ENDPOINT;
}
