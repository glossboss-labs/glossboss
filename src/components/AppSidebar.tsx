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
import { motion } from 'motion/react';
import { ambientEnter } from '@/lib/motion';
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
  FolderOpen,
  History,
} from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { getInitials, getSizedAvatarUrl } from '@/lib/utils/avatar';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationsStore } from '@/stores/notifications-store';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { PlanBadge } from '@/components/billing/PlanBadge';
import { useSubscription } from '@/hooks/use-subscription';
import { useProjects } from '@/lib/projects/queries';
import { formatLimit } from '@/lib/billing/limits';
import { FeedbackModal } from '@/components/feedback';
import { AuthPromptModal } from '@/components/auth/AuthPromptModal';
import { GlossBossLogo } from '@/components/ui/GlossBossLogo';
import { useRecentProjects } from '@/hooks/use-recent-projects';
import { SidebarProjectSearch } from '@/components/SidebarProjectSearch';

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
  'aria-label'?: string;
}

/** Base style shared by every NavItem button. Extracted to module scope to avoid re-creation on every render. */
const NAV_ITEM_BASE_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  borderRadius: 'var(--mantine-radius-sm)',
  transition: 'background-color 120ms ease, color 120ms ease',
  width: '100%',
  textDecoration: 'none',
} as const;

function getNavItemStyle(
  collapsed: boolean,
  active: boolean | undefined,
  color: string | undefined,
) {
  return {
    ...NAV_ITEM_BASE_STYLE,
    justifyContent: collapsed ? 'center' : 'flex-start',
    color: color ?? (active ? 'var(--gb-text-primary)' : 'var(--gb-text-secondary)'),
    backgroundColor: active ? 'var(--gb-highlight-row)' : 'transparent',
  } as const;
}

function NavItem({
  to,
  href,
  icon,
  label,
  active,
  collapsed,
  onClick,
  color,
  'aria-label': ariaLabel,
}: NavItemProps) {
  const commonStyle = getNavItemStyle(collapsed, active, color);

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
      aria-label={ariaLabel}
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
      aria-label={ariaLabel}
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
      aria-label={ariaLabel}
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
  const { data: projects = [] } = useProjects();
  const unreadNotifications = useNotificationsStore((s) => s.unreadCount);
  const { recentProjects } = useRecentProjects();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const pathname = location.pathname;
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  const displayName = user?.user_metadata?.full_name || user?.email || '';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const initials = getInitials(displayName);

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
              to="/"
              style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
            >
              <GlossBossLogo size={24} variant={collapsed ? 'icon' : 'full'} />
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
              to="/editor"
              icon={<FileText size={18} />}
              label={t('Local editor')}
              active={pathname === '/'}
              collapsed={collapsed}
            />
          </Stack>

          {/* Project search */}
          {isAuthenticated && <SidebarProjectSearch collapsed={collapsed} />}

          {/* Recent projects */}
          {isAuthenticated && recentProjects.length > 0 && (
            <>
              <Divider mt="sm" />
              {!collapsed && (
                <Group gap={6} px={12} pt={6} pb={2}>
                  <History size={12} style={{ color: 'var(--gb-text-tertiary)' }} />
                  <Text size="xs" fw={500} c="dimmed">
                    {t('Recent')}
                  </Text>
                </Group>
              )}
              <Stack gap={2}>
                {recentProjects.map((rp, i) => (
                  <motion.div
                    key={rp.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...ambientEnter, delay: i * 0.05 }}
                  >
                    <NavItem
                      to={rp.path}
                      icon={<FolderOpen size={16} />}
                      label={rp.name}
                      active={
                        pathname === `/projects/${rp.id}` ||
                        pathname.startsWith(`/projects/${rp.id}/`)
                      }
                      collapsed={collapsed}
                    />
                  </motion.div>
                ))}
              </Stack>
            </>
          )}
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
            aria-label={
              computedColorScheme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')
            }
            collapsed={collapsed}
            onClick={toggleColorScheme}
          />

          {/* Notifications */}
          {isAuthenticated && (
            <>
              <Divider />
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
            </>
          )}

          <Divider />

          {/* User section */}
          {isAuthenticated ? (
            <Stack gap={2}>
              {/* User profile */}
              {!collapsed ? (
                <Group gap="sm" px={12} py={8} wrap="nowrap">
                  <Avatar
                    src={getSizedAvatarUrl(avatarUrl, 26)}
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
                    <Avatar
                      src={getSizedAvatarUrl(avatarUrl, 26)}
                      size="sm"
                      radius="xl"
                      color="blue"
                    >
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
              icon={<LogIn size={18} />}
              label={t('Sign in')}
              collapsed={collapsed}
              onClick={() => setAuthPromptOpen(true)}
            />
          )}
        </Stack>
      </Stack>

      <FeedbackModal opened={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <AuthPromptModal opened={authPromptOpen} onClose={() => setAuthPromptOpen(false)} />
    </>
  );
}
