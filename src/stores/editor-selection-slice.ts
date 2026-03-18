/**
 * Editor Selection Slice
 *
 * Selection state, range selection, select all, clear.
 */

import type { StateCreator } from 'zustand';
import type { EditorEntriesSlice } from './editor-entries-slice';
import type { EditorReviewSlice } from './editor-review-slice';

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

export interface EditorSelectionState {
  /** Currently selected entry ID */
  selectedEntryId: string | null;

  /** IDs of entries selected for bulk operations */
  selectedEntryIds: Set<string>;
}

export interface EditorSelectionActions {
  selectEntry: (entryId: string | null) => void;
  toggleEntrySelection: (entryId: string) => void;
  setEntrySelection: (entryId: string, selected: boolean) => void;
  setSelectedEntries: (entryIds: string[]) => void;
  clearSelectedEntries: () => void;
}

export type EditorSelectionSlice = EditorSelectionState & EditorSelectionActions;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const selectionInitialState: EditorSelectionState = {
  selectedEntryId: null,
  selectedEntryIds: new Set(),
};

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

type FullStore = EditorEntriesSlice & EditorSelectionSlice & EditorReviewSlice;

export const createEditorSelectionSlice: StateCreator<FullStore, [], [], EditorSelectionSlice> = (
  set,
) => ({
  ...selectionInitialState,

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
});
