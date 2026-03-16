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
  Skeleton,
  Popover,
  Indicator,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import {
  Sun,
  Moon,
  LayoutDashboard,
  Globe,
  Map,
  Settings,
  PanelLeftClose,
  PanelLeft,
  FileText,
  MessageSquare,
  LogIn,
  LogOut,
  Bell,
} from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationsStore } from '@/stores/notifications-store';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { PlanBadge } from '@/components/billing/PlanBadge';
import { useSubscription } from '@/hooks/use-subscription';
import { useProjectsStore } from '@/stores/projects-store';
import { formatLimit } from '@/lib/billing/limits';
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
  const { plan, limits, loading: subLoading } = useSubscription();
  const projects = useProjectsStore((s) => s.projects);
  const unreadNotifications = useNotificationsStore((s) => s.unreadCount);
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const pathname = location.pathname;
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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
              to="/roadmap"
              icon={<Map size={18} />}
              label={t('Roadmap')}
              active={pathname === '/roadmap'}
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

          {/* Theme toggle as nav item */}
          <NavItem
            icon={computedColorScheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            label={computedColorScheme === 'dark' ? t('Light mode') : t('Dark mode')}
            collapsed={collapsed}
            onClick={toggleColorScheme}
          />

          <Divider />

          {/* Notifications */}
          {isAuthenticated && (
            <Popover
              opened={notificationsOpen}
              onChange={setNotificationsOpen}
              position="right-end"
              width={360}
              withinPortal
              shadow="var(--gb-shadow-menu)"
            >
              <Popover.Target>
                <Box>
                  <NavItem
                    icon={
                      <Indicator
                        size={14}
                        label={unreadNotifications > 0 ? String(unreadNotifications) : undefined}
                        disabled={unreadNotifications === 0}
                        color="red"
                        offset={2}
                      >
                        <Bell size={18} />
                      </Indicator>
                    }
                    label={t('Notifications')}
                    collapsed={collapsed}
                    onClick={() => setNotificationsOpen((o) => !o)}
                  />
                </Box>
              </Popover.Target>
              <Popover.Dropdown
                p={0}
                style={{
                  backgroundColor: 'var(--gb-surface-1)',
                  borderColor: 'var(--gb-border-subtle)',
                }}
              >
                <NotificationDropdown onClose={() => setNotificationsOpen(false)} />
              </Popover.Dropdown>
            </Popover>
          )}

          <Divider />

          {/* User section */}
          {isAuthenticated ? (
            <Stack gap={2}>
              {/* User profile */}
              {!collapsed ? (
                <Group gap="sm" px={12} py={8} wrap="nowrap">
                  <Avatar
                    src={avatarUrl}
                    size="sm"
                    radius="xl"
                    color="blue"
                    style={{ flexShrink: 0 }}
                  >
                    {initials}
                  </Avatar>
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Text size="xs" fw={500} truncate>
                      {displayName}
                    </Text>
                    {subLoading ? (
                      <Skeleton height={16} width={60} radius="xl" />
                    ) : (
                      <PlanBadge plan={plan} />
                    )}
                  </Stack>
                </Group>
              ) : (
                <Tooltip label={displayName} position="right">
                  <Box style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                    <Avatar src={avatarUrl} size="sm" radius="xl" color="blue">
                      {initials}
                    </Avatar>
                  </Box>
                </Tooltip>
              )}

              {/* Usage stats */}
              {!collapsed && !subLoading && (
                <Box px={12} py={4}>
                  <Text size="xs" c="dimmed" className="gb-tabular-nums">
                    {projects.filter((p) => !p.organization_id).length}/
                    {formatLimit(limits.projects)} {t('projects')} &middot;{' '}
                    {projects
                      .filter((p) => !p.organization_id)
                      .reduce((s, p) => s + (p.stats_total ?? 0), 0)
                      .toLocaleString()}
                    /{formatLimit(limits.strings)} {t('strings')}
                  </Text>
                </Box>
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
