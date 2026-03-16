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

/**
 * Pixel widths that map to each container option, used to calculate
 * the proportional content area inside a 1920px-wide display preview.
 */
const CONTENT_PX: Record<ContainerWidth, number> = {
  md: 980,
  lg: 1120,
  xl: 1320,
  '100%': 1920,
};
const DISPLAY_W = 1920;
const SIDEBAR_RATIO = 240 / DISPLAY_W; // sidebar takes 240px of 1920

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

          {/* Scaled 1920x1080 display preview */}
          <Box
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              borderRadius: 'var(--mantine-radius-md)',
              border: '2px solid var(--mantine-color-dark-4)',
              backgroundColor: 'var(--mantine-color-dark-7)',
              overflow: 'hidden',
            }}
          >
            {/* Sidebar */}
            <Box
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${SIDEBAR_RATIO * 100}%`,
                height: '100%',
                backgroundColor: 'var(--mantine-color-dark-6)',
                borderRight: '1px solid var(--mantine-color-dark-4)',
                display: 'flex',
                flexDirection: 'column',
                padding: '6% 8%',
                gap: '6%',
              }}
            >
              {/* Sidebar skeleton lines */}
              {[60, 45, 50, 40].map((w, i) => (
                <Box
                  key={i}
                  style={{
                    width: `${w}%`,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: 'var(--mantine-color-dark-4)',
                  }}
                />
              ))}
            </Box>

            {/* Main area */}
            <Box
              style={{
                position: 'absolute',
                top: 0,
                left: `${SIDEBAR_RATIO * 100}%`,
                right: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header bar */}
              <Box
                style={{
                  height: '8%',
                  borderBottom: '1px solid var(--mantine-color-dark-4)',
                  backgroundColor: 'var(--mantine-color-dark-6)',
                }}
              />

              {/* Content area with centered container */}
              <Box
                style={{
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '3% 0',
                }}
              >
                <motion.div
                  initial={false}
                  animate={{
                    width: `${(CONTENT_PX[containerWidth] / (DISPLAY_W - 240)) * 100}%`,
                  }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                  style={{
                    height: '100%',
                    maxWidth: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4%',
                    padding: '0 3%',
                  }}
                >
                  {/* Editor table skeleton rows */}
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Box
                      key={i}
                      style={{
                        display: 'flex',
                        gap: '3%',
                        height: '10%',
                      }}
                    >
                      <Box
                        style={{
                          flex: 1,
                          borderRadius: 2,
                          backgroundColor:
                            i === 0 ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-dark-5)',
                        }}
                      />
                      <Box
                        style={{
                          flex: 1,
                          borderRadius: 2,
                          backgroundColor:
                            i === 0 ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-dark-5)',
                        }}
                      />
                    </Box>
                  ))}
                </motion.div>
              </Box>
            </Box>

            {/* Width label overlay */}
            <Box
              style={{
                position: 'absolute',
                bottom: 6,
                right: 8,
              }}
            >
              <Text size="9px" c="dimmed" fw={500} style={{ userSelect: 'none', opacity: 0.6 }}>
                {CONTAINER_WIDTH_OPTIONS.find((o) => o.value === containerWidth)?.label}
              </Text>
            </Box>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}
