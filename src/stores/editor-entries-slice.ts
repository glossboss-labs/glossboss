/**
 * Editor Entries Slice
 *
 * Entry CRUD, filtering, sorting, search, columns, file loading.
 */

import type { StateCreator } from 'zustand';
import type { POFile, POEntry, POHeader } from '@/lib/po/types';
import { applySourceFile as applySourceFileEntries } from '@/lib/po/source-file';
import type { GlossaryAnalysisResult } from '@/lib/glossary/types';
import { deriveProjectName } from '@/lib/translation-memory';
import type { QAEntryReport } from '@/lib/qa';
import {
  getReviewEntryState,
  hasUnresolvedReviewComments,
  isReviewLocked,
  type ReviewEntryState,
} from '@/lib/review';
import type { TranslationGlossaryMode, TranslationProviderId } from '@/lib/translation/types';
import { getTranslationStatus } from '@/types';
import { fuzzyMatch } from '@/lib/utils/fuzzy-search';
import type { EditorReviewSlice } from './editor-review-slice';
import type { EditorSelectionSlice } from './editor-selection-slice';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Available filter types */
export type FilterType =
  | 'untranslated'
  | 'fuzzy'
  | 'translated'
  | 'modified'
  | 'qa-error'
  | 'qa-warning'
  | 'glossary-review'
  | 'manual-edit'
  | 'machine-translated'
  | 'review-draft'
  | 'review-in-review'
  | 'review-approved'
  | 'review-needs-changes'
  | 'review-unresolved'
  | 'review-changed'
  | 'upstream-delta';

/** Filter state: include (show only) or exclude (don't show) */
export type FilterState = 'include' | 'exclude';

/** Toggleable table columns */
export type TableColumn = 'status' | 'approve' | 'source' | 'translation' | 'signals';
export const ALL_TABLE_COLUMNS: TableColumn[] = [
  'status',
  'approve',
  'source',
  'translation',
  'signals',
];

/** Sort fields for table entries */
export type SortField = 'default' | 'source' | 'translation' | 'status';

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Machine translation metadata */
export interface MachineTranslationMeta {
  usedGlossary: boolean;
  glossaryMode?: TranslationGlossaryMode;
  provider?: TranslationProviderId;
  contextUsed?: boolean;
  timestamp: number;
}

/** Supported file formats */
export type FileFormat = 'po' | 'i18next';

interface FilteredEntriesCache {
  entries: POEntry[];
  filterQuery: string;
  activeFilters: Map<FilterType, FilterState>;
  dirtyEntryIds: Set<string>;
  glossaryAnalysis: Map<string, GlossaryAnalysisResult>;
  qaReports: Map<string, QAEntryReport>;
  upstreamDeltaEntryIds: Set<string>;
  machineTranslatedIds: Set<string>;
  manualEditIds: Set<string>;
  reviewEntries: Map<string, ReviewEntryState>;
  sortField: SortField;
  sortDirection: SortDirection;
  result: POEntry[];
}

let filteredEntriesCache: FilteredEntriesCache | null = null;

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

export interface EditorEntriesState {
  /** Current translation-memory project name */
  projectName: string;

  /** Currently loaded file info */
  filename: string | null;

  /** Source file format (for export) */
  sourceFormat: FileFormat;

  /** File header metadata */
  header: POHeader | null;

  /** All translation entries */
  entries: POEntry[];

  /** Filename of the uploaded source language file (if any) */
  sourceFilename: string | null;

  /** IDs of entries that have been modified */
  dirtyEntryIds: Set<string>;

  /** IDs of entries that were machine translated (DeepL) */
  machineTranslatedIds: Set<string>;

  /** IDs of entries that were manually edited (user typed, not MT) */
  manualEditIds: Set<string>;

  /** Metadata for machine translations (glossary usage, etc.) */
  machineTranslationMeta: Map<string, MachineTranslationMeta>;

  /** Glossary analysis results per entry */
  glossaryAnalysis: Map<string, GlossaryAnalysisResult>;

  /** QA results per entry */
  qaReports: Map<string, QAEntryReport>;

  /** Entries changed by the last upstream refresh diff */
  upstreamDeltaEntryIds: Set<string>;

  /** Search query for filtering */
  filterQuery: string;

  /** Active filters with their state (include/exclude) */
  activeFilters: Map<FilterType, FilterState>;

  /** Visible columns in desktop table */
  visibleColumns: Set<TableColumn>;

  /** Ordered columns in desktop table (left to right, excluding select checkbox column) */
  columnOrder: TableColumn[];

  /** Current sort field for filtered entries */
  sortField: SortField;

  /** Current sort direction for filtered entries */
  sortDirection: SortDirection;

