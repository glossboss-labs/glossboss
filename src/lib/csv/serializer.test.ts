import { describe, it, expect } from 'vitest';
import { serializeToCSV } from './serializer';
import { parseCSVTranslationFile } from './parser';
import type { POEntry, POHeader } from '@/lib/po/types';

function makeEntry(overrides: Partial<POEntry> & { msgid: string; msgstr: string }): POEntry {
  return {
    id: 'test',
    translatorComments: [],
    extractedComments: [],
    references: [],
    flags: [],
    ...overrides,
  };
}

describe('serializeToCSV — Weglot', () => {
  it('produces correct Weglot CSV output', () => {
    const entries: POEntry[] = [
      makeEntry({ msgid: 'Hello', msgstr: 'Bonjour', msgctxt: 'p' }),
      makeEntry({ msgid: 'Goodbye', msgstr: 'Au revoir', msgctxt: 't' }),
    ];

    const header: POHeader = {
      language: 'fr',
      'x-weglot-source-language': 'en',
    };

    const csv = serializeToCSV(entries, header, { variant: 'weglot' });
    const lines = csv.split('\n');

    expect(lines[0]).toBe(
      'word_type,source_language,target_language,source_word,target_word,is_translated',
    );
    expect(lines[1]).toBe('p,en,fr,Hello,Bonjour,1');
    expect(lines[2]).toBe('t,en,fr,Goodbye,Au revoir,1');
  });

  it('defaults word_type to "p" when msgctxt is missing', () => {
    const entries: POEntry[] = [makeEntry({ msgid: 'Hello', msgstr: 'Bonjour' })];

    const header: POHeader = {
      language: 'fr',
      'x-weglot-source-language': 'en',
    };

    const csv = serializeToCSV(entries, header, { variant: 'weglot' });
    const lines = csv.split('\n');

    expect(lines[1]).toBe('p,en,fr,Hello,Bonjour,1');
  });

  it('sets is_translated to 0 when msgstr is empty', () => {
    const entries: POEntry[] = [makeEntry({ msgid: 'Untranslated', msgstr: '', msgctxt: 'p' })];

    const header: POHeader = {
      language: 'fr',
      'x-weglot-source-language': 'en',
    };

    const csv = serializeToCSV(entries, header, { variant: 'weglot' });
    const lines = csv.split('\n');

    expect(lines[1]).toBe('p,en,fr,Untranslated,,0');
  });

  it('round-trips Weglot CSV: parse → serialize → parse', () => {
    const original = [
      'word_type,source_language,target_language,source_word,target_word,is_translated',
      'p,en,fr,Hello,Bonjour,1',
      't,en,fr,"Good, morning","Bon, matin",1',
      'p,en,fr,Untranslated,,0',
    ].join('\n');

    const parsed1 = parseCSVTranslationFile(original, 'weglot.csv');
    const serialized = serializeToCSV(parsed1.entries, parsed1.header, { variant: 'weglot' });
    const parsed2 = parseCSVTranslationFile(serialized, 'weglot.csv');

    expect(parsed2.entries).toHaveLength(parsed1.entries.length);
    for (let i = 0; i < parsed1.entries.length; i++) {
      expect(parsed2.entries[i]!.msgid).toBe(parsed1.entries[i]!.msgid);
      expect(parsed2.entries[i]!.msgstr).toBe(parsed1.entries[i]!.msgstr);
      expect(parsed2.entries[i]!.msgctxt).toBe(parsed1.entries[i]!.msgctxt);
    }
  });
});

describe('serializeToCSV — generic', () => {
  it('produces 2-column CSV when no entries have context', () => {
    const entries: POEntry[] = [
      makeEntry({ msgid: 'hello', msgstr: 'hola' }),
      makeEntry({ msgid: 'bye', msgstr: 'adios' }),
    ];

    const header: POHeader = {};
    const csv = serializeToCSV(entries, header);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('key,translation');
    expect(lines[1]).toBe('hello,hola');
    expect(lines[2]).toBe('bye,adios');
  });

  it('produces 3-column CSV when entries have context', () => {
    const entries: POEntry[] = [
      makeEntry({ msgid: 'save', msgstr: 'Speichern', msgctxt: 'button' }),
      makeEntry({ msgid: 'save', msgstr: 'Sichern', msgctxt: 'menu' }),
    ];

    const header: POHeader = {};
    const csv = serializeToCSV(entries, header);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('key,translation,context');
    expect(lines[1]).toBe('save,Speichern,button');
    expect(lines[2]).toBe('save,Sichern,menu');
  });

  it('quotes fields containing special characters', () => {
    const entries: POEntry[] = [
      makeEntry({ msgid: 'greeting', msgstr: 'hello, world' }),
      makeEntry({ msgid: 'quote', msgstr: 'He said "hi"' }),
      makeEntry({ msgid: 'multiline', msgstr: 'line1\nline2' }),
    ];

    const header: POHeader = {};
    const csv = serializeToCSV(entries, header);
    const lines = csv.split('\n');

    expect(lines[1]).toBe('greeting,"hello, world"');
    expect(lines[2]).toBe('quote,"He said ""hi"""');
    // multiline field spans two raw lines
    expect(csv).toContain('"line1\nline2"');
  });

  it('round-trips generic CSV: parse → serialize → parse', () => {
    const original = [
      'key,value,context',
      'save,Speichern,button',
      'save,Sichern,menu',
      'greeting,Hallo,',
    ].join('\n');

    const parsed1 = parseCSVTranslationFile(original, 'test.csv');
    const serialized = serializeToCSV(parsed1.entries, parsed1.header);
    const parsed2 = parseCSVTranslationFile(serialized, 'test.csv');

    expect(parsed2.entries).toHaveLength(parsed1.entries.length);
    for (let i = 0; i < parsed1.entries.length; i++) {
      expect(parsed2.entries[i]!.msgid).toBe(parsed1.entries[i]!.msgid);
      expect(parsed2.entries[i]!.msgstr).toBe(parsed1.entries[i]!.msgstr);
      expect(parsed2.entries[i]!.msgctxt).toBe(parsed1.entries[i]!.msgctxt);
    }
  });

  it('preserves original header names via x-csv-headers', () => {
    const original = ['source,target', 'hello,hola'].join('\n');

    const parsed = parseCSVTranslationFile(original, 'test.csv');
    const serialized = serializeToCSV(parsed.entries, parsed.header);
    const lines = serialized.split('\n');

    expect(lines[0]).toBe('source,target');
  });
});
