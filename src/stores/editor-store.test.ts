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
});