  /** @deprecated - kept for migration, use activeFilters instead */
  filterMode: 'all' | 'untranslated' | 'fuzzy' | 'translated';

  /** Last saved timestamp */
  lastSavedAt: number | null;

  /** Whether file has unsaved changes */
  hasUnsavedChanges: boolean;
}

export interface EditorEntriesActions {
  loadFile: (file: POFile, format?: FileFormat) => void;
  setProjectName: (projectName: string) => void;
  updateEntry: (entryId: string, msgstr: string) => void;
  updateEntryPlural: (entryId: string, msgstrPlural: string[]) => void;
  toggleFuzzy: (entryId: string) => void;
  clearFuzzyBatch: (entryIds: string[]) => void;
  addFuzzyBatch: (entryIds: string[]) => void;
  updateHeader: (field: string, value: string) => void;
  setFilterQuery: (query: string) => void;
  toggleFilter: (filter: FilterType) => void;
  setFilterState: (filter: FilterType, state: FilterState | null) => void;
  getFilterState: (filter: FilterType) => FilterState | null;
  clearFilters: () => void;
  toggleColumnVisibility: (column: TableColumn) => void;
  setColumnVisibility: (column: TableColumn, visible: boolean) => void;
  moveColumn: (column: TableColumn, direction: 'left' | 'right') => void;
  moveColumnToIndex: (column: TableColumn, targetIndex: number) => void;
  setSort: (field: SortField, direction: SortDirection) => void;
  resetSort: () => void;
  /** @deprecated */
  setFilterMode: (mode: EditorEntriesState['filterMode']) => void;
  markAsSaved: () => void;
  clearEditor: () => void;
  markAsMachineTranslated: (
    entryId: string,
    meta?: Partial<Omit<MachineTranslationMeta, 'timestamp'>>,
  ) => void;
  clearMachineTranslated: (entryId: string) => void;
  isMachineTranslated: (entryId: string) => boolean;
  getMachineTranslationMeta: (entryId: string) => MachineTranslationMeta | undefined;
  setGlossaryAnalysis: (entryId: string, analysis: GlossaryAnalysisResult) => void;
  setGlossaryAnalysisBatch: (analyses: Map<string, GlossaryAnalysisResult>) => void;
  getGlossaryAnalysis: (entryId: string) => GlossaryAnalysisResult | undefined;
  clearGlossaryAnalysis: () => void;
  setUpstreamDeltaEntries: (entryIds: string[]) => void;
  clearUpstreamDeltaEntries: () => void;
  setQaReports: (reports: Map<string, QAEntryReport>) => void;
  getQaReport: (entryId: string) => QAEntryReport | undefined;
  clearQaReports: () => void;
  getFilteredEntries: () => POEntry[];
  getEntryById: (entryId: string) => POEntry | undefined;
  isManuallyEdited: (entryId: string) => boolean;
  applySourceEntries: (sourceEntries: POEntry[], sourceFilename: string) => number;
  clearSourceFile: () => void;
  mergeEntries: (mergedEntries: POEntry[]) => void;
  getOverwriteWarningCount: () => number;
  getStats: () => {
    total: number;
    translated: number;
    untranslated: number;
    fuzzy: number;
    modified: number;
    machineTranslated: number;
    manualEdits: number;
    glossaryNeedsReview: number;
    qaErrors: number;
    qaWarnings: number;
    reviewDraft: number;
    reviewInReview: number;
    reviewApproved: number;
    reviewNeedsChanges: number;
    reviewUnresolved: number;
    reviewChanged: number;
    readyToExport: boolean;
  };
}

export type EditorEntriesSlice = EditorEntriesState & EditorEntriesActions;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const entriesInitialState: EditorEntriesState = {
  projectName: 'Untitled project',
  filename: null,
  sourceFormat: 'po',
  header: null,
  entries: [],
  sourceFilename: null,
  dirtyEntryIds: new Set(),
  machineTranslatedIds: new Set(),
  manualEditIds: new Set(),
  machineTranslationMeta: new Map(),
  glossaryAnalysis: new Map(),
  qaReports: new Map(),
  upstreamDeltaEntryIds: new Set(),
  filterQuery: '',
  activeFilters: new Map(),
  visibleColumns: new Set(ALL_TABLE_COLUMNS),
  columnOrder: [...ALL_TABLE_COLUMNS],
  sortField: 'default',
  sortDirection: 'asc',
  filterMode: 'all',
  lastSavedAt: null,
  hasUnsavedChanges: false,
};

/**
 * Check if an entry matches a specific filter
 */
