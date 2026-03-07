import { parseI18nextJSON, isI18nextContent } from './parser';

describe('isI18nextContent', () => {
  it('returns true for valid JSON objects', () => {
    expect(isI18nextContent('{"key": "value"}')).toBe(true);
    expect(isI18nextContent('{}')).toBe(true);
  });

  it('returns false for non-objects', () => {
    expect(isI18nextContent('"string"')).toBe(false);
    expect(isI18nextContent('[]')).toBe(false);
    expect(isI18nextContent('null')).toBe(false);
    expect(isI18nextContent('invalid json')).toBe(false);
  });
});

describe('parseI18nextJSON', () => {
  it('parses flat key-value pairs', () => {
    const json = JSON.stringify({
      greeting: 'Hello',
      farewell: 'Goodbye',
    });

    const result = parseI18nextJSON(json, 'en.json');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].msgid).toBe('greeting');
    expect(result.entries[0].msgstr).toBe('Hello');
    expect(result.entries[1].msgid).toBe('farewell');
    expect(result.entries[1].msgstr).toBe('Goodbye');
    expect(result.filename).toBe('en.json');
  });

  it('flattens nested objects with dot notation', () => {
    const json = JSON.stringify({
      common: {
        save: 'Save',
        cancel: 'Cancel',
      },
    });

    const result = parseI18nextJSON(json, 'test.json');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].msgid).toBe('common.save');
    expect(result.entries[0].msgstr).toBe('Save');
    expect(result.entries[1].msgid).toBe('common.cancel');
    expect(result.entries[1].msgstr).toBe('Cancel');
  });

  it('groups plural suffixes into plural entries', () => {
    const json = JSON.stringify({
      item_one: '{{count}} item',
      item_other: '{{count}} items',
    });

    const result = parseI18nextJSON(json, 'test.json');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].msgid).toBe('item');
    expect(result.entries[0].msgidPlural).toBe('item_other');
    expect(result.entries[0].msgstr).toBe('{{count}} item');
    expect(result.entries[0].msgstrPlural).toEqual(['{{count}} item', '{{count}} items']);
  });

  it('handles deeply nested keys', () => {
    const json = JSON.stringify({
      a: { b: { c: 'deep' } },
    });

    const result = parseI18nextJSON(json, 'test.json');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].msgid).toBe('a.b.c');
    expect(result.entries[0].msgstr).toBe('deep');
  });

  it('handles empty object', () => {
    const result = parseI18nextJSON('{}', 'empty.json');
    expect(result.entries).toHaveLength(0);
  });

  it('sets charset to UTF-8', () => {
    const result = parseI18nextJSON('{}', 'test.json');
    expect(result.charset).toBe('UTF-8');
  });
});
