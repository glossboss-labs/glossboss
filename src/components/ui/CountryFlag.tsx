/**
 * CountryFlag — renders a small colored badge with a 2-letter country code.
 * Cross-platform replacement for flag emoji (which Windows doesn't support).
 */

import { Text } from '@mantine/core';
import { getCountryCode } from '@/lib/flags';

interface CountryFlagProps {
  /** Language or locale code (e.g. "nl", "en-US", "pt-br") */
  code: string | null | undefined;
  size?: 'xs' | 'sm' | 'md';
}

/** Curated palette — high-contrast, visually distinct badges. */
const PALETTE = [
  '#c0392b', // red
  '#2980b9', // blue
  '#27ae60', // green
  '#8e44ad', // purple
  '#d35400', // orange
  '#16a085', // teal
  '#2c3e50', // navy
  '#e67e22', // amber
  '#1abc9c', // turquoise
  '#7f8c8d', // grey
  '#e74c3c', // scarlet
  '#3498db', // sky
  '#2ecc71', // emerald
  '#9b59b6', // violet
  '#f39c12', // gold
  '#0097a7', // cyan
  '#6d4c41', // brown
  '#546e7a', // slate
  '#ad1457', // magenta
  '#00897b', // dark teal
] as const;

const BADGE_SIZE: Record<string, { fontSize: number; px: number; height: number }> = {
  xs: { fontSize: 8, px: 3, height: 14 },
  sm: { fontSize: 9, px: 4, height: 16 },
  md: { fontSize: 10, px: 5, height: 18 },
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
  }
  return Math.abs(h);
}

export function CountryFlag({ code, size = 'sm' }: CountryFlagProps) {
  if (!code) return null;
  const country = getCountryCode(code);
  if (!country) return null;

  const bg = PALETTE[hashStr(country) % PALETTE.length];
  const s = BADGE_SIZE[size];

  return (
    <Text
      component="span"
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        color: '#fff',
        fontSize: s.fontSize,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: 0.5,
        borderRadius: 3,
        padding: `0 ${s.px}px`,
        height: s.height,
        minWidth: s.height + 2,
        textTransform: 'uppercase',
        flexShrink: 0,
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      }}
    >
      {country}
    </Text>
  );
}
