/**
 * Development Section — branch chip toggle (dev-only).
 */

import { Stack, Text, Alert, Badge, Paper, Group, Switch } from '@mantine/core';
import { GitBranch } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';

export interface DevelopmentSectionProps {
  branchChipEnabled?: boolean;
  onBranchChipEnabledChange?: (enabled: boolean) => void;
}

export function DevelopmentSection({
  branchChipEnabled = true,
  onBranchChipEnabledChange,
}: DevelopmentSectionProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="md">
      <Alert color="orange" variant="light" icon={<GitBranch size={16} />}>
        <Text size="sm" fw={600}>
          {t('Development Mode Only')}
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
            onChange={(e) => onBranchChipEnabledChange?.(e.currentTarget.checked)}
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
