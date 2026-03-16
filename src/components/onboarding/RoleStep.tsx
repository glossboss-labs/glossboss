/**
 * RoleStep — "How will you use GlossBoss?" option cards.
 * Auto-advances on selection after a short delay.
 */

import { useCallback } from 'react';
import { Title, Text, Stack } from '@mantine/core';
import { User, Users, Building2, Code } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation, msgid } from '@/lib/app-language';
import type { UserRole } from '@/lib/onboarding/types';
import { cn } from '@/lib/utils';

interface RoleOption {
  value: UserRole;
  label: string;
  description: string;
  Icon: LucideIcon;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'individual',
    label: msgid('Individual translator'),
    description: msgid('Translating on my own'),
    Icon: User,
  },
  {
    value: 'team_lead',
    label: msgid('Team lead'),
    description: msgid('Managing a translation team'),
    Icon: Users,
  },
  {
    value: 'agency',
    label: msgid('Agency or studio'),
    description: msgid('Working with multiple clients'),
    Icon: Building2,
  },
  {
    value: 'developer',
    label: msgid('Developer'),
    description: msgid('Localizing my own project'),
    Icon: Code,
  },
];

interface RoleStepProps {
  onNext: (role: UserRole) => void;
}

export function RoleStep({ onNext }: RoleStepProps) {
  const { t } = useTranslation();

  const handleSelect = useCallback(
    (role: UserRole) => {
      setTimeout(() => onNext(role), 200);
    },
    [onNext],
  );

  return (
    <Stack gap="md">
      <div className="text-center">
        <Title order={3} fw={700}>
          {t('How will you use GlossBoss?')}
        </Title>
        <Text size="sm" c="dimmed" mt={4}>
          {t("We'll tailor your experience based on your answer.")}
        </Text>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {ROLE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border border-border-subtle bg-surface-1 p-4',
              'cursor-pointer transition-all hover:border-accent/40 hover:bg-surface-2',
            )}
          >
            <option.Icon className="h-6 w-6 text-text-secondary" strokeWidth={1.5} />
            <span className="text-sm font-medium text-text-primary">{t(option.label)}</span>
            <span className="text-xs text-text-tertiary">{t(option.description)}</span>
          </button>
        ))}
      </div>
    </Stack>
  );
}
