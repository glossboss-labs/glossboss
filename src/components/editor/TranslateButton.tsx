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
import { getDeepLClient, hasUserApiKey } from '@/lib/deepl';
import {
  formatDeepLError,
  isGlossaryNotFoundError,
  notifyGlossaryFallback,
} from '@/lib/deepl/errors';
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
  /** Button style: compact icon or labeled button */
  display?: 'icon' | 'button';
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
  display = 'icon',
}: TranslateButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingTranslation, setPendingTranslation] = useState<string | null>(null);
  const [pendingUsedGlossary, setPendingUsedGlossary] = useState(false);
  const apiKeyConfigured = hasUserApiKey();
  const isDisabled = disabled || !text.trim() || !apiKeyConfigured;

  const iconSize = size === 'xs' ? 12 : size === 'sm' ? 14 : 16;
  const hasExistingTranslation = currentTranslation.trim().length > 0;
  const label = glossaryId ? 'Translate with Glossary' : 'Translate with DeepL';
  const tooltipLabel = !apiKeyConfigured
    ? 'Add your DeepL API key in Settings to enable translation'
    : glossaryId
      ? 'Translate with DeepL + Glossary'
      : 'Translate with DeepL';

  const doTranslate = useCallback(async () => {
    if (!text.trim() || isLoading || isDisabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const client = getDeepLClient();

      // When using a glossary, source_lang is REQUIRED by DeepL
      // Default to 'EN' since WordPress glossaries are English source
      const effectiveSourceLang = glossaryId ? sourceLang || 'EN' : sourceLang;

      let usedGlossary = Boolean(glossaryId);
      let result: string;
      try {
        // Use DeepL's native glossary support if available
        result = await client.translateText(text, targetLang, effectiveSourceLang, glossaryId);
      } catch (glossaryError) {
        // If glossary is stale/deleted, retry once without glossary.
        if (glossaryId && isGlossaryNotFoundError(glossaryError)) {
          usedGlossary = false;
          notifyGlossaryFallback('single');
          result = await client.translateText(text, targetLang, sourceLang, undefined);
        } else {
          throw glossaryError;
        }
      }

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
      const errorMessage = formatDeepLError(err);
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
    isDisabled,
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
    if (display === 'button') {
      return (
        <Button size={size} variant="light" disabled leftSection={<Loader size={iconSize} />}>
          Translating...
        </Button>
      );
    }

    return (
      <ActionIcon size={size} variant="subtle" disabled aria-label="Translating">
        <Loader size={iconSize} />
      </ActionIcon>
    );
  }

  if (error) {
    if (display === 'button') {
      return (
        <Tooltip label={`Error: ${error}. Click to retry.`} color="red" multiline w={220}>
          <Button
            size={size}
            variant="light"
            color="red"
            leftSection={<AlertCircle size={iconSize} />}
            onClick={doTranslate}
            disabled={isDisabled}
          >
            Retry translation
          </Button>
        </Tooltip>
      );
    }

    return (
      <Tooltip label={`Error: ${error}. Click to retry.`} color="red" multiline w={200}>
        <ActionIcon
          size={size}
          variant="subtle"
          color="red"
          onClick={doTranslate}
          disabled={isDisabled}
          aria-label="Retry translation"
        >
          <AlertCircle size={iconSize} />
        </ActionIcon>
      </Tooltip>
    );
  }

  // Show confirmation popover when there's existing translation
  return (
    <Popover opened={showConfirm} onClose={handleCancel} position="top" withArrow shadow="md">
      <Popover.Target>
        <Tooltip label={tooltipLabel} color="dark">
          <span style={{ display: 'inline-flex' }}>
            {display === 'button' ? (
              <Button
                size={size}
                variant="light"
                color={glossaryId ? 'teal' : 'blue'}
                leftSection={<Languages size={iconSize} />}
                onClick={doTranslate}
                disabled={isDisabled}
              >
                {label}
              </Button>
            ) : (
              <ActionIcon
                size={size}
                variant="light"
                color={glossaryId ? 'teal' : 'blue'}
                onClick={doTranslate}
                disabled={isDisabled}
                aria-label={label}
              >
                <Languages size={iconSize} />
              </ActionIcon>
            )}
          </span>
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
