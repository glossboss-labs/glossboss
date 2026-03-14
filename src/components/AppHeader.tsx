/**
 * AppHeader — shared header for project pages (Dashboard, ProjectDetail, ProjectEditor).
 *
 * Three-column layout: branding left, page actions center, controls right.
 * The optional `actions` slot lets individual pages inject page-specific buttons
 * (e.g. upload/download in ProjectEditor).
 */

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  Group,
  Text,
  ActionIcon,
  Menu,
  Tooltip,
  useMantineColorScheme,
  useComputedColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { motion } from 'motion/react';
import {
  Sun,
  Moon,
  MessageSquare,
  Settings,
  LayoutDashboard,
  ExternalLink,
  Info,
  Home,
} from 'lucide-react';
import { sectionVariants, buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { UserMenu } from '@/components/auth/UserMenu';
import { SettingsModal } from '@/components/SettingsModal';
import { FeedbackModal } from '@/components/feedback';

const MotionDiv = motion.div;
const appIcon = '/icon.svg';

interface AppHeaderProps {
  /** Extra buttons rendered in the center section */
  actions?: ReactNode;
}

function ThemeToggle() {
  const { t } = useTranslation();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');

  return (
    <Tooltip label={computedColorScheme === 'dark' ? t('Light mode') : t('Dark mode')}>
      <motion.div {...buttonStates}>
        <ActionIcon
          variant="default"
          size="md"
          onClick={toggleColorScheme}
          aria-label={
            computedColorScheme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')
          }
        >
          {computedColorScheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </ActionIcon>
      </motion.div>
    </Tooltip>
  );
}

export function AppHeader({ actions }: AppHeaderProps) {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
      <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
        <Group justify="space-between" align="center" mb="md">
          {/* Left: branding */}
          <Group gap="sm" align="center" style={{ flex: '0 0 auto' }}>
            <Link
              to="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <img
                src={appIcon}
                alt="GlossBoss"
                style={{ width: 20, height: 20, borderRadius: 4 }}
              />
              <Text fw={600} size="sm">
                GlossBoss
              </Text>
            </Link>
            <Tooltip label={t('Open local editor')}>
              <Text
                component={Link}
                to="/"
                size="xs"
                style={{
                  color: 'var(--gb-text-tertiary)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Home size={12} />
                {t('Editor')}
              </Text>
            </Tooltip>
          </Group>

          {/* Center: page-specific actions */}
          {actions && (
            <Group gap="xs" wrap="wrap" justify="center" style={{ flex: 1, rowGap: 6 }}>
              {actions}
            </Group>
          )}

          {/* Right: controls */}
          <Group gap={6} style={{ flex: '0 0 auto' }}>
            {!isMobile && (
              <>
                <Tooltip label={t('Share feedback')}>
                  <motion.div {...buttonStates}>
                    <ActionIcon
                      variant="subtle"
                      size="md"
                      onClick={() => setFeedbackOpen(true)}
                      aria-label={t('Share feedback')}
                    >
                      <MessageSquare size={16} />
                    </ActionIcon>
                  </motion.div>
                </Tooltip>
                <ThemeToggle />
              </>
            )}

            <Tooltip label={t('Projects')}>
              <motion.div {...buttonStates}>
                <ActionIcon
                  component={Link}
                  to="/dashboard"
                  variant="default"
                  size="md"
                  aria-label={t('Projects')}
                >
                  <LayoutDashboard size={16} />
                </ActionIcon>
              </motion.div>
            </Tooltip>

            <UserMenu />

            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <Tooltip label={t('Settings and actions')}>
                  <motion.div {...buttonStates}>
                    <ActionIcon variant="default" size="md" aria-label={t('Settings and actions')}>
                      <Settings size={16} />
                    </ActionIcon>
                  </motion.div>
                </Tooltip>
              </Menu.Target>
              <Menu.Dropdown>
                {isMobile && (
                  <Menu.Item
                    leftSection={<MessageSquare size={14} />}
                    onClick={() => setFeedbackOpen(true)}
                  >
                    {t('Share feedback')}
                  </Menu.Item>
                )}
                {isMobile && <Menu.Divider />}
                <Menu.Label>{t('Settings')}</Menu.Label>
                <Menu.Item
                  leftSection={<Settings size={14} />}
                  onClick={() => setSettingsOpen(true)}
                >
                  {t('Open settings')}
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
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </MotionDiv>

      <SettingsModal opened={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <FeedbackModal opened={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
