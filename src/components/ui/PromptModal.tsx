/**
 * Prompt Modal
 *
 * Mantine replacement for window.prompt(). Matches ConfirmModal style.
 */

import { useState, useEffect } from 'react';
import { Modal, Stack, TextInput, Group, Button } from '@mantine/core';
import { motion, AnimatePresence } from 'motion/react';
import { contentVariants, buttonStates } from '@/lib/motion';
import { msgid, useTranslation } from '@/lib/app-language';

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
  const { t } = useTranslation();
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

            <Group justify="flex-end" gap="sm">
              <motion.div {...buttonStates}>
                <Button variant="default" onClick={onClose}>
                  {t(cancelLabel)}
                </Button>
              </motion.div>
              <motion.div {...buttonStates}>
                <Button onClick={handleSubmit} disabled={!value.trim()}>
                  {t(submitLabel)}
                </Button>
              </motion.div>
            </Group>
          </MotionStack>
        )}
      </AnimatePresence>
    </Modal>
  );
}
