/**
 * StatusDot — compact 10px colored circle for status indication.
 *
 * Inspired by Crowdin's approach: a small dot instead of a full badge
 * in dense table rows where space is limited.
 */

import { Tooltip, Box } from '@mantine/core';
import { useTranslation } from '@/lib/app-language';
import { TRANSLATION_STATUS_COLORS, TRANSLATION_STATUS_LABELS } from '@/lib/design-tokens';
import type { TranslationStatus } from '@/types';

interface StatusDotProps {
  status: TranslationStatus;
  /** Dot diameter in pixels. */
  size?: number;
  /** Show tooltip with status label on hover. */
  withTooltip?: boolean;
}

export function StatusDot({ status, size = 10, withTooltip = true }: StatusDotProps) {
  const { t } = useTranslation();
  const color = `var(--mantine-color-${TRANSLATION_STATUS_COLORS[status]}-6)`;

  const dot = (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );

  if (!withTooltip) return dot;

  return <Tooltip label={t(TRANSLATION_STATUS_LABELS[status])}>{dot}</Tooltip>;
}