function entryMatchesFilter(
  entry: POEntry,
  filter: FilterType,
  dirtyEntryIds: Set<string>,
  glossaryAnalysis: Map<string, GlossaryAnalysisResult>,
  qaReports: Map<string, QAEntryReport>,
  upstreamDeltaEntryIds: Set<string>,
  machineTranslatedIds: Set<string>,
  manualEditIds: Set<string>,
  reviewEntries: Map<string, ReviewEntryState>,
): boolean {
  const reviewEntry = reviewEntries.get(entry.id);

  switch (filter) {
    case 'untranslated': {
      if (entry.msgidPlural) {
        const plurals = entry.msgstrPlural ?? [];
        return plurals.length < 2 || plurals.some((p) => !p.trim());
      }
      return !entry.msgstr.trim();
    }
    case 'fuzzy':
      return entry.flags.includes('fuzzy');
    case 'translated': {
      if (entry.msgidPlural) {
        const plurals = entry.msgstrPlural ?? [];
        return (
          plurals.length >= 2 &&
          plurals.every((p) => p.trim() !== '') &&
          !entry.flags.includes('fuzzy')
        );
      }
      return Boolean(entry.msgstr.trim()) && !entry.flags.includes('fuzzy');
    }
    case 'modified':
      return dirtyEntryIds.has(entry.id);
    case 'qa-error': {
      const report = qaReports.get(entry.id);
      return (report?.errorCount ?? 0) > 0;
    }
    case 'qa-warning': {
      const report = qaReports.get(entry.id);
      return (report?.warningCount ?? 0) > 0;
    }
    case 'glossary-review': {
      const analysis = glossaryAnalysis.get(entry.id);
      return analysis ? analysis.needsReviewCount > 0 : false;
    }
    case 'manual-edit':
      return manualEditIds.has(entry.id) && !machineTranslatedIds.has(entry.id);
    case 'machine-translated':
      return machineTranslatedIds.has(entry.id);
    case 'review-draft':
      return getReviewEntryState(reviewEntries, entry.id).status === 'draft';
    case 'review-in-review':
      return getReviewEntryState(reviewEntries, entry.id).status === 'in-review';
    case 'review-approved':
      return getReviewEntryState(reviewEntries, entry.id).status === 'approved';
    case 'review-needs-changes':
      return getReviewEntryState(reviewEntries, entry.id).status === 'needs-changes';
    case 'review-unresolved':
      return hasUnresolvedReviewComments(reviewEntry);
    case 'review-changed':
      return reviewEntry?.history.some((event) => event.type === 'translation-updated') ?? false;
    case 'upstream-delta':
      return upstreamDeltaEntryIds.has(entry.id);
    default:
      return false;
  }
}

/**
 * Check if an entry matches the search query
 */
function entryMatchesSearch(
  entry: POEntry,
  query: string,
  reviewEntries: Map<string, ReviewEntryState>,
): boolean {
  const reviewEntry = reviewEntries.get(entry.id);

  return (
    fuzzyMatch(entry.msgid, query) ||
    fuzzyMatch(entry.msgstr, query) ||
    (entry.sourceText ? fuzzyMatch(entry.sourceText, query) : false) ||
    (entry.msgctxt ? fuzzyMatch(entry.msgctxt, query) : false) ||
    entry.translatorComments.some((c) => fuzzyMatch(c, query)) ||
    entry.extractedComments.some((c) => fuzzyMatch(c, query)) ||
    (reviewEntry?.comments.some(
      (comment) => fuzzyMatch(comment.message, query) || fuzzyMatch(comment.author, query),
    ) ??
      false)
  );
}

function getSortText(entry: POEntry, field: SortField): string {
  if (field === 'source') {
    return (entry.sourceText ?? entry.msgid).toLowerCase();
  }

  if (field === 'translation') {
    if (entry.msgidPlural) {
      return (entry.msgstrPlural ?? []).join('\n').toLowerCase();
    }
    return entry.msgstr.toLowerCase();
  }

  return '';
}

