/**
 * CountryFlag — renders a circular SVG flag icon.
 * Cross-platform replacement for flag emoji (which Windows doesn't support).
 * Uses pre-copied circle-flags SVGs from public/flags/.
 */

import { getCountryCode } from '@/lib/flags';

interface CountryFlagProps {
  /** Language or locale code (e.g. "nl", "en-US", "pt-br") */
  code: string | null | undefined;
  size?: 'xs' | 'sm' | 'md';
}

const PX: Record<string, number> = {
  xs: 14,
  sm: 18,
  md: 22,
};

export function CountryFlag({ code, size = 'sm' }: CountryFlagProps) {
  if (!code) return null;
  const country = getCountryCode(code);
  if (!country) return null;

  const px = PX[size];

  return (
    <img
      src={`${import.meta.env.BASE_URL}flags/${country.toLowerCase()}.svg`}
      alt=""
      aria-hidden="true"
      width={px}
      height={px}
      loading="lazy"
      style={{
        display: 'inline-block',
        flexShrink: 0,
        verticalAlign: 'middle',
      }}
    />
  );
}
