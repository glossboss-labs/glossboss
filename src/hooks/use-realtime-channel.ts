/**
 * useRealtimeChannel — manages the Supabase Realtime channel lifecycle
 * for a cloud project editor session.
 *
 * Creates a Presence + Broadcast channel scoped to (projectId, languageId).
 * Handles join/leave, cell locks, entry updates, and review events.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient, isCloudBackendConfigured } from '@/lib/supabase/client';
import {
  createProjectChannel,
  BROADCAST_EVENTS,
  type PresencePayload,
  type CellLockEvent,
  type CellUnlockEvent,
  type EntryUpdatedEvent,
  type ReviewBroadcastEvent,
} from '@/lib/realtime';
import { useCollaborationStore } from '@/stores/collaboration-store';
import { useAuthStore } from '@/stores/auth-store';
import { useEditorStore } from '@/stores/editor-store';

export interface RealtimeChannelHandle {
  isConnected: boolean;
  broadcastLock: (entryId: string) => void;
  broadcastUnlock: (entryId: string) => void;
  broadcastEntryUpdate: (event: Omit<EntryUpdatedEvent, 'userId' | 'timestamp'>) => void;
  broadcastReviewEvent: (event: Omit<ReviewBroadcastEvent, 'userId' | 'timestamp'>) => void;
}

export function useRealtimeChannel(
  projectId: string | undefined,
  languageId: string | undefined,
): RealtimeChannelHandle {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const displayName =
    user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email ?? 'Anonymous';
  const avatarUrl = (user?.user_metadata?.avatar_url as string) ?? null;

  const isConnected = useCollaborationStore((s) => s.channelConnected);

  // Store actions are accessed via getState() rather than selectors because they
  // are only called from event handlers (Presence sync, Broadcast callbacks), not
  // during render. This avoids unnecessary re-renders when unrelated store state
  // changes, and is the recommended Zustand pattern for event-driven callbacks.
  const { setChannelConnected, syncPresence, handleUserLeave, lockCell, unlockCell, reset } =
    useCollaborationStore.getState();

  // Apply remote entry updates directly to the editor store.
  // Uses getState() inside the callback — correct because this runs from a
  // Broadcast event handler, not during React render.
  const applyRemoteEntryUpdate = useCallback((event: EntryUpdatedEvent) => {
    const store = useEditorStore.getState();
    const entry = store.entries.find((e) => e.id === event.entryId);
    if (!entry) return;

    // Apply the update without marking as dirty or triggering review history
    useEditorStore.setState((state) => {
      const updated = state.entries.map((e) => {
        if (e.id !== event.entryId) return e;
        const next = { ...e };
        if (event.msgstr !== undefined) next.msgstr = event.msgstr;
        if (event.msgstrPlural !== undefined) next.msgstrPlural = event.msgstrPlural;
        if (event.flags !== undefined) next.flags = event.flags;
        return next;
      });
      return { entries: updated };
    });
  }, []);

  // Apply remote review events (same getState() rationale as above)
  const applyRemoteReviewEvent = useCallback((event: ReviewBroadcastEvent) => {
    const store = useEditorStore.getState();

    if (event.type === 'status-changed' && event.data.status) {
      // Use the store action so history is recorded
      store.setReviewStatus(event.entryId, event.data.status);
    } else if (event.type === 'comment-added' && event.data.comment) {
      // Directly insert the comment to avoid duplicate IDs
      useEditorStore.setState((state) => {
        const reviewEntries = new Map(state.reviewEntries);
        const existing = reviewEntries.get(event.entryId) ?? {
          status: 'draft' as const,
          comments: [],
          history: [],
        };
        // Avoid duplicates
        if (existing.comments.some((c) => c.id === event.data.comment!.id)) return {};
        reviewEntries.set(event.entryId, {
          ...existing,
          comments: [...existing.comments, event.data.comment!],
        });
        return { reviewEntries, hasUnsavedChanges: true };
      });
    } else if (event.type === 'comment-resolved' && event.data.commentId != null) {
      store.setReviewCommentResolved(
        event.entryId,
        event.data.commentId,
        event.data.resolved ?? true,
      );
    }
  }, []);

  useEffect(() => {
    if (!projectId || !languageId || !userId || !isCloudBackendConfigured()) {
      return;
    }

    const client = getSupabaseClient('Realtime');
    const channel = createProjectChannel(client, { projectId, languageId, userId });
    channelRef.current = channel;

    // ── Presence ─────────────────────────────────────────
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresencePayload>();
      syncPresence(state as Record<string, PresencePayload[]>, userId);
    });

    channel.on('presence', { event: 'leave' }, ({ key }) => {
      if (key && key !== userId) handleUserLeave(key);
    });

    // ── Broadcast ────────────────────────────────────────
    channel.on('broadcast', { event: BROADCAST_EVENTS.CELL_LOCK }, ({ payload }) => {
      const ev = payload as CellLockEvent;
      if (ev.userId !== userId) {
        lockCell(ev.entryId, ev.userId, ev.displayName, ev.timestamp);
      }
    });

    channel.on('broadcast', { event: BROADCAST_EVENTS.CELL_UNLOCK }, ({ payload }) => {
      const ev = payload as CellUnlockEvent;
      if (ev.userId !== userId) {
        unlockCell(ev.entryId);
      }
    });

    channel.on('broadcast', { event: BROADCAST_EVENTS.ENTRY_UPDATED }, ({ payload }) => {
      const ev = payload as EntryUpdatedEvent;
      if (ev.userId !== userId) {
        applyRemoteEntryUpdate(ev);
      }
    });

    channel.on('broadcast', { event: BROADCAST_EVENTS.REVIEW_EVENT }, ({ payload }) => {
      const ev = payload as ReviewBroadcastEvent;
      if (ev.userId !== userId) {
        applyRemoteReviewEvent(ev);
      }
    });

    // ── Subscribe ────────────────────────────────────────
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setChannelConnected(true);
        await channel.track({
          userId,
          displayName,
          avatarUrl,
          activeEntryId: null,
          joinedAt: Date.now(),
        } satisfies PresencePayload);
      }
    });

    return () => {
      channelRef.current = null;
      void client.removeChannel(channel);
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, languageId, userId]);

  // ── Broadcast helpers ──────────────────────────────────

  const broadcastLock = useCallback(
    (entryId: string) => {
      if (!channelRef.current || !userId) return;
      void channelRef.current.send({
        type: 'broadcast',
        event: BROADCAST_EVENTS.CELL_LOCK,
        payload: {
          entryId,
          userId,
          displayName,
          timestamp: Date.now(),
        } satisfies CellLockEvent,
      });
      useCollaborationStore.getState().setLocalLock(entryId);
    },
    [userId, displayName],
  );

  const broadcastUnlock = useCallback(
    (entryId: string) => {
      if (!channelRef.current || !userId) return;
      void channelRef.current.send({
        type: 'broadcast',
        event: BROADCAST_EVENTS.CELL_UNLOCK,
        payload: {
          entryId,
          userId,
          timestamp: Date.now(),
        } satisfies CellUnlockEvent,
      });
      useCollaborationStore.getState().setLocalLock(null);
    },
    [userId],
  );

  const broadcastEntryUpdate = useCallback(
    (event: Omit<EntryUpdatedEvent, 'userId' | 'timestamp'>) => {
      if (!channelRef.current || !userId) return;
      void channelRef.current.send({
        type: 'broadcast',
        event: BROADCAST_EVENTS.ENTRY_UPDATED,
        payload: {
          ...event,
          userId,
          timestamp: Date.now(),
        } satisfies EntryUpdatedEvent,
      });
    },
    [userId],
  );

  const broadcastReviewEvent = useCallback(
    (event: Omit<ReviewBroadcastEvent, 'userId' | 'timestamp'>) => {
      if (!channelRef.current || !userId) return;
      void channelRef.current.send({
        type: 'broadcast',
        event: BROADCAST_EVENTS.REVIEW_EVENT,
        payload: {
          ...event,
          userId,
          timestamp: Date.now(),
        } satisfies ReviewBroadcastEvent,
      });
    },
    [userId],
  );

  return {
    isConnected,
    broadcastLock,
    broadcastUnlock,
    broadcastEntryUpdate,
    broadcastReviewEvent,
  };
}
