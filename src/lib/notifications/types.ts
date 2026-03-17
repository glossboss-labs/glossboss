/**
 * Notification types and data payloads.
 *
 * Each notification type has a corresponding data interface
 * stored as JSONB in the `data` column.
 */

export type NotificationType =
  | 'org_invite_received'
  | 'org_invite_accepted'
  | 'project_invite_received'
  | 'project_invite_accepted'
  | 'project_member_added'
  | 'org_member_added'
  | 'review_status_changed'
  | 'review_comment_added'
  | 'strings_updated';

export interface NotificationRow {
  id: string;
  recipient_id: string;
  type: NotificationType;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

// ── Type-safe data payloads ──────────────────────────────────

export interface OrgInviteReceivedData {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  invite_token: string;
  inviter_name: string;
  role: string;
}

export interface OrgInviteAcceptedData {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  accepter_name: string;
  accepter_id: string;
}

export interface ProjectInviteReceivedData {
  project_id: string;
  project_name: string;
  invite_token: string;
  inviter_name: string;
  role: string;
}

export interface ProjectInviteAcceptedData {
  project_id: string;
  project_name: string;
  accepter_name: string;
  accepter_id: string;
}

export interface ProjectMemberAddedData {
  project_id: string;
  project_name: string;
  role: string;
}

export interface OrgMemberAddedData {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role: string;
}

export interface ReviewStatusChangedData {
  project_id: string;
  project_name: string;
  entry_id: string;
  language_id: string;
  msgid: string;
  old_status: string;
  new_status: string;
}

export interface ReviewCommentAddedData {
  project_id: string;
  project_name: string;
  entry_id: string;
  language_id: string;
  msgid: string;
  comment_author: string;
  comment_message: string;
}

export interface StringsUpdatedData {
  project_id: string;
  project_name: string;
  language_id: string;
  locale: string;
  update_count: number;
  updated_by_name: string | null;
}

// ── Notification preferences ───────────────────────────────

/** Per-type channel toggles. */
export interface NotificationChannelPrefs {
  in_app?: boolean;
  email?: boolean;
  push?: boolean;
}

/** All available notification channels. */
export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'push'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** Digest frequency for batched string-update notifications. */
export type DigestFrequency = 'hourly' | 'daily' | 'weekly' | 'off';

/** All notification types that can be configured. */
export const CONFIGURABLE_TYPES: NotificationType[] = [
  'org_invite_received',
  'org_invite_accepted',
  'project_invite_received',
  'project_invite_accepted',
  'project_member_added',
  'org_member_added',
  'review_status_changed',
  'review_comment_added',
  'strings_updated',
];

/** Global notification preferences row. */
export interface NotificationPreferencesRow {
  user_id: string;
  preferences: Partial<Record<NotificationType, NotificationChannelPrefs>>;
  digest_frequency: DigestFrequency;
  created_at: string;
  updated_at: string;
}

/** Per-project notification preferences row. */
export interface ProjectNotificationPreferencesRow {
  id: string;
  user_id: string;
  project_id: string;
  preferences: Partial<Record<NotificationType, NotificationChannelPrefs>>;
  digest_frequency: DigestFrequency | null;
  created_at: string;
  updated_at: string;
}
