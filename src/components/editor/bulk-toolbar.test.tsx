import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import type { POEntry, POFile } from '@/lib/po';
import { useEditorStore } from '@/stores/editor-store';
import { useSourceStore } from '@/stores/source-store';
import * as deepl from '@/lib/deepl';
import { EditorTable } from './EditorTable';
import { ReviewSummary } from './ReviewSummary';
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

const originalMatchMedia = window.matchMedia;

function setMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

afterEach(() => {
  vi.restoreAllMocks();
});

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
    useSourceStore.getState().clearSource();
    setMatchMedia(false);
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
  }, 10000);

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
    useSourceStore.getState().clearSource();
    setMatchMedia(false);
  });

  it('shows compact controls when nothing is selected', () => {
    useEditorStore.getState().loadFile(makeFile([makeEntry('a')]));

    renderWithMantine(<TranslateToolbar glossary={null} />);

    expect(screen.getByRole('button', { name: /select all filtered/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^clear$/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /auto translate selected/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear fuzzy selected/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark fuzzy selected/i })).not.toBeInTheDocument();
  });

  it('hides glossary check when glossary is not loaded', () => {
    useEditorStore.getState().loadFile(makeFile([makeEntry('a')]));
    useEditorStore.getState().setSelectedEntries(['a']);

    renderWithMantine(<TranslateToolbar glossary={null} />);

    expect(
      screen.queryByRole('button', { name: /glossary check selected/i }),
    ).not.toBeInTheDocument();
  });

  it('shows mark fuzzy for selected non-fuzzy rows and hides clear fuzzy', () => {
    useEditorStore.getState().loadFile(makeFile([makeEntry('a', { msgstr: 'Done' })]));
    useEditorStore.getState().setSelectedEntries(['a']);

    renderWithMantine(<TranslateToolbar glossary={null} />);

    expect(screen.getByRole('button', { name: /mark fuzzy selected/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear fuzzy selected/i })).not.toBeInTheDocument();
  });

  it('uses EN source language for bulk translation when glossary is enabled and source is auto', async () => {
    const user = userEvent.setup();
    const translateBatch = vi.fn().mockResolvedValue(['Standaard template']);

    vi.spyOn(deepl, 'hasUserApiKey').mockReturnValue(true);
    vi.spyOn(deepl, 'getDeepLClient').mockReturnValue({
      translateBatch,
    } as unknown as ReturnType<typeof deepl.getDeepLClient>);

    useEditorStore.getState().loadFile({
      ...makeFile([makeEntry('a', { msgid: 'Standard template', msgstr: '' })]),
      header: { language: 'nl' },
    });

    renderWithMantine(<TranslateToolbar deeplGlossaryId="glossary-123" glossary={null} />);

    await user.click(screen.getByRole('button', { name: /translate 1 untranslated/i }));

    await waitFor(() => {
      expect(translateBatch).toHaveBeenCalledWith(
        ['Standard template'],
        'NL',
        'EN',
        'glossary-123',
      );
    });
  });

  it('auto-translates and preserves all plural forms in one bulk batch', async () => {
    const user = userEvent.setup();
    const translateBatch = vi.fn().mockResolvedValue(['Een item', 'Meerdere items']);

    vi.spyOn(deepl, 'hasUserApiKey').mockReturnValue(true);
    vi.spyOn(deepl, 'getDeepLClient').mockReturnValue({
      translateBatch,
    } as unknown as ReturnType<typeof deepl.getDeepLClient>);

    useEditorStore.getState().loadFile({
      ...makeFile([
        makeEntry('plural-a', {
          msgid: 'Item',
          msgidPlural: 'Items',
          msgstrPlural: ['', ''],
        }),
      ]),
      header: { language: 'nl' },
    });

    renderWithMantine(<TranslateToolbar glossary={null} />);

    await user.click(screen.getByRole('button', { name: /translate 1 untranslated/i }));

    await waitFor(() => {
      const updated = useEditorStore.getState().entries.find((entry) => entry.id === 'plural-a');
      expect(updated?.msgstrPlural).toEqual(['Een item', 'Meerdere items']);
    });
  });
});

