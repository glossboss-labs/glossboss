/**
 * Shared validation helpers for Edge Function payload parsing.
 *
 * These are extracted from the per-provider functions so fixes and
 * improvements land in one place.
 */

export function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function trimAndLimit(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

const LANGUAGE_CODE_RE = /^[A-Za-z]{2,3}(?:-[A-Za-z]{2})?$/;

export function isValidLanguageCode(value: string): boolean {
  return LANGUAGE_CODE_RE.test(value);
}
