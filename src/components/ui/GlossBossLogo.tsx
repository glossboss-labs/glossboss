/**
 * GlossBossLogo — renders the GlossBoss brand mark.
 *
 * Variants:
 *  - "full" — combined wordmark + icon (default)
 *  - "icon" — icon only
 *
 * Automatically switches between light/dark assets based on the current
 * Mantine color scheme.
 */

import { useComputedColorScheme } from '@mantine/core';

interface GlossBossLogoProps {
  /** Height in px. Defaults to 28. */
  size?: number;
  /** "full" = combined wordmark + icon; "icon" = icon only. */
  variant?: 'full' | 'icon';
}

export function GlossBossLogo({ size = 28, variant = 'full' }: GlossBossLogoProps) {
  const computedColorScheme = useComputedColorScheme('light');
  const isDark = computedColorScheme === 'dark';

  const src =
    variant === 'icon'
      ? isDark
        ? '/glossboss-icon-light.svg'
        : '/glossboss-icon-dark.svg'
      : isDark
        ? '/glossboss-combined-light.svg'
        : '/glossboss-combined-dark.svg';

  // Icon is 1:1, combined wordmark has viewBox 364.3×80 (aspect ~4.554:1).
  const width = variant === 'icon' ? size : Math.round(size * (364.3 / 80));

  return (
    <img
      src={src}
      alt="GlossBoss"
      width={width}
      height={size}
      style={{ height: size, display: 'block' }}
    />
  );
}
