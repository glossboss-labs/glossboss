/**
 * Editor Review Slice
 *
 * Review state, comments, QA validation, review locking.
 */

import type { StateCreator } from 'zustand';
import {
  getReviewEntryState,
  isReviewLocked,
  type ReviewComment,
  type ReviewEntryState,
  type ReviewStatus,
} from '@/lib/review';
import type { EditorEntriesSlice } from './editor-entries-slice';
import {
  cloneReviewEntry,
  commitReviewEntry,
  createReviewHistoryEvent,
  getReviewActorName,
} from './editor-entries-slice';
import type { EditorSelectionSlice } from './editor-selection-slice';

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

export interface EditorReviewState {
  /** Review workflow metadata keyed by entry ID */
  reviewEntries: Map<string, ReviewEntryState>;

  /** Display name used for review comments and history */
  reviewerName: string;

  /** Whether approved strings should be locked until reopened */
  lockApprovedEntries: boolean;
}

export interface EditorReviewActions {
  setReviewerName: (name: string) => void;
  setLockApprovedEntries: (enabled: boolean) => void;
  setReviewStatus: (entryId: string, status: ReviewStatus) => void;
  addReviewComment: (entryId: string, message: string, parentId?: string) => void;
  setReviewCommentResolved: (entryId: string, commentId: string, resolved: boolean) => void;
  restoreReviewEntries: (entries: Map<string, ReviewEntryState>) => void;
  getReviewEntry: (entryId: string) => ReviewEntryState;
  isEntryReviewLocked: (entryId: string) => boolean;
}

export type EditorReviewSlice = EditorReviewState & EditorReviewActions;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const reviewInitialState: EditorReviewState = {
  reviewEntries: new Map(),
  reviewerName: '',
  lockApprovedEntries: false,
};

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

type FullStore = EditorEntriesSlice & EditorSelectionSlice & EditorReviewSlice;

export const createEditorReviewSlice: StateCreator<FullStore, [], [], EditorReviewSlice> = (
  set,
  get,
) => ({
  ...reviewInitialState,

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
});
