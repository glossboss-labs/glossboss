/**
 * Provider Picker — language selection dropdowns for source and target,
 * plus provider badge and API key warning.
 */

import type { ReactNode } from 'react';
import { Group, Select, Text, Badge, Alert, Button, Stack, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { motion, AnimatePresence } from 'motion/react';
import { WandSparkles, Key } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { contentVariants } from '@/lib/motion';
import { renderFlagOption } from '@/components/ui';
import { SOURCE_LANGUAGES, TARGET_LANGUAGES } from './translate-languages';

const MotionDiv = motion.div;

export interface ProviderPickerProps {
  sourceLang: string;
  targetLang: string;
  inferredTarget: string | null;
  providerLabel: string;
  hasApiKey: boolean;
  selectedCount: number;
  untranslatedCount: number;
  onSourceChange: (value: string | null) => void;
  onTargetChange: (value: string | null) => void;
  /** Slot for action buttons (translate / cancel) rendered beside the language selectors */
  actionSlot?: ReactNode;
  /** Navigate to settings (called when user clicks "Set up API key") */
  onOpenSettings?: (tab?: string) => void;
}

export function ProviderPicker({
  sourceLang,
  targetLang,
  inferredTarget,
  providerLabel,
  hasApiKey,
  selectedCount,
  untranslatedCount,
  onSourceChange,
  onTargetChange,
  actionSlot,
  onOpenSettings,
}: ProviderPickerProps) {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  return (
    <>
      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap="xs">
          <WandSparkles size={14} />
          <Text size="sm" fw={600}>
            {t('Machine translation')}
          </Text>
          <Badge size="xs" variant="light" color="gray">
            {providerLabel}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          {selectedCount > 0
            ? t('{{count}} selected', { count: selectedCount })
            : t('{{count}} untranslated', { count: untranslatedCount })}
        </Text>
      </Group>

      {/* API Key Warning */}
      <AnimatePresence>
        {!hasApiKey && (
          <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
            <Alert color="yellow" icon={<Key size={16} />}>
              <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                <Text size="sm">
                  {t('To start translating, connect a free API key — it takes about 2 minutes.')}
                </Text>
                {onOpenSettings && (
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<Key size={14} />}
                    onClick={() => onOpenSettings('translation')}
                  >
                    {t('Set up API key')}
                  </Button>
                )}
              </Group>
            </Alert>
          </MotionDiv>
        )}
      </AnimatePresence>

      <Group
        data-tour="language-selectors"
        justify="space-between"
        align={isMobile ? 'stretch' : 'center'}
        wrap="wrap"
        style={isMobile ? { flexDirection: 'column' } : undefined}
      >
        {isMobile ? (
          <Stack gap="xs" w="100%">
            <Group gap="xs" align="center" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={500}>
                {t('From')}
              </Text>
              <Select
                data={SOURCE_LANGUAGES.map((opt) => ({
                  ...opt,
                  label: t(opt.label),
                }))}
                value={sourceLang}
                onChange={onSourceChange}
                placeholder={t('Auto-detect')}
                searchable
                clearable
                size="xs"
                disabled={!hasApiKey}
                aria-label={t('Source language')}
                style={{ flex: 1, minWidth: 0 }}
                renderOption={renderFlagOption}
              />
            </Group>
            <Group gap="xs" align="center" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={500}>
                {t('To')}
              </Text>
              <Select
                data={TARGET_LANGUAGES.map((opt) => ({
                  ...opt,
                  label: t(opt.label),
                }))}
                value={targetLang}
                onChange={onTargetChange}
                placeholder={t('Select target...')}
                searchable
                required
                size="xs"
                disabled={!hasApiKey}
                aria-label={t('Target language')}
                style={{ flex: 1, minWidth: 0 }}
                renderOption={renderFlagOption}
              />
              {inferredTarget && (
                <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>
                  {t('Detected: {{target}}', { target: inferredTarget })}
                </Badge>
              )}
            </Group>
          </Stack>
        ) : (
          <Group gap="xs" align="center">
            <Text size="xs" c="dimmed" fw={500}>
              {t('From')}
            </Text>
            <Select
              data={SOURCE_LANGUAGES.map((opt) => ({
                ...opt,
                label: t(opt.label),
              }))}
              value={sourceLang}
              onChange={onSourceChange}
              placeholder={t('Auto-detect')}
              searchable
              clearable
              w={160}
              size="xs"
              disabled={!hasApiKey}
              aria-label={t('Source language')}
              renderOption={renderFlagOption}
            />

            <Text c="dimmed" size="sm" aria-hidden="true">
              {'\u2192'}
            </Text>

            <Text size="xs" c="dimmed" fw={500}>
              {t('To')}
            </Text>
            <Select
              data={TARGET_LANGUAGES.map((opt) => ({
                ...opt,
                label: t(opt.label),
              }))}
              value={targetLang}
              onChange={onTargetChange}
              placeholder={t('Select target...')}
              searchable
              required
              w={170}
              size="xs"
              disabled={!hasApiKey}
              aria-label={t('Target language')}
              renderOption={renderFlagOption}
            />

            {inferredTarget && (
              <Badge size="xs" variant="light" color="gray">
                {t('Detected: {{target}}', { target: inferredTarget })}
              </Badge>
            )}
          </Group>
        )}

        {actionSlot}
      </Group>
    </>
  );
}
