/**
 * UserMenu — avatar + dropdown for signed-in users.
 * Shows sign-in link when not authenticated.
 * Includes settings, feedback, about links, and sign out.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { Menu, Avatar, ActionIcon, Tooltip, Group, Text } from '@mantine/core';
import {
  LogIn,
  LogOut,
  User,
  Settings,
  ExternalLink,
  Info,
  MessageSquare,
  Home,
  CircleHelp,
} from 'lucide-react';
import { motion } from 'motion/react';
import { buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { getInitials } from '@/lib/utils/avatar';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { useSubscription } from '@/hooks/use-subscription';
import { useProjects } from '@/lib/projects/queries';
import { formatLimit } from '@/lib/billing/limits';
import { PlanBadge } from '@/components/billing/PlanBadge';
import { FeedbackModal } from '@/components/feedback';
import { resetTourCompletion } from '@/hooks/use-editor-tour';

export function UserMenu() {
  const { t } = useTranslation();
  const { user, isAuthenticated, loading } = useAuth();
  const signOut = useAuthStore((s) => s.signOut);
  const { plan, limits } = useSubscription();
  const { data: projects = [] } = useProjects();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

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
  const initials = getInitials(displayName);

  return (
    <>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <motion.div {...buttonStates}>
            <ActionIcon
              variant="default"
              size="lg"
              radius="sm"
              style={{ padding: 0, overflow: 'hidden' }}
            >
              <Avatar src={avatarUrl} size="100%" radius="sm" color="blue">
                {initials}
              </Avatar>
            </ActionIcon>
          </motion.div>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>
            <Group gap={6}>
              <User size={12} />
              <Text size="xs" truncate style={{ maxWidth: 180 }}>
                {displayName}
              </Text>
              <PlanBadge plan={plan} />
            </Group>
          </Menu.Label>

          <Menu.Label>
            <Text size="xs" c="dimmed">
              {projects.filter((p) => !p.organization_id).length}/{formatLimit(limits.projects)}{' '}
              {t('projects')} &middot;{' '}
              {projects
                .filter((p) => !p.organization_id)
                .reduce((s, p) => s + (p.stats_total ?? 0), 0)
                .toLocaleString()}
              /{formatLimit(limits.strings)} {t('strings')}
            </Text>
          </Menu.Label>

          <Menu.Divider />

          <Menu.Item component={Link} to="/" leftSection={<Home size={14} />}>
            {t('Local editor')}
          </Menu.Item>
          <Menu.Item component={Link} to="/settings" leftSection={<Settings size={14} />}>
            {t('Settings')}
          </Menu.Item>
          <Menu.Item
            leftSection={<MessageSquare size={14} />}
            onClick={() => setFeedbackOpen(true)}
          >
            {t('Share feedback')}
          </Menu.Item>
          <Menu.Item
            component={Link}
            to="/editor?tour=1"
            leftSection={<CircleHelp size={14} />}
            onClick={() => resetTourCompletion()}
          >
            {t('Editor tour')}
          </Menu.Item>
          <Menu.Item
            component={Link}
            to="/settings?tour=settings&tab=translation"
            leftSection={<CircleHelp size={14} />}
            onClick={() => resetTourCompletion()}
          >
            {t('Settings tour')}
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
            href="/license"
            target="_blank"
            rel="noopener noreferrer"
            leftSection={<Info size={14} />}
          >
            {t('License')}
          </Menu.Item>
          <Menu.Item
            component="a"
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            leftSection={<Info size={14} />}
          >
            {t('Terms')}
          </Menu.Item>
          <Menu.Item
            component="a"
            href="/privacy"
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

      <FeedbackModal opened={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
