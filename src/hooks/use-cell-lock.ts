/**
 * useCellLock — manages lock-on-focus / unlock-on-blur for a single entry.
 *
 * Returns lock state and focus/blur handlers that broadcast lock events
 * via the Realtime channel.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useCollaborationStore } from '@/stores/collaboration-store';
import { useAuthStore } from '@/stores/auth-store';
import type { CellLock } from '@/lib/realtime';

/** Auto-unlock after 30 seconds of inactivity. */
const STALE_LOCK_TIMEOUT_MS = 30_000;

export interface CellLockState {
  /** Whether a remote user holds the lock on this entry. */
  isLockedByRemote: boolean;
  /** The lock owner info (null if not locked by remote). */
  lockOwner: CellLock | null;
  /** Focus handler — broadcasts lock and starts idle timer. */
  onFocus: () => void;
  /** Blur handler — broadcasts unlock and clears idle timer. */
  onBlur: () => void;
}

export function useCellLock(
  entryId: string,
  broadcastLock: (entryId: string) => void,
  broadcastUnlock: (entryId: string) => void,
): CellLockState {
  const userId = useAuthStore((s) => s.user?.id);
  const lock = useCollaborationStore((s) => s.cellLocks.get(entryId));
  const isConnected = useCollaborationStore((s) => s.channelConnected);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLockedByRemote = Boolean(lock && lock.userId !== userId);
  const lockOwner = isLockedByRemote ? lock! : null;

  const clearIdleTimer = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  }, []);

  const onFocus = useCallback(() => {
    if (!isConnected) return;
    broadcastLock(entryId);

    // Start idle timer
    clearIdleTimer();
    idleTimer.current = setTimeout(() => {
      broadcastUnlock(entryId);
    }, STALE_LOCK_TIMEOUT_MS);
  }, [entryId, isConnected, broadcastLock, broadcastUnlock, clearIdleTimer]);

  const onBlur = useCallback(() => {
    if (!isConnected) return;
    clearIdleTimer();
    broadcastUnlock(entryId);
  }, [entryId, isConnected, broadcastUnlock, clearIdleTimer]);

  // Cleanup timer on unmount
  useEffect(() => clearIdleTimer, [clearIdleTimer]);

  return { isLockedByRemote, lockOwner, onFocus, onBlur };
}
