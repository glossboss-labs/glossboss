import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APP_LANGUAGE_STORAGE_KEY,
  clearAppLanguage,
  detectPreferredAppLanguage,
  getAppLanguage,
  normalizeAppLanguage,
  saveAppLanguage,
  translateAppMessage,
} from '@/lib/app-language';

describe('app language settings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('normalizes supported locale variants', () => {
    expect(normalizeAppLanguage('nl_NL')).toBe('nl');
    expect(normalizeAppLanguage('en-GB')).toBe('en');
    expect(normalizeAppLanguage('fr')).toBeNull();
  });

  it('detects supported browser language', () => {
    expect(detectPreferredAppLanguage('nl-NL')).toBe('nl');
    expect(detectPreferredAppLanguage('fr-FR')).toBe('en');
  });

  it('stores and reads the selected language', () => {
    saveAppLanguage('nl');
    expect(localStorage.getItem(APP_LANGUAGE_STORAGE_KEY)).toBe('nl');
    expect(getAppLanguage()).toBe('nl');
  });

  it('falls back to the browser language when nothing is stored', () => {
    const languageSpy = vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('nl-NL');

    expect(getAppLanguage()).toBe('nl');

    languageSpy.mockRestore();
  });

  it('clears the stored language', () => {
    saveAppLanguage('nl');
    clearAppLanguage();
    expect(localStorage.getItem(APP_LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  it('reads Dutch translations from the PO catalog and interpolates values', () => {
    expect(translateAppMessage('nl', 'Settings')).toBe('Instellingen');
    expect(translateAppMessage('nl', 'Confirm')).toBe('Bevestigen');
    expect(translateAppMessage('nl', 'Line {line}', { values: { line: 4 } })).toBe('Regel 4');
  });
});
