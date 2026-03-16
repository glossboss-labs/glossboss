/**
 * Design Tokens — centralized status colors and semantic mappings.
 *
 * All status-related colors should reference these tokens instead of
 * hardcoding Mantine color strings. This ensures visual consistency
 * across the editor, dashboard, and settings pages.
 */

import type { TranslationStatus } from '@/types';
import type { ReviewStatus } from '@/lib/review';
import { msgid } from '@/lib/app-language';

/* ----------------------------------------------------------------
 * Translation status
 * ---------------------------------------------------------------- */

export const TRANSLATION_STATUS_COLORS: Record<TranslationStatus, string> = {
  translated: 'green',
  untranslated: 'red',
  fuzzy: 'yellow',
};

export const TRANSLATION_STATUS_LABELS: Record<TranslationStatus, string> = {
  translated: msgid('Translated'),
  untranslated: msgid('Untranslated'),
  fuzzy: msgid('Fuzzy'),
};

/* ----------------------------------------------------------------
 * Review status
 * ---------------------------------------------------------------- */

export const REVIEW_STATUS_COLORS: Record<ReviewStatus, string> = {
  draft: 'gray',
  'in-review': 'blue',
  approved: 'green',
  'needs-changes': 'orange',
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: msgid('Draft'),
  'in-review': msgid('In review'),
  approved: msgid('Approved'),
  'needs-changes': msgid('Needs changes'),
};

/* ----------------------------------------------------------------
 * Signal colors — badges for MT, glossary, QA, manual edits
 * ---------------------------------------------------------------- */

export const SIGNAL_COLORS = {
  mt: 'blue',
  glossary: 'blue',
  manualEdit: 'gray',
  qaError: 'red',
  qaWarning: 'orange',
  modified: 'orange',
  comment: 'blue',
} as const;

/* ----------------------------------------------------------------
 * PO flag colors
 * ---------------------------------------------------------------- */

export const FLAG_COLORS: Record<string, string> = {
  fuzzy: 'yellow',
  'c-format': 'gray',
  'no-c-format': 'gray',
  'php-format': 'gray',
  'no-php-format': 'gray',
  'python-format': 'gray',
  'python-brace-format': 'gray',
};

export function getFlagColor(flag: string): string {
  return FLAG_COLORS[flag] ?? 'gray';
}
