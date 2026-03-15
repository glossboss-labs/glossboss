/**
 * AppHeader — shared header for project pages (Dashboard, ProjectDetail, ProjectEditor).
 *
 * Three-column layout: branding left, page actions center, controls right.
 * Right-side controls mirror EditorHeader exactly: Feedback button, theme toggle,
 * dashboard link, user menu, and settings gear with full menu.
 */

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  Group,
  Text,
  Button,
  ActionIcon,
  Divider,
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
  GitBranch,
  Trash2,
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
  /** Cloud project ID — enables project export in settings Backup tab */
  projectId?: string | null;
  /** Open repo sync modal (shows "Repository sync" in settings menu) */
  onOpenRepoSync?: () => void;
  /** Clear the editor and navigate away */
  onClear?: () => void;
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
          size="lg"
          onClick={toggleColorScheme}
          aria-label={
            computedColorScheme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')
          }
        >
          {computedColorScheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </ActionIcon>
      </motion.div>
    </Tooltip>
  );
}

export function AppHeader({ actions, projectId, onOpenRepoSync, onClear }: AppHeaderProps) {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const computedColorScheme = useComputedColorScheme('light');
  const { toggleColorScheme } = useMantineColorScheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string | undefined>();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const handleOpenSettings = (tab?: string) => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  return (
    <>
      <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
        <Group justify="space-between" align="center" mb="sm">
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

          {/* Right: actions + controls */}
          <Group gap="sm" style={{ flex: '0 0 auto' }}>
            {actions}

            {!isMobile && <Divider orientation="vertical" />}

            {!isMobile && (
              <Group gap="sm">
                <Tooltip label={t('Share feedback')}>
                  <motion.div {...buttonStates}>
                    <Button
                      variant="subtle"
                      leftSection={<MessageSquare size={16} />}
                      onClick={() => setFeedbackOpen(true)}
                    >
                      {t('Feedback')}
                    </Button>
                  </motion.div>
                </Tooltip>

                <ThemeToggle />
              </Group>
            )}

            <Tooltip label={t('Projects')}>
              <motion.div {...buttonStates}>
                <ActionIcon
                  component={Link}
                  to="/dashboard"
                  variant="default"
                  size="lg"
                  aria-label={t('Projects')}
                >
                  <LayoutDashboard size={18} />
                </ActionIcon>
              </motion.div>
            </Tooltip>

            <UserMenu />

            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <Tooltip label={t('Settings and actions')}>
                  <motion.div {...buttonStates}>
                    <ActionIcon variant="default" size="lg" aria-label={t('Settings and actions')}>
                      <Settings size={18} />
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
                {isMobile && (
                  <Menu.Item
                    leftSection={
                      computedColorScheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />
                    }
                    onClick={toggleColorScheme}
                  >
                    {computedColorScheme === 'dark' ? t('Light mode') : t('Dark mode')}
                  </Menu.Item>
                )}
                {isMobile && <Menu.Divider />}
                <Menu.Label>{t('Settings')}</Menu.Label>
                <Menu.Item
                  leftSection={<Settings size={14} />}
                  onClick={() => handleOpenSettings()}
                >
                  {t('Open settings')}
                </Menu.Item>
                {(onOpenRepoSync || onClear) && (
                  <>
                    <Menu.Divider />
                    <Menu.Label>{t('Actions')}</Menu.Label>
                    {onOpenRepoSync && (
                      <Menu.Item leftSection={<GitBranch size={14} />} onClick={onOpenRepoSync}>
                        {t('Repository sync')}
                      </Menu.Item>
                    )}
                    {onClear && (
                      <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={onClear}>
                        {t('Clear editor')}
                      </Menu.Item>
                    )}
                  </>
                )}
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
                  href="/translate/"
                  target="_blank"
                  rel="noopener noreferrer"
                  leftSection={<ExternalLink size={14} />}
                >
                  {t('Translate')}
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

      <SettingsModal
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialTab={settingsTab}
        projectId={projectId}
      />
      <FeedbackModal opened={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
