import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import type { POEntry, POFile } from '@/lib/po';
import { useEditorStore } from '@/stores/editor-store';
import { EditorTable } from './EditorTable';
import { TranslateToolbar } from './TranslateToolbar';
import { shouldAutoTranslateEntry } from './translate-utils';

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

function makeFile(entries: POEntry[], filename = 'ui-test.po'): POFile {
  return {
    filename,
    header: {},
    entries,
    charset: 'UTF-8',
  };
}

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('bulk translate helpers', () => {
  it('marks empty and fuzzy entries as auto-translate candidates', () => {
    const emptySingular = makeEntry('1', { msgstr: '' });
    const pluralMissing = makeEntry('2', { msgidPlural: 'Messages', msgstrPlural: ['only one'] });
    const fuzzyTranslated = makeEntry('3', { flags: ['fuzzy'], msgstr: 'Existing text' });
    const translated = makeEntry('4', { msgstr: 'Done' });

    expect(shouldAutoTranslateEntry(emptySingular)).toBe(true);
    expect(shouldAutoTranslateEntry(pluralMissing)).toBe(true);
    expect(shouldAutoTranslateEntry(fuzzyTranslated)).toBe(true);
    expect(shouldAutoTranslateEntry(translated)).toBe(false);
  });
});

describe('bulk selection UI', () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.getState().clearEditor();
  });

  it('select-all checkbox selects all filtered rows across pages', async () => {
    const user = userEvent.setup();
    localStorage.setItem('po-editor-rows-per-page', '1');

    const entries = [makeEntry('a'), makeEntry('b'), makeEntry('c')];
    useEditorStore.getState().loadFile(makeFile(entries));

    renderWithMantine(<EditorTable />);

    const selectAll = screen.getByRole('checkbox', { name: /select all filtered entries/i });
    await user.click(selectAll);

    expect(useEditorStore.getState().selectedEntryIds).toEqual(new Set(['a', 'b', 'c']));
  });

  it('select-all checkbox becomes indeterminate for partial selection', async () => {
    const entries = [makeEntry('a'), makeEntry('b')];
    useEditorStore.getState().loadFile(makeFile(entries));

    renderWithMantine(<EditorTable />);
    act(() => {
      useEditorStore.getState().setEntrySelection('a', true);
    });

    const selectAll = screen.getByRole('checkbox', { name: /select all filtered entries/i });
    await waitFor(() => {
      expect((selectAll as HTMLInputElement).indeterminate).toBe(true);
    });
  });
});

describe('bulk action toolbar', () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.getState().clearEditor();
  });

  it('shows compact controls when nothing is selected', () => {
    useEditorStore.getState().loadFile(makeFile([makeEntry('a')]));

    renderWithMantine(<TranslateToolbar glossary={null} />);

    expect(screen.getByRole('button', { name: /select all filtered/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^clear$/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /auto translate selected/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve selected/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /unapprove selected/i })).not.toBeInTheDocument();
  });

  it('hides glossary check when glossary is not loaded', () => {
    useEditorStore.getState().loadFile(makeFile([makeEntry('a')]));
    useEditorStore.getState().setSelectedEntries(['a']);

    renderWithMantine(<TranslateToolbar glossary={null} />);

    expect(
      screen.queryByRole('button', { name: /glossary check selected/i }),
    ).not.toBeInTheDocument();
  });

  it('shows unapprove for selected non-fuzzy rows and hides approve', () => {
    useEditorStore.getState().loadFile(makeFile([makeEntry('a', { msgstr: 'Done' })]));
    useEditorStore.getState().setSelectedEntries(['a']);

    renderWithMantine(<TranslateToolbar glossary={null} />);

    expect(screen.getByRole('button', { name: /^unapprove selected$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^approve selected$/i })).not.toBeInTheDocument();
  });
});
