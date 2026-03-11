/**
 * Animated Confirmation Modal
 *
 * Reusable confirmation dialog with Motion animations.
 * Used for destructive or risky actions.
 */

import { Modal, Stack, Text, Group, Button, ThemeIcon } from '@mantine/core';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Info } from 'lucide-react';
import { contentVariants, buttonStates } from '@/lib/motion';
import { msgid, useTranslation } from '@/lib/app-language';

const MotionStack = motion.create(Stack);

export interface ConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  variant?: 'warning' | 'danger' | 'info';
  loading?: boolean;
}

export function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  detail,
  confirmLabel = msgid('Confirm'),
  cancelLabel = msgid('Cancel'),
  confirmColor = 'red',
  variant = 'warning',
  loading = false,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  const iconColor = variant === 'danger' ? 'red' : variant === 'warning' ? 'orange' : 'blue';
  const Icon = variant === 'info' ? Info : AlertTriangle;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      size="sm"
      withCloseButton={!loading}
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      closeButtonProps={{ 'aria-label': t('Close dialog') }}
    >
      <AnimatePresence mode="wait">
        {opened && (
          <MotionStack
            gap="md"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Group gap="sm" align="flex-start">
              <ThemeIcon color={iconColor} variant="light" size="lg" radius="xl" aria-hidden="true">
                <Icon size={18} />
              </ThemeIcon>
              <Stack gap={4} style={{ flex: 1 }}>
                <Text size="sm">{message}</Text>
                {detail && (
                  <Text size="xs" c="dimmed">
                    {detail}
                  </Text>
                )}
              </Stack>
            </Group>

            <Group justify="flex-end" gap="sm">
              <motion.div {...buttonStates}>
                <Button variant="default" onClick={onClose} disabled={loading}>
                  {t(cancelLabel)}
                </Button>
              </motion.div>
              <motion.div {...buttonStates}>
                <Button color={confirmColor} onClick={onConfirm} loading={loading}>
                  {t(confirmLabel)}
                </Button>
              </motion.div>
            </Group>
          </MotionStack>
        )}
      </AnimatePresence>
    </Modal>
  );
}
