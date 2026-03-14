import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildGlossaryURL,
  clearWPGlossaryCache,
  getCachedWPGlossaryLocales,
  hasGlossaryCache,
} from './wp-fetcher';

describe('buildGlossaryURL', () => {
  it('constructs the WordPress glossary URL for a locale', () => {
    expect(buildGlossaryURL('nl')).toBe(
      'https://translate.wordpress.org/locale/nl/default/glossary/-export/',
    );
  });

  it('lowercases the locale', () => {
    expect(buildGlossaryURL('DE')).toBe(
      'https://translate.wordpress.org/locale/de/default/glossary/-export/',
    );
  });
});

describe('cache helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getCachedWPGlossaryLocales returns empty initially', () => {
    expect(getCachedWPGlossaryLocales()).toEqual([]);
  });

  it('hasGlossaryCache returns false when no cache exists', () => {
    expect(hasGlossaryCache('nl')).toBe(false);
  });

  it('clearWPGlossaryCache for specific locale removes it', () => {
    localStorage.setItem(
      'glossboss-wp-glossary-nl',
      JSON.stringify({
        glossary: { sourceLocale: 'en', targetLocale: 'nl', entries: [], fetchedAt: '' },
        timestamp: Date.now(),
      }),
    );
    expect(getCachedWPGlossaryLocales()).toContain('nl');

    clearWPGlossaryCache('nl');
    expect(getCachedWPGlossaryLocales()).not.toContain('nl');
  });

  it('clearWPGlossaryCache without locale clears all', () => {
    localStorage.setItem(
      'glossboss-wp-glossary-nl',
      JSON.stringify({
        glossary: { sourceLocale: 'en', targetLocale: 'nl', entries: [], fetchedAt: '' },
        timestamp: Date.now(),
      }),
    );
    localStorage.setItem(
      'glossboss-wp-glossary-de',
      JSON.stringify({
        glossary: { sourceLocale: 'en', targetLocale: 'de', entries: [], fetchedAt: '' },
        timestamp: Date.now(),
      }),
    );

    clearWPGlossaryCache();
    expect(getCachedWPGlossaryLocales()).toEqual([]);
  });

  it('hasGlossaryCache returns true for valid cached glossary', () => {
    localStorage.setItem(
      'glossboss-wp-glossary-nl',
      JSON.stringify({
        glossary: { sourceLocale: 'en', targetLocale: 'nl', entries: [], fetchedAt: '' },
        timestamp: Date.now(),
      }),
    );
    expect(hasGlossaryCache('nl')).toBe(true);
  });

  it('hasGlossaryCache returns false for expired cache', () => {
    localStorage.setItem(
      'glossboss-wp-glossary-nl',
      JSON.stringify({
        glossary: { sourceLocale: 'en', targetLocale: 'nl', entries: [], fetchedAt: '' },
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      }),
    );
    expect(hasGlossaryCache('nl')).toBe(false);
  });
});
