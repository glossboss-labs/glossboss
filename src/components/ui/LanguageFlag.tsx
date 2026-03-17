/**
 * LanguageFlag — displays a colored country-code badge for a language/locale code.
 * Returns null if no flag mapping exists for the given code.
 */

import { CountryFlag } from './CountryFlag';

interface LanguageFlagProps {
  code: string | null | undefined;
  size?: 'xs' | 'sm' | 'md';
}

export function LanguageFlag({ code, size = 'sm' }: LanguageFlagProps) {
  return <CountryFlag code={code} size={size} />;
}
