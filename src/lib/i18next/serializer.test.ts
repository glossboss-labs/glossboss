import type { POEntry } from '@/lib/po/types';
import { serializeToI18next } from './serializer';

function makeEntry(overrides: Partial<POEntry> & { msgid: string }): POEntry {
  return {
    id: 'test',
    msgstr: '',
    translatorComments: [],
    extractedComments: [],
    references: [],
    flags: [],
    ...overrides,
  };
}

describe('serializeToI18next', () => {
  it('serializes flat entries to JSON', () => {
    const entries = [
      makeEntry({ msgid: 'greeting', msgstr: 'Hello' }),
      makeEntry({ msgid: 'farewell', msgstr: 'Goodbye' }),
    ];

    const result = JSON.parse(serializeToI18next(entries));
    expect(result).toEqual({
      greeting: 'Hello',
      farewell: 'Goodbye',
    });
  });

  it('creates nested objects from dot-separated keys', () => {
    const entries = [
      makeEntry({ msgid: 'common.save', msgstr: 'Save' }),
      makeEntry({ msgid: 'common.cancel', msgstr: 'Cancel' }),
    ];

    const result = JSON.parse(serializeToI18next(entries));
    expect(result).toEqual({
      common: {
        save: 'Save',
        cancel: 'Cancel',
      },
    });
  });

  it('produces flat output when nested is false', () => {
    const entries = [makeEntry({ msgid: 'common.save', msgstr: 'Save' })];

    const result = JSON.parse(serializeToI18next(entries, { nested: false }));
    expect(result).toEqual({ 'common.save': 'Save' });
  });

  it('serializes plural entries with suffixes', () => {
    const entries = [
      makeEntry({
        msgid: 'item',
        msgstr: '{{count}} item',
        msgidPlural: 'items',
        msgstrPlural: ['{{count}} item', '{{count}} items'],
      }),
    ];

    const result = JSON.parse(serializeToI18next(entries));
    expect(result).toEqual({
      item_one: '{{count}} item',
      item_other: '{{count}} items',
    });
  });

  it('skips header entries (empty msgid)', () => {
    const entries = [
      makeEntry({ msgid: '', msgstr: 'header content' }),
      makeEntry({ msgid: 'key', msgstr: 'value' }),
    ];

    const result = JSON.parse(serializeToI18next(entries));
    expect(result).toEqual({ key: 'value' });
  });

  it('skips untranslated entries when skipUntranslated is true', () => {
    const entries = [
      makeEntry({ msgid: 'translated', msgstr: 'yes' }),
      makeEntry({ msgid: 'untranslated', msgstr: '' }),
    ];

    const result = JSON.parse(serializeToI18next(entries, { skipUntranslated: true }));
    expect(result).toEqual({ translated: 'yes' });
  });

  it('uses msgctxt as key when available', () => {
    const entries = [makeEntry({ msgid: 'source text', msgctxt: 'button.save', msgstr: 'Save' })];

    const result = JSON.parse(serializeToI18next(entries));
    expect(result).toEqual({ button: { save: 'Save' } });
  });
});
