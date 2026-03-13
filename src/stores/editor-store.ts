/**
 * Editor Store
 *
 * Zustand store for PO editor state with localStorage persistence.
 * Manages loaded entries, selection, dirty state, and undo history.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { POFile, POEntry, POHeader } from '@/lib/po/types';
import type { GlossaryAnalysisResult } from '@/lib/glossary/types';
import { deriveProjectName } from '@/lib/translation-memory';
import type { QAEntryReport } from '@/lib/qa';
import {
  createDefaultReviewEntryState,
  getChangedReviewEntryCount,
  getReviewEntryState,
  hasUnresolvedReviewComments,
  isReviewLocked,
  type ReviewComment,
  type ReviewEntryState,
  type ReviewHistoryEvent,
  type ReviewStatus,
} from '@/lib/review';
import { STORAGE_KEY } from '@/lib/storage';
import type { TranslationGlossaryMode, TranslationProviderId } from '@/lib/translation/types';
import { getTranslationStatus } from '@/types';

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
const ALL_TABLE_COLUMNS: TableColumn[] = ['status', 'approve', 'source', 'translation', 'signals'];

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

/** Editor state */
export interface EditorState {
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

  /** Review workflow metadata keyed by entry ID */
  reviewEntries: Map<string, ReviewEntryState>;

  /** Display name used for review comments and history */
  reviewerName: string;

  /** Whether approved strings should be locked until reopened */
  lockApprovedEntries: boolean;

  /** Currently selected entry ID */
  selectedEntryId: string | null;

  /** IDs of entries selected for bulk operations */
  selectedEntryIds: Set<string>;

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

/** Editor actions */
export interface EditorActions {
  /** Load a PO file into the editor */
  loadFile: (file: POFile, format?: FileFormat) => void;

  /** Set the current project name used for translation memory scoping */
  setProjectName: (projectName: string) => void;

  /** Update a single entry's translation */
  updateEntry: (entryId: string, msgstr: string) => void;

  /** Update entry with plural translations */
  updateEntryPlural: (entryId: string, msgstrPlural: string[]) => void;

  /** Toggle fuzzy flag on an entry */
  toggleFuzzy: (entryId: string) => void;

  /** Clear fuzzy flag for a batch of entries (approve) */
  clearFuzzyBatch: (entryIds: string[]) => void;

  /** Add fuzzy flag for a batch of entries (unapprove) */
  addFuzzyBatch: (entryIds: string[]) => void;

  /** Update header metadata field */
  updateHeader: (field: string, value: string) => void;

  /** Select an entry */
  selectEntry: (entryId: string | null) => void;

  /** Toggle an entry in the bulk selection set */
  toggleEntrySelection: (entryId: string) => void;

  /** Set bulk selection state for a specific entry */
  setEntrySelection: (entryId: string, selected: boolean) => void;

  /** Replace the full bulk selection set */
  setSelectedEntries: (entryIds: string[]) => void;

  /** Clear all bulk selections */
  clearSelectedEntries: () => void;

  /** Set filter query */
  setFilterQuery: (query: string) => void;

  /** Toggle a filter on/off */
  toggleFilter: (filter: FilterType) => void;

  /** Set a specific filter state */
  setFilterState: (filter: FilterType, state: FilterState | null) => void;

  /** Get the current state of a filter */
  getFilterState: (filter: FilterType) => FilterState | null;

  /** Clear all active filters */
  clearFilters: () => void;

  /** Toggle visibility of a desktop table column */
  toggleColumnVisibility: (column: TableColumn) => void;

  /** Set visibility of a desktop table column */
  setColumnVisibility: (column: TableColumn, visible: boolean) => void;

  /** Move a desktop table column one position left or right */
  moveColumn: (column: TableColumn, direction: 'left' | 'right') => void;

  /** Move a desktop table column to a specific index */
  moveColumnToIndex: (column: TableColumn, targetIndex: number) => void;

  /** Set sorting options for filtered entries */
  setSort: (field: SortField, direction: SortDirection) => void;

  /** Reset sort to file/default order */
  resetSort: () => void;

  /** @deprecated - use toggleFilter instead */
  setFilterMode: (mode: EditorState['filterMode']) => void;

  /** Mark current state as saved */
  markAsSaved: () => void;

  /** Clear the editor (reset to empty state) */
  clearEditor: () => void;

  /** Mark an entry as machine translated */
  markAsMachineTranslated: (
    entryId: string,
    meta?: Partial<Omit<MachineTranslationMeta, 'timestamp'>>,
  ) => void;

