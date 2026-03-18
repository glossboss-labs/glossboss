/**
 * TanStack Query hooks for notifications.
 *
 * The notifications store remains the primary state holder for real-time
 * updates (optimistic mark-as-read, realtime inserts). This query hook
 * wraps the initial list fetch for components that prefer TanStack Query.
 */

import { useQuery } from '@tanstack/react-query';
import { listNotifications } from './api';
import { getNotificationPreferences } from './preferences-api';
import type { NotificationRow } from './types';
import type { NotificationPreferencesRow } from './types';

// ── Query key factory ────────────────────────────────────────

export const notificationKeys = {
  all: ['notifications'] as const,
  preferences: ['notifications', 'preferences'] as const,
};

// ── Query hooks ──────────────────────────────────────────────

export function useNotificationsQuery() {
  return useQuery<NotificationRow[]>({
    queryKey: notificationKeys.all,
    queryFn: listNotifications,
  });
}

export function useNotificationPreferences() {
  return useQuery<NotificationPreferencesRow | null>({
    queryKey: notificationKeys.preferences,
    queryFn: getNotificationPreferences,
  });
}
