/**
 * NotificationItem — single notification row in the dropdown.
 *
 * Renders an icon, message, and relative time based on notification type.
 * Clicking marks the notification as read and navigates to the relevant page.
 */

import { Group, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { useNavigate } from 'react-router';
import {
  UserPlus,
  UserCheck,
  Users,
  FileCheck,
  MessageSquare,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { formatRelativeTime } from '@/lib/notifications/format';
import { useNotificationsStore } from '@/stores/notifications-store';
import type {
  NotificationRow,
  NotificationType,
  OrgInviteReceivedData,
  OrgInviteAcceptedData,
  ProjectInviteReceivedData,
  ProjectInviteAcceptedData,
  ProjectMemberAddedData,
  OrgMemberAddedData,
  ReviewStatusChangedData,
  ReviewCommentAddedData,
  StringsUpdatedData,
} from '@/lib/notifications/types';

const iconMap: Record<NotificationType, LucideIcon> = {
  org_invite_received: UserPlus,
  org_invite_accepted: UserCheck,
  project_invite_received: UserPlus,
  project_invite_accepted: UserCheck,
  project_member_added: Users,
  org_member_added: Users,
  review_status_changed: FileCheck,
  review_comment_added: MessageSquare,
  strings_updated: FileText,
};

function getNotificationLink(n: NotificationRow): string {
  const d = n.data as Record<string, string>;
  switch (n.type) {
    case 'org_invite_received':
      return `/invite/${(n.data as OrgInviteReceivedData).invite_token}`;
    case 'project_invite_received':
      return `/invite/project/${(n.data as ProjectInviteReceivedData).invite_token}`;
    case 'org_invite_accepted':
    case 'org_member_added':
      return `/orgs/${d.organization_slug || ''}`;
    case 'project_invite_accepted':
    case 'project_member_added':
      return `/projects/${d.project_id || ''}`;
    case 'review_status_changed':
    case 'review_comment_added':
      return `/projects/${d.project_id || ''}/languages/${d.language_id || ''}`;
    case 'strings_updated':
      return `/projects/${d.project_id || ''}/languages/${d.language_id || ''}`;
    default:
      return '/dashboard';
  }
}

function useNotificationMessage(n: NotificationRow): string {
  const { t } = useTranslation();
  switch (n.type) {
    case 'org_invite_received': {
      const d = n.data as OrgInviteReceivedData;
      return t('{{name}} invited you to {{org}}', {
        name: d.inviter_name,
        org: d.organization_name,
      });
    }
    case 'org_invite_accepted': {
      const d = n.data as OrgInviteAcceptedData;
      return t('{{name}} joined {{org}}', {
        name: d.accepter_name,
        org: d.organization_name,
      });
    }
    case 'project_invite_received': {
      const d = n.data as ProjectInviteReceivedData;
      return t('{{name}} invited you to {{project}}', {
        name: d.inviter_name,
        project: d.project_name,
      });
    }
    case 'project_invite_accepted': {
      const d = n.data as ProjectInviteAcceptedData;
      return t('{{name}} joined {{project}}', {
        name: d.accepter_name,
        project: d.project_name,
      });
    }
    case 'project_member_added': {
      const d = n.data as ProjectMemberAddedData;
      return t('You were added to {{project}}', { project: d.project_name });
    }
    case 'org_member_added': {
      const d = n.data as OrgMemberAddedData;
      return t('You were added to {{org}}', { org: d.organization_name });
    }
    case 'review_status_changed': {
      const d = n.data as ReviewStatusChangedData;
      return t('Review status changed to {{status}} on "{{msgid}}"', {
        status: d.new_status,
        msgid: d.msgid.length > 40 ? d.msgid.slice(0, 40) + '...' : d.msgid,
      });
    }
    case 'review_comment_added': {
      const d = n.data as ReviewCommentAddedData;
      return t('{{author}} commented on "{{msgid}}"', {
        author: d.comment_author,
        msgid: d.msgid.length > 40 ? d.msgid.slice(0, 40) + '...' : d.msgid,
      });
    }
    case 'strings_updated': {
      const d = n.data as StringsUpdatedData;
      return t('{{count}} strings updated in {{project}} ({{locale}})', {
        count: d.update_count,
        project: d.project_name,
        locale: d.locale,
      });
    }
    default:
      return t('New notification');
  }
}

interface NotificationItemProps {
  notification: NotificationRow;
  onClose: () => void;
}

export function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const navigate = useNavigate();
  const markAsRead = useNotificationsStore((s) => s.markAsRead);
  const message = useNotificationMessage(notification);
  const Icon = iconMap[notification.type] || Users;
  const isUnread = !notification.read_at;

  const handleClick = () => {
    if (isUnread) void markAsRead(notification.id);
    onClose();
    navigate(getNotificationLink(notification));
  };

  return (
    <UnstyledButton
      onClick={handleClick}
      py={8}
      px="sm"
      style={{
        display: 'block',
        width: '100%',
        borderRadius: 'var(--mantine-radius-sm)',
        backgroundColor: isUnread ? 'var(--gb-highlight-row)' : 'transparent',
        transition: 'background-color 120ms ease',
      }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <ThemeIcon
          variant="light"
          size="md"
          color={isUnread ? 'blue' : 'gray'}
          style={{ flexShrink: 0, marginTop: 2 }}
        >
          <Icon size={14} />
        </ThemeIcon>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" lineClamp={2} style={{ lineHeight: 1.4 }}>
            {message}
          </Text>
          <Text size="xs" c="dimmed" mt={2}>
            {formatRelativeTime(notification.created_at)}
          </Text>
        </div>
      </Group>
    </UnstyledButton>
  );
}
