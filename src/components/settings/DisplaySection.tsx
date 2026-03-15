/**
 * Display Section — container width selector, app language selector.
 */

import { Stack, Text, Paper, Select, SegmentedControl, Anchor } from '@mantine/core';
import { Languages } from 'lucide-react';
import { CONTAINER_WIDTH_OPTIONS, type ContainerWidth } from '@/lib/container-width';
import { APP_LANGUAGE_OPTIONS, useTranslation, type AppLanguage } from '@/lib/app-language';

export interface DisplaySectionProps {
  containerWidth?: ContainerWidth;
  onContainerWidthChange?: (width: ContainerWidth) => void;
}

export function DisplaySection({
  containerWidth = 'xl',
  onContainerWidthChange,
}: DisplaySectionProps) {
  const { language, setLanguage, t } = useTranslation();

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {t('Adjust the appearance of the editor to suit your screen and preferences.')}
      </Text>

      <Paper p="md" withBorder>
        <Stack gap="sm">
          <div>
            <Text size="sm" fw={500}>
              {t('Interface language')}
            </Text>
            <Text size="xs" c="dimmed">
              {t('Choose which language GlossBoss uses for its interface.')}
            </Text>
          </div>

          <Select
            aria-label={t('Interface language')}
            value={language}
            onChange={(value) => {
              if (value) {
                setLanguage(value as AppLanguage);
              }
            }}
            data={APP_LANGUAGE_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            leftSection={<Languages size={14} />}
            allowDeselect={false}
          />

          <Text size="xs" c="dimmed">
            {t('Want to help translate GlossBoss?')}{' '}
            <Anchor href="/translate/" target="_blank" rel="noopener noreferrer">
              {t('Read the translation guide')}
            </Anchor>
          </Text>
        </Stack>
      </Paper>

      <Paper p="md" withBorder>
        <Stack gap="sm">
          <div>
            <Text size="sm" fw={500}>
              {t('Container width')}
            </Text>
            <Text size="xs" c="dimmed">
              {t(
                'Controls the maximum width of the main content area. Use a wider setting on large monitors, or full width to use all available space.',
              )}
            </Text>
          </div>

          <SegmentedControl
            value={containerWidth}
            onChange={(value) => onContainerWidthChange?.(value as ContainerWidth)}
            data={CONTAINER_WIDTH_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
            fullWidth
            size="xs"
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
