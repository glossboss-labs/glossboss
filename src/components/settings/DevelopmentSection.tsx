/**
 * Development Section — branch chip toggle (dev-only).
 *
 * Self-contained: reads/writes localStorage directly.
 */

import { Stack, Text, Alert, Badge, Paper, Group, Switch } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { GitBranch } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { DEV_BRANCH_CHIP_KEY } from '@/lib/constants/storage-keys';

const BRANCH_CHIP_KEY = DEV_BRANCH_CHIP_KEY;

export interface DevelopmentSectionProps {
  branchChipEnabled?: boolean;
  onBranchChipEnabledChange?: (enabled: boolean) => void;
}

export function DevelopmentSection({
  branchChipEnabled: controlledValue,
  onBranchChipEnabledChange,
}: DevelopmentSectionProps) {
  const { t } = useTranslation();

  const [storedValue, setStoredValue] = useLocalStorage({
    key: BRANCH_CHIP_KEY,
    defaultValue: true,
  });

  const branchChipEnabled = controlledValue ?? storedValue;

  const handleChange = (enabled: boolean) => {
    setStoredValue(enabled);
    onBranchChipEnabledChange?.(enabled);
  };

  return (
    <Stack gap="md">
      <Alert color="orange" variant="light" icon={<GitBranch size={16} />}>
        <Text size="sm" fw={600}>
          {t('Development mode only')}
        </Text>
        <Text size="sm">
          {t(
            'These tools only appear while running the app locally in development and are not shown in production.',
          )}
        </Text>
      </Alert>

      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="sm" fw={500}>
                {t('Branch status badge')}
              </Text>
              <Text size="xs" c="dimmed">
                {t(
                  'Show the current git branch in a small floating badge at the bottom right of the site.',
                )}
              </Text>
            </div>

            <Badge variant="light" color="gray">
              {__GIT_BRANCH__}
            </Badge>
          </Group>

          <Switch
            label={t('Show branch badge')}
            description={t('Only visible while running the app in development mode')}
            checked={branchChipEnabled}
            onChange={(e) => handleChange(e.currentTarget.checked)}
            styles={{
              track: {
                transition: 'background-color 0.2s ease, border-color 0.2s ease',
              },
              thumb: {
                transition: 'transform 0.2s ease, left 0.2s ease',
              },
            }}
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
