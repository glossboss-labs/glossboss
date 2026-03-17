import { describe, it, expect } from 'vitest';
import { applySourceFile } from './source-file';
import type { POEntry } from './types';

function makeEntry(overrides: Partial<POEntry> & { msgid: string }): POEntry {
  return {
    id: overrides.msgid,
    msgstr: '',
    translatorComments: [],
    extractedComments: [],
    references: [],
    flags: [],
    ...overrides,
  };
}

describe('applySourceFile', () => {
  it('matches entries by msgid and sets sourceText from source msgstr', () => {
    const target = [
      makeEntry({ msgid: 'button.save', msgstr: 'Opslaan' }),
      makeEntry({ msgid: 'button.cancel', msgstr: 'Annuleren' }),
    ];
    const source = [
      makeEntry({ msgid: 'button.save', msgstr: 'Save' }),
      makeEntry({ msgid: 'button.cancel', msgstr: 'Cancel' }),
    ];

    const matched = applySourceFile(target, source);

    expect(matched).toBe(2);
    expect(target[0].sourceText).toBe('Save');
    expect(target[1].sourceText).toBe('Cancel');
  });

  it('handles partial matches', () => {
    const target = [
      makeEntry({ msgid: 'button.save', msgstr: 'Opslaan' }),
      makeEntry({ msgid: 'button.delete', msgstr: 'Verwijderen' }),
    ];
    const source = [makeEntry({ msgid: 'button.save', msgstr: 'Save' })];

    const matched = applySourceFile(target, source);

    expect(matched).toBe(1);
    expect(target[0].sourceText).toBe('Save');
    expect(target[1].sourceText).toBeUndefined();
  });

  it('respects msgctxt for disambiguation', () => {
    const target = [
      makeEntry({ msgid: 'title', msgctxt: 'page', msgstr: 'Pagina titel' }),
      makeEntry({ msgid: 'title', msgctxt: 'dialog', msgstr: 'Dialoog titel' }),
    ];
    const source = [
      makeEntry({ msgid: 'title', msgctxt: 'page', msgstr: 'Page Title' }),
      makeEntry({ msgid: 'title', msgctxt: 'dialog', msgstr: 'Dialog Title' }),
    ];

    const matched = applySourceFile(target, source);

    expect(matched).toBe(2);
    expect(target[0].sourceText).toBe('Page Title');
    expect(target[1].sourceText).toBe('Dialog Title');
  });

  it('skips entries where source msgstr is empty', () => {
    const target = [makeEntry({ msgid: 'key', msgstr: 'Value' })];
    const source = [makeEntry({ msgid: 'key', msgstr: '' })];

    const matched = applySourceFile(target, source);

    expect(matched).toBe(0);
    expect(target[0].sourceText).toBeUndefined();
  });

  it('handles plural source text', () => {
    const target = [
      makeEntry({
        msgid: 'items',
        msgstr: '1 item',
        msgidPlural: 'items_other',
        msgstrPlural: ['1 item', '%d items'],
      }),
    ];
    const source = [
      makeEntry({
        msgid: 'items',
        msgstr: '1 item',
        msgidPlural: 'items_other',
        msgstrPlural: ['%d item', '%d items'],
      }),
    ];

    const matched = applySourceFile(target, source);

    expect(matched).toBe(1);
    expect(target[0].sourceText).toBe('1 item');
    expect(target[0].sourceTextPlural).toBe('%d items');
  });

  it('returns 0 when no entries match', () => {
    const target = [makeEntry({ msgid: 'a', msgstr: 'A' })];
    const source = [makeEntry({ msgid: 'b', msgstr: 'B' })];

    expect(applySourceFile(target, source)).toBe(0);
  });
});
