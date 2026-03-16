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

/** Content width as a fraction of the main area (viewport minus 240px sidebar). */
const CONTENT_FRACTION: Record<ContainerWidth, number> = {
  md: 980 / 1680,
  lg: 1120 / 1680,
  xl: 1320 / 1680,
  '100%': 1,
};

/** Skeleton bar — a small rounded rectangle used in the display preview. */
function Skel({
  w = '100%',
  h = 3,
  color = 'var(--mantine-color-default-border)',
}: {
  w?: string | number;
  h?: number;
  color?: string;
}) {
  return (
    <Box style={{ width: w, height: h, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
  );
}

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

          {/* Scaled 16:9 display preview */}
          <Box
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              borderRadius: 'var(--mantine-radius-md)',
              border: '1px solid var(--mantine-color-default-border)',
              backgroundColor: 'var(--mantine-color-body)',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            {/* Sidebar */}
            <Box
              style={{
                width: '12.5%',
                flexShrink: 0,
                borderRight: '1px solid var(--mantine-color-default-border)',
                display: 'flex',
                flexDirection: 'column',
                padding: '3% 2%',
                gap: 4,
              }}
            >
              <Skel w="70%" />
              <Box style={{ height: 6 }} />
              {[55, 40, 48, 42].map((w, i) => (
                <Skel key={i} w={`${w}%`} h={2} />
              ))}
            </Box>

            {/* Main area */}
            <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {/* Top header bar */}
              <Box
                style={{
                  height: '7%',
                  borderBottom: '1px solid var(--mantine-color-default-border)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 3%',
                  gap: '2%',
                }}
              >
                <Skel w="15%" h={3} />
                <Skel w="8%" h={3} />
              </Box>

              {/* Content area */}
              <Box
                style={{
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  initial={false}
                  animate={{ width: `${CONTENT_FRACTION[containerWidth] * 100}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '2% 2% 0',
                  }}
                >
                  {/* File info bar */}
                  <Box style={{ display: 'flex', gap: '2%', marginBottom: '3%' }}>
                    <Skel w="25%" h={3} />
                    <Skel w={16} h={3} color="var(--mantine-color-blue-4)" />
                  </Box>

                  {/* Toolbar row */}
                  <Box
                    style={{
                      display: 'flex',
                      gap: '2%',
                      marginBottom: '3%',
                      alignItems: 'center',
                    }}
                  >
                    <Skel w="35%" h={4} color="var(--mantine-color-default-border)" />
                    <Box style={{ flex: 1 }} />
                    <Skel w="8%" h={3} />
                    <Skel w="8%" h={3} />
                  </Box>

                  {/* Table header */}
                  <Box
                    style={{
                      display: 'flex',
                      borderBottom: '1px solid var(--mantine-color-default-border)',
                      paddingBottom: 2,
                      marginBottom: 2,
                      gap: '4%',
                    }}
                  >
                    <Box style={{ width: '8%' }}>
                      <Skel w="100%" h={2} />
                    </Box>
                    <Box style={{ flex: 1 }}>
                      <Skel w="30%" h={2} />
                    </Box>
                    <Box style={{ flex: 1 }}>
                      <Skel w="35%" h={2} />
                    </Box>
                  </Box>

                  {/* Table rows */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Box
                      key={i}
                      style={{
                        display: 'flex',
                        gap: '4%',
                        padding: '1.5% 0',
                        borderBottom: '1px solid var(--mantine-color-default-border)',
                        opacity: 1 - i * 0.1,
                      }}
                    >
                      <Box
                        style={{
                          width: '8%',
                          display: 'flex',
                          alignItems: 'flex-start',
                          paddingTop: 1,
                        }}
                      >
                        <Skel w={14} h={3} color="var(--mantine-color-teal-4)" />
                      </Box>
                      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Skel w={`${65 - i * 8}%`} h={2} />
                        {i === 1 && <Skel w="80%" h={2} />}
                      </Box>
                      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Skel w={`${60 - i * 6}%`} h={2} />
                        {i === 1 && <Skel w="75%" h={2} />}
                      </Box>
                    </Box>
                  ))}
                </motion.div>
              </Box>
            </Box>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}
