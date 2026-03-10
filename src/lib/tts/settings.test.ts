import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearTtsSettings,
  getTtsSettings,
  isElevenLabsQuotaExceeded,
  isTtsPersistEnabled,
  saveTtsSettings,
  setTtsPersistEnabled,
} from './settings';

describe('tts settings', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('stores settings in session storage by default', () => {
    saveTtsSettings({ provider: 'elevenlabs', apiKey: 'key-123' });

    expect(getTtsSettings()).toMatchObject({
      provider: 'elevenlabs',
      apiKey: 'key-123',
    });
    expect(sessionStorage.getItem('glossboss-tts-settings')).toContain('key-123');
  });

  it('moves settings to local storage when persistence is enabled', () => {
    saveTtsSettings({ apiKey: 'persisted-key' });

    setTtsPersistEnabled(true);

    expect(isTtsPersistEnabled()).toBe(true);
    expect(localStorage.getItem('glossboss-tts-settings')).toContain('persisted-key');
    expect(sessionStorage.getItem('glossboss-tts-settings')).toBeNull();
  });

  it('clears settings and persistence flag', () => {
    saveTtsSettings({ provider: 'elevenlabs', apiKey: 'abc' });
    setTtsPersistEnabled(true);

    clearTtsSettings();

    expect(getTtsSettings()).toMatchObject({
      provider: 'browser',
      apiKey: '',
    });
    expect(isTtsPersistEnabled()).toBe(false);
  });

  it('marks usage as exhausted when count reaches the limit', () => {
    expect(
      isElevenLabsQuotaExceeded({
        characterCount: 100,
        characterLimit: 100,
      }),
    ).toBe(true);
    expect(
      isElevenLabsQuotaExceeded({
        characterCount: 50,
        characterLimit: 100,
      }),
    ).toBe(false);
  });
});
