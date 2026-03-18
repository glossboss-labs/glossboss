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

  return <img src={src} alt="GlossBoss" style={{ height: size, display: 'block' }} />;
}
