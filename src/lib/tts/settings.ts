import { createPersistenceManager } from '@/lib/settings/storage-persistence';
import { TTS_SETTINGS_KEY, TTS_PERSIST_KEY } from '@/lib/constants/storage-keys';
import type { TtsSettings, TtsUsageStats } from './types';

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

const manager = createPersistenceManager<TtsSettings>({
  storageKey: TTS_SETTINGS_KEY,
  persistKey: TTS_PERSIST_KEY,
  defaults: DEFAULT_SETTINGS,
  label: 'TTS Settings',
  cache: true,
});

export function isTtsPersistEnabled(): boolean {
  return manager.isPersistEnabled();
}

export function setTtsPersistEnabled(enabled: boolean): void {
  manager.setPersistEnabled(enabled);
}

export function getTtsSettings(): TtsSettings {
  return manager.get();
}

export function saveTtsSettings(settings: Partial<TtsSettings>): void {
  manager.save(settings);
}

export function clearTtsSettings(): void {
  manager.clear();
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
  return manager.subscribe(listener);
}