  /** Clear machine translated flag for an entry (when manually edited) */
  clearMachineTranslated: (entryId: string) => void;

  /** Check if an entry was machine translated */
  isMachineTranslated: (entryId: string) => boolean;

  /** Get machine translation metadata for an entry */
  getMachineTranslationMeta: (entryId: string) => MachineTranslationMeta | undefined;

  /** Set glossary analysis for an entry */
  setGlossaryAnalysis: (entryId: string, analysis: GlossaryAnalysisResult) => void;

  /** Set glossary analysis for multiple entries at once */
  setGlossaryAnalysisBatch: (analyses: Map<string, GlossaryAnalysisResult>) => void;

  /** Get glossary analysis for an entry */
  getGlossaryAnalysis: (entryId: string) => GlossaryAnalysisResult | undefined;

  /** Clear all glossary analysis (e.g., when glossary changes) */
  clearGlossaryAnalysis: () => void;

  /** Mark the entries changed by the last upstream refresh */
  setUpstreamDeltaEntries: (entryIds: string[]) => void;

  /** Clear the upstream refresh delta marker */
  clearUpstreamDeltaEntries: () => void;

  /** Set QA reports for multiple entries at once */
  setQaReports: (reports: Map<string, QAEntryReport>) => void;

  /** Get QA report for an entry */
  getQaReport: (entryId: string) => QAEntryReport | undefined;

  /** Clear all QA reports */
  clearQaReports: () => void;

  /** Set the active reviewer display name */
  setReviewerName: (name: string) => void;

  /** Enable or disable automatic locking for approved strings */
  setLockApprovedEntries: (enabled: boolean) => void;

  /** Set review status for an entry */
  setReviewStatus: (entryId: string, status: ReviewStatus) => void;

  /** Add a review comment or reply to an entry */
  addReviewComment: (entryId: string, message: string, parentId?: string) => void;

  /** Resolve or reopen a review comment */
  setReviewCommentResolved: (entryId: string, commentId: string, resolved: boolean) => void;

  /** Replace review metadata, for example when restoring a draft */
  restoreReviewEntries: (entries: Map<string, ReviewEntryState>) => void;

  /** Get review metadata for an entry */
  getReviewEntry: (entryId: string) => ReviewEntryState;

  /** Check if an entry is locked by the review workflow */
  isEntryReviewLocked: (entryId: string) => boolean;

  /** Get filtered entries based on current filters */
  getFilteredEntries: () => POEntry[];

  /** Get entry by ID */
  getEntryById: (entryId: string) => POEntry | undefined;

  /** Check if an entry was manually edited */
  isManuallyEdited: (entryId: string) => boolean;

  /** Merge entries from a POT update, replacing all entries */
  mergeEntries: (mergedEntries: POEntry[]) => void;

  /** Get count of entries that would be overwritten by bulk translation */
  getOverwriteWarningCount: () => number;

