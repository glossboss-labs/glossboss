/**
 * ModalActionButtons — shared cancel/confirm button group for modals.
 *
 * Used by ConfirmModal and PromptModal for consistent styling.
 */

import { Group, Button } from '@mantine/core';
import { motion } from 'motion/react';
import { buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';

export interface ModalActionButtonsProps {
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Color for the confirm button. Defaults to Mantine primary. */
  confirmColor?: string;
  /** Disable the cancel button (e.g. while loading). */
  cancelDisabled?: boolean;
  /** Disable the confirm button (e.g. empty input). */
  confirmDisabled?: boolean;
  /** Show a loading spinner on the confirm button. */
  loading?: boolean;
}

export function ModalActionButtons({
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmColor,
  cancelDisabled = false,
  confirmDisabled = false,
  loading = false,
}: ModalActionButtonsProps) {
  const { t } = useTranslation();

  return (
    <Group justify="flex-end" gap="sm">
      <motion.div {...buttonStates}>
        <Button variant="default" onClick={onCancel} disabled={cancelDisabled}>
          {t(cancelLabel)}
        </Button>
      </motion.div>
      <motion.div {...buttonStates}>
        <Button
          color={confirmColor}
          onClick={onConfirm}
          loading={loading}
          disabled={confirmDisabled}
        >
          {t(confirmLabel)}
        </Button>
      </motion.div>
    </Group>
  );
}
