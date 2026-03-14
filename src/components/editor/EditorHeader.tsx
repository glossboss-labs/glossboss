/**
 * EditorHeader — top toolbar with app title, file actions, and settings.
 *
 * Contains the Upload / Download / Update / Push buttons, the feedback
 * button, the theme toggle, and the gear-menu with all secondary actions.
 */

import type { MutableRefObject, RefObject } from 'react';
import {
  Title,
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
} from 'lucide-react';
import { sectionVariants, fadeVariants, buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import type { FileFormat } from '@/stores';
import type { RepoConnection } from '@/lib/repo-sync/types';

const MotionDiv = motion.div;
const appIcon = '/icon.svg';

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
}

export function EditorHeader({
  onFileUpload,
  fileInputRef,
  fileResetRef,
  filename,
  hasUnsavedChanges,
  sourceFormat,
  onDownload,
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
}: EditorHeaderProps) {
  const { t } = useTranslation();
  const computedColorScheme = useComputedColorScheme('light');

  return (
    <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
      <Group justify="space-between" align="flex-start">
        <div data-ev-id="ev_c00be328c4">
          <Group gap="xs" align="center">
            <img src={appIcon} alt="GlossBoss" style={{ width: 28, height: 28, borderRadius: 6 }} />
            <Title order={1}>GlossBoss</Title>
          </Group>
          <Text size="sm" mt={4} style={{ color: 'var(--gb-text-secondary)' }}>
            {t('Edit gettext translation files with DeepL integration')}
          </Text>
        </div>

        <Group gap="sm">
          <Group gap="sm">
            <motion.div {...buttonStates}>
              <FileButton onChange={onFileUpload} accept=".po,.pot,.json" resetRef={fileResetRef}>
                {(props) => (
                  <Button leftSection={<Upload size={16} />} {...props} ref={fileInputRef}>
                    {t('Upload')}
                  </Button>
                )}
              </FileButton>
            </motion.div>

            <AnimatePresence>
              {filename && (
                <MotionDiv variants={fadeVariants} initial="hidden" animate="visible" exit="exit">
                  <Group gap="sm">
                    <Group gap={0} style={{ position: 'relative', overflow: 'visible' }}>
                      <Tooltip
                        label={
                          hasUnsavedChanges
                            ? t('You have unsaved changes')
                            : t('Download as {format}', {
                                format: sourceFormat === 'i18next' ? 'JSON' : 'PO',
                              })
                        }
                      >
                        <motion.div {...buttonStates}>
                          <Button
                            leftSection={<Download size={16} />}
                            variant="light"
                            onClick={onDownload}
                            aria-label={
                              hasUnsavedChanges ? t('Download (unsaved changes)') : undefined
                            }
                            style={{
                              borderTopRightRadius: 0,
                              borderBottomRightRadius: 0,
                              position: 'relative',
                              overflow: 'visible',
                            }}
                          >
                            {t('Download')}
                            <AnimatePresence>
                              {hasUnsavedChanges && (
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
                      </Tooltip>
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                          <Button
                            variant="light"
                            px={8}
                            aria-label={t('Download format options')}
                            style={{
                              borderTopLeftRadius: 0,
                              borderBottomLeftRadius: 0,
                              borderLeft: '1px solid var(--mantine-color-default-border)',
                            }}
                          >
                            <ChevronDown size={14} />
                          </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Label>{t('Download as')}</Menu.Label>
                          <Menu.Item onClick={() => onDownloadAs('po')}>
                            {t('PO file (.po)')}
                          </Menu.Item>
                          <Menu.Item onClick={() => onDownloadAs('i18next')}>
                            {t('i18next JSON (.json)')}
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item
                            leftSection={<Archive size={14} />}
                            onClick={() => onOpenSettings('transfer')}
                          >
                            {t('Backup')}
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>

                    <Tooltip
                      multiline
                      w={340}
                      label={t(
                        'Update this file using a .pot template. Existing translations are kept when source strings still match, new strings are added, and obsolete strings are removed.',
                      )}
                    >
                      <motion.div {...buttonStates}>
                        <FileButton onChange={onPotUpload} accept=".pot">
                          {(props) => (
                            <Button leftSection={<FileUp size={16} />} variant="light" {...props}>
                              {t('Update')}
                            </Button>
                          )}
                        </FileButton>
                      </motion.div>
                    </Tooltip>

                    {repoConnection && (
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
                    )}
                  </Group>
                </MotionDiv>
              )}
            </AnimatePresence>
          </Group>

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
