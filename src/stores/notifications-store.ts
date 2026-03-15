/**
 * Notifications Store
 *
 * Ephemeral Zustand store for in-app notifications.
 * Fetches from Supabase, patches via realtime, no localStorage.
 */

import { create } from 'zustand';
import type { NotificationRow } from '@/lib/notifications/types';
import {
  listNotifications,
  markAsRead as apiMarkAsRead,
  markAllAsRead as apiMarkAllAsRead,
  deleteNotification as apiDeleteNotification,
} from '@/lib/notifications/api';

export interface NotificationsState {
  notifications: NotificationRow[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

export interface NotificationsActions {
  fetch: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  /** Prepend a notification from realtime. */
  addNotification: (notification: NotificationRow) => void;
  reset: () => void;
}

const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
};

function countUnread(notifications: NotificationRow[]): number {
  return notifications.filter((n) => !n.read_at).length;
}

export const useNotificationsStore = create<NotificationsState & NotificationsActions>()(
  (set, get) => ({
    ...initialState,

    fetch: async () => {
      set({ loading: true, error: null });
      try {
        const notifications = await listNotifications();
        set({ notifications, unreadCount: countUnread(notifications), loading: false });
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Failed to load notifications',
          loading: false,
        });
      }
    },

    markAsRead: async (id: string) => {
      const now = new Date().toISOString();
      // Optimistic update
      set((state) => {
        const notifications = state.notifications.map((n) =>
          n.id === id ? { ...n, read_at: now } : n,
        );
        return { notifications, unreadCount: countUnread(notifications) };
      });
      try {
        await apiMarkAsRead(id);
      } catch {
        // Revert on failure
        void get().fetch();
      }
    },

    markAllAsRead: async () => {
      const now = new Date().toISOString();
      set((state) => ({
        notifications: state.notifications.map((n) => (n.read_at ? n : { ...n, read_at: now })),
        unreadCount: 0,
      }));
      try {
        await apiMarkAllAsRead();
      } catch {
        void get().fetch();
      }
    },

    deleteNotification: async (id: string) => {
      set((state) => {
        const notifications = state.notifications.filter((n) => n.id !== id);
        return { notifications, unreadCount: countUnread(notifications) };
      });
      try {
        await apiDeleteNotification(id);
      } catch {
        void get().fetch();
      }
    },

    addNotification: (notification: NotificationRow) => {
      set((state) => {
        // Avoid duplicates from race between fetch and realtime
        if (state.notifications.some((n) => n.id === notification.id)) return {};
        const notifications = [notification, ...state.notifications];
        return { notifications, unreadCount: countUnread(notifications) };
      });
    },

    reset: () => set({ ...initialState }),
  }),
);
