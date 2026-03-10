import { describe, expect, it } from 'vitest';
import type { POEntry } from '@/lib/po';
import { DISCOVERED_APP_LANGUAGES } from './discovery';

function getEntryKey(entry: POEntry): string {
  return entry.msgctxt ? `${entry.msgctxt}\u0004${entry.msgid}` : entry.msgid;
}

describe('discovered app languages', () => {
  it('includes English as the required source and fallback catalog', () => {
    expect(DISCOVERED_APP_LANGUAGES.some((language) => language.value === 'en')).toBe(true);
  });

  it('keeps every discovered catalog in sync with the English source keys', () => {
    const englishCatalog = DISCOVERED_APP_LANGUAGES.find((language) => language.value === 'en');

    expect(englishCatalog).toBeDefined();

    const englishKeys = new Set(englishCatalog?.file.entries.map(getEntryKey));

    for (const language of DISCOVERED_APP_LANGUAGES) {
      const languageKeys = new Set(language.file.entries.map(getEntryKey));

      expect(
        Array.from(englishKeys).filter((key) => !languageKeys.has(key)),
        `${language.filename} is missing keys from app.en.po`,
      ).toEqual([]);

      expect(
        Array.from(languageKeys).filter((key) => !englishKeys.has(key)),
        `${language.filename} has keys that do not exist in app.en.po`,
      ).toEqual([]);
    }
  });
});
