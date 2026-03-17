import { getFlagEmoji } from '@/lib/flags';

export const GLOSSARY_SELECTED_LOCALE_KEY = 'glossboss-selected-glossary-locale';
export const GLOSSARY_ENFORCEMENT_KEY = 'glossboss-glossary-enforcement';

/** Prepend flag emoji to a locale label if available. */
function flagLabel(code: string, label: string): string {
  const flag = getFlagEmoji(code);
  return flag ? `${flag} ${label}` : label;
}

export const COMMON_GLOSSARY_LOCALES = [
  { value: 'ar', label: flagLabel('ar', 'Arabic (ar)') },
  { value: 'cs', label: flagLabel('cs', 'Czech (cs)') },
  { value: 'da', label: flagLabel('da', 'Danish (da)') },
  { value: 'de', label: flagLabel('de', 'German (de)') },
  { value: 'el', label: flagLabel('el', 'Greek (el)') },
  { value: 'es', label: flagLabel('es', 'Spanish (es)') },
  { value: 'fi', label: flagLabel('fi', 'Finnish (fi)') },
  { value: 'fr', label: flagLabel('fr', 'French (fr)') },
  { value: 'he', label: flagLabel('he', 'Hebrew (he)') },
  { value: 'hu', label: flagLabel('hu', 'Hungarian (hu)') },
  { value: 'it', label: flagLabel('it', 'Italian (it)') },
  { value: 'ja', label: flagLabel('ja', 'Japanese (ja)') },
  { value: 'ko', label: flagLabel('ko', 'Korean (ko)') },
  { value: 'nb', label: flagLabel('nb', 'Norwegian (nb)') },
  { value: 'nl', label: flagLabel('nl', 'Dutch (nl)') },
  { value: 'pl', label: flagLabel('pl', 'Polish (pl)') },
  { value: 'pt', label: flagLabel('pt', 'Portuguese (pt)') },
  { value: 'pt-br', label: flagLabel('pt-br', 'Portuguese - Brazil (pt-br)') },
  { value: 'ro', label: flagLabel('ro', 'Romanian (ro)') },
  { value: 'ru', label: flagLabel('ru', 'Russian (ru)') },
  { value: 'sv', label: flagLabel('sv', 'Swedish (sv)') },
  { value: 'tr', label: flagLabel('tr', 'Turkish (tr)') },
  { value: 'uk', label: flagLabel('uk', 'Ukrainian (uk)') },
  { value: 'zh-cn', label: flagLabel('zh-cn', 'Chinese Simplified (zh-cn)') },
];
