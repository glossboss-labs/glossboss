import type { TranslationProviderId } from './types';
import { TRANSLATION_USAGE_KEY } from '@/lib/constants/storage-keys';

const STORAGE_KEY = TRANSLATION_USAGE_KEY;

/** Event name dispatched after usage changes, consumed by FilterToolbar and others. */
export const TRANSLATION_USAGE_REFRESH_EVENT = 'translation-usage-refresh';

export interface TranslationUsageEntry {
  /** Total characters translated in the current tracking period */
  characterCount: number;

  /** Number of translation requests in the current tracking period */
  translationCount: number;

  /** Total tokens consumed (LLM providers only, 0 for DeepL/Azure) */
  tokenCount: number;

  /** Prompt tokens consumed (LLM providers only) */
  promptTokens: number;

  /** Completion tokens consumed (LLM providers only) */
  completionTokens: number;

  /** Timestamp (ms) of the first recorded usage in this period */
  periodStartedAt: number;
}

interface UsageStore {
  [provider: string]: TranslationUsageEntry;
}

const EMPTY_ENTRY: TranslationUsageEntry = {
  characterCount: 0,
  translationCount: 0,
  tokenCount: 0,
  promptTokens: 0,
  completionTokens: 0,
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
    tokenCount: safeNonNegative(entry.tokenCount),
    promptTokens: safeNonNegative(entry.promptTokens),
    completionTokens: safeNonNegative(entry.completionTokens),
    periodStartedAt: safeNonNegative(entry.periodStartedAt),
  };
}

/** Optional token usage to record alongside characters. */
export interface TokenUsageDelta {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Record translated characters (and optionally tokens) for a provider.
 *
 * Call this after every successful translation batch.
 */
export function recordTranslationUsage(
  provider: TranslationProviderId,
  characters: number,
  tokens?: TokenUsageDelta,
): void {
  if (characters <= 0 && !tokens) return;

  const store = loadStore();
  const entry = parseEntry(store[provider]);

  entry.characterCount += Math.max(0, characters);
  entry.translationCount += 1;
  if (tokens) {
    entry.tokenCount += tokens.totalTokens;
    entry.promptTokens += tokens.promptTokens;
    entry.completionTokens += tokens.completionTokens;
  }
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
