/**
 * Realtime collaboration type definitions.
 *
 * All broadcast payloads and presence types used by the
 * project-level Supabase Realtime channel.
 */

import type { ReviewComment, ReviewStatus } from '@/lib/review';

// ── Presence ───────────────────────────────────────────────

export interface PresencePayload {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  activeEntryId: string | null;
  joinedAt: number;
}

export interface PresenceUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  activeEntryId: string | null;
  color: string;
  joinedAt: number;
}

// ── Broadcast events ───────────────────────────────────────

export interface CellLockEvent {
  entryId: string;
  userId: string;
  displayName: string;
  timestamp: number;
}

export interface CellUnlockEvent {
  entryId: string;
  userId: string;
  timestamp: number;
}

export interface EntryUpdatedEvent {
  entryId: string;
  userId: string;
  msgstr?: string;
  msgstrPlural?: string[];
  flags?: string[];
  timestamp: number;
}

export type ReviewBroadcastType = 'status-changed' | 'comment-added' | 'comment-resolved';

export interface ReviewBroadcastEvent {
  entryId: string;
  userId: string;
  displayName: string;
  type: ReviewBroadcastType;
  data: {
    status?: ReviewStatus;
    comment?: ReviewComment;
    commentId?: string;
    resolved?: boolean;
  };
  timestamp: number;
}

// ── Cell lock state ────────────────────────────────────────

export interface CellLock {
  userId: string;
  displayName: string;
  color: string;
  lockedAt: number;
}

// ── Broadcast event names ──────────────────────────────────

export const BROADCAST_EVENTS = {
  CELL_LOCK: 'cell:lock',
  CELL_UNLOCK: 'cell:unlock',
  ENTRY_UPDATED: 'entry:updated',
  REVIEW_EVENT: 'review:event',
} as const;
