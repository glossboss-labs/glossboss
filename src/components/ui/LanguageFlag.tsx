/**
 * LanguageFlag — displays a flag emoji for a language/locale code.
 * Returns null if no flag mapping exists for the given code.
 */

import { Text } from '@mantine/core';
import { getFlagEmoji } from '@/lib/flags';

interface LanguageFlagProps {
  code: string | null | undefined;
  size?: 'xs' | 'sm' | 'md';
}

const FONT_SIZE: Record<string, string> = {
  xs: '12px',
  sm: '14px',
  md: '16px',
};

export function LanguageFlag({ code, size = 'sm' }: LanguageFlagProps) {
  if (!code) return null;
  const flag = getFlagEmoji(code);
  if (!flag) return null;

  return (
    <Text component="span" style={{ fontSize: FONT_SIZE[size], lineHeight: 1 }} aria-hidden="true">
      {flag}
    </Text>
  );
}
