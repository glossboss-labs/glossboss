import { describe, expect, it } from 'vitest';
import { isPOFileContent, parsePOFile, parsePOFileWithDiagnostics } from './parser';

const MINIMAL_PO = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"

msgid "Hello"
msgstr "Hallo"
`.trim();

const MULTI_ENTRY_PO = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: nl\\n"

#: src/app.tsx:10
msgid "Hello"
msgstr "Hallo"

#: src/app.tsx:20
#, fuzzy
msgid "Goodbye"
msgstr "Tot ziens"

msgid "Untranslated"
msgstr ""
`.trim();

describe('parsePOFile', () => {
  it('parses a minimal PO file', () => {
    const file = parsePOFile(MINIMAL_PO, 'test.po');
    expect(file.entries).toHaveLength(1);
    expect(file.entries[0].msgid).toBe('Hello');
    expect(file.entries[0].msgstr).toBe('Hallo');
  });

  it('parses header metadata', () => {
    const file = parsePOFile(MULTI_ENTRY_PO, 'test.po');
    expect(file.header.language).toBe('nl');
    expect(file.charset).toBe('UTF-8');
  });

  it('parses references and flags', () => {
    const file = parsePOFile(MULTI_ENTRY_PO, 'test.po');
    expect(file.entries[0].references).toContain('src/app.tsx:10');
    expect(file.entries[1].flags).toContain('fuzzy');
  });

  it('throws on empty input', () => {
    expect(() => parsePOFile('', 'empty.po')).toThrow();
  });

  it('throws on input with no entries', () => {
    const headerOnly = `msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"`;
    expect(() => parsePOFile(headerOnly, 'header.po')).toThrow();
  });
});

describe('parsePOFileWithDiagnostics', () => {
  it('reports stats correctly', () => {
    const result = parsePOFileWithDiagnostics(MULTI_ENTRY_PO, 'test.po');
    expect(result.success).toBe(true);
    expect(result.stats.totalEntries).toBe(3);
    expect(result.stats.translatedEntries).toBe(1);
    expect(result.stats.fuzzyEntries).toBe(1);
    expect(result.stats.untranslatedEntries).toBe(1);
  });

  it('handles BOM gracefully', () => {
    const withBom = '\uFEFF' + MINIMAL_PO;
    const result = parsePOFileWithDiagnostics(withBom, 'bom.po');
    expect(result.success).toBe(true);
    expect(result.file?.entries).toHaveLength(1);
  });

  it('detects duplicate entries', () => {
    const dupes = `
msgid ""
msgstr ""

msgid "Hello"
msgstr "Hallo"

msgid "Hello"
msgstr "Hoi"
`.trim();
    const result = parsePOFileWithDiagnostics(dupes, 'dupes.po');
    expect(result.warnings.some((w) => w.code === 'DUPLICATE_ENTRY')).toBe(true);
  });
});

describe('isPOFileContent', () => {
  it('returns true for valid PO content', () => {
    expect(isPOFileContent(MINIMAL_PO)).toBe(true);
  });

  it('returns false for random text', () => {
    expect(isPOFileContent('just some random text')).toBe(false);
  });
});
