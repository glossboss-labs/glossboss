/**
 * Shared Application Types
 *
 * Common types used across the application.
 */

/** Language code (ISO 639-1) */
export type LanguageCode = string;

/** Locale code (e.g., 'en_US', 'nl_NL') */
export type LocaleCode = string;

/** File upload result */
export interface FileUploadResult {
  filename: string;
  content: string;
  size: number;
}

/** Translation status for an entry */
export type TranslationStatus = 'translated' | 'untranslated' | 'fuzzy';

/** Get status from a PO entry */
export function getTranslationStatus(
  msgstr: string,
  flags: string[],
  msgstrPlural?: string[],
): TranslationStatus {
  // For plural entries, check if ALL plural forms are filled
  if (msgstrPlural && msgstrPlural.length > 0) {
    const allPluralsFilled = msgstrPlural.every((form) => form.trim() !== '');
    if (!allPluralsFilled) return 'untranslated';
  } else {
    // Singular entry - check msgstr
    if (!msgstr.trim()) return 'untranslated';
  }

  if (flags.includes('fuzzy')) return 'fuzzy';
  return 'translated';
}

/** Notification type */
export interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

/** Async operation state */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Create initial async state */
export function createAsyncState<T>(initialData: T | null = null): AsyncState<T> {
  return {
    data: initialData,
    loading: false,
    error: null,
  };
}
