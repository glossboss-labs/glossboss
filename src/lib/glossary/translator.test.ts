import { describe, it, expect, vi } from 'vitest';
import {
  prepareForTranslation,
  restoreGlossaryTerms,
  createGlossaryAwareTranslator,
} from './translator';
import type { Glossary } from './types';

// Silence debug output
vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
  debugWarn: vi.fn(),
  debugInfo: vi.fn(),
}));

function makeGlossary(entries: Array<{ term: string; translation: string }>): Glossary {
  return {
    sourceLocale: 'en',
    targetLocale: 'nl',
    entries: entries.map((e) => ({ ...e })),
    fetchedAt: new Date().toISOString(),
  };
}

describe('prepareForTranslation', () => {
  it('returns original text when no glossary is given', () => {
    const result = prepareForTranslation('Hello world', null);
    expect(result.text).toBe('Hello world');
    expect(result.hasGlossaryTerms).toBe(false);
    expect(result.placeholders.size).toBe(0);
  });

  it('returns original text for empty glossary', () => {
    const glossary = makeGlossary([]);
    const result = prepareForTranslation('Hello world', glossary);
    expect(result.hasGlossaryTerms).toBe(false);
  });

  it('returns original text for blank input', () => {
    const glossary = makeGlossary([{ term: 'Hello', translation: 'Hallo' }]);
    const result = prepareForTranslation('   ', glossary);
    expect(result.hasGlossaryTerms).toBe(false);
  });

  it('replaces a single glossary term with a placeholder', () => {
    const glossary = makeGlossary([{ term: 'Dashboard', translation: 'Overzicht' }]);
    const result = prepareForTranslation('Open the Dashboard now', glossary);
    expect(result.hasGlossaryTerms).toBe(true);
    expect(result.placeholders.size).toBe(1);
    expect(result.text).toContain('⟦GLOSS');
    expect(result.text).not.toContain('Dashboard');
  });

  it('replaces multiple occurrences of the same term', () => {
    const glossary = makeGlossary([{ term: 'Plugin', translation: 'Plug-in' }]);
    const result = prepareForTranslation('Plugin A and Plugin B', glossary);
    expect(result.placeholders.size).toBe(2);
  });

  it('respects word boundaries', () => {
    const glossary = makeGlossary([{ term: 'log', translation: 'logboek' }]);
    const result = prepareForTranslation('The changelog is ready', glossary);
    // "log" inside "changelog" should NOT match because no word boundary before it
    expect(result.hasGlossaryTerms).toBe(false);
  });

  it('filters entries with empty translation', () => {
    const glossary = makeGlossary([{ term: 'Dashboard', translation: '' }]);
    const result = prepareForTranslation('Open the Dashboard', glossary);
    expect(result.hasGlossaryTerms).toBe(false);
  });

  it('filters entries with term shorter than 2 chars', () => {
    const glossary = makeGlossary([{ term: 'A', translation: 'Een' }]);
    const result = prepareForTranslation('A test', glossary);
    expect(result.hasGlossaryTerms).toBe(false);
  });

  it('handles longer terms first to avoid partial matches', () => {
    const glossary = makeGlossary([
      { term: 'Custom Post', translation: 'Aangepast bericht' },
      { term: 'Post', translation: 'Bericht' },
    ]);
    const result = prepareForTranslation('Create a Custom Post here', glossary);
    // "Custom Post" should be replaced as a single match, not "Post" separately
    expect(result.placeholders.size).toBe(1);
    const info = [...result.placeholders.values()][0];
    expect(info!.entry.term).toBe('Custom Post');
  });
});

describe('restoreGlossaryTerms', () => {
  it('returns original text with no placeholders', () => {
    const result = restoreGlossaryTerms('Hallo wereld', new Map());
    expect(result.text).toBe('Hallo wereld');
    expect(result.appliedTerms).toEqual([]);
  });

  it('restores a placeholder to glossary translation', () => {
    const placeholders = new Map([
      [
        0,
        {
          entry: { term: 'Dashboard', translation: 'Overzicht' },
          capitalization: 'title' as const,
        },
      ],
    ]);
    const result = restoreGlossaryTerms('Open het ⟦GLOSS0⟧ nu', placeholders);
    expect(result.text).toBe('Open het Overzicht nu');
    expect(result.appliedTerms).toHaveLength(1);
  });

  it('applies capitalization correctly', () => {
    const placeholders = new Map([
      [
        0,
        {
          entry: { term: 'dashboard', translation: 'overzicht' },
          capitalization: 'upper' as const,
        },
      ],
    ]);
    const result = restoreGlossaryTerms('⟦GLOSS0⟧ page', placeholders);
    expect(result.text).toBe('OVERZICHT page');
  });

  it('handles lowercase capitalization', () => {
    const placeholders = new Map([
      [
        0,
        {
          entry: { term: 'Dashboard', translation: 'Overzicht' },
          capitalization: 'lower' as const,
        },
      ],
    ]);
    const result = restoreGlossaryTerms('the ⟦GLOSS0⟧ is ready', placeholders);
    expect(result.text).toBe('the overzicht is ready');
  });

  it('tries variation when exact placeholder is modified by DeepL', () => {
    const placeholders = new Map([
      [
        0,
        {
          entry: { term: 'Plugin', translation: 'Plug-in' },
          capitalization: 'title' as const,
        },
      ],
    ]);
    // DeepL might strip the unicode brackets
    const result = restoreGlossaryTerms('Open het GLOSS0 nu', placeholders);
    expect(result.text).toBe('Open het Plug-in nu');
    expect(result.appliedTerms).toHaveLength(1);
  });
});

describe('createGlossaryAwareTranslator', () => {
  it('translates without glossary terms using raw translate function', async () => {
    const translateFn = vi.fn().mockResolvedValue('Hallo wereld');
    const glossary = makeGlossary([{ term: 'Missing', translation: 'Ontbreekt' }]);
    const translator = createGlossaryAwareTranslator(translateFn, glossary);

    const result = await translator('Hello world');
    expect(result).toBe('Hallo wereld');
    // Should call with original text since no glossary term matched
    expect(translateFn).toHaveBeenCalledWith('Hello world');
  });

  it('translates with glossary term protection', async () => {
    const translateFn = vi.fn().mockImplementation(async (text: string) => {
      // Simulate DeepL keeping placeholders intact
      return text.replace('Open the', 'Open het');
    });
    const glossary = makeGlossary([{ term: 'Dashboard', translation: 'Overzicht' }]);
    const translator = createGlossaryAwareTranslator(translateFn, glossary);

    const result = await translator('Open the Dashboard now');
    expect(result).toContain('Overzicht');
  });

  it('falls through to raw translation when glossary is null', async () => {
    const translateFn = vi.fn().mockResolvedValue('Translated');
    const translator = createGlossaryAwareTranslator(translateFn, null);
    const result = await translator('Some text');
    expect(result).toBe('Translated');
    expect(translateFn).toHaveBeenCalledWith('Some text');
  });
});
