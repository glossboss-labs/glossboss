/**
 * Unified LLM settings — stores per-provider configuration
 * (API key, model, temperature, project context toggle).
 *
 * Migrates existing Gemini settings on first read.
 */

import type { LlmProviderId } from '@/lib/translation/types';
import { getLlmDefaultModel } from './providers';
import { createPersistenceManager } from '@/lib/settings/storage-persistence';
import {
  LLM_SETTINGS_KEY,
  LLM_PERSIST_KEY,
  GEMINI_SETTINGS_KEY,
  GEMINI_PERSIST_KEY,
} from '@/lib/constants/storage-keys';

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

// Wrapper type so the persistence manager can treat the store as a single object.
interface LlmStoreWrapper {
  store: LlmSettingsStore;
  updatedAt: number;
}

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

// ── Persistence manager (handles persist toggle + storage) ───

const manager = createPersistenceManager<LlmStoreWrapper>({
  storageKey: LLM_SETTINGS_KEY,
  persistKey: LLM_PERSIST_KEY,
  defaults: { store: {}, updatedAt: 0 },
  label: 'LLM Settings',
  parse: (raw) => {
    // The storage format is a flat LlmSettingsStore (not wrapped).
    // We wrap it for the manager but store it flat for backward compat.
    if (typeof raw === 'object' && raw !== null) {
      return { store: raw as unknown as LlmSettingsStore, updatedAt: 0 };
    }
    return { store: {}, updatedAt: 0 };
  },
});

// Override the manager's save to write flat (not wrapped) for backward compat.
function saveStoreRaw(store: LlmSettingsStore): void {
  try {
    const storage = manager.isPersistEnabled() ? localStorage : sessionStorage;
    storage.setItem(LLM_SETTINGS_KEY, JSON.stringify(store));
    manager.invalidateCache();
  } catch {
    // Ignore storage errors.
  }
}

// ── Persistence toggle ─────────────────────────────────────

export function isLlmPersistEnabled(): boolean {
  return manager.isPersistEnabled();
}

export function setLlmPersistEnabled(enabled: boolean): void {
  manager.setPersistEnabled(enabled);
}

// ── Migration from legacy Gemini settings ──────────────────

let migrationDone = false;

function migrateGeminiSettings(): void {
  if (migrationDone) return;
  migrationDone = true;

  try {
    // Check if legacy Gemini settings exist
    const legacyPersist = localStorage.getItem(GEMINI_PERSIST_KEY) === 'true';
    const legacyStore = legacyPersist ? localStorage : sessionStorage;
    const legacyRaw = legacyStore.getItem(GEMINI_SETTINGS_KEY);
    if (!legacyRaw) return;

    // Check if we've already migrated (google entry exists)
    const currentStore = loadStore();
    if (currentStore.google) return;

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
    saveStoreRaw(store);

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
  return manager.get().store;
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
  saveStoreRaw(store);
}

export function clearLlmSettings(provider: LlmProviderId): void {
  const store = loadStore();
  delete store[provider];
  saveStoreRaw(store);
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
  saveStoreRaw(store);
}

export function clearCustomSettings(): void {
  const store = loadStore();
  delete (store as Record<string, unknown>).custom;
  saveStoreRaw(store);
}

export function hasCustomApiKey(): boolean {
  const custom = getCustomSettings();
  return Boolean(custom.baseURL.trim());
}