function getStatusRank(entry: POEntry): number {
  if (entry.flags.includes('fuzzy')) return 1;

  if (entry.msgidPlural) {
    const plurals = entry.msgstrPlural ?? [];
    const isComplete = plurals.length >= 2 && plurals.every((p) => p.trim() !== '');
    return isComplete ? 2 : 0;
  }

  return entry.msgstr.trim() ? 2 : 0;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

type FullStore = EditorEntriesSlice & EditorSelectionSlice & EditorReviewSlice;

export const createEditorEntriesSlice: StateCreator<FullStore, [], [], EditorEntriesSlice> = (
  set,
  get,
) => ({
  ...entriesInitialState,

  loadFile: (file: POFile, format: FileFormat = 'po') => {
    set((state) => ({
      projectName: deriveProjectName(file.header, file.filename),
      filename: file.filename,
      sourceFormat: format,
      sourceFilename: null,
      header: file.header,
      entries: file.entries,
      dirtyEntryIds: new Set(),
      machineTranslatedIds: new Set(),
      manualEditIds: new Set(),
      machineTranslationMeta: new Map(),
      glossaryAnalysis: new Map(),
      qaReports: new Map(),
      upstreamDeltaEntryIds: new Set(),
      reviewEntries: new Map(),
      selectedEntryId: file.entries[0]?.id ?? null,
      selectedEntryIds: new Set(),
      filterQuery: '',
      activeFilters: new Map(),
      visibleColumns: new Set(state.visibleColumns),
      columnOrder: [...state.columnOrder],
      sortField: state.sortField,
      sortDirection: state.sortDirection,
      filterMode: 'all',
      lastSavedAt: Date.now(),
      hasUnsavedChanges: false,
    }));
  },

  setProjectName: (projectName: string) => {
    set({
      projectName: projectName.trim() || 'Untitled project',
    });
  },

  updateEntry: (entryId: string, msgstr: string) => {
    set((state) => {
      const existingEntry = state.entries.find((entry) => entry.id === entryId);
      if (!existingEntry || existingEntry.msgstr === msgstr) {
        return {};
      }

      const reviewEntry = getReviewEntryState(state.reviewEntries, entryId);
      if (isReviewLocked(reviewEntry.status, state.lockApprovedEntries)) {
        return {};
      }

      const entries = state.entries.map((entry) =>
        entry.id === entryId ? { ...entry, msgstr, isDirty: true } : entry,
      );

      const dirtyEntryIds = new Set(state.dirtyEntryIds);
      dirtyEntryIds.add(entryId);

      const reviewEntries = new Map(state.reviewEntries);
      const nextReviewEntry = cloneReviewEntry(state.reviewEntries.get(entryId));
      nextReviewEntry.history.push(
        createReviewHistoryEvent(getReviewActorName(state.reviewerName), {
          type: 'translation-updated',
          field: 'singular',
          from: existingEntry.msgstr,
          to: msgstr,
        }),
      );
      commitReviewEntry(reviewEntries, entryId, nextReviewEntry);

      return {
        entries,
        dirtyEntryIds,
        reviewEntries,
        hasUnsavedChanges: true,
      };
    });
  },

  updateEntryPlural: (entryId: string, msgstrPlural: string[]) => {
    set((state) => {
      const existingEntry = state.entries.find((entry) => entry.id === entryId);
      if (
        !existingEntry ||
        JSON.stringify(existingEntry.msgstrPlural ?? []) === JSON.stringify(msgstrPlural)
      ) {
        return {};
      }

      const reviewEntry = getReviewEntryState(state.reviewEntries, entryId);
      if (isReviewLocked(reviewEntry.status, state.lockApprovedEntries)) {
        return {};
      }

      const entries = state.entries.map((entry) =>
        entry.id === entryId ? { ...entry, msgstrPlural, isDirty: true } : entry,
      );

      const dirtyEntryIds = new Set(state.dirtyEntryIds);
      dirtyEntryIds.add(entryId);

      const reviewEntries = new Map(state.reviewEntries);
      const nextReviewEntry = cloneReviewEntry(state.reviewEntries.get(entryId));
      nextReviewEntry.history.push(
        createReviewHistoryEvent(getReviewActorName(state.reviewerName), {
          type: 'translation-updated',
          field: 'plural',
          from: (existingEntry.msgstrPlural ?? []).join('\n'),
          to: msgstrPlural.join('\n'),
        }),
      );
      commitReviewEntry(reviewEntries, entryId, nextReviewEntry);

      return {
        entries,
        dirtyEntryIds,
        reviewEntries,
        hasUnsavedChanges: true,
      };
    });
  },

  toggleFuzzy: (entryId: string) => {
    set((state) => {
      const reviewEntry = getReviewEntryState(state.reviewEntries, entryId);
      if (isReviewLocked(reviewEntry.status, state.lockApprovedEntries)) {
        return {};
      }

      const entries = state.entries.map((entry) => {
        if (entry.id !== entryId) return entry;

        const hasFuzzy = entry.flags.includes('fuzzy');
        const flags = hasFuzzy
          ? entry.flags.filter((f) => f !== 'fuzzy')
          : [...entry.flags, 'fuzzy' as const];

        return { ...entry, flags, isDirty: true };
      });

      const dirtyEntryIds = new Set(state.dirtyEntryIds);
      dirtyEntryIds.add(entryId);

      return {
        entries,
        dirtyEntryIds,
        hasUnsavedChanges: true,
      };
    });
  },

  clearFuzzyBatch: (entryIds: string[]) => {
    if (entryIds.length === 0) return;

    set((state) => {
      const targetIds = new Set(entryIds);
      const dirtyEntryIds = new Set(state.dirtyEntryIds);
      let changed = false;

      const entries = state.entries.map((entry) => {
        const reviewEntry = getReviewEntryState(state.reviewEntries, entry.id);
        if (
          !targetIds.has(entry.id) ||
          !entry.flags.includes('fuzzy') ||
          isReviewLocked(reviewEntry.status, state.lockApprovedEntries)
        ) {
          return entry;
        }

        changed = true;
        dirtyEntryIds.add(entry.id);

        return {
          ...entry,
          flags: entry.flags.filter((flag) => flag !== 'fuzzy'),
          isDirty: true,
        };
      });

      if (!changed) {
        return {};
      }

      return {
        entries,
        dirtyEntryIds,
        hasUnsavedChanges: true,
      };
    });
  },

  addFuzzyBatch: (entryIds: string[]) => {
    if (entryIds.length === 0) return;

    set((state) => {
      const targetIds = new Set(entryIds);
      const dirtyEntryIds = new Set(state.dirtyEntryIds);
      let changed = false;

      const entries = state.entries.map((entry) => {
        const reviewEntry = getReviewEntryState(state.reviewEntries, entry.id);
        if (
          !targetIds.has(entry.id) ||
          entry.flags.includes('fuzzy') ||
          isReviewLocked(reviewEntry.status, state.lockApprovedEntries)
        ) {
          return entry;
        }

        changed = true;
        dirtyEntryIds.add(entry.id);

        return {
          ...entry,
          flags: [...entry.flags, 'fuzzy' as const],
          isDirty: true,
        };
      });

      if (!changed) {
        return {};
      }

      return {
        entries,
        dirtyEntryIds,
        hasUnsavedChanges: true,
      };
    });
  },

  updateHeader: (field: string, value: string) => {
    set((state) => ({
      header: {
        ...state.header,
        [field]: value || undefined,
      },
      hasUnsavedChanges: true,
    }));
  },

  setFilterQuery: (query: string) => {
    set({ filterQuery: query });
  },

  toggleFilter: (filter: FilterType) => {
    set((state) => {
      const activeFilters = new Map(state.activeFilters);
      const currentState = activeFilters.get(filter);

      if (currentState === undefined) {
        activeFilters.set(filter, 'include');
      } else if (currentState === 'include') {
        activeFilters.set(filter, 'exclude');
      } else {
        activeFilters.delete(filter);
      }

      return { activeFilters };
    });
  },

  setFilterState: (filter: FilterType, state: FilterState | null) => {
    set((currentState) => {
      const activeFilters = new Map(currentState.activeFilters);
      if (state === null) {
        activeFilters.delete(filter);
      } else {
        activeFilters.set(filter, state);
      }
      return { activeFilters };
    });
  },

  getFilterState: (filter: FilterType) => {
    return get().activeFilters.get(filter) ?? null;
  },

  clearFilters: () => {
    set({ activeFilters: new Map(), filterQuery: '' });
  },

  toggleColumnVisibility: (column: TableColumn) => {
    set((state) => {
      const visibleColumns = new Set(state.visibleColumns);

      if (visibleColumns.has(column)) {
        if (visibleColumns.size === 1) {
          return {};
        }
        visibleColumns.delete(column);
      } else {
        visibleColumns.add(column);
      }

      return { visibleColumns };
    });
  },

  setColumnVisibility: (column: TableColumn, visible: boolean) => {
    set((state) => {
      const visibleColumns = new Set(state.visibleColumns);

      if (visible) {
        visibleColumns.add(column);
      } else {
        if (visibleColumns.size === 1) {
          return {};
        }
        visibleColumns.delete(column);
      }

      return { visibleColumns };
    });
  },

  moveColumn: (column: TableColumn, direction: 'left' | 'right') => {
    set((state) => {
      const index = state.columnOrder.indexOf(column);
      if (index === -1) return {};

      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= state.columnOrder.length) {
        return {};
      }

      const nextOrder = [...state.columnOrder];
      const [moved] = nextOrder.splice(index, 1);
      nextOrder.splice(targetIndex, 0, moved);

      return { columnOrder: nextOrder };
    });
  },

  moveColumnToIndex: (column: TableColumn, targetIndex: number) => {
    set((state) => {
      const index = state.columnOrder.indexOf(column);
      if (index === -1) return {};
      if (targetIndex < 0 || targetIndex >= state.columnOrder.length) return {};
      if (targetIndex === index) return {};

      const nextOrder = [...state.columnOrder];
      const [moved] = nextOrder.splice(index, 1);
      nextOrder.splice(targetIndex, 0, moved);
      return { columnOrder: nextOrder };
    });
  },

  setSort: (field: SortField, direction: SortDirection) => {
    set({ sortField: field, sortDirection: direction });
  },

  resetSort: () => {
    set({ sortField: 'default', sortDirection: 'asc' });
  },

  setFilterMode: (mode: EditorEntriesState['filterMode']) => {
    const activeFilters = new Map<FilterType, FilterState>();
    if (mode !== 'all') {
      activeFilters.set(mode, 'include');
    }
    set({ filterMode: mode, activeFilters });
  },

  markAsSaved: () => {
    set((state) => ({
      dirtyEntryIds: new Set(),
      entries: state.entries.map((e) => ({ ...e, isDirty: false })),
      lastSavedAt: Date.now(),
      hasUnsavedChanges: false,
    }));
  },

  clearEditor: () => {
    set({
      ...entriesInitialState,
      visibleColumns: new Set(ALL_TABLE_COLUMNS),
      columnOrder: [...ALL_TABLE_COLUMNS],
      // Reset selection slice state
      selectedEntryId: null,
      selectedEntryIds: new Set(),
      // Reset review slice state
      reviewEntries: new Map(),
      reviewerName: '',
      lockApprovedEntries: false,
    });
  },

  applySourceEntries: (sourceEntries: POEntry[], sourceFilename: string) => {
    const entries = [...get().entries];
    const matched = applySourceFileEntries(entries, sourceEntries);
    set({ entries, sourceFilename });
    return matched;
  },

  clearSourceFile: () => {
    const entries = get().entries.map((e) => {
      if (!e.sourceText && !e.sourceTextPlural) return e;
      const cleaned = { ...e };
      delete cleaned.sourceText;
      delete cleaned.sourceTextPlural;
      return cleaned;
    });
    set({ entries, sourceFilename: null });
  },

  mergeEntries: (mergedEntries: POEntry[]) => {
    set({
      entries: mergedEntries,
      dirtyEntryIds: new Set(),
      machineTranslatedIds: new Set(),
      manualEditIds: new Set(),
      machineTranslationMeta: new Map(),
      glossaryAnalysis: new Map(),
      qaReports: new Map(),
      upstreamDeltaEntryIds: new Set(),
      reviewEntries: new Map(),
      selectedEntryId: mergedEntries[0]?.id ?? null,
      selectedEntryIds: new Set(),
      hasUnsavedChanges: true,
    });
  },

  markAsMachineTranslated: (
    entryId: string,
    meta: Partial<Omit<MachineTranslationMeta, 'timestamp'>> = {},
  ) => {
    set((state) => {
      const machineTranslatedIds = new Set(state.machineTranslatedIds);
      machineTranslatedIds.add(entryId);

      const machineTranslationMeta = new Map(state.machineTranslationMeta);
      machineTranslationMeta.set(entryId, {
        usedGlossary: Boolean(meta.usedGlossary),
        glossaryMode: meta.glossaryMode ?? (meta.usedGlossary ? 'native' : 'none'),
        provider: meta.provider,
        contextUsed: Boolean(meta.contextUsed),
        timestamp: Date.now(),
      });

      return { machineTranslatedIds, machineTranslationMeta };
    });
  },

  clearMachineTranslated: (entryId: string) => {
    set((state) => {
      const machineTranslatedIds = new Set(state.machineTranslatedIds);
      machineTranslatedIds.delete(entryId);

      const machineTranslationMeta = new Map(state.machineTranslationMeta);
      machineTranslationMeta.delete(entryId);

      const manualEditIds = new Set(state.manualEditIds);
      manualEditIds.add(entryId);

      return { machineTranslatedIds, machineTranslationMeta, manualEditIds };
    });
  },

  isMachineTranslated: (entryId: string) => {
    return get().machineTranslatedIds.has(entryId);
  },

  getMachineTranslationMeta: (entryId: string) => {
    return get().machineTranslationMeta.get(entryId);
  },

  setGlossaryAnalysis: (entryId: string, analysis: GlossaryAnalysisResult) => {
    set((state) => {
      const glossaryAnalysis = new Map(state.glossaryAnalysis);
      glossaryAnalysis.set(entryId, analysis);
      return { glossaryAnalysis };
    });
  },

  setGlossaryAnalysisBatch: (analyses: Map<string, GlossaryAnalysisResult>) => {
    set((state) => {
      const glossaryAnalysis = new Map(state.glossaryAnalysis);
      analyses.forEach((analysis, entryId) => {
        glossaryAnalysis.set(entryId, analysis);
      });
      return { glossaryAnalysis };
    });
  },

  getGlossaryAnalysis: (entryId: string) => {
    return get().glossaryAnalysis.get(entryId);
  },

  clearGlossaryAnalysis: () => {
    set({ glossaryAnalysis: new Map() });
  },

  setUpstreamDeltaEntries: (entryIds: string[]) => {
    set({ upstreamDeltaEntryIds: new Set(entryIds) });
  },

  clearUpstreamDeltaEntries: () => {
    set({ upstreamDeltaEntryIds: new Set() });
  },

  setQaReports: (reports: Map<string, QAEntryReport>) => {
    set({ qaReports: new Map(reports) });
  },

  getQaReport: (entryId: string) => {
    return get().qaReports.get(entryId);
  },

  clearQaReports: () => {
    set({ qaReports: new Map() });
  },

  getFilteredEntries: () => {
    const {
      entries,
      filterQuery,
      activeFilters,
      dirtyEntryIds,
      glossaryAnalysis,
      qaReports,
      upstreamDeltaEntryIds,
      machineTranslatedIds,
      manualEditIds,
      reviewEntries,
      sortField,
      sortDirection,
    } = get();

    if (
      filteredEntriesCache &&
      filteredEntriesCache.entries === entries &&
      filteredEntriesCache.filterQuery === filterQuery &&
      filteredEntriesCache.activeFilters === activeFilters &&
      filteredEntriesCache.dirtyEntryIds === dirtyEntryIds &&
      filteredEntriesCache.glossaryAnalysis === glossaryAnalysis &&
      filteredEntriesCache.qaReports === qaReports &&
      filteredEntriesCache.upstreamDeltaEntryIds === upstreamDeltaEntryIds &&
      filteredEntriesCache.machineTranslatedIds === machineTranslatedIds &&
      filteredEntriesCache.manualEditIds === manualEditIds &&
      filteredEntriesCache.reviewEntries === reviewEntries &&
      filteredEntriesCache.sortField === sortField &&
      filteredEntriesCache.sortDirection === sortDirection
    ) {
      return filteredEntriesCache.result;
    }

    let filtered = entries;

    const includeFilters: FilterType[] = [];
    const excludeFilters: FilterType[] = [];

    activeFilters.forEach((filterState, filterType) => {
      if (filterState === 'include') {
        includeFilters.push(filterType);
      } else if (filterState === 'exclude') {
        excludeFilters.push(filterType);
      }
    });

    if (includeFilters.length > 0) {
      filtered = filtered.filter((entry) =>
        includeFilters.some((filter) =>
          entryMatchesFilter(
            entry,
            filter,
            dirtyEntryIds,
            glossaryAnalysis,
            qaReports,
            upstreamDeltaEntryIds,
            machineTranslatedIds,
            manualEditIds,
            reviewEntries,
          ),
        ),
      );
    }

    if (excludeFilters.length > 0) {
      filtered = filtered.filter(
        (entry) =>
          !excludeFilters.some((filter) =>
            entryMatchesFilter(
              entry,
              filter,
              dirtyEntryIds,
              glossaryAnalysis,
              qaReports,
              upstreamDeltaEntryIds,
              machineTranslatedIds,
              manualEditIds,
              reviewEntries,
            ),
          ),
      );
    }

    if (filterQuery.trim()) {
      filtered = filtered.filter((entry) => entryMatchesSearch(entry, filterQuery, reviewEntries));
    }

    if (sortField !== 'default') {
      const directionMultiplier = sortDirection === 'asc' ? 1 : -1;

      filtered = filtered
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => {
          const compareResult =
            sortField === 'status'
              ? getStatusRank(a.entry) - getStatusRank(b.entry)
              : getSortText(a.entry, sortField).localeCompare(getSortText(b.entry, sortField));

          if (compareResult !== 0) {
            return compareResult * directionMultiplier;
          }

          return a.index - b.index;
        })
        .map(({ entry }) => entry);
    }

    filteredEntriesCache = {
      entries,
      filterQuery,
      activeFilters,
      dirtyEntryIds,
      glossaryAnalysis,
      qaReports,
      upstreamDeltaEntryIds,
      machineTranslatedIds,
      manualEditIds,
      reviewEntries,
      sortField,
      sortDirection,
      result: filtered,
    };

    return filtered;
  },

  getEntryById: (entryId: string) => {
    return get().entries.find((e) => e.id === entryId);
  },

  getStats: () => {
    const {
      entries,
      dirtyEntryIds,
      machineTranslatedIds,
      manualEditIds,
      glossaryAnalysis,
      qaReports,
      reviewEntries,
    } = get();
    const total = entries.length;

    const isFullyTranslated = (e: POEntry): boolean => {
      if (e.msgidPlural) {
        const plurals = e.msgstrPlural ?? [];
        return plurals.length >= 2 && plurals.every((p) => p.trim() !== '');
      }
      return e.msgstr.trim() !== '';
    };

    const isUntranslated = (e: POEntry): boolean => {
      if (e.msgidPlural) {
        const plurals = e.msgstrPlural ?? [];
        return plurals.length < 2 || plurals.some((p) => !p.trim());
      }
      return !e.msgstr.trim();
    };

    const translated = entries.filter(
      (e) => isFullyTranslated(e) && !e.flags.includes('fuzzy'),
    ).length;
    const fuzzy = entries.filter((e) => e.flags.includes('fuzzy')).length;
    const untranslated = entries.filter((e) => isUntranslated(e)).length;
    const modified = dirtyEntryIds.size;
    const machineTranslated = machineTranslatedIds.size;
    const manualEdits = manualEditIds.size;
    const glossaryNeedsReview = Array.from(glossaryAnalysis).filter(
      ([, analysis]) => analysis.needsReviewCount > 0,
    ).length;
    const qaErrors = Array.from(qaReports.values()).filter(
      (report) => report.errorCount > 0,
    ).length;
    const qaWarnings = Array.from(qaReports.values()).filter(
      (report) => report.warningCount > 0,
    ).length;
    const reviewDraft = entries.filter(
      (entry) => getReviewEntryState(reviewEntries, entry.id).status === 'draft',
    ).length;
    const reviewInReview = entries.filter(
      (entry) => getReviewEntryState(reviewEntries, entry.id).status === 'in-review',
    ).length;
    const reviewApproved = entries.filter(
      (entry) => getReviewEntryState(reviewEntries, entry.id).status === 'approved',
    ).length;
    const reviewNeedsChanges = entries.filter(
      (entry) => getReviewEntryState(reviewEntries, entry.id).status === 'needs-changes',
    ).length;
    const reviewUnresolved = Array.from(reviewEntries.values()).reduce(
      (totalComments, entry) =>
        totalComments + entry.comments.filter((comment) => !comment.resolvedAt).length,
      0,
    );
    const reviewChanged = getChangedReviewEntryCount(reviewEntries);
    const readyToExport =
      total > 0 &&
      reviewApproved === total &&
      reviewUnresolved === 0 &&
      entries.every(
        (entry) =>
          getTranslationStatus(entry.msgstr, entry.flags, entry.msgstrPlural) === 'translated',
      );

    return {
      total,
      translated,
      untranslated,
      fuzzy,
      modified,
      machineTranslated,
      manualEdits,
      glossaryNeedsReview,
      qaErrors,
      qaWarnings,
      reviewDraft,
      reviewInReview,
      reviewApproved,
      reviewNeedsChanges,
      reviewUnresolved,
      reviewChanged,
      readyToExport,
    };
  },

  isManuallyEdited: (entryId: string) => {
    return get().manualEditIds.has(entryId);
  },

  getOverwriteWarningCount: () => {
    const { entries, manualEditIds, machineTranslatedIds } = get();
    return entries.filter((e) => {
      const hasTranslation = e.msgstr.trim() !== '';
      const isManual = manualEditIds.has(e.id);
      const isMT = machineTranslatedIds.has(e.id);
      return hasTranslation && (isManual || !isMT);
    }).length;
  },
});

