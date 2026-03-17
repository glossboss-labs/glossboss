export const GLOSSARY_SELECTED_LOCALE_KEY = 'glossboss-selected-glossary-locale';
export const GLOSSARY_ENFORCEMENT_KEY = 'glossboss-glossary-enforcement';

/**
 * SessionStorage key tracking locales where the user explicitly dismissed the
 * auto-loaded glossary.  Stored as a JSON array of locale strings.
 * Lives in sessionStorage so dismissal resets on next browser session.
 */
export const GLOSSARY_DISMISSED_KEY = 'glossboss-glossary-dismissed';

/** Mark a locale as dismissed so the cloud-project auto-load skips it. */
export function dismissGlossaryForLocale(locale: string): void {
  try {
    const raw = sessionStorage.getItem(GLOSSARY_DISMISSED_KEY);
    const dismissed: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!dismissed.includes(locale)) {
      dismissed.push(locale);
      sessionStorage.setItem(GLOSSARY_DISMISSED_KEY, JSON.stringify(dismissed));
    }
  } catch {
    /* best-effort */
  }
}

/** Remove a locale from the dismissed list (e.g. when the user manually loads). */
export function undismissGlossaryForLocale(locale: string): void {
  try {
    const raw = sessionStorage.getItem(GLOSSARY_DISMISSED_KEY);
    if (!raw) return;
    const dismissed: string[] = (JSON.parse(raw) as string[]).filter((l) => l !== locale);
    sessionStorage.setItem(GLOSSARY_DISMISSED_KEY, JSON.stringify(dismissed));
  } catch {
    /* best-effort */
  }
}

/** Check whether the user dismissed auto-load for a locale this session. */
export function isGlossaryDismissedForLocale(locale: string): boolean {
  try {
    const raw = sessionStorage.getItem(GLOSSARY_DISMISSED_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as string[]).includes(locale);
  } catch {
    return false;
  }
}

export const COMMON_GLOSSARY_LOCALES = [
  { value: 'ar', label: 'Arabic (ar)' },
  { value: 'cs', label: 'Czech (cs)' },
  { value: 'da', label: 'Danish (da)' },
  { value: 'de', label: 'German (de)' },
  { value: 'el', label: 'Greek (el)' },
  { value: 'es', label: 'Spanish (es)' },
  { value: 'fi', label: 'Finnish (fi)' },
  { value: 'fr', label: 'French (fr)' },
  { value: 'he', label: 'Hebrew (he)' },
  { value: 'hu', label: 'Hungarian (hu)' },
  { value: 'it', label: 'Italian (it)' },
  { value: 'ja', label: 'Japanese (ja)' },
  { value: 'ko', label: 'Korean (ko)' },
  { value: 'nb', label: 'Norwegian (nb)' },
  { value: 'nl', label: 'Dutch (nl)' },
  { value: 'pl', label: 'Polish (pl)' },
  { value: 'pt', label: 'Portuguese (pt)' },
  { value: 'pt-br', label: 'Portuguese - Brazil (pt-br)' },
  { value: 'ro', label: 'Romanian (ro)' },
  { value: 'ru', label: 'Russian (ru)' },
  { value: 'sv', label: 'Swedish (sv)' },
  { value: 'tr', label: 'Turkish (tr)' },
  { value: 'uk', label: 'Ukrainian (uk)' },
  { value: 'zh-cn', label: 'Chinese Simplified (zh-cn)' },
];
