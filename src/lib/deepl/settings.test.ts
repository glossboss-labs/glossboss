import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDeepLSettings,
  saveDeepLSettings,
  clearDeepLSettings,
  hasUserApiKey,
  getDeepLApiUrl,
  isPersistEnabled,
  setPersistEnabled,
} from './settings';

describe('DeepL settings', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('getDeepLSettings', () => {
    it('returns defaults when nothing is stored', () => {
      const settings = getDeepLSettings();
      expect(settings.apiKey).toBe('');
      expect(settings.apiType).toBe('free');
      expect(settings.formality).toBe('prefer_less');
    });

    it('reads from sessionStorage by default (persist disabled)', () => {
      sessionStorage.setItem(
        'glossboss-deepl-settings',
        JSON.stringify({ apiKey: 'session-key', apiType: 'free', updatedAt: 1 }),
      );
      const settings = getDeepLSettings();
      expect(settings.apiKey).toBe('session-key');
    });

    it('reads from localStorage when persist is enabled', () => {
      localStorage.setItem('glossboss-deepl-persist', 'true');
      localStorage.setItem(
        'glossboss-deepl-settings',
        JSON.stringify({ apiKey: 'local-key', apiType: 'pro', updatedAt: 1 }),
      );
      const settings = getDeepLSettings();
      expect(settings.apiKey).toBe('local-key');
      expect(settings.apiType).toBe('pro');
    });

    it('uses default formality when stored settings lack formality', () => {
      sessionStorage.setItem(
        'glossboss-deepl-settings',
        JSON.stringify({ apiKey: 'k', apiType: 'free', updatedAt: 1 }),
      );
      const settings = getDeepLSettings();
      expect(settings.formality).toBe('prefer_less');
    });

    it('reads stored formality preference', () => {
      sessionStorage.setItem(
        'glossboss-deepl-settings',
        JSON.stringify({ apiKey: 'k', apiType: 'free', formality: 'prefer_more', updatedAt: 1 }),
      );
      const settings = getDeepLSettings();
      expect(settings.formality).toBe('prefer_more');
    });
  });

  describe('saveDeepLSettings', () => {
    it('saves to sessionStorage by default', () => {
      saveDeepLSettings({ apiKey: 'test-key', apiType: 'free' });
      expect(sessionStorage.getItem('glossboss-deepl-settings')).not.toBeNull();
      expect(localStorage.getItem('glossboss-deepl-settings')).toBeNull();
    });

    it('saves to localStorage when persist is enabled', () => {
      setPersistEnabled(true);
      saveDeepLSettings({ apiKey: 'test-key', apiType: 'pro' });
      expect(localStorage.getItem('glossboss-deepl-settings')).not.toBeNull();
    });

    it('persists formality preference', () => {
      saveDeepLSettings({ formality: 'prefer_more' });
      const settings = getDeepLSettings();
      expect(settings.formality).toBe('prefer_more');
    });
  });

  describe('clearDeepLSettings', () => {
    it('clears from both storage backends', () => {
      sessionStorage.setItem('glossboss-deepl-settings', 'x');
      localStorage.setItem('glossboss-deepl-settings', 'x');
      localStorage.setItem('glossboss-deepl-persist', 'true');

      clearDeepLSettings();

      expect(sessionStorage.getItem('glossboss-deepl-settings')).toBeNull();
      expect(localStorage.getItem('glossboss-deepl-settings')).toBeNull();
      expect(localStorage.getItem('glossboss-deepl-persist')).toBeNull();
    });
  });

  describe('isPersistEnabled / setPersistEnabled', () => {
    it('defaults to false', () => {
      expect(isPersistEnabled()).toBe(false);
    });

    it('returns true after enabling', () => {
      setPersistEnabled(true);
      expect(isPersistEnabled()).toBe(true);
    });

    it('migrates key from session → local on enable', () => {
      sessionStorage.setItem(
        'glossboss-deepl-settings',
        JSON.stringify({ apiKey: 'k', apiType: 'free', updatedAt: 1 }),
      );

      setPersistEnabled(true);

      expect(localStorage.getItem('glossboss-deepl-settings')).not.toBeNull();
      expect(sessionStorage.getItem('glossboss-deepl-settings')).toBeNull();
    });

    it('migrates key from local → session on disable', () => {
      localStorage.setItem('glossboss-deepl-persist', 'true');
      localStorage.setItem(
        'glossboss-deepl-settings',
        JSON.stringify({ apiKey: 'k', apiType: 'free', updatedAt: 1 }),
      );

      setPersistEnabled(false);

      expect(sessionStorage.getItem('glossboss-deepl-settings')).not.toBeNull();
      expect(localStorage.getItem('glossboss-deepl-settings')).toBeNull();
    });
  });

  describe('hasUserApiKey', () => {
    it('returns false with no key', () => {
      expect(hasUserApiKey()).toBe(false);
    });

    it('returns true when key is saved', () => {
      saveDeepLSettings({ apiKey: 'test' });
      expect(hasUserApiKey()).toBe(true);
    });

    it('returns false for whitespace-only key', () => {
      saveDeepLSettings({ apiKey: '   ' });
      expect(hasUserApiKey()).toBe(false);
    });
  });

  describe('getDeepLApiUrl', () => {
    it('returns free API URL by default', () => {
      expect(getDeepLApiUrl()).toBe('https://api-free.deepl.com/v2');
    });

    it('returns pro API URL', () => {
      expect(getDeepLApiUrl('pro')).toBe('https://api.deepl.com/v2');
    });

    it('returns free API URL for free type', () => {
      expect(getDeepLApiUrl('free')).toBe('https://api-free.deepl.com/v2');
    });
  });
});
