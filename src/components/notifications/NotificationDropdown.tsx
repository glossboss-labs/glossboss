/**
 * NotificationDropdown — content rendered inside the bell popover.
 *
 * Shows a scrollable list of recent notifications with a "Mark all read" action.
 */

import { Button, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { CheckCheck } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useNotificationsStore } from '@/stores/notifications-store';
import { NotificationItem } from './NotificationItem';

interface NotificationDropdownProps {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { t } = useTranslation();
  const notifications = useNotificationsStore((s) => s.notifications);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const markAllAsRead = useNotificationsStore((s) => s.markAllAsRead);

  return (
    <Stack gap={0} style={{ width: 340 }}>
      {/* Header */}
      <Group justify="space-between" px="sm" py="xs">
        <Text fw={600} size="sm">
          {t('Notifications')}
        </Text>
        {unreadCount > 0 && (
          <Button
            variant="subtle"
            size="compact-xs"
            leftSection={<CheckCheck size={14} />}
            onClick={() => void markAllAsRead()}
          >
            {t('Mark all read')}
          </Button>
        )}
      </Group>

      {/* List */}
      {notifications.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="xl" px="sm">
          {t('No notifications')}
        </Text>
      ) : (
        <ScrollArea.Autosize mah={360} type="auto" offsetScrollbars>
          <Stack gap={2} px={4} pb="xs">
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onClose={onClose} />
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}
    </Stack>
  );
}
