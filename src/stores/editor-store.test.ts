import { beforeEach, describe, expect, it } from 'vitest';
import type { POEntry, POFile } from '@/lib/po';
import { useEditorStore } from './editor-store';

function makeEntry(id: string, overrides: Partial<POEntry> = {}): POEntry {
  return {
    id,
    translatorComments: [],
    extractedComments: [],
    references: [],
    flags: [],
    msgid: `Message ${id}`,
    msgstr: '',
    ...overrides,
  };
}

function makeFile(entries: POEntry[], filename = 'test.po'): POFile {
  return {
    filename,
    header: {},
    entries,
    charset: 'UTF-8',
  };
}

describe('editor-store selection and approve actions', () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.getState().clearEditor();
  });

  it('toggles, sets, replaces, and clears selected entries', () => {
    const entries = [makeEntry('1'), makeEntry('2')];
    useEditorStore.getState().loadFile(makeFile(entries));

    useEditorStore.getState().toggleEntrySelection('1');
    expect(useEditorStore.getState().selectedEntryIds.has('1')).toBe(true);

    useEditorStore.getState().setEntrySelection('2', true);
    expect(useEditorStore.getState().selectedEntryIds.has('2')).toBe(true);

    useEditorStore.getState().setEntrySelection('1', false);
    expect(useEditorStore.getState().selectedEntryIds.has('1')).toBe(false);

    useEditorStore.getState().setSelectedEntries(['1']);
    expect(useEditorStore.getState().selectedEntryIds).toEqual(new Set(['1']));

    useEditorStore.getState().clearSelectedEntries();
    expect(useEditorStore.getState().selectedEntryIds.size).toBe(0);
  });

  it('clearFuzzyBatch removes fuzzy only and marks touched entries dirty', () => {
    const entries = [
      makeEntry('fuzzy', { flags: ['fuzzy'], msgstr: 'Old translation' }),
      makeEntry('plain', { msgstr: 'Already translated' }),
    ];
    useEditorStore.getState().loadFile(makeFile(entries));

    useEditorStore.getState().clearFuzzyBatch(['fuzzy', 'plain']);
    const state = useEditorStore.getState();
    const fuzzyEntry = state.entries.find((entry) => entry.id === 'fuzzy');
    const plainEntry = state.entries.find((entry) => entry.id === 'plain');

    expect(fuzzyEntry?.flags.includes('fuzzy')).toBe(false);
    expect(plainEntry?.flags).toEqual([]);
    expect(state.dirtyEntryIds.has('fuzzy')).toBe(true);
    expect(state.dirtyEntryIds.has('plain')).toBe(false);
    expect(state.hasUnsavedChanges).toBe(true);
  });

  it('addFuzzyBatch adds fuzzy only to non-fuzzy entries and marks touched entries dirty', () => {
    const entries = [
      makeEntry('plain', { msgstr: 'Already translated' }),
      makeEntry('fuzzy', { flags: ['fuzzy'], msgstr: 'Needs review' }),
    ];
    useEditorStore.getState().loadFile(makeFile(entries));

    useEditorStore.getState().addFuzzyBatch(['plain', 'fuzzy']);
    const state = useEditorStore.getState();
    const plainEntry = state.entries.find((entry) => entry.id === 'plain');
    const fuzzyEntry = state.entries.find((entry) => entry.id === 'fuzzy');

    expect(plainEntry?.flags.includes('fuzzy')).toBe(true);
    expect(fuzzyEntry?.flags.filter((f) => f === 'fuzzy').length).toBe(1);
    expect(state.dirtyEntryIds.has('plain')).toBe(true);
    expect(state.dirtyEntryIds.has('fuzzy')).toBe(false);
    expect(state.hasUnsavedChanges).toBe(true);
  });

  it('resets selectedEntryIds on load, merge, and clear', () => {
    const initialEntries = [makeEntry('a1'), makeEntry('a2')];
    const nextEntries = [makeEntry('b1'), makeEntry('b2')];

    useEditorStore.getState().loadFile(makeFile(initialEntries, 'first.po'));
    useEditorStore.getState().setSelectedEntries(['a1', 'a2']);
    expect(useEditorStore.getState().selectedEntryIds.size).toBe(2);

    useEditorStore.getState().loadFile(makeFile(nextEntries, 'second.po'));
    expect(useEditorStore.getState().selectedEntryIds.size).toBe(0);

    useEditorStore.getState().setSelectedEntries(['b1']);
    useEditorStore.getState().mergeEntries([makeEntry('m1'), makeEntry('m2')]);
    expect(useEditorStore.getState().selectedEntryIds.size).toBe(0);

    useEditorStore.getState().setSelectedEntries(['m1']);
    useEditorStore.getState().clearEditor();
    expect(useEditorStore.getState().selectedEntryIds.size).toBe(0);
  });

  it('toggles column visibility and keeps at least one column visible', () => {
    const state = useEditorStore.getState();

    expect(state.visibleColumns).toEqual(new Set(['status', 'source', 'translation', 'signals']));

    state.toggleColumnVisibility('status');
    state.toggleColumnVisibility('source');
    state.toggleColumnVisibility('translation');

    expect(useEditorStore.getState().visibleColumns).toEqual(new Set(['signals']));

    // Last visible column cannot be hidden
    state.toggleColumnVisibility('signals');
    expect(useEditorStore.getState().visibleColumns).toEqual(new Set(['signals']));
  });

  it('reorders columns left and right', () => {
    const state = useEditorStore.getState();
    expect(state.columnOrder).toEqual(['status', 'source', 'translation', 'signals']);

    state.moveColumn('signals', 'left');
    expect(useEditorStore.getState().columnOrder).toEqual([
      'status',
      'source',
      'signals',
      'translation',
    ]);

    state.moveColumn('status', 'right');
    expect(useEditorStore.getState().columnOrder).toEqual([
      'source',
      'status',
      'signals',
      'translation',
    ]);

    // No-op at edges
    state.moveColumn('source', 'left');
    expect(useEditorStore.getState().columnOrder).toEqual([
      'source',
      'status',
      'signals',
      'translation',
    ]);

    state.moveColumnToIndex('translation', 1);
    expect(useEditorStore.getState().columnOrder).toEqual([
      'source',
      'translation',
      'status',
      'signals',
    ]);
  });

  it('sorts filtered entries by source text and can reset to file order', () => {
    const entries = [
      makeEntry('1', { msgid: 'Bravo' }),
      makeEntry('2', { msgid: 'Alpha' }),
      makeEntry('3', { msgid: 'Charlie' }),
    ];
    useEditorStore.getState().loadFile(makeFile(entries));

    useEditorStore.getState().setSort('source', 'asc');
    expect(
      useEditorStore
        .getState()
        .getFilteredEntries()
        .map((entry) => entry.id),
    ).toEqual(['2', '1', '3']);

    useEditorStore.getState().setSort('source', 'desc');
    expect(
      useEditorStore
        .getState()
        .getFilteredEntries()
        .map((entry) => entry.id),
    ).toEqual(['3', '1', '2']);

    useEditorStore.getState().resetSort();
    expect(
      useEditorStore
        .getState()
        .getFilteredEntries()
        .map((entry) => entry.id),
    ).toEqual(['1', '2', '3']);
  });

  it('sorts filtered entries by translation status', () => {
    const entries = [
      makeEntry('translated', { msgstr: 'Ready' }),
      makeEntry('untranslated', { msgstr: '' }),
      makeEntry('fuzzy', { msgstr: 'Needs review', flags: ['fuzzy'] }),
    ];
    useEditorStore.getState().loadFile(makeFile(entries));

    useEditorStore.getState().setSort('status', 'asc');
    expect(
      useEditorStore
        .getState()
        .getFilteredEntries()
        .map((entry) => entry.id),
    ).toEqual(['untranslated', 'fuzzy', 'translated']);

    useEditorStore.getState().setSort('status', 'desc');
    expect(
      useEditorStore
        .getState()
        .getFilteredEntries()
        .map((entry) => entry.id),
    ).toEqual(['translated', 'fuzzy', 'untranslated']);
  });

  it('keeps duplicate sort keys in original order', () => {
    const entries = [
      makeEntry('a', { msgid: 'Alpha', msgstr: '' }),
      makeEntry('b', { msgid: 'Alpha', msgstr: '' }),
      makeEntry('c', { msgid: 'Bravo', msgstr: 'Done' }),
      makeEntry('d', { msgid: 'Bravo', msgstr: 'Done too' }),
      makeEntry('e', { msgid: 'Charlie', msgstr: 'Needs review', flags: ['fuzzy'] }),
    ];
    useEditorStore.getState().loadFile(makeFile(entries));

    useEditorStore.getState().setSort('source', 'asc');
    expect(
      useEditorStore
        .getState()
        .getFilteredEntries()
        .map((entry) => entry.id),
    ).toEqual(['a', 'b', 'c', 'd', 'e']);

    useEditorStore.getState().setSort('source', 'desc');
    expect(
      useEditorStore
        .getState()
        .getFilteredEntries()
        .map((entry) => entry.id),
    ).toEqual(['e', 'c', 'd', 'a', 'b']);

    useEditorStore.getState().setSort('status', 'asc');
    expect(
      useEditorStore
        .getState()
        .getFilteredEntries()
        .map((entry) => entry.id),
    ).toEqual(['a', 'b', 'e', 'c', 'd']);

    useEditorStore.getState().setSort('status', 'desc');
    expect(
      useEditorStore
        .getState()
        .getFilteredEntries()
        .map((entry) => entry.id),
    ).toEqual(['c', 'd', 'e', 'a', 'b']);

    useEditorStore.getState().resetSort();
    expect(
      useEditorStore
        .getState()
        .getFilteredEntries()
        .map((entry) => entry.id),
    ).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