// ---------------------------------------------------------------------------
// Review helpers shared by entries and review slices
// ---------------------------------------------------------------------------

import {
  createDefaultReviewEntryState,
  getChangedReviewEntryCount,
  type ReviewHistoryEvent,
} from '@/lib/review';

export function createReviewHistoryEvent(
  actor: string,
  event: Omit<ReviewHistoryEvent, 'id' | 'actor' | 'createdAt'>,
): ReviewHistoryEvent {
  return {
    id: crypto.randomUUID(),
    actor,
    createdAt: new Date().toISOString(),
    ...event,
  };
}

export function getReviewActorName(reviewerName: string): string {
  return reviewerName.trim();
}

export function cloneReviewEntry(entry: ReviewEntryState | undefined): ReviewEntryState {
  const source = entry ?? createDefaultReviewEntryState();
  return {
    status: source.status,
    comments: [...source.comments],
    history: [...source.history],
  };
}

export function commitReviewEntry(
  reviewEntries: Map<string, ReviewEntryState>,
  entryId: string,
  entry: ReviewEntryState,
): void {
  const isDefault =
    entry.status === 'draft' && entry.comments.length === 0 && entry.history.length === 0;

  if (isDefault) {
    reviewEntries.delete(entryId);
    return;
  }

  reviewEntries.set(entryId, entry);
}
