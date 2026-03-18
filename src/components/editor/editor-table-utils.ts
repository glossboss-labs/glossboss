import { createContext } from 'react';
import { msgid } from '@/lib/app-language';
import type { TargetLanguage, SourceLanguage } from '@/lib/deepl/types';
import type { Glossary } from '@/lib/glossary/types';
import type { TranslationStatus } from '@/types';
import type { ReviewStatus } from '@/lib/review';
import type { POEntry } from '@/lib/po';
import type { CSSProperties } from 'react';
import {
  NAV_SKIP_TRANSLATED_KEY as _NAV_SKIP_TRANSLATED_KEY,
  INSPECTOR_WIDTH_KEY as _INSPECTOR_WIDTH_KEY,
  INSPECTOR_OPEN_KEY as _INSPECTOR_OPEN_KEY,
  COLUMN_WIDTHS_KEY,
  ROWS_PER_PAGE_KEY,
} from '@/lib/constants/storage-keys';

// Re-export storage keys
export const NAV_SKIP_TRANSLATED_KEY = _NAV_SKIP_TRANSLATED_KEY;
export const INSPECTOR_WIDTH_KEY = _INSPECTOR_WIDTH_KEY;
export const INSPECTOR_OPEN_KEY = _INSPECTOR_OPEN_KEY;
export { COLUMN_WIDTHS_KEY, ROWS_PER_PAGE_KEY };

// Inspector defaults
export const INSPECTOR_DEFAULT_WIDTH = 500;
export const INSPECTOR_MIN_WIDTH = 380;
export const INSPECTOR_MAX_WIDTH = 780;

// Column definitions
export const COLUMN_KEYS = [
  'select',
  'status',
  'approve',
  'source',
  'translation',
  'signals',
] as const;
export type TableColumnKey = (typeof COLUMN_KEYS)[number];
export type DataColumnKey = Exclude<TableColumnKey, 'select'>;

export const DATA_COLUMN_LABELS: Record<DataColumnKey, string> = {
  status: msgid('Status'),
  approve: msgid('Review'),
  source: msgid('Source string'),
  translation: msgid('Translated string'),
  signals: msgid('Signals'),
};

export const DEFAULT_COLUMN_WIDTHS = [72, 230, 128, 300, 300, 220];
export const MIN_COLUMN_WIDTH = 60;

// Workspace mode
export type WorkspaceMode = 'edit' | 'review';

// Rows per page options
export const ROWS_PER_PAGE_OPTIONS = [
  { value: '25', label: msgid('25 rows') },
  { value: '50', label: msgid('50 rows') },
  { value: '100', label: msgid('100 rows') },
  { value: '250', label: msgid('250 rows') },
  { value: '500', label: msgid('500 rows') },
];

/** Check if an entry needs translation (untranslated or fuzzy) */
export function entryNeedsTranslation(entry: POEntry): boolean {
  if (entry.flags.includes('fuzzy')) return true;
  if (entry.msgidPlural) {
    const plurals = entry.msgstrPlural ?? [];
    return plurals.length < 2 || plurals.some((p) => !p.trim());
  }
  return !entry.msgstr.trim();
}

/** Status badge colors */
export const STATUS_COLORS: Record<TranslationStatus, string> = {
  translated: 'green',
  untranslated: 'red',
  fuzzy: 'yellow',
};

/** Status badge labels */
export const STATUS_LABELS: Record<TranslationStatus, string> = {
  translated: msgid('Translated'),
  untranslated: msgid('Untranslated'),
  fuzzy: msgid('Fuzzy'),
};

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

/** Flag badge colors */
export const FLAG_COLORS: Record<string, string> = {
  fuzzy: 'yellow',
  'c-format': 'violet',
  'no-c-format': 'gray',
  'php-format': 'violet',
  'no-php-format': 'gray',
  'python-format': 'violet',
  'no-python-format': 'gray',
};

