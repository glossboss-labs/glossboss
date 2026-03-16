/**
 * Display Section — container width selector, app language selector.
 *
 * Self-contained: reads/writes localStorage directly so it works both
 * in the Settings page (standalone) and when passed props from the editor.
 */

import { Stack, Text, Paper, Select, SegmentedControl, Anchor, Box } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { Languages } from 'lucide-react';
import { motion } from 'motion/react';
import {
  CONTAINER_WIDTH_KEY,
  CONTAINER_WIDTH_OPTIONS,
  type ContainerWidth,
} from '@/lib/container-width';
import { APP_LANGUAGE_OPTIONS, useTranslation, type AppLanguage } from '@/lib/app-language';

/** Maps container width values to a proportional percentage for the preview bar. */
const WIDTH_PREVIEW: Record<ContainerWidth, number> = {
  md: 55,
  lg: 70,
  xl: 85,
  '100%': 100,
};

export interface DisplaySectionProps {
  containerWidth?: ContainerWidth;
  onContainerWidthChange?: (width: ContainerWidth) => void;
}

export function DisplaySection({
  containerWidth: controlledWidth,
  onContainerWidthChange,
}: DisplaySectionProps) {
  const { language, setLanguage, t } = useTranslation();

  const [storedWidth, setStoredWidth] = useLocalStorage<ContainerWidth>({
    key: CONTAINER_WIDTH_KEY,
    defaultValue: 'xl',
  });

  const containerWidth = controlledWidth ?? storedWidth;

  const handleWidthChange = (value: ContainerWidth) => {
    setStoredWidth(value);
    onContainerWidthChange?.(value);
  };

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
            onChange={(value) => handleWidthChange(value as ContainerWidth)}
            data={CONTAINER_WIDTH_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
            fullWidth
            size="xs"
          />

          <Box
            style={{
              position: 'relative',
              height: 32,
              borderRadius: 'var(--mantine-radius-sm)',
              backgroundColor: 'var(--mantine-color-dark-6)',
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={false}
              animate={{ width: `${WIDTH_PREVIEW[containerWidth]}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{
                height: '100%',
                borderRadius: 'var(--mantine-radius-sm)',
                background:
                  'linear-gradient(90deg, var(--mantine-color-blue-8), var(--mantine-color-blue-6))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text size="xs" fw={500} c="white" style={{ userSelect: 'none' }}>
                {CONTAINER_WIDTH_OPTIONS.find((o) => o.value === containerWidth)?.label}
              </Text>
            </motion.div>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}
