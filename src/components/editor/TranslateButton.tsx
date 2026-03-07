/**
 * Translate Button Component
 *
 * Button to translate a single entry using DeepL.
 * Supports DeepL native glossary for context-aware translation.
 * Shows loading state and handles errors.
 * Includes overwrite confirmation for non-empty fields.
 */

import { useState, useCallback } from 'react';
import { ActionIcon, Tooltip, Loader, Popover, Button, Text, Stack, Group } from '@mantine/core';
import { Languages, AlertCircle, AlertTriangle } from 'lucide-react';
import { getDeepLClient } from '@/lib/deepl';
import type { TargetLanguage, SourceLanguage } from '@/lib/deepl/types';

interface TranslateButtonProps {
  /** Text to translate */
  text: string;
  /** Current translation (to check if overwriting) */
  currentTranslation?: string;
  /** Target language code */
  targetLang: TargetLanguage;
  /** Source language code (optional, auto-detect if omitted) */
  sourceLang?: SourceLanguage;
  /** DeepL glossary ID for native glossary support */
  glossaryId?: string;
  /** Callback when translation completes (second param indicates glossary was used) */
  onTranslated: (translatedText: string, usedGlossary?: boolean) => void;
  /** Callback when translation fails */
  onError?: (error: string) => void;
  /** Whether translation is disabled */
  disabled?: boolean;
  /** Size of the button */
  size?: 'xs' | 'sm' | 'md';
}

export function TranslateButton({
  text,
  currentTranslation = '',
  targetLang,
  sourceLang,
  glossaryId,
  onTranslated,
  onError,
  disabled = false,
  size = 'sm',
}: TranslateButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingTranslation, setPendingTranslation] = useState<string | null>(null);
  const [pendingUsedGlossary, setPendingUsedGlossary] = useState(false);

  const iconSize = size === 'xs' ? 12 : size === 'sm' ? 14 : 16;
  const hasExistingTranslation = currentTranslation.trim().length > 0;

  const doTranslate = useCallback(async () => {
    if (!text.trim() || isLoading || disabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const client = getDeepLClient();

      // When using a glossary, source_lang is REQUIRED by DeepL
      // Default to 'EN' since WordPress glossaries are English source
      const effectiveSourceLang = glossaryId ? sourceLang || 'EN' : sourceLang;

      // Use DeepL's native glossary support if available
      const result = await client.translateText(text, targetLang, effectiveSourceLang, glossaryId);

      const usedGlossary = Boolean(glossaryId);
      if (usedGlossary) {
        console.log('[DeepL] Translated with glossary:', glossaryId);
      }

      // If there's existing translation, show confirmation first
      if (hasExistingTranslation) {
        setPendingTranslation(result);
        setPendingUsedGlossary(usedGlossary);
        setShowConfirm(true);
      } else {
        // No existing translation, apply directly
        onTranslated(result, usedGlossary);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Translation failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [
    text,
    targetLang,
    sourceLang,
    glossaryId,
    onTranslated,
    onError,
    isLoading,
    disabled,
    hasExistingTranslation,
  ]);

  const handleConfirm = useCallback(() => {
    if (pendingTranslation) {
      onTranslated(pendingTranslation, pendingUsedGlossary);
    }
    setPendingTranslation(null);
    setPendingUsedGlossary(false);
    setShowConfirm(false);
  }, [pendingTranslation, pendingUsedGlossary, onTranslated]);

  const handleCancel = useCallback(() => {
    setPendingTranslation(null);
    setPendingUsedGlossary(false);
    setShowConfirm(false);
  }, []);

  if (isLoading) {
    return (
      <ActionIcon size={size} variant="subtle" disabled>
        <Loader size={iconSize} />
      </ActionIcon>
    );
  }

  if (error) {
    return (
      <Tooltip label={`Error: ${error}. Click to retry.`} color="red" multiline w={200}>
        <ActionIcon size={size} variant="subtle" color="red" onClick={doTranslate}>
          <AlertCircle size={iconSize} />
        </ActionIcon>
      </Tooltip>
    );
  }

  // Show confirmation popover when there's existing translation
  return (
    <Popover opened={showConfirm} onClose={handleCancel} position="top" withArrow shadow="md">
      <Popover.Target>
        <Tooltip
          label={glossaryId ? 'Translate with DeepL + Glossary' : 'Translate with DeepL'}
          color="dark"
        >
          <ActionIcon
            size={size}
            variant="light"
            color={glossaryId ? 'teal' : 'blue'}
            onClick={doTranslate}
            disabled={disabled || !text.trim()}
          >
            <Languages size={iconSize} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap="xs" maw={280}>
          <Group gap="xs">
            <AlertTriangle size={16} color="var(--mantine-color-orange-6)" />
            <Text size="sm" fw={500}>
              Replace existing translation?
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            This will overwrite your current translation with the DeepL result.
          </Text>
          <Group gap="xs" justify="flex-end">
            <Button size="xs" variant="subtle" onClick={handleCancel}>
              Keep original
            </Button>
            <Button size="xs" color="blue" onClick={handleConfirm}>
              Replace
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
