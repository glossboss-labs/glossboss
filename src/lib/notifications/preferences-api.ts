/**
 * Notification Preferences API
 *
 * CRUD for global and per-project notification preferences.
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import type {
  NotificationPreferencesRow,
  ProjectNotificationPreferencesRow,
  NotificationChannelPrefs,
  NotificationType,
  DigestFrequency,
} from './types';

function supabase() {
  return getSupabaseClient('Notifications');
}

async function getUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase().auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// ── Global preferences ─────────────────────────────────────

export async function getNotificationPreferences(): Promise<NotificationPreferencesRow | null> {
  const userId = await getUserId();

  const { data, error } = await supabase()
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as NotificationPreferencesRow | null;
}

export async function upsertNotificationPreferences(
  preferences: Partial<Record<NotificationType, NotificationChannelPrefs>>,
  digestFrequency: DigestFrequency,
): Promise<void> {
  const userId = await getUserId();

  const { error } = await supabase().from('notification_preferences').upsert(
    {
      user_id: userId,
      preferences,
      digest_frequency: digestFrequency,
    },
    { onConflict: 'user_id' },
  );

  if (error) throw error;
}

// ── Per-project preferences ────────────────────────────────

export async function getProjectNotificationPreferences(
  projectId: string,
): Promise<ProjectNotificationPreferencesRow | null> {
  const userId = await getUserId();

  const { data, error } = await supabase()
    .from('project_notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw error;
  return data as ProjectNotificationPreferencesRow | null;
}

export async function upsertProjectNotificationPreferences(
  projectId: string,
  preferences: Partial<Record<NotificationType, NotificationChannelPrefs>>,
  digestFrequency: DigestFrequency | null,
): Promise<void> {
  const userId = await getUserId();

  const { error } = await supabase().from('project_notification_preferences').upsert(
    {
      user_id: userId,
      project_id: projectId,
      preferences,
      digest_frequency: digestFrequency,
    },
    { onConflict: 'user_id,project_id' },
  );

  if (error) throw error;
}

export async function deleteProjectNotificationPreferences(projectId: string): Promise<void> {
  const { error } = await supabase()
    .from('project_notification_preferences')
    .delete()
    .eq('project_id', projectId);

  if (error) throw error;
}
