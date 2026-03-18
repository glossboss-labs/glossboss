/**
 * Editor Store
 *
 * Zustand store for PO editor state with localStorage persistence.
 * Composes entries, selection, and review slices into a single store.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getStorageAdapter } from '@/lib/cloud';
import { deriveProjectName } from '@/lib/translation-memory';
import { STORAGE_KEY } from '@/lib/storage';
import type { ReviewEntryState } from '@/lib/review';
import {
  createEditorEntriesSlice,
  ALL_TABLE_COLUMNS,
  type EditorEntriesSlice,
  type MachineTranslationMeta,
  type TableColumn,
} from './editor-entries-slice';
import { createEditorSelectionSlice, type EditorSelectionSlice } from './editor-selection-slice';
import { createEditorReviewSlice, type EditorReviewSlice } from './editor-review-slice';

// ---------------------------------------------------------------------------
// Re-exports — preserve the public API
// ---------------------------------------------------------------------------

export type {
  FilterType,
  FilterState,
  TableColumn,
  SortField,
  SortDirection,
  MachineTranslationMeta,
  FileFormat,
} from './editor-entries-slice';

export type { EditorSelectionState, EditorSelectionActions } from './editor-selection-slice';
export type { EditorReviewState, EditorReviewActions } from './editor-review-slice';

/** Combined state and actions — the full store type. */
export type EditorState = EditorEntriesSlice & EditorSelectionSlice & EditorReviewSlice;
export type EditorActions = Record<string, never>; // All actions live on slices now

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useEditorStore = create<
  EditorEntriesSlice & EditorSelectionSlice & EditorReviewSlice
>()(
  persist(
    (...a) => ({
      ...createEditorEntriesSlice(...a),
      ...createEditorSelectionSlice(...a),
      ...createEditorReviewSlice(...a),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => getStorageAdapter()),
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
        if (
          Array.isArray(state.machineTranslationMeta) &&
          state.machineTranslationMeta.length > 0
        ) {
          try {
            const entries = state.machineTranslationMeta as unknown as [
              string,
              MachineTranslationMeta,
            ][];
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

        // Initialize activeFilters as empty Map
        state.activeFilters = new Map();

        // Convert visibleColumns array back to Set after rehydration
        if (Array.isArray(state.visibleColumns)) {
          const allowed = new Set<TableColumn>(ALL_TABLE_COLUMNS);
          const columns = (state.visibleColumns as unknown as string[]).filter((column) =>
            allowed.has(column as TableColumn),
          ) as TableColumn[];
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
