/**
 * Notifications API
 *
 * Supabase CRUD operations for the notifications table.
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import type { NotificationRow } from './types';

function supabase() {
  return getSupabaseClient('Notifications');
}

const NOTIFICATIONS_LIMIT = 50;

export async function listNotifications(): Promise<NotificationRow[]> {
  const { data, error } = await supabase()
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(NOTIFICATIONS_LIMIT);

  if (error) throw error;
  return (data as NotificationRow[]) ?? [];
}

export async function markAsRead(id: string): Promise<void> {
  const { error } = await supabase()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function markAllAsRead(): Promise<void> {
  const { error } = await supabase()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase().from('notifications').delete().eq('id', id);

  if (error) throw error;
}
