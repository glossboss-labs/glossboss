/**
 * Language lists and mapping utilities for translation providers.
 */

import { msgid } from '@/lib/app-language';

/** DeepL supported source languages */
export const SOURCE_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: '', label: msgid('Auto-detect') },
  { value: 'BG', label: msgid('Bulgarian') },
  { value: 'CS', label: msgid('Czech') },
  { value: 'DA', label: msgid('Danish') },
  { value: 'DE', label: msgid('German') },
  { value: 'EL', label: msgid('Greek') },
  { value: 'EN', label: msgid('English') },
  { value: 'ES', label: msgid('Spanish') },
  { value: 'ET', label: msgid('Estonian') },
  { value: 'FI', label: msgid('Finnish') },
  { value: 'FR', label: msgid('French') },
  { value: 'HU', label: msgid('Hungarian') },
  { value: 'ID', label: msgid('Indonesian') },
  { value: 'IT', label: msgid('Italian') },
  { value: 'JA', label: msgid('Japanese') },
  { value: 'KO', label: msgid('Korean') },
  { value: 'LT', label: msgid('Lithuanian') },
  { value: 'LV', label: msgid('Latvian') },
  { value: 'NB', label: msgid('Norwegian') },
  { value: 'NL', label: msgid('Dutch') },
  { value: 'PL', label: msgid('Polish') },
  { value: 'PT', label: msgid('Portuguese') },
  { value: 'RO', label: msgid('Romanian') },
  { value: 'RU', label: msgid('Russian') },
  { value: 'SK', label: msgid('Slovak') },
  { value: 'SL', label: msgid('Slovenian') },
  { value: 'SV', label: msgid('Swedish') },
  { value: 'TR', label: msgid('Turkish') },
  { value: 'UK', label: msgid('Ukrainian') },
  { value: 'ZH', label: msgid('Chinese') },
];

/** DeepL supported target languages */
export const TARGET_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: 'BG', label: msgid('Bulgarian') },
  { value: 'CS', label: msgid('Czech') },
  { value: 'DA', label: msgid('Danish') },
  { value: 'DE', label: msgid('German') },
  { value: 'EL', label: msgid('Greek') },
  { value: 'EN-GB', label: msgid('English (UK)') },
  { value: 'EN-US', label: msgid('English (US)') },
  { value: 'ES', label: msgid('Spanish') },
  { value: 'ET', label: msgid('Estonian') },
  { value: 'FI', label: msgid('Finnish') },
  { value: 'FR', label: msgid('French') },
  { value: 'HU', label: msgid('Hungarian') },
  { value: 'ID', label: msgid('Indonesian') },
  { value: 'IT', label: msgid('Italian') },
  { value: 'JA', label: msgid('Japanese') },
  { value: 'KO', label: msgid('Korean') },
  { value: 'LT', label: msgid('Lithuanian') },
  { value: 'LV', label: msgid('Latvian') },
  { value: 'NB', label: msgid('Norwegian') },
  { value: 'NL', label: msgid('Dutch') },
  { value: 'PL', label: msgid('Polish') },
  { value: 'PT-BR', label: msgid('Portuguese (Brazil)') },
  { value: 'PT-PT', label: msgid('Portuguese (Portugal)') },
  { value: 'RO', label: msgid('Romanian') },
  { value: 'RU', label: msgid('Russian') },
  { value: 'SK', label: msgid('Slovak') },
  { value: 'SL', label: msgid('Slovenian') },
  { value: 'SV', label: msgid('Swedish') },
  { value: 'TR', label: msgid('Turkish') },
  { value: 'UK', label: msgid('Ukrainian') },
  { value: 'ZH', label: msgid('Chinese') },
];

/** Map PO language codes to DeepL codes */
export function mapToDeepLCode(poLang: string): string | null {
  const code = poLang.toUpperCase().replace('_', '-');
  const directMatch = TARGET_LANGUAGES.find((l) => l.value === code);
  if (directMatch) return directMatch.value;
  const baseCode = code.split('-')[0];
  const baseMatch = TARGET_LANGUAGES.find(
    (l) => l.value === baseCode || l.value.startsWith(baseCode + '-'),
  );
  if (baseMatch) return baseMatch.value;
  return null;
}
