import { describe, it, expect } from 'vitest';
import { parseCSVTranslationFile, isCSVTranslationContent, detectCSVVariant } from './parser';

describe('detectCSVVariant', () => {
  it('detects weglot when headers include word_type and source_word', () => {
    expect(
      detectCSVVariant([
        'word_type',
        'source_language',
        'target_language',
        'source_word',
        'target_word',
        'is_translated',
      ]),
    ).toBe('weglot');
  });

  it('returns generic for standard headers', () => {
    expect(detectCSVVariant(['key', 'translation'])).toBe('generic');
  });

  it('returns generic when only word_type is present', () => {
    expect(detectCSVVariant(['word_type', 'value'])).toBe('generic');
  });

  it('returns generic when only source_word is present', () => {
    expect(detectCSVVariant(['source_word', 'value'])).toBe('generic');
  });
});

describe('isCSVTranslationContent', () => {
  it('returns true for valid 2-column CSV', () => {
    expect(isCSVTranslationContent('key,translation\nhello,world')).toBe(true);
  });

  it('returns true for Weglot CSV', () => {
    const csv =
      'word_type,source_language,target_language,source_word,target_word,is_translated\np,en,fr,Hello,Bonjour,1';
    expect(isCSVTranslationContent(csv)).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isCSVTranslationContent('')).toBe(false);
  });

  it('returns false for whitespace-only', () => {
    expect(isCSVTranslationContent('   \n  ')).toBe(false);
  });

  it('returns false for single-column CSV', () => {
    expect(isCSVTranslationContent('just_one_column\nhello')).toBe(false);
  });

  it('returns true for CSV with BOM', () => {
    expect(isCSVTranslationContent('\uFEFFkey,translation\nhello,world')).toBe(true);
  });

  it('returns false for content with commas only inside quotes', () => {
    expect(isCSVTranslationContent('"no commas outside"')).toBe(false);
  });
});

describe('parseCSVTranslationFile — Weglot', () => {
  it('parses standard Weglot 6-column CSV', () => {
    const csv = [
      'word_type,source_language,target_language,source_word,target_word,is_translated',
      'p,en,fr,Hello,Bonjour,1',
      't,en,fr,Goodbye,Au revoir,1',
    ].join('\n');

    const result = parseCSVTranslationFile(csv, 'weglot.csv');

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.msgid).toBe('Hello');
    expect(result.entries[0]!.msgstr).toBe('Bonjour');
    expect(result.entries[0]!.msgctxt).toBe('p');
    expect(result.entries[0]!.extractedComments).toEqual(['p']);
    expect(result.entries[1]!.msgid).toBe('Goodbye');
    expect(result.entries[1]!.msgstr).toBe('Au revoir');
    expect(result.entries[1]!.msgctxt).toBe('t');
  });

  it('stores source and target language in header', () => {
    const csv = [
      'word_type,source_language,target_language,source_word,target_word,is_translated',
      'p,en,de,Hello,Hallo,1',
    ].join('\n');

    const result = parseCSVTranslationFile(csv, 'weglot.csv');

    expect(result.header.language).toBe('de');
    expect(result.header['x-weglot-source-language']).toBe('en');
  });

  it('produces empty msgstr when is_translated is 0', () => {
    const csv = [
      'word_type,source_language,target_language,source_word,target_word,is_translated',
      'p,en,fr,Untranslated,Pas traduit,0',
    ].join('\n');

    const result = parseCSVTranslationFile(csv, 'weglot.csv');

    expect(result.entries[0]!.msgid).toBe('Untranslated');
    expect(result.entries[0]!.msgstr).toBe('');
  });

  it('skips rows with empty source_word', () => {
    const csv = [
      'word_type,source_language,target_language,source_word,target_word,is_translated',
      'p,en,fr,,something,1',
      'p,en,fr,Hello,Bonjour,1',
    ].join('\n');

    const result = parseCSVTranslationFile(csv, 'weglot.csv');

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.msgid).toBe('Hello');
  });
});

