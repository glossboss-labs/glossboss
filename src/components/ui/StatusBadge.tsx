/**
 * StatusBadge — Badge wired to design tokens for consistent status display.
 */

import { Badge, type BadgeProps } from '@mantine/core';
import { useTranslation } from '@/lib/app-language';
import {
  TRANSLATION_STATUS_COLORS,
  TRANSLATION_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
  REVIEW_STATUS_LABELS,
} from '@/lib/design-tokens';
import type { TranslationStatus } from '@/types';
import type { ReviewStatus } from '@/lib/review';

interface TranslationStatusBadgeProps extends Omit<BadgeProps, 'color' | 'children'> {
  status: TranslationStatus;
}

export function TranslationStatusBadge({
  status,
  variant = 'filled',
  size = 'sm',
  ...rest
}: TranslationStatusBadgeProps) {
  const { t } = useTranslation();
  return (
    <Badge color={TRANSLATION_STATUS_COLORS[status]} variant={variant} size={size} {...rest}>
      {t(TRANSLATION_STATUS_LABELS[status])}
    </Badge>
  );
}

interface ReviewStatusBadgeProps extends Omit<BadgeProps, 'color' | 'children'> {
  status: ReviewStatus;
}

export function ReviewStatusBadge({
  status,
  variant = 'light',
  size = 'xs',
  ...rest
}: ReviewStatusBadgeProps) {
  const { t } = useTranslation();
  return (
    <Badge color={REVIEW_STATUS_COLORS[status]} variant={variant} size={size} {...rest}>
      {t(REVIEW_STATUS_LABELS[status])}
    </Badge>
  );
}
