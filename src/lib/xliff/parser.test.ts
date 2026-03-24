import { describe, it, expect } from 'vitest';
import { parseXLIFF, isXLIFFContent } from './parser';

const STANDARD_XLIFF = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="de" datatype="plaintext" original="messages">
    <body>
      <trans-unit id="greeting">
        <source>Hello</source>
        <target>Hallo</target>
      </trans-unit>
      <trans-unit id="farewell">
        <source>Goodbye</source>
        <target>Auf Wiedersehen</target>
      </trans-unit>
      <trans-unit id="thanks">
        <source>Thank you</source>
        <target>Danke</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

describe('parseXLIFF', () => {
  it('parses a standard XLIFF 1.2 file with multiple trans-units', () => {
    const { file: result } = parseXLIFF(STANDARD_XLIFF, 'messages.xlf');

    expect(result.filename).toBe('messages.xlf');
    expect(result.entries).toHaveLength(3);

    expect(result.entries[0]!.msgid).toBe('Hello');
    expect(result.entries[0]!.msgstr).toBe('Hallo');
    expect(result.entries[0]!.references).toEqual(['xliff:id=greeting']);

    expect(result.entries[1]!.msgid).toBe('Goodbye');
    expect(result.entries[1]!.msgstr).toBe('Auf Wiedersehen');

    expect(result.entries[2]!.msgid).toBe('Thank you');
    expect(result.entries[2]!.msgstr).toBe('Danke');
  });

  it('parses Weglot-style XLIFF with word_type notes', () => {
    const weglotXliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="fr" datatype="plaintext" original="weglot">
    <body>
      <trans-unit id="1">
        <source>Home</source>
        <target>Accueil</target>
        <note>noun</note>
      </trans-unit>
      <trans-unit id="2">
        <source>Contact us today for more info</source>
        <target>Contactez-nous aujourd'hui</target>
        <note>This is a longer description</note>
      </trans-unit>
    </body>
  </file>
</xliff>`;

    const { file: result } = parseXLIFF(weglotXliff, 'weglot.xlf');

    // Single-word note should become msgctxt
    expect(result.entries[0]!.extractedComments).toEqual(['noun']);
    expect(result.entries[0]!.msgctxt).toBe('noun');

    // Multi-word note should NOT become msgctxt
    expect(result.entries[1]!.extractedComments).toEqual(['This is a longer description']);
    expect(result.entries[1]!.msgctxt).toBeUndefined();
  });

  it('extracts source and target language from file element', () => {
    const { file: result } = parseXLIFF(STANDARD_XLIFF, 'test.xlf');

    expect(result.header['x-xliff-source-language']).toBe('en');
    expect(result.header.language).toBe('de');
  });

  it('treats missing <target> as untranslated', () => {
    const xliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="ja" datatype="plaintext" original="test">
    <body>
      <trans-unit id="1">
        <source>Hello</source>
      </trans-unit>
    </body>
  </file>
</xliff>`;

    const { file: result } = parseXLIFF(xliff, 'test.xlf');
    expect(result.entries[0]!.msgstr).toBe('');
  });

  it('treats self-closing <target/> as empty', () => {
    const xliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="ja" datatype="plaintext" original="test">
    <body>
      <trans-unit id="1">
        <source>Hello</source>
        <target/>
      </trans-unit>
    </body>
  </file>
</xliff>`;

    const { file: result } = parseXLIFF(xliff, 'test.xlf');
    expect(result.entries[0]!.msgstr).toBe('');
  });

  it('decodes XML entities correctly', () => {
    const xliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="de" datatype="plaintext" original="test">
    <body>
      <trans-unit id="1">
        <source>Tom &amp; Jerry &lt;3&gt; &quot;fun&quot; &apos;times&apos;</source>
        <target>Tom &amp; Jerry &lt;3&gt; &quot;Spa\u00DF&quot; &apos;Zeiten&apos;</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

    const { file: result } = parseXLIFF(xliff, 'test.xlf');
    expect(result.entries[0]!.msgid).toBe('Tom & Jerry <3> "fun" \'times\'');
    expect(result.entries[0]!.msgstr).toBe('Tom & Jerry <3> "Spa\u00DF" \'Zeiten\'');
  });

  it('decodes numeric and hex character references', () => {
    const xliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="nl" datatype="plaintext" original="test">
    <body>
      <trans-unit id="1">
        <source>Create a website</source>
        <target>Cre&#xEB;er nu een website</target>
      </trans-unit>
      <trans-unit id="2">
        <source>Resume</source>
        <target>R&#233;sum&#233;</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

    const { file: result } = parseXLIFF(xliff, 'test.xlf');
    expect(result.entries[0]!.msgstr).toBe('Creëer nu een website');
    expect(result.entries[1]!.msgstr).toBe('Résumé');
  });

  it('handles CDATA sections', () => {
    const xliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="de" datatype="plaintext" original="test">
    <body>
      <trans-unit id="1">
        <source><![CDATA[Hello <b>World</b>]]></source>
        <target><![CDATA[Hallo <b>Welt</b>]]></target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

    const { file: result } = parseXLIFF(xliff, 'test.xlf');
    expect(result.entries[0]!.msgid).toBe('Hello <b>World</b>');
    expect(result.entries[0]!.msgstr).toBe('Hallo <b>Welt</b>');
  });

  it('maps state="needs-translation" to fuzzy flag', () => {
    const xliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="de" datatype="plaintext" original="test">
    <body>
      <trans-unit id="1">
        <source>Hello</source>
        <target state="needs-translation">Hallo</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

    const { file: result } = parseXLIFF(xliff, 'test.xlf');
    expect(result.entries[0]!.flags).toContain('fuzzy');
  });

  it('does not add fuzzy flag when approved="yes"', () => {
    const xliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="de" datatype="plaintext" original="test">
    <body>
      <trans-unit id="1" approved="yes">
        <source>Hello</source>
        <target state="needs-translation">Hallo</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

    const { file: result } = parseXLIFF(xliff, 'test.xlf');
    expect(result.entries[0]!.flags).not.toContain('fuzzy');
  });

  it('concatenates trans-units from multiple <file> blocks', () => {
    const xliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="de" datatype="plaintext" original="file1">
    <body>
      <trans-unit id="1">
        <source>Hello</source>
        <target>Hallo</target>
      </trans-unit>
    </body>
  </file>
  <file source-language="en" target-language="de" datatype="plaintext" original="file2">
    <body>
      <trans-unit id="2">
        <source>World</source>
        <target>Welt</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

    const { file: result } = parseXLIFF(xliff, 'multi.xlf');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.msgid).toBe('Hello');
    expect(result.entries[1]!.msgid).toBe('World');
  });

  it('generates stable IDs using hash', () => {
    const { file: result } = parseXLIFF(STANDARD_XLIFF, 'test.xlf');

    // IDs should be in format index-hash
    for (const entry of result.entries) {
      expect(entry.id).toMatch(/^\d+-[a-z0-9]+$/);
    }

    // Parsing the same content again should produce the same IDs
    const { file: result2 } = parseXLIFF(STANDARD_XLIFF, 'test.xlf');
    for (let i = 0; i < result.entries.length; i++) {
      expect(result.entries[i]!.id).toBe(result2.entries[i]!.id);
    }
  });

  it('extracts Weglot quality and type metadata', () => {
    const xliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="nl" datatype="plaintext" original="weglot">
    <body>
      <trans-unit id="100" type="Text" quality="Manual" resname="Hello World" url="/">
        <source>Hello</source>
        <target>Hallo</target>
      </trans-unit>
      <trans-unit id="200" type="Meta (SEO)" quality="Automatic" resname="Page title">
        <source>Welcome</source>
        <target>Welkom</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

    const { file: result, entryMeta } = parseXLIFF(xliff, 'weglot.xlf');

    expect(result.entries).toHaveLength(2);

    // Check metadata map
    const meta0 = entryMeta.get(result.entries[0]!.id);
    expect(meta0?.quality).toBe('Manual');
    expect(meta0?.contentType).toBe('Text');
    expect(meta0?.resname).toBe('Hello World');
    expect(meta0?.url).toBe('/');

    const meta1 = entryMeta.get(result.entries[1]!.id);
    expect(meta1?.quality).toBe('Automatic');
    expect(meta1?.contentType).toBe('Meta (SEO)');

    // resname should appear as translator comment
    expect(result.entries[0]!.translatorComments).toEqual(['Hello World']);

    // type should appear as extracted comment
    expect(result.entries[0]!.extractedComments).toEqual(['Text']);
    expect(result.entries[1]!.extractedComments).toEqual(['Meta (SEO)']);
  });

  it('strips BOM from content', () => {
    const bomContent = '\uFEFF' + STANDARD_XLIFF;
    const { file: result } = parseXLIFF(bomContent, 'bom.xlf');
    expect(result.entries).toHaveLength(3);
  });
});

describe('isXLIFFContent', () => {
  it('returns true for valid XLIFF content', () => {
    expect(isXLIFFContent(STANDARD_XLIFF)).toBe(true);
    expect(isXLIFFContent('<xliff version="1.2">')).toBe(true);
  });

  it('returns false for non-XLIFF content', () => {
    expect(isXLIFFContent('{"key": "value"}')).toBe(false);
    expect(isXLIFFContent('msgid "hello"')).toBe(false);
    expect(isXLIFFContent('<html><body>Not XLIFF</body></html>')).toBe(false);
    expect(isXLIFFContent('')).toBe(false);
  });
});

describe('error handling', () => {
  it('rejects XLIFF 2.0 with clear error message', () => {
    const xliff2 = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en" trgLang="de">
  <file id="f1">
    <unit id="1">
      <segment>
        <source>Hello</source>
        <target>Hallo</target>
      </segment>
    </unit>
  </file>
</xliff>`;

    expect(() => parseXLIFF(xliff2, 'test.xlf')).toThrow(
      'XLIFF 2.0 is not supported. Please export as XLIFF 1.2.',
    );
  });

  it('throws on empty content', () => {
    expect(() => parseXLIFF('', 'empty.xlf')).toThrow('Empty XLIFF file.');
    expect(() => parseXLIFF('   ', 'empty.xlf')).toThrow('Empty XLIFF file.');
  });

  it('throws on malformed XML without <xliff> root', () => {
    expect(() => parseXLIFF('<root>not xliff</root>', 'bad.xlf')).toThrow(
      'Invalid XLIFF file: missing <xliff> root element.',
    );
  });

  it('throws when no <file> elements found', () => {
    const noFile = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
</xliff>`;

    expect(() => parseXLIFF(noFile, 'nofile.xlf')).toThrow(
      'Invalid XLIFF file: no <file> elements found.',
    );
  });
});
