import type { TranslationProviderId } from './types';

const STORAGE_KEY = 'glossboss-translation-usage';

/** Event name dispatched after usage changes, consumed by FilterToolbar and others. */
export const TRANSLATION_USAGE_REFRESH_EVENT = 'translation-usage-refresh';

export interface TranslationUsageEntry {
  /** Total characters translated in the current tracking period */
  characterCount: number;

  /** Number of translation requests in the current tracking period */
  translationCount: number;

  /** Timestamp (ms) of the first recorded usage in this period */
  periodStartedAt: number;
}

interface UsageStore {
  [provider: string]: TranslationUsageEntry;
}

const EMPTY_ENTRY: TranslationUsageEntry = {
  characterCount: 0,
  translationCount: 0,
  periodStartedAt: 0,
};

function loadStore(): UsageStore {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(store: UsageStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage errors.
  }
}

function safeNonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function parseEntry(raw: unknown): TranslationUsageEntry {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY_ENTRY };
  const entry = raw as Record<string, unknown>;
  return {
    characterCount: safeNonNegative(entry.characterCount),
    translationCount: safeNonNegative(entry.translationCount),
    periodStartedAt: safeNonNegative(entry.periodStartedAt),
  };
}

/**
 * Record translated characters for a provider.
 *
 * Call this after every successful translation batch.
 */
export function recordTranslationUsage(provider: TranslationProviderId, characters: number): void {
  if (characters <= 0) return;

  const store = loadStore();
  const entry = parseEntry(store[provider]);

  entry.characterCount += characters;
  entry.translationCount += 1;
  if (entry.periodStartedAt === 0) {
    entry.periodStartedAt = Date.now();
  }

  store[provider] = entry;
  saveStore(store);
}

/**
 * Get the current usage stats for a specific provider.
 */
export function getTranslationUsage(provider: TranslationProviderId): TranslationUsageEntry {
  const store = loadStore();
  return parseEntry(store[provider]);
}

/**
 * Reset usage for a specific provider.
 */
export function resetTranslationUsage(provider: TranslationProviderId): void {
  const store = loadStore();
  delete store[provider];
  saveStore(store);
}
