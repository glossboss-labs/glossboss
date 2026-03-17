/**
 * Unified LLM settings — stores per-provider configuration
 * (API key, model, temperature, project context toggle).
 *
 * Migrates existing Gemini settings on first read.
 */

import type { LlmProviderId } from '@/lib/translation/types';
import { getLlmDefaultModel } from './providers';

const STORAGE_KEY = 'glossboss-llm-settings';
const PERSIST_KEY = 'glossboss-llm-persist';
const LEGACY_GEMINI_KEY = 'glossboss-gemini-settings';
const LEGACY_GEMINI_PERSIST_KEY = 'glossboss-gemini-persist';

export interface LlmProviderSettings {
  apiKey: string;
  modelId: string;
  temperature: number;
  useProjectContext: boolean;
  updatedAt: number;
}

// Custom endpoint settings (extends base)
export interface CustomProviderSettings extends LlmProviderSettings {
  label: string;
  baseURL: string;
}

type LlmSettingsStore = Partial<Record<LlmProviderId, LlmProviderSettings>> & {
  custom?: CustomProviderSettings;
};

const DEFAULT_TEMPERATURE = 0.2;

function defaultSettings(provider: LlmProviderId): LlmProviderSettings {
  return {
    apiKey: '',
    modelId: getLlmDefaultModel(provider),
    temperature: DEFAULT_TEMPERATURE,
    useProjectContext: false,
    updatedAt: 0,
  };
}

// ── Persistence toggle ─────────────────────────────────────

export function isLlmPersistEnabled(): boolean {
  try {
    return localStorage.getItem(PERSIST_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setLlmPersistEnabled(enabled: boolean): void {
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
  return isLlmPersistEnabled() ? localStorage : sessionStorage;
}

// ── Migration from legacy Gemini settings ──────────────────

let migrationDone = false;

function migrateGeminiSettings(): void {
  if (migrationDone) return;
  migrationDone = true;

  try {
    // Check if legacy Gemini settings exist
    const legacyPersist = localStorage.getItem(LEGACY_GEMINI_PERSIST_KEY) === 'true';
    const legacyStore = legacyPersist ? localStorage : sessionStorage;
    const legacyRaw = legacyStore.getItem(LEGACY_GEMINI_KEY);
    if (!legacyRaw) return;

    // Check if we've already migrated (google entry exists)
    const currentRaw = getStore().getItem(STORAGE_KEY);
    if (currentRaw) {
      try {
        const current = JSON.parse(currentRaw) as LlmSettingsStore;
        if (current.google) return; // Already migrated
      } catch {
        // Parse error — proceed with migration
      }
    }

    const legacy = JSON.parse(legacyRaw);
    const googleSettings: LlmProviderSettings = {
      apiKey: typeof legacy.apiKey === 'string' ? legacy.apiKey : '',
      modelId:
        typeof legacy.modelId === 'string' && legacy.modelId.trim()
          ? legacy.modelId.trim()
          : getLlmDefaultModel('google'),
      temperature: DEFAULT_TEMPERATURE,
      useProjectContext: Boolean(legacy.useProjectContext),
      updatedAt: typeof legacy.updatedAt === 'number' ? legacy.updatedAt : Date.now(),
    };

    // Write migrated settings
    const store = loadStore();
    store.google = googleSettings;
    saveStore(store);

    // Migrate persist setting
    if (legacyPersist) {
      setLlmPersistEnabled(true);
    }
  } catch {
    // Ignore migration errors.
  }
}

// ── Store read/write ───────────────────────────────────────

function loadStore(): LlmSettingsStore {
  migrateGeminiSettings();
  try {
    const stored = getStore().getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(store: LlmSettingsStore): void {
  try {
    getStore().setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage errors.
  }
}

// ── Public API ─────────────────────────────────────────────

export function getLlmSettings(provider: LlmProviderId): LlmProviderSettings {
  const store = loadStore();
  const stored = store[provider];
  if (!stored) return defaultSettings(provider);

  return {
    apiKey: typeof stored.apiKey === 'string' ? stored.apiKey : '',
    modelId:
      typeof stored.modelId === 'string' && stored.modelId.trim()
        ? stored.modelId.trim()
        : getLlmDefaultModel(provider),
    temperature:
      typeof stored.temperature === 'number' && Number.isFinite(stored.temperature)
        ? stored.temperature
        : DEFAULT_TEMPERATURE,
    useProjectContext: Boolean(stored.useProjectContext),
    updatedAt: typeof stored.updatedAt === 'number' ? stored.updatedAt : 0,
  };
}

export function saveLlmSettings(
  provider: LlmProviderId,
  settings: Partial<LlmProviderSettings>,
): void {
  const store = loadStore();
  const current = store[provider] ?? defaultSettings(provider);
  store[provider] = {
    ...current,
    ...settings,
    updatedAt: Date.now(),
  };
  saveStore(store);
}

export function clearLlmSettings(provider: LlmProviderId): void {
  const store = loadStore();
  delete store[provider];
  saveStore(store);
}

export function hasLlmApiKey(provider: LlmProviderId): boolean {
  return Boolean(getLlmSettings(provider).apiKey.trim());
}

export function getCustomSettings(): CustomProviderSettings {
  const store = loadStore();
  const stored = store.custom;
  if (!stored) {
    return {
      ...defaultSettings('openai' as LlmProviderId),
      label: '',
      baseURL: '',
    };
  }

  return {
    apiKey: typeof stored.apiKey === 'string' ? stored.apiKey : '',
    modelId: typeof stored.modelId === 'string' && stored.modelId.trim() ? stored.modelId : '',
    temperature:
      typeof stored.temperature === 'number' && Number.isFinite(stored.temperature)
        ? stored.temperature
        : DEFAULT_TEMPERATURE,
    useProjectContext: Boolean(stored.useProjectContext),
    updatedAt: typeof stored.updatedAt === 'number' ? stored.updatedAt : 0,
    label:
      typeof (stored as CustomProviderSettings).label === 'string'
        ? (stored as CustomProviderSettings).label
        : '',
    baseURL:
      typeof (stored as CustomProviderSettings).baseURL === 'string'
        ? (stored as CustomProviderSettings).baseURL
        : '',
  };
}

export function saveCustomSettings(settings: Partial<CustomProviderSettings>): void {
  const store = loadStore();
  const current = (store.custom as CustomProviderSettings | undefined) ?? {
    ...defaultSettings('openai' as LlmProviderId),
    label: '',
    baseURL: '',
  };
  (store as Record<string, unknown>).custom = {
    ...current,
    ...settings,
    updatedAt: Date.now(),
  };
  saveStore(store);
}

export function clearCustomSettings(): void {
  const store = loadStore();
  delete (store as Record<string, unknown>).custom;
  saveStore(store);
}

export function hasCustomApiKey(): boolean {
  const custom = getCustomSettings();
  return Boolean(custom.baseURL.trim());
}
