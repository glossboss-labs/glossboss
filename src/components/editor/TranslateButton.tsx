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
import { useLocalStorage } from '@mantine/hooks';
import { Languages, AlertCircle, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { trackEvent } from '@/lib/analytics';
import {
  formatDeepLError,
  isGlossaryNotFoundError,
  notifyGlossaryFallback,
} from '@/lib/deepl/errors';
import type { TargetLanguage, SourceLanguage } from '@/lib/deepl/types';
import type { Glossary } from '@/lib/glossary/types';
import {
  getTranslationProviderLabel,
  hasProviderCredentials,
  translateWithActiveProvider,
  type ProviderTranslationMetadata,
} from '@/lib/translation';
import {
  TRANSLATION_PROVIDER_STORAGE_KEY,
  type TranslationProviderSettings,
} from '@/lib/translation/settings';
import { getEffectiveProjectType, getEffectiveSlug, useSourceStore } from '@/stores/source-store';

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
  /** Glossary data for prompt-aware providers */
  glossary?: Glossary | null;
  /** Source references for project-context providers */
  references?: string[];
  /** Callback when translation completes */
  onTranslated: (translatedText: string, meta?: ProviderTranslationMetadata) => void;
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
  glossary = null,
  references,
  onTranslated,
  onError,
  disabled = false,
  size = 'sm',
  display = 'icon',
}: TranslateButtonProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingTranslation, setPendingTranslation] = useState<string | null>(null);
  const [pendingMeta, setPendingMeta] = useState<ProviderTranslationMetadata | null>(null);
  const [providerState] = useLocalStorage<TranslationProviderSettings>({
    key: TRANSLATION_PROVIDER_STORAGE_KEY,
    defaultValue: {
      provider: 'deepl',
      updatedAt: 0,
    },
  });
  const activeProvider = providerState.provider;
  const projectSlug = useSourceStore((state) => getEffectiveSlug(state));
  const projectType = useSourceStore((state) => getEffectiveProjectType(state));
  const providerLabel = getTranslationProviderLabel(activeProvider);
  const apiKeyConfigured = hasProviderCredentials(activeProvider);
  const isDisabled = disabled || !text.trim() || !apiKeyConfigured;

  const iconSize = size === 'xs' ? 12 : size === 'sm' ? 14 : 16;
  const hasExistingTranslation = currentTranslation.trim().length > 0;
  const label =
    glossaryId && activeProvider === 'deepl'
      ? t('Translate with Glossary')
      : t('Translate with {{provider}}', { provider: providerLabel });
  const tooltipLabel = !apiKeyConfigured
    ? t('Add your {{provider}} API key in Settings to enable translation', {
        provider: providerLabel,
      })
    : glossaryId
      ? t('Translate with {{provider}} + Glossary', { provider: providerLabel })
      : t('Translate with {{provider}}', { provider: providerLabel });

  const doTranslate = useCallback(async () => {
    if (!text.trim() || isLoading || isDisabled) return;

    setIsLoading(true);
    setError(null);

    try {
      let resultText = '';
      let resultMeta: ProviderTranslationMetadata | undefined;
      try {
        const response = await translateWithActiveProvider({
          text,
          targetLang,
          sourceLang,
          glossary,
          deeplGlossaryId: activeProvider === 'deepl' ? glossaryId : undefined,
          references,
          projectSlug,
          projectType,
        });
        const translated = response.translations[0];
        if (!translated?.text) {
          throw new Error('No translation returned');
        }
        resultText = translated.text;
        resultMeta = translated.metadata;
      } catch (glossaryError) {
        // If glossary is stale/deleted, retry once without glossary.
        if (activeProvider === 'deepl' && glossaryId && isGlossaryNotFoundError(glossaryError)) {
          notifyGlossaryFallback('single');
          const fallbackResponse = await translateWithActiveProvider({
            text,
            targetLang,
            sourceLang,
            glossary,
            deeplGlossaryId: undefined,
            references,
            projectSlug,
            projectType,
          });
          const fallbackTranslated = fallbackResponse.translations[0];
          if (!fallbackTranslated?.text) {
            throw new Error('No translation returned', { cause: glossaryError });
          }
          resultText = fallbackTranslated.text;
          resultMeta = fallbackTranslated.metadata;
        } else {
          throw glossaryError;
        }
      }

      trackEvent('translation_completed', { provider: 'single' });

      // If there's existing translation, show confirmation first
      if (hasExistingTranslation) {
        setPendingTranslation(resultText);
        setPendingMeta(resultMeta ?? null);
        setShowConfirm(true);
      } else {
        // No existing translation, apply directly
        onTranslated(resultText, resultMeta);
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
    glossary,
    references,
    onTranslated,
    onError,
    isLoading,
    isDisabled,
    hasExistingTranslation,
    activeProvider,
    projectSlug,
    projectType,
  ]);

  const handleConfirm = useCallback(() => {
    if (pendingTranslation) {
      onTranslated(pendingTranslation, pendingMeta ?? undefined);
    }
    setPendingTranslation(null);
    setPendingMeta(null);
    setShowConfirm(false);
  }, [pendingMeta, pendingTranslation, onTranslated]);

  const handleCancel = useCallback(() => {
    setPendingTranslation(null);
    setPendingMeta(null);
    setShowConfirm(false);
  }, []);

  if (isLoading) {
    if (display === 'button') {
      return (
        <Button size={size} variant="light" disabled leftSection={<Loader size={iconSize} />}>
          {t('Translating...')}
        </Button>
      );
    }

    return (
      <ActionIcon size={size} variant="subtle" disabled aria-label={t('Translating')}>
        <Loader size={iconSize} />
      </ActionIcon>
    );
  }

  if (error) {
    if (display === 'button') {
      return (
        <Tooltip
          label={t('Error: {{error}}. Click to retry.', { error })}
          color="red"
          multiline
          w={220}
        >
          <Button
            size={size}
            variant="light"
            color="red"
            leftSection={<AlertCircle size={iconSize} />}
            onClick={doTranslate}
            disabled={isDisabled}
          >
            {t('Retry translation')}
          </Button>
        </Tooltip>
      );
    }

    return (
      <Tooltip
        label={t('Error: {{error}}. Click to retry.', { error })}
        color="red"
        multiline
        w={200}
      >
        <ActionIcon
          size={size}
          variant="subtle"
          color="red"
          onClick={doTranslate}
          disabled={isDisabled}
          aria-label={t('Retry translation')}
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
              {t('Replace existing translation?')}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            {t('This will overwrite your current translation with the {{provider}} result.', {
              provider: providerLabel,
            })}
          </Text>
          <Group gap="xs" justify="flex-end">
            <Button size="xs" variant="subtle" onClick={handleCancel}>
              {t('Keep original')}
            </Button>
            <Button size="xs" color="blue" onClick={handleConfirm}>
              {t('Replace')}
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
