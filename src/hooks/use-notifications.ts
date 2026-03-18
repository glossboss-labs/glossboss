/**
 * useNotifications
 *
 * Fetches notifications on mount and subscribes to new ones
 * via Supabase Realtime postgres_changes.
 */

import { useEffect } from 'react';
import { getSupabaseClient, isCloudBackendConfigured } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationsStore } from '@/stores/notifications-store';
import type { NotificationRow } from '@/lib/notifications/types';

export function useNotifications() {
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId || !isCloudBackendConfigured()) return;

    // Access store methods via getState() so they don't need to be in the
    // dependency array — these are stable references on the store object,
    // but subscribing to them via selectors would cause unnecessary re-renders.
    const { fetch, addNotification, reset } = useNotificationsStore.getState();

    // Initial fetch
    void fetch();

    // Subscribe to new notifications via postgres_changes
    const client = getSupabaseClient('Notifications');
    const channel = client
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          addNotification(payload.new as NotificationRow);
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
      reset();
    };
  }, [userId]);
}
