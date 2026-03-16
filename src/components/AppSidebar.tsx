/**
 * AppSidebar — persistent left sidebar for cloud pages (Vercel-style).
 *
 * Collapsible: 220px expanded (icon + label), 56px collapsed (icon only).
 * Collapse state persisted in localStorage. On mobile, hidden by default
 * and toggled via the AppShell burger.
 */

import { Link, useLocation } from 'react-router';
import {
  Stack,
  Tooltip,
  UnstyledButton,
  Text,
  Group,
  Divider,
  ActionIcon,
  Box,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import {
  Sun,
  Moon,
  LayoutDashboard,
  Globe,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useAuth } from '@/hooks/use-auth';
import { UserMenu } from '@/components/auth/UserMenu';
import { NotificationBell } from '@/components/notifications';

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
}

function NavItem({ to, icon, label, active, collapsed }: NavItemProps) {
  const button = (
    <UnstyledButton
      component={Link}
      to={to}
      py={8}
      px={collapsed ? 0 : 12}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10,
        borderRadius: 'var(--mantine-radius-sm)',
        color: active ? 'var(--gb-text-primary)' : 'var(--gb-text-secondary)',
        backgroundColor: active ? 'var(--gb-highlight-row)' : 'transparent',
        transition: 'background-color 120ms ease, color 120ms ease',
        width: '100%',
        textDecoration: 'none',
      }}
      mod={{ active }}
      styles={{
        root: {
          '&:hover': {
            backgroundColor: 'var(--gb-highlight-row)',
            color: 'var(--gb-text-primary)',
          },
        },
      }}
    >
      <Box style={{ flexShrink: 0, lineHeight: 0 }}>{icon}</Box>
      {!collapsed && (
        <Text size="sm" fw={active ? 600 : 400}>
          {label}
        </Text>
      )}
    </UnstyledButton>
  );

  if (collapsed) {
    return (
      <Tooltip label={label} position="right" withArrow>
        {button}
      </Tooltip>
    );
  }

  return button;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const pathname = location.pathname;

  return (
    <Stack justify="space-between" h="100%" py="sm" px={collapsed ? 'xs' : 'sm'}>
      {/* Top section */}
      <Stack gap={4}>
        {/* Logo + collapse toggle */}
        <Group
          justify={collapsed ? 'center' : 'space-between'}
          align="center"
          mb="xs"
          px={collapsed ? 0 : 4}
        >
          {!collapsed && (
            <Link
              to="/dashboard"
              style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
            >
              <img
                src={
                  computedColorScheme === 'dark'
                    ? '/glossboss-combined-light.svg'
                    : '/glossboss-combined-dark.svg'
                }
                alt="GlossBoss"
                style={{ height: 24, display: 'block' }}
              />
            </Link>
          )}
          {collapsed && (
            <Link
              to="/dashboard"
              style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
            >
              <img
                src={
                  computedColorScheme === 'dark'
                    ? '/glossboss-icon-light.svg'
                    : '/glossboss-icon-dark.svg'
                }
                alt="GlossBoss"
                style={{ height: 24, display: 'block' }}
                onError={(e) => {
                  // Fallback to combined logo if icon variant doesn't exist
                  (e.target as HTMLImageElement).src =
                    computedColorScheme === 'dark'
                      ? '/glossboss-combined-light.svg'
                      : '/glossboss-combined-dark.svg';
                  (e.target as HTMLImageElement).style.height = '20px';
                }}
              />
            </Link>
          )}
          <Tooltip label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')} position="right">
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={onToggle}>
              {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            </ActionIcon>
          </Tooltip>
        </Group>

        <Divider />

        {/* Navigation */}
        <Stack gap={2} mt="xs">
          <NavItem
            to="/dashboard"
            icon={<LayoutDashboard size={18} />}
            label={t('Dashboard')}
            active={pathname === '/dashboard'}
            collapsed={collapsed}
          />
          <NavItem
            to="/explore"
            icon={<Globe size={18} />}
            label={t('Explore')}
            active={pathname === '/explore'}
            collapsed={collapsed}
          />
        </Stack>
      </Stack>

      {/* Bottom section */}
      <Stack gap={4}>
        <Divider />
        <Stack gap={2} mt="xs">
          <NavItem
            to="/settings"
            icon={<Settings size={18} />}
            label={t('Settings')}
            active={pathname.startsWith('/settings')}
            collapsed={collapsed}
          />
        </Stack>

        {/* Controls row */}
        <Group justify={collapsed ? 'center' : 'space-between'} gap="xs" px={collapsed ? 0 : 4}>
          {isAuthenticated && <NotificationBell />}
          <Tooltip label={computedColorScheme === 'dark' ? t('Light mode') : t('Dark mode')}>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={toggleColorScheme}>
              {computedColorScheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </ActionIcon>
          </Tooltip>
          {!collapsed && <UserMenu />}
          {collapsed && <UserMenu />}
        </Group>
      </Stack>
    </Stack>
  );
}
