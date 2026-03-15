/**
 * UserMenu — avatar + dropdown for signed-in users.
 * Shows sign-in link when not authenticated.
 * Includes settings, about links, and sign out.
 */

import { Link } from 'react-router';
import { Menu, Avatar, ActionIcon, Tooltip, UnstyledButton, Group, Text } from '@mantine/core';
import {
  LogIn,
  LogOut,
  User,
  Settings,
  ExternalLink,
  Info,
  MessageSquare,
  Home,
} from 'lucide-react';
import { motion } from 'motion/react';
import { buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';

export function UserMenu() {
  const { t } = useTranslation();
  const { user, isAuthenticated, loading } = useAuth();
  const signOut = useAuthStore((s) => s.signOut);

  if (loading) return null;

  if (!isAuthenticated) {
    return (
      <Tooltip label={t('Sign in')}>
        <motion.div {...buttonStates}>
          <ActionIcon
            variant="default"
            size="lg"
            component={Link}
            to="/login"
            aria-label={t('Sign in')}
          >
            <LogIn size={18} />
          </ActionIcon>
        </motion.div>
      </Tooltip>
    );
  }

  const displayName = user?.user_metadata?.full_name || user?.email || '';
  const avatarUrl = user?.user_metadata?.avatar_url;
  const initials = displayName
    .split(/\s+/)
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <motion.div {...buttonStates}>
          <UnstyledButton>
            <Group gap={8}>
              <Avatar src={avatarUrl} size={28} radius="sm" color="blue">
                {initials}
              </Avatar>
            </Group>
          </UnstyledButton>
        </motion.div>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          <Group gap={6}>
            <User size={12} />
            <Text size="xs" truncate style={{ maxWidth: 180 }}>
              {displayName}
            </Text>
          </Group>
        </Menu.Label>

        <Menu.Divider />

        <Menu.Item component={Link} to="/" leftSection={<Home size={14} />}>
          {t('Local editor')}
        </Menu.Item>
        <Menu.Item component={Link} to="/settings" leftSection={<Settings size={14} />}>
          {t('Settings')}
        </Menu.Item>
        <Menu.Item
          component="a"
          href="https://github.com/glossboss-labs/glossboss/issues"
          target="_blank"
          rel="noopener noreferrer"
          leftSection={<MessageSquare size={14} />}
        >
          {t('Share feedback')}
        </Menu.Item>

        <Menu.Divider />

        <Menu.Label>{t('GlossBoss v{version}', { version: __APP_VERSION__ })}</Menu.Label>
        <Menu.Item
          component="a"
          href="https://github.com/glossboss-labs/glossboss"
          target="_blank"
          rel="noopener noreferrer"
          leftSection={<ExternalLink size={14} />}
        >
          {t('Source')}
        </Menu.Item>
        <Menu.Item
          component="a"
          href="/license/"
          target="_blank"
          rel="noopener noreferrer"
          leftSection={<Info size={14} />}
        >
          {t('License')}
        </Menu.Item>
        <Menu.Item
          component="a"
          href="/privacy/"
          target="_blank"
          rel="noopener noreferrer"
          leftSection={<Info size={14} />}
        >
          {t('Privacy')}
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item color="red" leftSection={<LogOut size={14} />} onClick={signOut}>
          {t('Sign out')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
