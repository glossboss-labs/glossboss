import { describe, it, expect } from 'vitest';
import { serializeToXLIFF } from './serializer';
import { parseXLIFF } from './parser';
import type { POEntry, POHeader } from '@/lib/po/types';

function makeEntry(overrides: Partial<POEntry> & Pick<POEntry, 'msgid' | 'msgstr'>): POEntry {
  return {
    id: '0-test',
    translatorComments: [],
    extractedComments: [],
    references: [],
    flags: [],
    ...overrides,
  };
}

describe('serializeToXLIFF', () => {
  it('round-trips: parse XLIFF -> serialize -> parse again', () => {
    const original = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="fr" datatype="plaintext" original="messages">
    <body>
      <trans-unit id="greeting">
        <source>Hello</source>
        <target>Bonjour</target>
      </trans-unit>
      <trans-unit id="farewell">
        <source>Goodbye</source>
        <target>Au revoir</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

    const { file: parsed } = parseXLIFF(original, 'test.xlf');
    const serialized = serializeToXLIFF(parsed.entries, parsed.header);
    const { file: reparsed } = parseXLIFF(serialized, 'test.xlf');

    expect(reparsed.entries).toHaveLength(parsed.entries.length);
    for (let i = 0; i < parsed.entries.length; i++) {
      expect(reparsed.entries[i]!.msgid).toBe(parsed.entries[i]!.msgid);
      expect(reparsed.entries[i]!.msgstr).toBe(parsed.entries[i]!.msgstr);
    }
    expect(reparsed.header.language).toBe(parsed.header.language);
    expect(reparsed.header['x-xliff-source-language']).toBe(
      parsed.header['x-xliff-source-language'],
    );
  });

  it('correctly escapes XML special characters', () => {
    const entries: POEntry[] = [
      makeEntry({
        msgid: 'Tom & Jerry <3> "fun"',
        msgstr: 'Tom & Jerry <3> "Spa\u00DF"',
      }),
    ];
    const header: POHeader = { language: 'de', 'x-xliff-source-language': 'en' };
    const xml = serializeToXLIFF(entries, header);

    expect(xml).toContain('Tom &amp; Jerry &lt;3&gt; &quot;fun&quot;');
    expect(xml).toContain('Tom &amp; Jerry &lt;3&gt; &quot;Spa\u00DF&quot;');
  });

  it('preserves trans-unit id from references', () => {
    const entries: POEntry[] = [
      makeEntry({
        msgid: 'Hello',
        msgstr: 'Hallo',
        references: ['xliff:id=my-custom-id'],
      }),
    ];
    const header: POHeader = { language: 'de' };
    const xml = serializeToXLIFF(entries, header);

    expect(xml).toContain('id="my-custom-id"');
  });

  it('uses 1-based index when no xliff:id reference exists', () => {
    const entries: POEntry[] = [
      makeEntry({ msgid: 'First', msgstr: 'Erstes' }),
      makeEntry({ msgid: 'Second', msgstr: 'Zweites' }),
    ];
    const header: POHeader = { language: 'de' };
    const xml = serializeToXLIFF(entries, header);

    expect(xml).toContain('id="1"');
    expect(xml).toContain('id="2"');
  });

  it('sets state attribute correctly', () => {
    const entries: POEntry[] = [
      makeEntry({ msgid: 'Translated', msgstr: 'Traduit' }),
      makeEntry({ msgid: 'Untranslated', msgstr: '' }),
    ];
    const header: POHeader = { language: 'fr' };
    const xml = serializeToXLIFF(entries, header);

    expect(xml).toContain('state="translated"');
    expect(xml).toContain('state="needs-translation"');
  });

  it('writes <note> from extractedComments', () => {
    const entries: POEntry[] = [
      makeEntry({
        msgid: 'Hello',
        msgstr: 'Bonjour',
        extractedComments: ['noun'],
      }),
    ];
    const header: POHeader = { language: 'fr' };
    const xml = serializeToXLIFF(entries, header);

    expect(xml).toContain('<note>noun</note>');
  });

  it('falls back to msgctxt for <note> when no extractedComments', () => {
    const entries: POEntry[] = [
      makeEntry({
        msgid: 'Hello',
        msgstr: 'Bonjour',
        msgctxt: 'greeting',
      }),
    ];
    const header: POHeader = { language: 'fr' };
    const xml = serializeToXLIFF(entries, header);

    expect(xml).toContain('<note>greeting</note>');
  });

  it('omits <note> when neither extractedComments nor msgctxt exist', () => {
    const entries: POEntry[] = [
      makeEntry({
        msgid: 'Hello',
        msgstr: 'Bonjour',
      }),
    ];
    const header: POHeader = { language: 'fr' };
    const xml = serializeToXLIFF(entries, header);

    expect(xml).not.toContain('<note>');
  });

  it('produces valid XLIFF 1.2 structure', () => {
    const entries: POEntry[] = [makeEntry({ msgid: 'Hello', msgstr: 'Hallo' })];
    const header: POHeader = { language: 'de', 'x-xliff-source-language': 'en' };
    const xml = serializeToXLIFF(entries, header);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('version="1.2"');
    expect(xml).toContain('xmlns="urn:oasis:names:tc:xliff:document:1.2"');
    expect(xml).toContain('source-language="en"');
    expect(xml).toContain('target-language="de"');
    expect(xml).toContain('datatype="plaintext"');
    expect(xml).toContain('original="glossboss"');
    expect(xml).toContain('<body>');
    expect(xml).toContain('</body>');
  });

  it('supports custom indentation', () => {
    const entries: POEntry[] = [makeEntry({ msgid: 'Hello', msgstr: 'Hallo' })];
    const header: POHeader = { language: 'de' };

    const xml4 = serializeToXLIFF(entries, header, { indent: 4 });
    // With indent=4, body is at level 2 = 8 spaces
    expect(xml4).toContain('        <body>');

    const xml2 = serializeToXLIFF(entries, header, { indent: 2 });
    // With indent=2, body is at level 2 = 4 spaces
    expect(xml2).toContain('    <body>');
  });

  it('uses default languages when header has none', () => {
    const entries: POEntry[] = [makeEntry({ msgid: 'Hello', msgstr: '' })];
    const header: POHeader = {};
    const xml = serializeToXLIFF(entries, header);

    expect(xml).toContain('source-language="en"');
    expect(xml).toContain('target-language="und"');
  });
});
