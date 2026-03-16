/**
 * AppSidebar — persistent left sidebar for all pages (Vercel-style).
 *
 * Collapsible: 220px expanded (icon + label), 56px collapsed (icon only).
 * Collapse state persisted in localStorage. On mobile, hidden by default
 * and toggled via the AppShell burger.
 *
 * Contains all primary navigation + user controls — no need for an avatar
 * dropdown menu to duplicate these.
 */

import { useState } from 'react';
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
  Avatar,
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
  FileText,
  MessageSquare,
  LogIn,
  LogOut,
} from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { NotificationBell } from '@/components/notifications';
import { PlanBadge } from '@/components/billing/PlanBadge';
import { useSubscription } from '@/hooks/use-subscription';
import { FeedbackModal } from '@/components/feedback';

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItemProps {
  to?: string;
  href?: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed: boolean;
  onClick?: () => void;
  color?: string;
}

function NavItem({ to, href, icon, label, active, collapsed, onClick, color }: NavItemProps) {
  const commonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'flex-start',
    gap: 10,
    borderRadius: 'var(--mantine-radius-sm)',
    color: color ?? (active ? 'var(--gb-text-primary)' : 'var(--gb-text-secondary)'),
    backgroundColor: active ? 'var(--gb-highlight-row)' : 'transparent',
    transition: 'background-color 120ms ease, color 120ms ease',
    width: '100%',
    textDecoration: 'none',
  } as const;

  const hoverStyles = {
    root: {
      '&:hover': {
        backgroundColor: 'var(--gb-highlight-row)',
        color: color ?? 'var(--gb-text-primary)',
      },
    },
  };

  const content = (
    <>
      <Box style={{ flexShrink: 0, lineHeight: 0 }}>{icon}</Box>
      {!collapsed && (
        <Text size="sm" fw={active ? 600 : 400} truncate>
          {label}
        </Text>
      )}
    </>
  );

  const button = to ? (
    <UnstyledButton
      component={Link}
      to={to}
      py={8}
      px={collapsed ? 0 : 12}
      style={commonStyle}
      styles={hoverStyles}
    >
      {content}
    </UnstyledButton>
  ) : href ? (
    <UnstyledButton
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      py={8}
      px={collapsed ? 0 : 12}
      style={commonStyle}
      styles={hoverStyles}
    >
      {content}
    </UnstyledButton>
  ) : (
    <UnstyledButton
      py={8}
      px={collapsed ? 0 : 12}
      style={commonStyle}
      styles={hoverStyles}
      onClick={onClick}
    >
      {content}
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
  const { user, isAuthenticated } = useAuth();
  const signOut = useAuthStore((s) => s.signOut);
  const { plan } = useSubscription();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const pathname = location.pathname;
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const displayName = user?.user_metadata?.full_name || user?.email || '';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const initials = displayName
    .split(/\s+/)
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
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
            <Link
              to="/dashboard"
              style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
            >
              <img
                src={
                  computedColorScheme === 'dark'
                    ? collapsed
                      ? '/glossboss-icon-light.svg'
                      : '/glossboss-combined-light.svg'
                    : collapsed
                      ? '/glossboss-icon-dark.svg'
                      : '/glossboss-combined-dark.svg'
                }
                alt="GlossBoss"
                style={{ height: collapsed ? 24 : 24, display: 'block' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    computedColorScheme === 'dark'
                      ? '/glossboss-combined-light.svg'
                      : '/glossboss-combined-dark.svg';
                  (e.target as HTMLImageElement).style.height = '20px';
                }}
              />
            </Link>
            {!collapsed && (
              <Tooltip label={t('Collapse sidebar')} position="right">
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={onToggle}>
                  <PanelLeftClose size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            {collapsed && (
              <Tooltip label={t('Expand sidebar')} position="right">
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={onToggle}>
                  <PanelLeft size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>

          <Divider />

          {/* Main navigation */}
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
            <NavItem
              to="/"
              icon={<FileText size={18} />}
              label={t('Local editor')}
              active={pathname === '/'}
              collapsed={collapsed}
            />
          </Stack>
        </Stack>

        {/* Bottom section */}
        <Stack gap={4}>
          {/* Utility links */}
          <Stack gap={2}>
            <NavItem
              to="/settings"
              icon={<Settings size={18} />}
              label={t('Settings')}
              active={pathname.startsWith('/settings')}
              collapsed={collapsed}
            />
            <NavItem
              icon={<MessageSquare size={18} />}
              label={t('Share feedback')}
              collapsed={collapsed}
              onClick={() => setFeedbackOpen(true)}
            />
          </Stack>

          <Divider />

          {/* Theme + notifications */}
          <Group justify={collapsed ? 'center' : 'flex-start'} gap="xs" px={collapsed ? 0 : 4}>
            {isAuthenticated && <NotificationBell />}
            <Tooltip label={computedColorScheme === 'dark' ? t('Light mode') : t('Dark mode')}>
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={toggleColorScheme}>
                {computedColorScheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </ActionIcon>
            </Tooltip>
          </Group>

          <Divider />

          {/* User section */}
          {isAuthenticated ? (
            <Stack gap={4}>
              {!collapsed && (
                <Group gap="sm" px={4} py={4}>
                  <Avatar src={avatarUrl} size="sm" radius="xl" color="blue">
                    {initials}
                  </Avatar>
                  <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                    <Text size="xs" fw={500} truncate>
                      {displayName}
                    </Text>
                    <PlanBadge plan={plan} />
                  </Stack>
                </Group>
              )}
              {collapsed && (
                <Tooltip label={displayName} position="right">
                  <Box style={{ display: 'flex', justifyContent: 'center' }}>
                    <Avatar src={avatarUrl} size="sm" radius="xl" color="blue">
                      {initials}
                    </Avatar>
                  </Box>
                </Tooltip>
              )}
              <NavItem
                icon={<LogOut size={18} />}
                label={t('Sign out')}
                collapsed={collapsed}
                onClick={signOut}
                color="var(--mantine-color-red-6)"
              />
            </Stack>
          ) : (
            <NavItem
              to="/login"
              icon={<LogIn size={18} />}
              label={t('Sign in')}
              collapsed={collapsed}
            />
          )}
        </Stack>
      </Stack>

      <FeedbackModal opened={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
