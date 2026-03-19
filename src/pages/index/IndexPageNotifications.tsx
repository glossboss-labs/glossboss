import { Box, Notification, Paper, Stack, Text, Transition } from '@mantine/core';
import { AlertTriangle, Check, FileUp } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import type { DownloadInfo, FeedbackInfo, MergeInfo } from './types';

export interface IndexPageNotificationsProps {
  isDragging: boolean;
  downloadSuccess: DownloadInfo | null;
  onCloseDownloadSuccess: () => void;
  mergeSuccess: MergeInfo | null;
  onCloseMergeSuccess: () => void;
  feedbackSuccess: FeedbackInfo | null;
  onCloseFeedbackSuccess: () => void;
  feedbackError: string | null;
  onCloseFeedbackError: () => void;
}

export function IndexPageNotifications({
  isDragging,
  downloadSuccess,
  onCloseDownloadSuccess,
  mergeSuccess,
  onCloseMergeSuccess,
  feedbackSuccess,
  onCloseFeedbackSuccess,
  feedbackError,
  onCloseFeedbackError,
}: IndexPageNotificationsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Transition mounted={isDragging} transition="fade" duration={150} timingFunction="ease">
        {(styles) => (
          <Box
            style={{
              ...styles,
              position: 'fixed',
              inset: 0,
              backgroundColor: 'color-mix(in srgb, var(--gb-surface-0) 75%, transparent)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <Paper p="xl" radius="md" shadow="lg" style={{ maxWidth: 340 }}>
              <Stack align="center" gap="md">
                <Box
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 'var(--mantine-radius-md)',
                    backgroundColor: 'var(--mantine-color-blue-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileUp size={32} color="var(--mantine-color-blue-filled)" />
                </Box>
                <Stack align="center" gap={4}>
                  <Text fw={600} size="lg">
                    {t("Drop it like it's hot")}
                  </Text>
                  <Text c="dimmed" size="sm" ta="center">
                    {t('Release to load your translation file')}
                  </Text>
                </Stack>
              </Stack>
            </Paper>
          </Box>
        )}
      </Transition>

      <Transition
        mounted={downloadSuccess !== null}
        transition="slide-left"
        duration={200}
        timingFunction="ease"
      >
        {(styles) => (
          <Notification
            icon={<Check size={18} />}
            color="green"
            title={t('File downloaded')}
            onClose={onCloseDownloadSuccess}
            style={{
              ...styles,
              position: 'fixed',
              bottom: 20,
              right: 20,
              zIndex: 1000,
              minWidth: 280,
            }}
          >
            <Text size="sm">
              <strong data-ev-id="ev_e901455cf4">{downloadSuccess?.filename}</strong> (
              {downloadSuccess?.size})
            </Text>
          </Notification>
        )}
      </Transition>

      <Transition
        mounted={mergeSuccess !== null}
        transition="slide-left"
        duration={200}
        timingFunction="ease"
      >
        {(styles) => (
          <Notification
            icon={<Check size={18} />}
            color="blue"
            title={t('Updated')}
            onClose={onCloseMergeSuccess}
            style={{
              ...styles,
              position: 'fixed',
              bottom: 20,
              right: 20,
              zIndex: 1000,
              minWidth: 320,
            }}
          >
            <Text size="sm">
              {t('Updated from {{filename}}: +{{added}} new, -{{removed}} removed, {{kept}} kept', {
                filename: mergeSuccess?.potFilename,
                added: mergeSuccess?.added,
                removed: mergeSuccess?.removed,
                kept: mergeSuccess?.kept,
              })}
              {mergeSuccess?.updatedMeta
                ? ` (${t('{{count}} with updated references', { count: mergeSuccess.updatedMeta })})`
                : ''}
            </Text>
          </Notification>
        )}
      </Transition>

      <Transition
        mounted={feedbackSuccess !== null}
        transition="slide-left"
        duration={200}
        timingFunction="ease"
      >
        {(styles) => (
          <Notification
            icon={<Check size={18} />}
            color="teal"
            title={t('Feedback submitted')}
            onClose={onCloseFeedbackSuccess}
            style={{
              ...styles,
              position: 'fixed',
              top: 20,
              right: 20,
              zIndex: 1000,
              minWidth: 300,
            }}
          >
            <Text size="sm">{t('Thanks. Your feedback was submitted.')}</Text>
            {feedbackSuccess?.referenceId && (
              <Text size="sm" mt={4}>
                {t('Reference: {{referenceId}}', {
                  referenceId: feedbackSuccess.referenceId,
                })}
              </Text>
            )}
          </Notification>
        )}
      </Transition>

      <Transition
        mounted={feedbackError !== null}
        transition="slide-left"
        duration={200}
        timingFunction="ease"
      >
        {(styles) => (
          <Notification
            icon={<AlertTriangle size={18} />}
            color="red"
            title={t('Feedback failed')}
            onClose={onCloseFeedbackError}
            style={{
              ...styles,
              position: 'fixed',
              top: 20,
              right: 20,
              zIndex: 1000,
              minWidth: 320,
            }}
          >
            <Text size="sm">{feedbackError}</Text>
          </Notification>
        )}
      </Transition>
    </>
  );
}
