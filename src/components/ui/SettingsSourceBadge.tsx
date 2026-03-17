/**
 * SettingsSourceBadge — shows where a setting comes from in the cascade.
 *
 * Used in project settings to indicate whether a value is inherited from
 * the org, overridden at the project level, or the user's personal setting.
 */

import { Badge, Tooltip } from '@mantine/core';
import { Lock } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';

export type SettingsSource = 'org-enforced' | 'org-default' | 'project' | 'personal' | 'default';

interface SettingsSourceBadgeProps {
  source: SettingsSource;
}

export function SettingsSourceBadge({ source }: SettingsSourceBadgeProps) {
  const { t } = useTranslation();

  switch (source) {
    case 'org-enforced':
      return (
        <Tooltip label={t('This setting is enforced by your organization and cannot be changed.')}>
          <Badge variant="light" color="red" size="xs" leftSection={<Lock size={10} />}>
            {t('Org enforced')}
          </Badge>
        </Tooltip>
      );
    case 'org-default':
      return (
        <Badge variant="light" color="blue" size="xs">
          {t('Org default')}
        </Badge>
      );
    case 'project':
      return (
        <Badge variant="light" color="cyan" size="xs">
          {t('Project override')}
        </Badge>
      );
    case 'personal':
      return (
        <Badge variant="light" color="gray" size="xs">
          {t('Personal')}
        </Badge>
      );
    case 'default':
    default:
      return null;
  }
}