describe('editor details and mobile layout', () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.getState().clearEditor();
    useSourceStore.getState().clearSource();
    setMatchMedia(false);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('shows details only for the selected row and switches when selecting another row', async () => {
    const user = userEvent.setup();
    const entries = [
      makeEntry('a', {
        msgid: 'Save changes',
        msgstr: '',
        msgctxt: 'admin',
        references: ['includes/Admin/Page.php:42'],
        translatorComments: ['Translator note A'],
      }),
      makeEntry('b', {
        msgid: 'Delete user',
        msgstr: '',
        translatorComments: ['Translator note B'],
      }),
    ];

    useEditorStore.getState().loadFile(makeFile(entries));
    renderWithMantine(<EditorTable />);

    expect(screen.getByTestId('entry-details-a')).toBeInTheDocument();
    expect(screen.queryByTestId('entry-details-b')).not.toBeInTheDocument();

    await user.click(screen.getByText('Delete user'));

    expect(screen.queryByTestId('entry-details-a')).not.toBeInTheDocument();
    expect(screen.getByTestId('entry-details-b')).toBeInTheDocument();
  });

  it('wraps status badges instead of adding an inline status scroller', () => {
    useEditorStore.getState().loadFile(makeFile([makeEntry('a', { msgstr: 'Done' })]));

    act(() => {
      const store = useEditorStore.getState();
      store.updateEntry('a', 'Updated translation');
      store.markAsMachineTranslated('a');
      store.clearMachineTranslated('a');
      store.setGlossaryAnalysis('a', {
        entryId: 'a',
        terms: [],
        matchedCount: 1,
        needsReviewCount: 0,
        analyzedAt: new Date().toISOString(),
      });
    });

    renderWithMantine(<EditorTable />);

    // Status badge shows translation status text; secondary indicators are icon-only.
    const statusBadges = screen.getByTestId('status-badges-a');
    expect(statusBadges).toBeInTheDocument();
    expect(statusBadges.textContent).toContain('Translated');
  });

  it('activates source reference from the inspector reference link', async () => {
    const user = userEvent.setup();
    useSourceStore.getState().setProjectContext('plugin', 'demo-plugin');

    const entries = [
      makeEntry('a', {
        msgid: 'Save changes',
        references: ['includes/Admin/Page.php:42'],
      }),
    ];

    useEditorStore.getState().loadFile(makeFile(entries));
    renderWithMantine(<EditorTable />);

    await user.click(screen.getByText('includes/Admin/Page.php:42'));

    const activeReference = useSourceStore.getState().activeReference;
    expect(activeReference?.path).toBe('includes/Admin/Page.php');
    expect(activeReference?.line).toBe(42);
  });

  it('renders mobile card list instead of desktop table on small screens', () => {
    setMatchMedia(true);
    useEditorStore.getState().loadFile(makeFile([makeEntry('a'), makeEntry('b')]));

    renderWithMantine(<EditorTable />);

    expect(screen.getByTestId('mobile-entry-card-list')).toBeInTheDocument();
    expect(screen.queryByTestId('editor-table-desktop')).not.toBeInTheDocument();
  });

  it('keeps the shared table layout in review mode and shows review bulk actions in the toolbar', () => {
    useEditorStore
      .getState()
      .loadFile(makeFile([makeEntry('a', { msgstr: 'Reviewed translation' }), makeEntry('b')]));
    useEditorStore.getState().setReviewStatus('a', 'approved');
    useEditorStore.getState().setSelectedEntries(['a', 'b']);

    renderWithMantine(
      <>
        <TranslateToolbar glossary={null} mode="review" />
        <EditorTable mode="review" />
      </>,
    );

    expect(screen.getByTestId('editor-table-desktop')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^approve selected$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^unapprove selected$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^request changes selected$/i })).toBeInTheDocument();
    expect(screen.getByText('String inspector')).toBeInTheDocument();
  });

  it('uses the native textarea text color for translation editing on mobile', async () => {
    const user = userEvent.setup();
    setMatchMedia(true);
    useEditorStore
      .getState()
      .loadFile(
        makeFile([makeEntry('a', { msgid: 'Source message', msgstr: 'Mobile translation' })]),
      );

    renderWithMantine(<EditorTable />);

    await user.click(screen.getByText('Mobile translation'));

    const textarea = await screen.findByDisplayValue('Mobile translation');
    expect((textarea as HTMLTextAreaElement).style.color).toBe('var(--mantine-color-text)');
    expect((textarea as HTMLTextAreaElement).style.backgroundColor).toBe('var(--gb-surface-1)');
    expect(screen.queryByTestId('highlighted-backdrop-a-singular')).not.toBeInTheDocument();
  });

  it('keeps the highlighted overlay editing style on desktop', async () => {
    const user = userEvent.setup();
    useEditorStore
      .getState()
      .loadFile(
        makeFile([makeEntry('a', { msgid: 'Source message', msgstr: 'Desktop translation' })]),
      );

    const { container } = renderWithMantine(<EditorTable />);

    const editableField = container.querySelector('[data-field-id="a-singular"]');
    expect(editableField).not.toBeNull();
    await user.click(editableField!);

    const textarea = await screen.findByDisplayValue('Desktop translation');
    expect((textarea as HTMLTextAreaElement).style.color).toBe('transparent');
    expect((textarea as HTMLTextAreaElement).style.backgroundColor).toBe('transparent');
    expect(screen.getByTestId('highlighted-backdrop-a-singular')).toBeInTheDocument();
  });

  it('reflects review status updates in the review summary', () => {
    useEditorStore.getState().loadFile(makeFile([makeEntry('a', { msgstr: 'Done' })]));

    renderWithMantine(
      <>
        <ReviewSummary />
        <EditorTable />
      </>,
    );

    act(() => {
      useEditorStore.getState().setReviewStatus('a', 'approved');
    });

    expect(screen.getByText('Ready for export')).toBeInTheDocument();
  });

  it('does not open inline editing for approved locked strings', async () => {
    const user = userEvent.setup();
    useEditorStore
      .getState()
      .loadFile(
        makeFile([makeEntry('a', { msgid: 'Source message', msgstr: 'Locked translation' })]),
      );
    useEditorStore.getState().setReviewStatus('a', 'approved');
    useEditorStore.getState().setLockApprovedEntries(true);

    renderWithMantine(<EditorTable />);

    await user.click(screen.getAllByText('Locked translation')[0]);

    expect(screen.queryByDisplayValue('Locked translation')).not.toBeInTheDocument();
  });
});
