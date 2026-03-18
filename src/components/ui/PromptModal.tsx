/**
 * Prompt Modal
 *
 * Mantine replacement for window.prompt(). Matches ConfirmModal style.
 */

import { useState, useEffect } from 'react';
import { Modal, Stack, TextInput } from '@mantine/core';
import { motion, AnimatePresence } from 'motion/react';
import { contentVariants } from '@/lib/motion';
import { msgid } from '@/lib/app-language';
import { ModalActionButtons } from './ModalActionButtons';

const MotionStack = motion.create(Stack);

export interface PromptModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  label?: string;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
}

export function PromptModal({
  opened,
  onClose,
  onSubmit,
  title,
  label,
  placeholder,
  submitLabel = msgid('OK'),
  cancelLabel = msgid('Cancel'),
}: PromptModalProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!opened) return;
    const id = requestAnimationFrame(() => setValue(''));
    return () => cancelAnimationFrame(id);
  }, [opened]);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
      onClose();
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered size="sm">
      <AnimatePresence mode="wait">
        {opened && (
          <MotionStack
            gap="md"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <TextInput
              label={label}
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              data-autofocus
            />

            <ModalActionButtons
              cancelLabel={cancelLabel}
              confirmLabel={submitLabel}
              onCancel={onClose}
              onConfirm={handleSubmit}
              confirmDisabled={!value.trim()}
            />
          </MotionStack>
        )}
      </AnimatePresence>
    </Modal>
  );
}
