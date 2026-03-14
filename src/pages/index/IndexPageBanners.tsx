import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Code,
  Group,
  List,
  Paper,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, GitBranch, GitPullRequest, RotateCcw, X } from 'lucide-react';
import type { ParseIssue } from '@/lib/po';
import { contentVariants } from '@/lib/motion';
import { formatDraftAge } from '@/lib/storage';
import { useTranslation } from '@/lib/app-language';
import type { RepoConnection } from '@/lib/repo-sync/types';
import type { PendingDraft } from './types';

const MotionDiv = motion.div;

export interface IndexPageBannersProps {
  dragError: string | null;
  onCloseDragError: () => void;
  errors: ParseIssue[];
  onCloseErrors: () => void;
  warnings: ParseIssue[];
  showWarnings: boolean;
  onCloseWarnings: () => void;
  pendingDraft: PendingDraft | null;
  onRestoreDraft: () => void;
  onDiscardDraft: () => void;
  hasFileLoaded: boolean;
  isFromDraft: boolean;
  lastAutoSave: number | null;
  repoConnection: RepoConnection | null;
  onOpenRepoPush: () => void;
}

export function IndexPageBanners({
  dragError,
  onCloseDragError,
  errors,
  onCloseErrors,
  warnings,
  showWarnings,
  onCloseWarnings,
  pendingDraft,
  onRestoreDraft,
  onDiscardDraft,
  hasFileLoaded,
  isFromDraft,
  lastAutoSave,
  repoConnection,
  onOpenRepoPush,
}: IndexPageBannersProps) {
  const { t } = useTranslation();

  return (
    <>
      <AnimatePresence>
        {dragError && (
          <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
            <Alert
              color="red"
              title={t('Upload failed')}
              onClose={onCloseDragError}
              withCloseButton
            >
              {dragError}
            </Alert>
          </MotionDiv>
        )}
      </AnimatePresence>

      {errors.length > 0 && (
        <Alert
          color="red"
          title={t('Failed to parse file')}
          onClose={onCloseErrors}
          withCloseButton
        >
          <List size="sm" spacing="xs">
            {errors.map((error, idx) => (
              <List.Item key={idx}>
                {error.line && <Code mr={8}>{t('Line {line}', { line: error.line })}</Code>}
                {error.message}
              </List.Item>
            ))}
          </List>
        </Alert>
      )}

      {warnings.length > 0 && showWarnings && (
        <Alert
          color="yellow"
          title={
            <Group gap="xs">
              <AlertTriangle size={16} />
              <span data-ev-id="ev_76292818e0">
                {t('{{count}} warning(s) during parsing', { count: warnings.length })}
              </span>
            </Group>
          }
          onClose={onCloseWarnings}
          withCloseButton
        >
          <List size="sm" spacing="xs">
            {warnings.slice(0, 5).map((warning, idx) => (
              <List.Item key={idx}>
                {warning.line && <Code mr={8}>{t('Line {{line}}', { line: warning.line })}</Code>}
                {warning.message}
              </List.Item>
            ))}
            {warnings.length > 5 && (
              <List.Item>
                <Text size="sm" c="dimmed">
                  {t('...and {{count}} more warnings', { count: warnings.length - 5 })}
                </Text>
              </List.Item>
            )}
          </List>
        </Alert>
      )}

      {pendingDraft && (
        <Alert
          color="blue"
          title={
            <Group gap="xs">
              <RotateCcw size={16} />
              <span data-ev-id="ev_be4d010bf8">{t('Unsaved draft found')}</span>
            </Group>
          }
          withCloseButton
          onClose={onDiscardDraft}
        >
          <Stack gap="sm">
            <Text size="sm">
              {t(
                'You have unsaved changes from {age}. Would you like to restore your previous work?',
                {
                  age: formatDraftAge(pendingDraft.draft.savedAt, t),
                },
              )}
            </Text>
            <Text size="xs" c="dimmed">
              {t('{count} modified entries will be restored.', {
                count: pendingDraft.draft.dirtyEntryIds.length,
              })}
            </Text>
            <Group gap="sm">
              <Button size="xs" leftSection={<RotateCcw size={14} />} onClick={onRestoreDraft}>
                {t('Restore draft')}
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                leftSection={<X size={14} />}
                onClick={onDiscardDraft}
              >
                {t('Discard and use new file')}
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}

      {hasFileLoaded && (isFromDraft || lastAutoSave) && (
        <Group gap="xs">
          {isFromDraft && (
            <Badge color="orange" variant="light" size="sm">
              {t('Editing draft')}
            </Badge>
          )}
          {lastAutoSave && (
            <Text size="xs" c="dimmed">
              {t('Auto-saved {age}', { age: formatDraftAge(lastAutoSave, t) })}
            </Text>
          )}
        </Group>
      )}

      {hasFileLoaded && repoConnection && (
        <Paper p="xs" withBorder>
          <Group gap="xs" justify="space-between">
            <Group gap="xs">
              <GitBranch size={14} />
              <Text size="xs" fw={500}>
                {repoConnection.owner}/{repoConnection.repo}
              </Text>
              <Badge size="xs" variant="light">
                {repoConnection.branch}
              </Badge>
              <Text size="xs" c="dimmed">
                {repoConnection.filePath}
              </Text>
            </Group>
            <Tooltip label={t('Push changes to repository')}>
              <ActionIcon variant="subtle" size="sm" onClick={onOpenRepoPush}>
                <GitPullRequest size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Paper>
      )}
    </>
  );
}
