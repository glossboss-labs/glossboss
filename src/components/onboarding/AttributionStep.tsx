/**
 * AttributionStep — "How did you hear about us?" single-select.
 * Analytics-only (PostHog event), not stored in DB.
 * Auto-advances on selection.
 */

import { useCallback } from 'react';
import { Title, Text, Stack, Button } from '@mantine/core';
import { Search, Share2, MessageCircle, BookOpen, Github, HelpCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation, msgid } from '@/lib/app-language';
import type { AttributionSource } from '@/lib/onboarding/types';
import { cn } from '@/lib/utils';

interface AttributionOption {
  value: AttributionSource;
  label: string;
  Icon: LucideIcon;
}

const ATTRIBUTION_OPTIONS: AttributionOption[] = [
  { value: 'search', label: msgid('Search engine'), Icon: Search },
  { value: 'social', label: msgid('Social media'), Icon: Share2 },
  { value: 'word_of_mouth', label: msgid('Word of mouth'), Icon: MessageCircle },
  { value: 'blog', label: msgid('Blog or article'), Icon: BookOpen },
  { value: 'github', label: msgid('GitHub'), Icon: Github },
  { value: 'other', label: msgid('Other'), Icon: HelpCircle },
];

interface AttributionStepProps {
  onNext: (source: AttributionSource | null) => void;
}

export function AttributionStep({ onNext }: AttributionStepProps) {
  const { t } = useTranslation();

  const handleSelect = useCallback(
    (source: AttributionSource) => {
      setTimeout(() => onNext(source), 200);
    },
    [onNext],
  );

  return (
    <Stack gap="md">
      <div className="text-center">
        <Title order={3} fw={700}>
          {t('How did you hear about us?')}
        </Title>
        <Text size="sm" c="dimmed" mt={4}>
          {t('This helps us improve how we reach translators like you.')}
        </Text>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ATTRIBUTION_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border border-border-subtle bg-surface-1 p-4',
              'cursor-pointer transition-all hover:border-accent/40 hover:bg-surface-2',
            )}
          >
            <option.Icon className="h-5 w-5 text-text-secondary" strokeWidth={1.5} />
            <span className="text-sm font-medium text-text-secondary">{t(option.label)}</span>
          </button>
        ))}
      </div>

      <Button variant="subtle" size="xs" fullWidth onClick={() => onNext(null)} c="dimmed">
        {t('Skip')}
      </Button>
    </Stack>
  );
}
