import { describe, expect, it } from 'vitest';
import {
  findTranslationMemorySuggestions,
  parseTranslationMemoryJson,
  parseTranslationMemoryTmx,
  serializeTranslationMemoryToJson,
  serializeTranslationMemoryToTmx,
} from '@/lib/translation-memory';
import type { TranslationMemoryEntry, TranslationMemoryScope } from '@/lib/translation-memory';

const scope: TranslationMemoryScope = {
  projectName: 'Hello Dolly 1.7.2',
  targetLanguage: 'nl',
  sourceLanguage: 'en',
};

const exactEntry: TranslationMemoryEntry = {
  id: 'welcome',
  projectName: scope.projectName,
  targetLanguage: scope.targetLanguage,
  sourceLanguage: scope.sourceLanguage,
  sourceText: 'Welcome back',
  targetText: 'Welkom terug',
  approvedAt: '2026-03-11T12:00:00.000Z',
  updatedAt: '2026-03-11T12:00:00.000Z',
  usageCount: 1,
};

describe('translation memory matcher', () => {
  it('returns exact matches before fuzzy matches', () => {
    const suggestions = findTranslationMemorySuggestions(
      [
        {
          ...exactEntry,
          id: 'close',
          sourceText: 'Close',
          targetText: 'Sluiten',
          updatedAt: '2026-03-11T11:00:00.000Z',
        },
        exactEntry,
      ],
      {
        sourceText: 'Welcome back',
        context: undefined,
        sourceTextPlural: undefined,
      },
    );

    expect(suggestions[0]?.matchType).toBe('exact');
    expect(suggestions[0]?.entry.targetText).toBe('Welkom terug');
  });

  it('returns fuzzy matches above the threshold', () => {
    const suggestions = findTranslationMemorySuggestions(
      [
        {
          ...exactEntry,
          id: 'save',
          sourceText: 'Save changes',
          targetText: 'Wijzigingen opslaan',
        },
      ],
      {
        sourceText: 'Save change',
        context: undefined,
        sourceTextPlural: undefined,
      },
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.matchType).toBe('fuzzy');
    expect(suggestions[0]?.score).toBeGreaterThan(0.75);
  });
});

describe('translation memory formats', () => {
  it('round-trips the JSON format', () => {
    const serialized = serializeTranslationMemoryToJson(scope, [exactEntry]);
    const parsed = parseTranslationMemoryJson(serialized);

    expect(parsed.projectName).toBe(scope.projectName);
    expect(parsed.entries[0]?.targetText).toBe('Welkom terug');
  });

  it('round-trips the TMX format', () => {
    const serialized = serializeTranslationMemoryToTmx(scope, [exactEntry]);
    const parsed = parseTranslationMemoryTmx(serialized);

    expect(parsed.scope.projectName).toBe(scope.projectName);
    expect(parsed.entries[0]?.sourceText).toBe('Welcome back');
    expect(parsed.entries[0]?.targetText).toBe('Welkom terug');
  });
});
