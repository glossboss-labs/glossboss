export const APP_LANGUAGE_STORAGE_KEY = 'glossboss-app-language';

export const APP_LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Nederlands' },
] as const;

export type AppLanguage = (typeof APP_LANGUAGE_OPTIONS)[number]['value'];

const SUPPORTED_APP_LANGUAGES = new Set<AppLanguage>(
  APP_LANGUAGE_OPTIONS.map((option) => option.value),
);

export function normalizeAppLanguage(value?: string | null): AppLanguage | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  const language = normalized.split('-')[0];

  return SUPPORTED_APP_LANGUAGES.has(language as AppLanguage) ? (language as AppLanguage) : null;
}

export function detectPreferredAppLanguage(preferred?: string | null): AppLanguage {
  return normalizeAppLanguage(preferred) ?? 'en';
}

export function getAppLanguage(): AppLanguage {
  try {
    const stored = normalizeAppLanguage(localStorage.getItem(APP_LANGUAGE_STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // Ignore storage errors and fall back to browser preferences.
  }

  if (typeof navigator !== 'undefined') {
    return detectPreferredAppLanguage(navigator.language);
  }

  return 'en';
}

export function saveAppLanguage(language: AppLanguage): void {
  try {
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage errors.
  }
}

export function clearAppLanguage(): void {
  try {
    localStorage.removeItem(APP_LANGUAGE_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}