  /** Get translation statistics */
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

/** Initial state */
const initialState: EditorState = {
  projectName: 'Untitled project',
  filename: null,
  sourceFormat: 'po',
  header: null,
  entries: [],
  dirtyEntryIds: new Set(),
  machineTranslatedIds: new Set(),
  manualEditIds: new Set(),
  machineTranslationMeta: new Map(),
  glossaryAnalysis: new Map(),
  qaReports: new Map(),
  upstreamDeltaEntryIds: new Set(),
  reviewEntries: new Map(),
  reviewerName: '',
  lockApprovedEntries: false,
  selectedEntryId: null,
  selectedEntryIds: new Set(),
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

function createReviewHistoryEvent(
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

function getReviewActorName(reviewerName: string): string {
  return reviewerName.trim();
}

function cloneReviewEntry(entry: ReviewEntryState | undefined): ReviewEntryState {
  const source = entry ?? createDefaultReviewEntryState();
  return {
    status: source.status,
    comments: [...source.comments],
    history: [...source.history],
  };
}

function commitReviewEntry(
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
      // Check for plural entries
      if (entry.msgidPlural) {
        const plurals = entry.msgstrPlural ?? [];
        return plurals.length < 2 || plurals.some((p) => !p.trim());
      }
      return !entry.msgstr.trim();
    }
    case 'fuzzy':
      return entry.flags.includes('fuzzy');
    case 'translated': {
      // Check for plural entries - all forms must be filled
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
  const lowerQuery = query.toLowerCase();
  const reviewEntry = reviewEntries.get(entry.id);

  return (
    entry.msgid.toLowerCase().includes(lowerQuery) ||
    entry.msgstr.toLowerCase().includes(lowerQuery) ||
    (entry.msgctxt?.toLowerCase().includes(lowerQuery) ?? false) ||
    entry.translatorComments.some((c) => c.toLowerCase().includes(lowerQuery)) ||
    entry.extractedComments.some((c) => c.toLowerCase().includes(lowerQuery)) ||
    (reviewEntry?.comments.some(
      (comment) =>
        comment.message.toLowerCase().includes(lowerQuery) ||
        comment.author.toLowerCase().includes(lowerQuery),
    ) ??
      false)
  );
}

function getSortText(entry: POEntry, field: SortField): string {
  if (field === 'source') {
    return entry.msgid.toLowerCase();
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

/**
 * Editor store with persistence
 */
export const useEditorStore = create<EditorState & EditorActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      loadFile: (file: POFile, format: FileFormat = 'po') => {
        set((state) => ({
          projectName: deriveProjectName(file.header, file.filename),
          filename: file.filename,
          sourceFormat: format,
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
            [field]: value || undefined, // Remove empty values
          },
          hasUnsavedChanges: true,
        }));
      },

      selectEntry: (entryId: string | null) => {
        set({ selectedEntryId: entryId });
      },

      toggleEntrySelection: (entryId: string) => {
        set((state) => {
          const selectedEntryIds = new Set(state.selectedEntryIds);
          if (selectedEntryIds.has(entryId)) {
            selectedEntryIds.delete(entryId);
          } else {
            selectedEntryIds.add(entryId);
          }
          return { selectedEntryIds };
        });
      },

      setEntrySelection: (entryId: string, selected: boolean) => {
        set((state) => {
          const selectedEntryIds = new Set(state.selectedEntryIds);
          if (selected) {
            selectedEntryIds.add(entryId);
          } else {
            selectedEntryIds.delete(entryId);
          }
          return { selectedEntryIds };
        });
      },

      setSelectedEntries: (entryIds: string[]) => {
        set({ selectedEntryIds: new Set(entryIds) });
      },

      clearSelectedEntries: () => {
        set({ selectedEntryIds: new Set() });
      },

      setFilterQuery: (query: string) => {
        set({ filterQuery: query });
      },

      toggleFilter: (filter: FilterType) => {
        set((state) => {
          const activeFilters = new Map(state.activeFilters);
          const currentState = activeFilters.get(filter);

          // Cycle: none -> include -> exclude -> none
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

      setFilterMode: (mode: EditorState['filterMode']) => {
        // Legacy support - convert to new filter system
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
        set(initialState);
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

          // Mark as manually edited since user cleared the MT flag (by editing)
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

      setReviewerName: (name: string) => {
        set({ reviewerName: name.trim() });
      },

      setLockApprovedEntries: (enabled: boolean) => {
        set({ lockApprovedEntries: enabled });
      },

      setReviewStatus: (entryId: string, status: ReviewStatus) => {
        set((state) => {
          const current = getReviewEntryState(state.reviewEntries, entryId);
          if (current.status === status) {
            return {};
          }

          const reviewEntries = new Map(state.reviewEntries);
          const nextEntry = cloneReviewEntry(state.reviewEntries.get(entryId));
          nextEntry.status = status;
          nextEntry.history.push(
            createReviewHistoryEvent(getReviewActorName(state.reviewerName), {
              type: 'review-status-changed',
              field: 'review-status',
              from: current.status,
              to: status,
            }),
          );
          commitReviewEntry(reviewEntries, entryId, nextEntry);

          return { reviewEntries, hasUnsavedChanges: true };
        });
      },

      addReviewComment: (entryId: string, message: string, parentId?: string) => {
        const trimmed = message.trim();
        if (!trimmed) return;

        set((state) => {
          const reviewEntries = new Map(state.reviewEntries);
          const nextEntry = cloneReviewEntry(state.reviewEntries.get(entryId));
          const commentId = crypto.randomUUID();
          const author = getReviewActorName(state.reviewerName);
          const comment: ReviewComment = {
            id: commentId,
            parentId,
            author,
            message: trimmed,
            createdAt: new Date().toISOString(),
          };

          nextEntry.comments.push(comment);
          nextEntry.history.push(
            createReviewHistoryEvent(author, {
              type: 'comment-added',
              field: parentId ? 'reply' : 'comment',
              to: trimmed,
              commentId,
            }),
          );
          commitReviewEntry(reviewEntries, entryId, nextEntry);

          return { reviewEntries, hasUnsavedChanges: true };
        });
      },

      setReviewCommentResolved: (entryId: string, commentId: string, resolved: boolean) => {
        set((state) => {
          const current = state.reviewEntries.get(entryId);
          if (!current) return {};

          let changed = false;
          const actor = getReviewActorName(state.reviewerName);
          const nextEntry = cloneReviewEntry(current);
          nextEntry.comments = nextEntry.comments.map((comment) => {
            if (comment.id !== commentId) return comment;
            const isResolved = Boolean(comment.resolvedAt);
            if (isResolved === resolved) return comment;
            changed = true;
            return {
              ...comment,
              resolvedAt: resolved ? new Date().toISOString() : null,
              resolvedBy: resolved ? actor : null,
            };
          });

          if (!changed) return {};

          nextEntry.history.push(
            createReviewHistoryEvent(actor, {
              type: resolved ? 'comment-resolved' : 'comment-reopened',
              field: 'comment',
              commentId,
            }),
          );

          const reviewEntries = new Map(state.reviewEntries);
          commitReviewEntry(reviewEntries, entryId, nextEntry);
          return { reviewEntries, hasUnsavedChanges: true };
        });
      },

      restoreReviewEntries: (entries: Map<string, ReviewEntryState>) => {
        set((state) => ({
          reviewEntries: new Map(entries),
          hasUnsavedChanges: state.hasUnsavedChanges || entries.size > 0,
        }));
      },

      getReviewEntry: (entryId: string) => {
        return getReviewEntryState(get().reviewEntries, entryId);
      },

      isEntryReviewLocked: (entryId: string) => {
        const state = get();
        const status = getReviewEntryState(state.reviewEntries, entryId).status;
        return isReviewLocked(status, state.lockApprovedEntries);
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

        let filtered = entries;

        // Separate include and exclude filters
        const includeFilters: FilterType[] = [];
        const excludeFilters: FilterType[] = [];

        // Map.forEach callback is (value, key) not (key, value)
        activeFilters.forEach((filterState, filterType) => {
          if (filterState === 'include') {
            includeFilters.push(filterType);
          } else if (filterState === 'exclude') {
            excludeFilters.push(filterType);
          }
        });

        // Apply include filters (OR logic - entry matches if it matches ANY include filter)
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

        // Apply exclude filters (AND logic - entry is excluded if it matches ANY exclude filter)
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

        // Apply search filter (AND with status filters)
        if (filterQuery.trim()) {
          filtered = filtered.filter((entry) =>
            entryMatchesSearch(entry, filterQuery, reviewEntries),
          );
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

              // Preserve current filtered/file order for equal sort keys.
              return a.index - b.index;
            })
            .map(({ entry }) => entry);
        }

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

        // Helper to check if an entry is fully translated (handles plurals)
        const isFullyTranslated = (e: POEntry): boolean => {
          if (e.msgidPlural) {
            // Plural entry - all forms must be filled
            const plurals = e.msgstrPlural ?? [];
            return plurals.length >= 2 && plurals.every((p) => p.trim() !== '');
          }
          return e.msgstr.trim() !== '';
        };

        // Helper to check if an entry is untranslated (any form empty)
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

      /** Check if an entry was manually edited */
      isManuallyEdited: (entryId: string) => {
        return get().manualEditIds.has(entryId);
      },

      /** Get count of entries that would be overwritten by bulk translation */
      getOverwriteWarningCount: () => {
        const { entries, manualEditIds, machineTranslatedIds } = get();
        // Count entries with translations that are either manual edits or have been modified
        // but are NOT currently marked as machine translated
        return entries.filter((e) => {
          const hasTranslation = e.msgstr.trim() !== '';
          const isManual = manualEditIds.has(e.id);
          const isMT = machineTranslatedIds.has(e.id);
          // Entry would be overwritten if it has translation and is manual (not MT)
          return hasTranslation && (isManual || !isMT);
        }).length;
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projectName: state.projectName,
        filename: state.filename,
        sourceFormat: state.sourceFormat,
        header: state.header,
        entries: state.entries,
        dirtyEntryIds: Array.from(state.dirtyEntryIds),
        machineTranslatedIds: Array.from(state.machineTranslatedIds),
        manualEditIds: Array.from(state.manualEditIds),
        visibleColumns: Array.from(state.visibleColumns),
        columnOrder: state.columnOrder,
        sortField: state.sortField,
        sortDirection: state.sortDirection,
        // Serialize Map to array of [key, value] pairs
        machineTranslationMeta:
          state.machineTranslationMeta instanceof Map
            ? Array.from(state.machineTranslationMeta.entries())
            : [],
        reviewEntries:
          state.reviewEntries instanceof Map ? Array.from(state.reviewEntries.entries()) : [],
        reviewerName: state.reviewerName,
        lockApprovedEntries: state.lockApprovedEntries,
        lastSavedAt: state.lastSavedAt,
        hasUnsavedChanges: state.hasUnsavedChanges,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Default sourceFormat for older persisted state
        if (!state.sourceFormat) {
          state.sourceFormat = 'po';
        }

        if (!state.projectName) {
          state.projectName = deriveProjectName(state.header ?? null, state.filename ?? null);
        }

        // Convert dirtyEntryIds array back to Set after rehydration
        if (Array.isArray(state.dirtyEntryIds)) {
          state.dirtyEntryIds = new Set(state.dirtyEntryIds as unknown as string[]);
        } else {
          state.dirtyEntryIds = new Set();
        }

        // Convert machineTranslatedIds array back to Set after rehydration
        if (Array.isArray(state.machineTranslatedIds)) {
          state.machineTranslatedIds = new Set(state.machineTranslatedIds as unknown as string[]);
        } else {
          state.machineTranslatedIds = new Set();
        }

        // Convert manualEditIds array back to Set after rehydration
        if (Array.isArray(state.manualEditIds)) {
          state.manualEditIds = new Set(state.manualEditIds as unknown as string[]);
        } else {
          state.manualEditIds = new Set();
        }

        // Convert machineTranslationMeta array back to Map after rehydration
        // The array format is [[entryId, {usedGlossary, timestamp}], ...]
        if (
          Array.isArray(state.machineTranslationMeta) &&
          state.machineTranslationMeta.length > 0
        ) {
          try {
            const entries = state.machineTranslationMeta as unknown as [
              string,
              MachineTranslationMeta,
            ][];
            // Validate structure before creating Map
            const validEntries = entries.filter(
              (entry) =>
                Array.isArray(entry) &&
                entry.length === 2 &&
                typeof entry[0] === 'string' &&
                entry[1] &&
                typeof entry[1] === 'object',
            );
            state.machineTranslationMeta = new Map(validEntries);
          } catch {
            state.machineTranslationMeta = new Map();
          }
        } else {
          state.machineTranslationMeta = new Map();
        }

        // Initialize activeFilters as empty Set
        state.activeFilters = new Map();

        // Convert visibleColumns array back to Set after rehydration
        if (Array.isArray(state.visibleColumns)) {
          const allowed = new Set<TableColumn>(ALL_TABLE_COLUMNS);
          const columns = (state.visibleColumns as unknown as string[]).filter((column) =>
            allowed.has(column as TableColumn),
          ) as TableColumn[];
          // Append newly-introduced columns that were not in the persisted set
          const missing = ALL_TABLE_COLUMNS.filter((column) => !columns.includes(column));
          state.visibleColumns = new Set(
            columns.length > 0 ? [...columns, ...missing] : ALL_TABLE_COLUMNS,
          );
        } else {
          state.visibleColumns = new Set(ALL_TABLE_COLUMNS);
        }

        // Normalize columnOrder for older persisted state
        if (Array.isArray(state.columnOrder)) {
          const sanitized = (state.columnOrder as unknown as string[]).filter((column) =>
            ALL_TABLE_COLUMNS.includes(column as TableColumn),
          ) as TableColumn[];
          const missing = ALL_TABLE_COLUMNS.filter((column) => !sanitized.includes(column));
          state.columnOrder = [...sanitized, ...missing];
        } else {
          state.columnOrder = [...ALL_TABLE_COLUMNS];
        }

        // Default sort for older persisted state
        state.sortField = state.sortField ?? 'default';
        state.sortDirection = state.sortDirection ?? 'asc';

        // Initialize glossaryAnalysis as empty Map (not persisted, recalculated on demand)
        state.glossaryAnalysis = new Map();
        state.qaReports = new Map();
        state.reviewerName =
          typeof state.reviewerName === 'string' ? state.reviewerName.trim() : '';
        state.lockApprovedEntries = Boolean(state.lockApprovedEntries);

        if (Array.isArray(state.reviewEntries) && state.reviewEntries.length > 0) {
          try {
            const entries = state.reviewEntries as unknown as [string, ReviewEntryState][];
            const validEntries = entries.filter(
              (entry) =>
                Array.isArray(entry) &&
                entry.length === 2 &&
                typeof entry[0] === 'string' &&
                entry[1] &&
                typeof entry[1] === 'object',
            );
            state.reviewEntries = new Map(validEntries);
          } catch {
            state.reviewEntries = new Map();
          }
        } else {
          state.reviewEntries = new Map();
        }

        // Initialize selectedEntryIds as empty Set (not persisted)
        state.selectedEntryIds = new Set();
      },
    },
  ),
);
