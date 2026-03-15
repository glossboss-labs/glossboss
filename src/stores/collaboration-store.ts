/**
 * Collaboration Store
 *
 * Non-persisted Zustand store for real-time collaboration state.
 * Tracks online users, cell locks, and channel connection status.
 * This store is purely ephemeral — nothing is written to localStorage or Supabase.
 */

import { create } from 'zustand';
import type { CellLock, PresenceUser } from '@/lib/realtime';
import { getUserColor } from '@/lib/realtime';
import type { PresencePayload } from '@/lib/realtime';

export interface CollaborationState {
  /** Whether the Realtime channel is connected. */
  channelConnected: boolean;

  /** Currently online users (excluding the local user). */
  onlineUsers: Map<string, PresenceUser>;

  /** Active cell locks keyed by entry ID. */
  cellLocks: Map<string, CellLock>;

  /** Entry ID currently locked by the local user. */
  localLockEntryId: string | null;
}

export interface CollaborationActions {
  setChannelConnected: (connected: boolean) => void;

  /** Full presence sync — replaces the entire onlineUsers map. */
  syncPresence: (presences: Record<string, PresencePayload[]>, localUserId: string) => void;

  /** Handle a single user joining. */
  handleUserJoin: (payload: PresencePayload) => void;

  /** Handle a single user leaving — removes them and their locks. */
  handleUserLeave: (userId: string) => void;

  /** Lock a cell for a remote user. */
  lockCell: (entryId: string, userId: string, displayName: string, timestamp: number) => void;

  /** Unlock a cell. */
  unlockCell: (entryId: string) => void;

  /** Track what the local user has locked. */
  setLocalLock: (entryId: string | null) => void;

  /** Clear all state (on disconnect or unmount). */
  reset: () => void;
}

const initialState: CollaborationState = {
  channelConnected: false,
  onlineUsers: new Map(),
  cellLocks: new Map(),
  localLockEntryId: null,
};

export const useCollaborationStore = create<CollaborationState & CollaborationActions>()((set) => ({
  ...initialState,

  setChannelConnected: (connected) => set({ channelConnected: connected }),

  syncPresence: (presences, localUserId) => {
    const users = new Map<string, PresenceUser>();
    for (const [key, payloads] of Object.entries(presences)) {
      if (key === localUserId) continue;
      const payload = payloads[0];
      if (!payload) continue;
      users.set(key, {
        userId: payload.userId,
        displayName: payload.displayName,
        avatarUrl: payload.avatarUrl,
        activeEntryId: payload.activeEntryId,
        color: getUserColor(payload.userId),
        joinedAt: payload.joinedAt,
      });
    }
    set({ onlineUsers: users });
  },

  handleUserJoin: (payload) =>
    set((state) => {
      const users = new Map(state.onlineUsers);
      users.set(payload.userId, {
        userId: payload.userId,
        displayName: payload.displayName,
        avatarUrl: payload.avatarUrl,
        activeEntryId: payload.activeEntryId,
        color: getUserColor(payload.userId),
        joinedAt: payload.joinedAt,
      });
      return { onlineUsers: users };
    }),

  handleUserLeave: (userId) =>
    set((state) => {
      const users = new Map(state.onlineUsers);
      users.delete(userId);

      // Remove any locks held by this user
      const locks = new Map(state.cellLocks);
      for (const [entryId, lock] of locks) {
        if (lock.userId === userId) locks.delete(entryId);
      }

      return { onlineUsers: users, cellLocks: locks };
    }),

  lockCell: (entryId, userId, displayName, timestamp) =>
    set((state) => {
      const existing = state.cellLocks.get(entryId);
      // Ignore stale events
      if (existing && existing.lockedAt > timestamp) return {};

      const locks = new Map(state.cellLocks);
      locks.set(entryId, {
        userId,
        displayName,
        color: getUserColor(userId),
        lockedAt: timestamp,
      });
      return { cellLocks: locks };
    }),

  unlockCell: (entryId) =>
    set((state) => {
      if (!state.cellLocks.has(entryId)) return {};
      const locks = new Map(state.cellLocks);
      locks.delete(entryId);
      return { cellLocks: locks };
    }),

  setLocalLock: (entryId) => set({ localLockEntryId: entryId }),

  reset: () => set({ ...initialState }),
}));
