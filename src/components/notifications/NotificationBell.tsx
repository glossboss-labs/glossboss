/**
 * NotificationBell — bell icon with unread badge that opens a popover dropdown.
 */

import { useState } from 'react';
import { ActionIcon, Indicator, Popover, Tooltip } from '@mantine/core';
import { motion } from 'motion/react';
import { Bell } from 'lucide-react';
import { buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { useNotificationsStore } from '@/stores/notifications-store';
import { NotificationDropdown } from './NotificationDropdown';

export function NotificationBell() {
  const { t } = useTranslation();
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const [opened, setOpened] = useState(false);

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      width={360}
      withinPortal
      shadow="var(--gb-shadow-menu)"
    >
      <Popover.Target>
        <Tooltip label={t('Notifications')}>
          <motion.div {...buttonStates}>
            <Indicator
              size={16}
              label={unreadCount > 0 ? String(unreadCount) : undefined}
              disabled={unreadCount === 0}
              color="red"
              offset={4}
              processing={unreadCount > 0}
            >
              <ActionIcon
                variant="default"
                size="lg"
                onClick={() => setOpened((o) => !o)}
                aria-label={t('Notifications')}
              >
                <Bell size={18} />
              </ActionIcon>
            </Indicator>
          </motion.div>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown
        p={0}
        style={{
          backgroundColor: 'var(--gb-surface-2)',
          borderColor: 'var(--gb-border-subtle)',
        }}
      >
        <NotificationDropdown onClose={() => setOpened(false)} />
      </Popover.Dropdown>
    </Popover>
  );
}
