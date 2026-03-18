import type { POEntry } from '@/lib/po/types';
import { diffEntriesAgainstTemplate } from './diff';

function createEntry(overrides: Partial<POEntry> & Pick<POEntry, 'id' | 'msgid'>): POEntry {
  return {
    msgstr: '',
    translatorComments: [],
    extractedComments: [],
    references: [],
    flags: [],
    ...overrides,
  };
}

describe('diffEntriesAgainstTemplate', () => {
  it('classifies added, removed, and metadata-updated entries and tracks upstream delta ids', () => {
    const currentEntries = [
      createEntry({
        id: 'keep',
        msgid: 'Keep me',
        msgstr: 'Hou me',
        references: ['src/current.ts:10'],
      }),
      createEntry({
        id: 'remove',
        msgid: 'Remove me',
        msgstr: 'Verwijder me',
      }),
      createEntry({
        id: 'change',
        msgid: 'Change me',
        msgstr: 'Verander me',
        references: ['src/old.ts:5'],
      }),
    ];

    const upstreamEntries = [
      createEntry({
        id: 'keep-upstream',
        msgid: 'Keep me',
        references: ['src/current.ts:10'],
      }),
      createEntry({
        id: 'change-upstream',
        msgid: 'Change me',
        references: ['src/new.ts:9'],
      }),
      createEntry({
        id: 'add-upstream',
        msgid: 'Add me',
        references: ['src/add.ts:2'],
      }),
    ];

    const result = diffEntriesAgainstTemplate(currentEntries, upstreamEntries);

    expect(result.summary).toEqual({
      added: 1,
      removed: 1,
      changed: 1,
      unchanged: 1,
      metaUpdated: 1,
    });

    expect(result.mergeEntries.map((entry) => entry.msgid)).toEqual([
      'Keep me',
      'Change me',
      'Add me',
    ]);
    expect(result.mergeEntries.find((entry) => entry.msgid === 'Change me')?.references).toEqual([
      'src/new.ts:9',
    ]);
    expect(result.mergeEntries.find((entry) => entry.msgid === 'Add me')?.msgstr).toBe('');
    expect([...result.deltaEntryIds]).toEqual(expect.arrayContaining(['change', 'add-upstream']));
    expect(result.deltaEntryIds).toHaveLength(2);
  });
});