/** Translation settings context */
export interface TranslateSettings {
  targetLang: TargetLanguage | null;
  sourceLang: SourceLanguage | null;
  glossary: Glossary | null;
  deeplGlossaryId: string | null;
  glossaryEnforcementEnabled: boolean;
  speechEnabled: boolean;
  translateEnabled: boolean;
}

export const TranslateSettingsContext = createContext<TranslateSettings>({
  targetLang: null,
  sourceLang: null,
  glossary: null,
  deeplGlossaryId: null,
  glossaryEnforcementEnabled: false,
  speechEnabled: true,
  translateEnabled: true,
});

/** Broadcast context for realtime collaboration. */
export interface RealtimeBroadcast {
  broadcastEntryUpdate?: (event: {
    entryId: string;
    msgstr?: string;
    msgstrPlural?: string[];
    flags?: string[];
  }) => void;
  broadcastLock?: (entryId: string) => void;
  broadcastUnlock?: (entryId: string) => void;
  broadcastReviewEvent?: (event: {
    entryId: string;
    displayName: string;
    type: 'status-changed' | 'comment-added' | 'comment-resolved';
    data: {
      status?: import('@/lib/review').ReviewStatus;
      comment?: import('@/lib/review').ReviewComment;
      commentId?: string;
      resolved?: boolean;
    };
  }) => void;
}

export const RealtimeBroadcastContext = createContext<RealtimeBroadcast>({});

/** Context for viewer read-only mode. */
export const ReadOnlyContext = createContext(false);

/**
 * Regex to match code-like tokens in translation strings:
 * - Printf: %s, %d, %1$s, %-10.2f, etc.
 * - PHP/named: %(name)s
 * - Positional braces: {0}, {name}, {{variable}}
 * - HTML tags: <br/>, <a href="...">, </strong>, etc.
 * - Escape sequences: \n, \t, \r, \\
 */
export const CODE_TOKEN_RE =
  /(%(?:\d+\$)?[-+0 #]*(?:\*|\d+)?(?:\.(?:\*|\d+))?(?:hh?|ll?|[ljztL])?[diouxXeEfFgGaAcspn%]|%\([^)]+\)[diouxXeEfFgGaAcspn]|\{\{?\w+\}?\}?|\{\d+\}|<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^>]*)?\s*\/?>|\\[nrt\\])/g;

export function isSameReference(
  a: import('@/lib/wp-source').ParsedReference | null,
  b: import('@/lib/wp-source').ParsedReference,
): boolean {
  return Boolean(a && a.path === b.path && a.line === b.line);
}

export function formatReviewTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function describeReviewHistoryEvent(
  event: import('@/lib/review').ReviewHistoryEvent,
  t: (key: string, vars?: Record<string, unknown>) => string,
): string {
  switch (event.type) {
    case 'translation-updated':
      return event.field === 'plural' ? t('Updated plural translation') : t('Updated translation');
    case 'review-status-changed':
      return t('Changed review status from {{from}} to {{to}}', {
        from: event.from ? t(REVIEW_STATUS_LABELS[event.from as ReviewStatus]) : t('Unknown'),
        to: event.to ? t(REVIEW_STATUS_LABELS[event.to as ReviewStatus]) : t('Unknown'),
      });
    case 'comment-added':
      return event.field === 'reply' ? t('Added reply') : t('Added comment');
    case 'comment-resolved':
      return t('Resolved comment');
    case 'comment-reopened':
      return t('Reopened comment');
    default:
      return t('Updated review');
  }
}

export function pluralSummary(
  entry: POEntry,
  t: (key: string, vars?: Record<string, unknown>) => string,
): string {
  if (!entry.msgidPlural) return t('Singular entry');
  const forms = entry.msgstrPlural ?? [];
  const completed = forms.filter((form) => form.trim()).length;
  const total = Math.max(forms.length, 2);
  return t('Plural entry: {{completed}}/{{total}} forms translated', { completed, total });
}

/**
 * Shared styles for inline editing overlay
 */
export const INLINE_EDITOR_SHARED_STYLES: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 'var(--mantine-font-size-sm)',
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  padding: '7px 12px',
  margin: 0,
};
