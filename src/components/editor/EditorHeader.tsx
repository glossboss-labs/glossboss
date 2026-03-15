/**
 * EditorHeader — top toolbar with app title, file menu, and settings.
 *
 * File operations (Upload, Download, Update, Backup) are grouped into a
 * single "File" dropdown menu. Push and Save to cloud remain as visible
 * buttons since they're contextual.
 */

import type { MutableRefObject, RefObject } from 'react';
import {
  Text,
  Group,
  Button,
  FileButton,
  Tooltip,
  ActionIcon,
  Divider,
  Menu,
  useComputedColorScheme,
} from '@mantine/core';
import { Link as RouterLink } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  Download,
  Trash2,
  MessageSquare,
  FileUp,
  RotateCcw,
  Settings,
  Sun,
  Moon,
  ChevronDown,
  GitBranch,
  GitPullRequest,
  Link,
  ExternalLink,
  Info,
  Archive,
  Globe,
  Cloud,
  LayoutDashboard,
} from 'lucide-react';
import { sectionVariants, buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import type { FileFormat } from '@/stores';
import type { RepoConnection } from '@/lib/repo-sync/types';
import { UserMenu } from '@/components/auth/UserMenu';
import { useAuth } from '@/hooks/use-auth';

const MotionDiv = motion.div;

/* ------------------------------------------------------------------ */
/*  ThemeToggle                                                        */
/* ------------------------------------------------------------------ */

function ThemeToggle({ onToggle }: { onToggle: () => void }) {
  const { t } = useTranslation();
  const computedColorScheme = useComputedColorScheme('light');

  return (
    <Tooltip label={computedColorScheme === 'dark' ? t('Light mode') : t('Dark mode')}>
      <motion.div {...buttonStates}>
        <ActionIcon
          variant="default"
          size="lg"
          onClick={onToggle}
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

/* ------------------------------------------------------------------ */
/*  EditorHeader                                                       */
/* ------------------------------------------------------------------ */

export interface EditorHeaderProps {
  /** Callback when a file is selected via the Upload button. */
  onFileUpload: (file: File | null) => void;
  /** Ref forwarded to the hidden FileButton trigger element. */
  fileInputRef: RefObject<HTMLButtonElement | null>;
  /** Reset callback exposed by FileButton. */
  fileResetRef: MutableRefObject<(() => void) | null>;

  /** Currently loaded filename (null = no file). */
  filename: string | null;
  hasUnsavedChanges: boolean;
  sourceFormat: FileFormat;

  onDownload: () => void;
  onDownloadAs: (format: FileFormat) => void;
  onPotUpload: (file: File | null) => void;

  repoConnection: RepoConnection | null;
  onPushToRepo: () => void;

  isMobile: boolean | undefined;

  onOpenFeedback: () => void;
  onToggleColorScheme: () => void;
  onOpenSettings: (tab?: string) => void;

  /** Opens the "Load from URL" prompt modal. */
  onLoadFromUrl: () => void;
  onOpenWordPressProject: () => void;
  /** Opens the WP refresh modal (only shown when a WP project is detected). */
  onRefreshWordPress?: () => void;
  onOpenRepoSync: () => void;
  onClearClick: () => void;

  /** Callback to save current editor state to a cloud project. */
  onSaveToCloud?: () => void;
  /** Whether a cloud save is in progress. */
  savingToCloud?: boolean;
}

export function EditorHeader({
  onFileUpload,
  fileInputRef,
  fileResetRef,
  filename,
  hasUnsavedChanges,
  onDownloadAs,
  onPotUpload,
  repoConnection,
  onPushToRepo,
  isMobile,
  onOpenFeedback,
  onToggleColorScheme,
  onOpenSettings,
  onLoadFromUrl,
  onOpenWordPressProject,
  onRefreshWordPress,
  onOpenRepoSync,
  onClearClick,
  onSaveToCloud,
  savingToCloud,
}: EditorHeaderProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const computedColorScheme = useComputedColorScheme('light');

  return (
    <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
      <Group justify="space-between" align={filename ? 'center' : 'flex-start'}>
        {/* Left: logo + File menu */}
        <Group gap="sm" align="center">
          <div data-ev-id="ev_c00be328c4">
            {filename ? (
              <img
                src={
                  computedColorScheme === 'dark'
                    ? '/glossboss-combined-light.svg'
                    : '/glossboss-combined-dark.svg'
                }
                alt="GlossBoss"
                style={{ height: 20 }}
              />
            ) : (
              <>
                <img
                  src={
                    computedColorScheme === 'dark'
                      ? '/glossboss-combined-light.svg'
                      : '/glossboss-combined-dark.svg'
                  }
                  alt="GlossBoss"
                  style={{ height: 28 }}
                />
                <Text size="sm" mt={4} style={{ color: 'var(--gb-text-secondary)' }}>
                  {t('Edit gettext translation files with DeepL integration')}
                </Text>
              </>
            )}
          </div>

          {/* File menu */}
          <FileButton onChange={onFileUpload} accept=".po,.pot,.json" resetRef={fileResetRef}>
            {(props) => <button {...props} ref={fileInputRef} style={{ display: 'none' }} />}
          </FileButton>

          <Menu position="bottom-start" withinPortal>
            <Menu.Target>
              <motion.div {...buttonStates}>
                <Button
                  variant="subtle"
                  color="gray"
                  rightSection={<ChevronDown size={12} />}
                  style={{ position: 'relative', overflow: 'visible' }}
                >
                  {t('File')}
                  <AnimatePresence>
                    {hasUnsavedChanges && filename && (
                      <MotionDiv
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: 'var(--mantine-color-orange-5)',
                          border: '2px solid var(--mantine-color-body)',
                          zIndex: 1,
                        }}
                      />
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<Upload size={14} />}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('Upload file…')}
              </Menu.Item>
              {filename && (
                <>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<Download size={14} />}
                    onClick={() => onDownloadAs('po')}
                  >
                    {t('Download as PO')}
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<Download size={14} />}
                    onClick={() => onDownloadAs('i18next')}
                  >
                    {t('Download as JSON')}
                  </Menu.Item>
                  <Menu.Divider />
                  <FileButton onChange={onPotUpload} accept=".pot">
                    {(props) => (
                      <Menu.Item leftSection={<FileUp size={14} />} {...props}>
                        {t('Update from POT…')}
                      </Menu.Item>
                    )}
                  </FileButton>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<Archive size={14} />}
                    onClick={() => onOpenSettings('transfer')}
                  >
                    {t('Backup')}
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>

        {/* Right: contextual buttons + utility controls */}
        <Group gap="sm" wrap="wrap" style={{ rowGap: 8 }}>
          {/* Contextual buttons that stay visible */}
          <AnimatePresence>
            {filename && repoConnection && (
              <MotionDiv
                key="push"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Tooltip
                  label={t('Push changes to {{provider}}', {
                    provider: repoConnection.provider === 'github' ? 'GitHub' : 'GitLab',
                  })}
                >
                  <motion.div {...buttonStates}>
                    <Button
                      leftSection={<GitPullRequest size={16} />}
                      variant="light"
                      color="teal"
                      onClick={onPushToRepo}
                    >
                      {t('Push')}
                    </Button>
                  </motion.div>
                </Tooltip>
              </MotionDiv>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {filename && isAuthenticated && onSaveToCloud && (
              <MotionDiv
                key="cloud"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Tooltip label={t('Save this file as a cloud project')}>
                  <motion.div {...buttonStates}>
                    <Button
                      leftSection={<Cloud size={16} />}
                      variant="light"
                      color="violet"
                      onClick={onSaveToCloud}
                      loading={savingToCloud}
                    >
                      {t('Save to cloud')}
                    </Button>
                  </motion.div>
                </Tooltip>
              </MotionDiv>
            )}
          </AnimatePresence>

          {!isMobile && <Divider orientation="vertical" />}

          {!isMobile && (
            <Group gap="sm">
              <Tooltip label={t('Share feedback')}>
                <motion.div {...buttonStates}>
                  <Button
                    variant="subtle"
                    leftSection={<MessageSquare size={16} />}
                    onClick={onOpenFeedback}
                  >
                    {t('Feedback')}
                  </Button>
                </motion.div>
              </Tooltip>

              <ThemeToggle onToggle={onToggleColorScheme} />
            </Group>
          )}

          {isAuthenticated && (
            <Tooltip label={t('Projects')}>
              <motion.div {...buttonStates}>
                <ActionIcon
                  component={RouterLink}
                  to="/dashboard"
                  variant="default"
                  size="lg"
                  aria-label={t('Projects')}
                >
                  <LayoutDashboard size={18} />
                </ActionIcon>
              </motion.div>
            </Tooltip>
          )}

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
                <Menu.Item leftSection={<MessageSquare size={14} />} onClick={onOpenFeedback}>
                  {t('Share feedback')}
                </Menu.Item>
              )}
              {isMobile && (
                <Menu.Item
                  leftSection={
                    computedColorScheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />
                  }
                  onClick={onToggleColorScheme}
                >
                  {computedColorScheme === 'dark' ? t('Light mode') : t('Dark mode')}
                </Menu.Item>
              )}
              {isMobile && <Menu.Divider />}
              <Menu.Label>{t('Settings')}</Menu.Label>
              <Menu.Item leftSection={<Settings size={14} />} onClick={() => onOpenSettings()}>
                {t('Open settings')}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>{t('Actions')}</Menu.Label>
              <Menu.Item leftSection={<Link size={14} />} onClick={onLoadFromUrl}>
                {t('Load from URL')}
              </Menu.Item>
              <Menu.Item leftSection={<Globe size={14} />} onClick={onOpenWordPressProject}>
                {t('Open from WordPress.org')}
              </Menu.Item>
              {onRefreshWordPress && (
                <Menu.Item leftSection={<RotateCcw size={14} />} onClick={onRefreshWordPress}>
                  {t('Refresh from WordPress.org')}
                </Menu.Item>
              )}
              <Menu.Item leftSection={<GitBranch size={14} />} onClick={onOpenRepoSync}>
                {repoConnection ? t('Repository sync') : t('Open from repository')}
              </Menu.Item>
              <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={onClearClick}>
                {t('Clear editor')}
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
  );
}
