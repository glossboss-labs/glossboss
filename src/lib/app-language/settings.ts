import { DISCOVERED_APP_LANGUAGES } from './discovery';
import { APP_LANGUAGE_KEY } from '@/lib/constants/storage-keys';

export const APP_LANGUAGE_STORAGE_KEY = APP_LANGUAGE_KEY;

export const APP_LANGUAGE_OPTIONS = DISCOVERED_APP_LANGUAGES.map(({ value, label }) => ({
  value,
  label,
}));

export type AppLanguage = (typeof APP_LANGUAGE_OPTIONS)[number]['value'];

const SUPPORTED_APP_LANGUAGES = new Set<AppLanguage>(
  APP_LANGUAGE_OPTIONS.map((option) => option.value),
);

const englishAppLanguage = APP_LANGUAGE_OPTIONS.find((option) => option.value === 'en')?.value;

if (!englishAppLanguage) {
  throw new Error(
    '[App Language] English app locale app.en.po is required as the fallback language.',
  );
}

export const DEFAULT_APP_LANGUAGE: AppLanguage = englishAppLanguage;

export function normalizeAppLanguage(value?: string | null): AppLanguage | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  const language = normalized.split('-')[0];

  return SUPPORTED_APP_LANGUAGES.has(language as AppLanguage) ? (language as AppLanguage) : null;
}

export function detectPreferredAppLanguage(preferred?: string | null): AppLanguage {
  return normalizeAppLanguage(preferred) ?? DEFAULT_APP_LANGUAGE;
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

  return DEFAULT_APP_LANGUAGE;
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
