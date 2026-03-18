/**
 * Batch Translate Controls — confirm modal, progress bar,
 * skip manual edits checkbox, error/success/bulk-action messages.
 */

import { Group, Text, Progress, Stack, Alert, Checkbox } from '@mantine/core';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import { msgid, useTranslation } from '@/lib/app-language';
import { contentVariants } from '@/lib/motion';
import { ConfirmModal } from '@/components/ui';

const MotionDiv = motion.div;
const MotionStack = motion.create(Stack);

export interface BatchTranslateControlsProps {
  /** Whether a bulk translation is currently running */
  isTranslating: boolean;
  /** Whether this is a retranslate-all operation */
  isRetranslateMode: boolean;
  /** Current progress percentage (0-100) */
  progress: number;
  /** Number of successfully translated entries */
  translateCount: number;
  /** Number of failed translations */
  failedCount: number;
  /** Error message if translation failed */
  error: string | null;
  /** Whether to skip manually edited entries during retranslation */
  skipManualEdits: boolean;
  /** Number of manual edits that would be affected */
  manualEditCount: number;
  /** Number of already translated entries */
  translatedCount: number;
  /** Bulk action feedback message */
  bulkActionMessage: string | null;
  /** Whether the retranslate confirm dialog is open */
  confirmRetranslateOpen: boolean;
  onRetranslateAll: () => void;
  onSetConfirmRetranslateOpen: (open: boolean) => void;
  onSetSkipManualEdits: (skip: boolean) => void;
  onClearError: () => void;
  onClearTranslateCount: () => void;
  onClearBulkActionMessage: () => void;
}

export function BatchTranslateControls({
  isTranslating,
  isRetranslateMode,
  progress,
  translateCount,
  failedCount,
  error,
  skipManualEdits,
  manualEditCount,
  translatedCount,
  bulkActionMessage,
  confirmRetranslateOpen,
  onRetranslateAll,
  onSetConfirmRetranslateOpen,
  onSetSkipManualEdits,
  onClearError,
  onClearTranslateCount,
  onClearBulkActionMessage,
}: BatchTranslateControlsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Retranslate confirmation modal */}
      <ConfirmModal
        opened={confirmRetranslateOpen}
        onClose={() => onSetConfirmRetranslateOpen(false)}
        onConfirm={onRetranslateAll}
        title={t('Retranslate all entries?')}
        message={t(
          'This will overwrite {{count}} existing translations with new machine translations.',
          { count: translatedCount },
        )}
        detail={
          manualEditCount > 0 && skipManualEdits
            ? t('{{count}} manually edited entries will be skipped.', { count: manualEditCount })
            : manualEditCount > 0
              ? t('\u26a0\ufe0f {{count}} manually edited entries will be overwritten!', {
                  count: manualEditCount,
                })
              : t('Consider downloading a backup first.')
        }
        confirmLabel={msgid('Retranslate all')}
        confirmColor="orange"
        variant={manualEditCount > 0 && !skipManualEdits ? 'danger' : 'warning'}
      />

      {/* Skip manual edits option */}
      <AnimatePresence>
        {manualEditCount > 0 && !isTranslating && (
          <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
            <Group gap="xs">
              <Checkbox
                size="xs"
                checked={skipManualEdits}
                onChange={(e) => onSetSkipManualEdits(e.currentTarget.checked)}
                label={
                  <Group gap={4}>
                    <ShieldAlert size={14} aria-hidden="true" />
                    <Text size="xs">
                      {t('Protect {{count}} manual edits from bulk translation', {
                        count: manualEditCount,
                      })}
                    </Text>
                  </Group>
                }
              />
            </Group>
          </MotionDiv>
        )}
      </AnimatePresence>

      {/* Progress bar during bulk translation */}
      <AnimatePresence>
        {isTranslating && (
          <MotionStack
            gap="xs"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {isRetranslateMode ? t('Retranslating') : t('Translating')}... {translateCount}
                {failedCount > 0 ? ` (${t('{{count}} failed', { count: failedCount })})` : ''}
              </Text>
              <Text size="sm" fw={500}>
                {progress}%
              </Text>
            </Group>
            <Progress
              value={progress}
              size="sm"
              animated
              color={failedCount > 0 ? 'orange' : 'blue'}
              aria-label={t('Translation progress')}
            />
          </MotionStack>
        )}
      </AnimatePresence>

      {/* Error display */}
      <AnimatePresence>
        {error && !isTranslating && (
          <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
            <Alert
              color="red"
              icon={<AlertCircle size={16} />}
              withCloseButton
              onClose={onClearError}
            >
              {error}
            </Alert>
          </MotionDiv>
        )}
      </AnimatePresence>

      {/* Bulk action feedback */}
      <AnimatePresence>
        {bulkActionMessage && !isTranslating && (
          <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
            <Alert color="blue" withCloseButton onClose={onClearBulkActionMessage}>
              {bulkActionMessage}
            </Alert>
          </MotionDiv>
        )}
      </AnimatePresence>

      {/* Success message */}
      <AnimatePresence>
        {!isTranslating && translateCount > 0 && !error && (
          <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
            <Alert color="green" withCloseButton onClose={onClearTranslateCount}>
              {t('Successfully translated {{count}} entries', { count: translateCount })}
            </Alert>
          </MotionDiv>
        )}
      </AnimatePresence>
    </>
  );
}
