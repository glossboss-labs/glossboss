import { msgid } from '@/lib/app-language';

export type ReviewStatus = 'draft' | 'in-review' | 'approved' | 'needs-changes';

export interface ReviewComment {
  id: string;
  parentId?: string;
  author: string;
  message: string;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

export type ReviewHistoryEventType =
  | 'translation-updated'
  | 'review-status-changed'
  | 'comment-added'
  | 'comment-resolved'
  | 'comment-reopened';

export interface ReviewHistoryEvent {
  id: string;
  type: ReviewHistoryEventType;
  actor: string;
  createdAt: string;
  field?: string;
  from?: string | null;
  to?: string | null;
  commentId?: string;
}

export interface ReviewEntryState {
  status: ReviewStatus;
  comments: ReviewComment[];
  history: ReviewHistoryEvent[];
}

export interface ReviewSummary {
  total: number;
  draft: number;
  inReview: number;
  approved: number;
  needsChanges: number;
  unresolvedComments: number;
  changedEntries: number;
  readyToExport: boolean;
}

export const DEFAULT_REVIEWER_NAME = msgid('Current editor');

export function createDefaultReviewEntryState(): ReviewEntryState {
  return {
    status: 'draft',
    comments: [],
    history: [],
  };
}

export function getReviewEntryState(
  entries: Map<string, ReviewEntryState>,
  entryId: string,
): ReviewEntryState {
  return entries.get(entryId) ?? createDefaultReviewEntryState();
}

export function hasUnresolvedReviewComments(entry: ReviewEntryState | undefined | null): boolean {
  if (!entry) return false;
  return entry.comments.some((comment) => !comment.resolvedAt);
}

export function getChangedReviewEntryCount(entries: Map<string, ReviewEntryState>): number {
  let count = 0;

  entries.forEach((entry) => {
    if (entry.history.some((event) => event.type === 'translation-updated')) {
      count += 1;
    }
  });

  return count;
}

export function isReviewLocked(status: ReviewStatus, lockApprovedEntries: boolean): boolean {
  return lockApprovedEntries && status === 'approved';
}