describe('parseCSVTranslationFile — generic', () => {
  it('parses generic 2-column CSV', () => {
    const csv = ['key,translation', 'greeting,Hello', 'farewell,Goodbye'].join('\n');

    const result = parseCSVTranslationFile(csv, 'translations.csv');

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.msgid).toBe('greeting');
    expect(result.entries[0]!.msgstr).toBe('Hello');
    expect(result.entries[0]!.msgctxt).toBeUndefined();
    expect(result.entries[1]!.msgid).toBe('farewell');
    expect(result.entries[1]!.msgstr).toBe('Goodbye');
  });

  it('parses generic 3-column CSV with context', () => {
    const csv = ['key,translation,context', 'save,Speichern,button', 'save,Sichern,menu'].join(
      '\n',
    );

    const result = parseCSVTranslationFile(csv, 'translations.csv');

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.msgid).toBe('save');
    expect(result.entries[0]!.msgstr).toBe('Speichern');
    expect(result.entries[0]!.msgctxt).toBe('button');
    expect(result.entries[1]!.msgctxt).toBe('menu');
  });

  it('stores original headers in x-csv-headers', () => {
    const csv = ['source,target', 'hello,hola'].join('\n');

    const result = parseCSVTranslationFile(csv, 'test.csv');

    expect(result.header['x-csv-headers']).toBe('source,target');
  });

  it('skips rows with empty first column', () => {
    const csv = ['key,value', ',empty_key', 'valid,ok'].join('\n');

    const result = parseCSVTranslationFile(csv, 'test.csv');

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.msgid).toBe('valid');
  });
});

describe('parseCSVTranslationFile — edge cases', () => {
  it('handles empty file', () => {
    const result = parseCSVTranslationFile('', 'empty.csv');

    expect(result.entries).toHaveLength(0);
    expect(result.filename).toBe('empty.csv');
  });

  it('handles header-only file with no data rows', () => {
    const result = parseCSVTranslationFile('key,translation\n', 'header-only.csv');

    expect(result.entries).toHaveLength(0);
  });

  it('strips BOM from content', () => {
    const csv = '\uFEFFkey,translation\nhello,world';

    const result = parseCSVTranslationFile(csv, 'bom.csv');

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.msgid).toBe('hello');
  });

  it('handles quoted fields with commas', () => {
    const csv = ['key,translation', '"hello, world","hola, mundo"'].join('\n');

    const result = parseCSVTranslationFile(csv, 'quoted.csv');

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.msgid).toBe('hello, world');
    expect(result.entries[0]!.msgstr).toBe('hola, mundo');
  });

  it('handles quoted fields with newlines', () => {
    const csv = 'key,translation\n"line1\nline2","linea1\nlinea2"';

    const result = parseCSVTranslationFile(csv, 'multiline.csv');

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.msgid).toBe('line1\nline2');
    expect(result.entries[0]!.msgstr).toBe('linea1\nlinea2');
  });

  it('handles escaped double quotes', () => {
    const csv = ['key,translation', '"He said ""hello""","Elle a dit ""bonjour"""'].join('\n');

    const result = parseCSVTranslationFile(csv, 'escaped.csv');

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.msgid).toBe('He said "hello"');
    expect(result.entries[0]!.msgstr).toBe('Elle a dit "bonjour"');
  });

  it('generates stable IDs using index and hash', () => {
    const csv = ['key,translation', 'hello,world', 'foo,bar'].join('\n');

    const result = parseCSVTranslationFile(csv, 'test.csv');

    expect(result.entries[0]!.id).toMatch(/^0-/);
    expect(result.entries[1]!.id).toMatch(/^1-/);

    // IDs should be stable across parses
    const result2 = parseCSVTranslationFile(csv, 'test.csv');
    expect(result.entries[0]!.id).toBe(result2.entries[0]!.id);
    expect(result.entries[1]!.id).toBe(result2.entries[1]!.id);
  });
});
