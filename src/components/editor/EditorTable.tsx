/**
 * Editor Table Component
 *
 * Translation table with inline editing, animations, and status badges.
 * Uses standard rendering (virtualization removed for stability).
 */

import {
  useState,
  useCallback,
  useRef,
  type KeyboardEvent,
  createContext,
  useContext,
  useMemo,
  memo,
  useEffect,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Table,
  Badge,
  Text,
  Stack,
  Group,
  Box,
  Paper,
  Tooltip,
  Textarea,
  ScrollArea,
  Pagination,
  Select,
  Checkbox,
  Collapse,
  UnstyledButton,
  Button,
  Divider,
  Loader,
  Anchor,
  ActionIcon,
  SegmentedControl,
  useMantineTheme,
} from '@mantine/core';
import { useLocalStorage, useMediaQuery } from '@mantine/hooks';
import {
  MessageSquare,
  FileCode,
  Pencil,
  Bot,
  Edit3,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  X,
  PanelRightOpen,
  PanelRightClose,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import {
  useEditorStore,
  useSourceStore,
  useTranslationMemoryStore,
  getEffectiveSlug,
} from '@/stores';
import type { POEntry } from '@/lib/po';
import { parseReferences, buildTracUrl, type ParsedReference } from '@/lib/wp-source';
import { getTranslationStatus, type TranslationStatus } from '@/types';
import {
  getReviewEntryState,
  isReviewLocked,
  type ReviewComment,
  type ReviewEntryState,
  type ReviewHistoryEvent,
  type ReviewStatus,
} from '@/lib/review';
import { TranslateButton } from './TranslateButton';
import { GlossaryIndicator } from './GlossaryIndicator';
import { SourceCodeViewer } from './SourceCodeViewer';
import { SourceBrowser } from './SourceBrowser';
import type { TargetLanguage, SourceLanguage } from '@/lib/deepl/types';
import type { Glossary, GlossaryAnalysisResult } from '@/lib/glossary/types';
import { useDragGhost } from '@/hooks/use-drag-ghost';
import { toSpeakLanguageTag } from '@/lib/tts';
import { SpeakButton } from '@/components/ui';
import { msgid, useTranslation } from '@/lib/app-language';
import {
  createTranslationMemoryScope,
  type TranslationMemoryScope,
} from '@/lib/translation-memory';
import { QA_RULE_LABELS, type QAEntryReport } from '@/lib/qa';

/** localStorage key for skip-translated navigation setting */
export const NAV_SKIP_TRANSLATED_KEY = 'glossboss-nav-skip-translated';
const INSPECTOR_WIDTH_KEY = 'glossboss-inspector-width';
const INSPECTOR_OPEN_KEY = 'glossboss-inspector-open';
const INSPECTOR_DEFAULT_WIDTH = 500;
const INSPECTOR_MIN_WIDTH = 380;
const INSPECTOR_MAX_WIDTH = 780;
type WorkspaceMode = 'edit' | 'review';

/** Check if an entry needs translation (untranslated or fuzzy) */
function entryNeedsTranslation(entry: POEntry): boolean {
  if (entry.flags.includes('fuzzy')) return true;
  if (entry.msgidPlural) {
    const plurals = entry.msgstrPlural ?? [];
    return plurals.length < 2 || plurals.some((p) => !p.trim());
  }
  return !entry.msgstr.trim();
}

/** Rows per page options */
const ROWS_PER_PAGE_OPTIONS = [
  { value: '25', label: msgid('25 rows') },
  { value: '50', label: msgid('50 rows') },
  { value: '100', label: msgid('100 rows') },
  { value: '250', label: msgid('250 rows') },
  { value: '500', label: msgid('500 rows') },
];

/** Column definitions with default proportional widths */
const COLUMN_KEYS = ['select', 'status', 'approve', 'source', 'translation', 'signals'] as const;
type TableColumnKey = (typeof COLUMN_KEYS)[number];
type DataColumnKey = Exclude<TableColumnKey, 'select'>;
const DATA_COLUMN_LABELS: Record<DataColumnKey, string> = {
  status: msgid('Status'),
  approve: msgid('Review'),
  source: msgid('Source string'),
  translation: msgid('Translated string'),
  signals: msgid('Signals'),
};
const DEFAULT_COLUMN_WIDTHS = [72, 230, 128, 300, 300, 220];
const MIN_COLUMN_WIDTH = 60; // minimum proportion

/**
 * Resizable column header with drag handle
 */
function ResizableTh({
  children,
  widthPercent,
  onResize,
  isLast,
  onCellPointerDown,
  dataColumnKey,
  isDragging = false,
  dropIndicatorPosition,
  align = 'left',
  padding = '12px 8px',
}: {
  children: React.ReactNode;
  widthPercent: string;
  onResize?: (deltaX: number) => void;
  isLast: boolean;
  onCellPointerDown?: (e: ReactPointerEvent<HTMLTableCellElement>) => void;
  dataColumnKey?: DataColumnKey;
  isDragging?: boolean;
  dropIndicatorPosition?: 'before' | 'after';
  align?: 'left' | 'center';
  padding?: CSSProperties['padding'];
}) {
  const handleRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      startXRef.current = e.clientX;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const onPointerMove = (ev: globalThis.PointerEvent) => {
        const delta = ev.clientX - startXRef.current;
        if (delta !== 0) {
          onResize?.(delta);
          startXRef.current = ev.clientX;
        }
      };

      const onPointerUp = () => {
        target.removeEventListener('pointermove', onPointerMove);
        target.removeEventListener('pointerup', onPointerUp);
      };

      target.addEventListener('pointermove', onPointerMove);
      target.addEventListener('pointerup', onPointerUp);
    },
    [onResize],
  );

  return (
    <Table.Th
      onPointerDown={onCellPointerDown}
      data-column-key={dataColumnKey}
      style={{
        width: widthPercent,
        padding,
        position: 'relative',
        userSelect: 'none',
        textAlign: align,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        opacity: isDragging ? 0.3 : 1,
        background: isDragging ? 'var(--gb-surface-3)' : undefined,
        transition: 'opacity 140ms ease, background 140ms ease',
      }}
    >
      {children}
      {dropIndicatorPosition && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 2,
            bottom: 2,
            width: 2,
            backgroundColor: 'var(--mantine-color-blue-6)',
            left: dropIndicatorPosition === 'before' ? -1 : undefined,
            right: dropIndicatorPosition === 'after' ? -1 : undefined,
            zIndex: 12,
            pointerEvents: 'none',
            borderRadius: 999,
            boxShadow:
              '0 0 0 1px var(--mantine-color-blue-5), 0 0 16px color-mix(in srgb, var(--mantine-color-blue-4) 45%, transparent)',
            transition: 'left 140ms ease, right 140ms ease',
          }}
        />
      )}
      {!isLast && (
        <div
          ref={handleRef}
          onPointerDown={onPointerDown}
          style={{
            position: 'absolute',
            right: -3,
            top: 0,
            bottom: 0,
            width: 6,
            cursor: 'col-resize',
            zIndex: 11,
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResize?.(Infinity); // sentinel for reset
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--gb-glow-focus)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        />
      )}
    </Table.Th>
  );
}

/** Translation settings context */
interface TranslateSettings {
  targetLang: TargetLanguage | null;
  sourceLang: SourceLanguage | null;
  glossary: Glossary | null;
  deeplGlossaryId: string | null;
  glossaryEnforcementEnabled: boolean;
  speechEnabled: boolean;
  translateEnabled: boolean;
}

const TranslateSettingsContext = createContext<TranslateSettings>({
  targetLang: null,
  sourceLang: null,
  glossary: null,
  deeplGlossaryId: null,
  glossaryEnforcementEnabled: false,
  speechEnabled: true,
  translateEnabled: true,
});

/**
 * Regex to match code-like tokens in translation strings:
 * - Printf: %s, %d, %1$s, %-10.2f, etc.
 * - PHP/named: %(name)s
 * - Positional braces: {0}, {name}, {{variable}}
 * - HTML tags: <br/>, <a href="...">, </strong>, etc.
 * - Escape sequences: \n, \t, \r, \\
 */
const CODE_TOKEN_RE =
  /(%(?:\d+\$)?[-+0 #]*(?:\*|\d+)?(?:\.(?:\*|\d+))?(?:hh?|ll?|[ljztL])?[diouxXeEfFgGaAcspn%]|%\([^)]+\)[diouxXeEfFgGaAcspn]|\{\{?\w+\}?\}?|\{\d+\}|<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^>]*)?\s*\/?>|\\[nrt\\])/g;

/**
 * Renders text with code-like tokens highlighted
 */
function HighlightedText({ children, dimmed }: { children: string; dimmed?: boolean }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const re = new RegExp(CODE_TOKEN_RE.source, CODE_TOKEN_RE.flags);
  while ((match = re.exec(children)) !== null) {
    if (match.index > lastIndex) {
      parts.push(children.slice(lastIndex, match.index));
    }
    parts.push(
      <Text
        key={match.index}
        component="code"
        size="xs"
        style={{
          fontFamily: 'var(--mantine-font-family-monospace)',
          backgroundColor: 'var(--mantine-color-default-hover)',
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 3,
          padding: '1px 4px',
          whiteSpace: 'nowrap',
        }}
      >
        {match[0]}
      </Text>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < children.length) {
    parts.push(children.slice(lastIndex));
  }

  // No tokens found, return plain text
  if (parts.length === 1 && typeof parts[0] === 'string') {
    return (
      <Text
        component="span"
        size="sm"
        style={{ whiteSpace: 'pre-wrap' }}
        c={dimmed ? 'dimmed' : undefined}
      >
        {children}
      </Text>
    );
  }

  return (
    <Text
      component="span"
      size="sm"
      style={{ whiteSpace: 'pre-wrap' }}
      c={dimmed ? 'dimmed' : undefined}
    >
      {parts}
    </Text>
  );
}

/** Status badge colors */
const STATUS_COLORS: Record<TranslationStatus, string> = {
  translated: 'green',
  untranslated: 'red',
  fuzzy: 'yellow',
};

/** Status badge labels */
const STATUS_LABELS: Record<TranslationStatus, string> = {
  translated: msgid('Translated'),
  untranslated: msgid('Untranslated'),
  fuzzy: msgid('Fuzzy'),
};

const REVIEW_STATUS_COLORS: Record<ReviewStatus, string> = {
  draft: 'gray',
  'in-review': 'blue',
  approved: 'green',
  'needs-changes': 'orange',
};

const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: msgid('Draft'),
  'in-review': msgid('In review'),
  approved: msgid('Approved'),
  'needs-changes': msgid('Needs changes'),
};

function hasReviewTranslationChanges(reviewEntry: ReviewEntryState): boolean {
  return reviewEntry.history.some((event) => event.type === 'translation-updated');
}

function getReviewQueueSourceText(entry: POEntry): string {
  return entry.msgidPlural ? `${entry.msgid} / ${entry.msgidPlural}` : entry.msgid;
}

function getReviewQueueTranslationText(
  entry: POEntry,
  t: (key: string, vars?: Record<string, unknown>) => string,
): string {
  if (entry.msgidPlural) {
    const forms = (entry.msgstrPlural ?? []).filter((form) => form.trim());
    return forms.length > 0 ? forms.join(' / ') : t('No translation');
  }

  return entry.msgstr.trim() || t('No translation');
}

/** Flag badge colors */
const FLAG_COLORS: Record<string, string> = {
  fuzzy: 'yellow',
  'c-format': 'violet',
  'no-c-format': 'gray',
  'php-format': 'violet',
  'no-php-format': 'gray',
  'python-format': 'violet',
  'no-python-format': 'gray',
};

/**
 * Editable text field component
 */
function EditableField({
  value,
  placeholder = msgid('Click to add translation'),
  onChange,
  onKeyDown,
  entryId,
  fieldId,
  isPlural = false,
  pluralIndex,
  useNativeTextColor = false,
  disabled = false,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>, fieldId: string) => void;
  entryId: string;
  fieldId: string;
  isPlural?: boolean;
  pluralIndex?: number;
  useNativeTextColor?: boolean;
  disabled?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEmpty = !value || value.trim() === '';

  const handleClick = useCallback(() => {
    if (disabled) return;
    setEditValue(value);
    setIsEditing(true);
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        const len = textarea.value.length;
        textarea.setSelectionRange(len, len);
      }
    }, 0);
  }, [disabled, value]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (editValue !== value) {
      onChange(editValue);
    }
  }, [editValue, value, onChange]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        setEditValue(value);
        setIsEditing(false);
        e.preventDefault();
      } else if (e.key === 'Tab') {
        if (editValue !== value) {
          onChange(editValue);
        }
        setIsEditing(false);
        onKeyDown?.(e, fieldId);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        if (editValue !== value) {
          onChange(editValue);
        }
        setIsEditing(false);
        onKeyDown?.(e, fieldId);
      }
    },
    [editValue, value, onChange, onKeyDown, fieldId],
  );

  if (isEditing) {
    const sharedStyles: CSSProperties = {
      fontFamily: 'inherit',
      fontSize: 'var(--mantine-font-size-sm)',
      lineHeight: 1.55,
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      padding: '7px 12px',
      margin: 0,
    };

    return (
      <Box
        style={{
          margin: '-6px -8px',
          padding: 2,
          borderRadius: 6,
        }}
      >
        {isPlural && pluralIndex !== undefined && (
          <Text component="span" size="xs" c="dimmed" mb={4} ml={6} style={{ display: 'block' }}>
            [{pluralIndex}]
          </Text>
        )}
        <Box style={{ position: 'relative' }}>
          {!useNativeTextColor && (
            <Box
              aria-hidden
              data-testid={`highlighted-backdrop-${fieldId}`}
              style={{
                ...sharedStyles,
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
                borderRadius: 'var(--mantine-radius-default)',
                backgroundColor: 'var(--gb-surface-1)',
              }}
            >
              <HighlightedText>{editValue || ' '}</HighlightedText>
            </Box>
          )}
          <Textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.currentTarget.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autosize
            minRows={1}
            maxRows={8}
            size="sm"
            classNames={{ input: 'inline-editor-input' }}
            styles={{
              input: {
                ...sharedStyles,
                fontFamily: 'inherit',
                // Mobile browsers can misplace the caret when the textarea text is transparent
                // and a separate overlay renders the visible content.
                color: useNativeTextColor ? 'var(--mantine-color-text)' : 'transparent',
                caretColor: 'var(--mantine-color-text)',
                backgroundColor: useNativeTextColor ? 'var(--gb-surface-1)' : 'transparent',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                position: 'relative',
                zIndex: 1,
                overflow: 'hidden',
              },
            }}
            data-field-id={fieldId}
            data-entry-id={entryId}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      className="editable-text-wrapper"
      data-field-id={fieldId}
      data-entry-id={entryId}
      onClick={handleClick}
      style={{
        cursor: disabled ? 'not-allowed' : 'text',
        padding: '6px 8px',
        margin: '-6px -8px',
        borderRadius: 4,
        minHeight: 32,
        opacity: disabled ? 0.72 : 1,
        transition: 'background-color 150ms ease',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = 'var(--mantine-color-default-hover)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {isPlural && pluralIndex !== undefined && (
        <Text component="span" size="xs" c="dimmed" mr={4}>
          [{pluralIndex}]
        </Text>
      )}
      {isEmpty ? (
        <Pencil size={14} style={{ opacity: 0.35, verticalAlign: 'middle' }} />
      ) : (
        <HighlightedText>{value}</HighlightedText>
      )}
    </Box>
  );
}

/**
 * Source text display with plural support (read-only)
 */
function SourceCell({ entry }: { entry: POEntry }) {
  const { t } = useTranslation();
  const translateSettings = useContext(TranslateSettingsContext);
  const sourceLang = toSpeakLanguageTag(translateSettings.sourceLang);
  const hasPlural = Boolean(entry.msgidPlural);

  if (hasPlural) {
    return (
      <Stack gap={4}>
        <Group gap={4} wrap="nowrap" align="flex-start">
          <Badge size="xs" variant="light" color="gray">
            {t('singular')}
          </Badge>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <HighlightedText>{entry.msgid}</HighlightedText>
          </Box>
          {translateSettings.speechEnabled && (
            <SpeakButton
              kind="source"
              entryId={`${entry.id}-source-0`}
              text={entry.msgid}
              lang={sourceLang}
            />
          )}
        </Group>
        <Group gap={4} wrap="nowrap" align="flex-start">
          <Badge size="xs" variant="light" color="gray">
            {t('plural')}
          </Badge>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <HighlightedText>{entry.msgidPlural!}</HighlightedText>
          </Box>
          {translateSettings.speechEnabled && (
            <SpeakButton
              kind="source"
              entryId={`${entry.id}-source-1`}
              text={entry.msgidPlural!}
              lang={sourceLang}
            />
          )}
        </Group>
      </Stack>
    );
  }

  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <Box style={{ flex: 1, minWidth: 0 }}>
        <HighlightedText>{entry.msgid}</HighlightedText>
      </Box>
      {translateSettings.speechEnabled && (
        <SpeakButton
          kind="source"
          entryId={`${entry.id}-source`}
          text={entry.msgid}
          lang={sourceLang}
        />
      )}
    </Group>
  );
}

function SignalsOverviewCell({
  isMT,
  usedGlossary,
  provider,
  glossaryAnalysis,
  qaReport,
  unresolvedCommentCount,
  showReviewSignals = true,
}: {
  isMT: boolean;
  usedGlossary: boolean;
  provider?: string;
  glossaryAnalysis: GlossaryAnalysisResult | null;
  qaReport: QAEntryReport | null;
  unresolvedCommentCount: number;
  showReviewSignals?: boolean;
}) {
  const { t } = useTranslation();
  const hasGlossarySignals = (glossaryAnalysis?.terms.length ?? 0) > 0;
  const hasQaSignals = Boolean(qaReport && (qaReport.errorCount > 0 || qaReport.warningCount > 0));
  const providerLabel = provider === 'gemini' ? 'Gemini' : provider === 'azure' ? 'Azure' : 'DeepL';

  if (
    !isMT &&
    !hasGlossarySignals &&
    !hasQaSignals &&
    (!showReviewSignals || unresolvedCommentCount === 0)
  ) {
    return (
      <Text size="xs" c="dimmed">
        —
      </Text>
    );
  }

  return (
    <Stack gap={4}>
      {isMT && (
        <Tooltip
          label={
            usedGlossary
              ? t('Machine translated with glossary by {{provider}}', { provider: providerLabel })
              : t('Machine translated by {{provider}}', { provider: providerLabel })
          }
        >
          <Badge
            size="xs"
            variant="light"
            color={usedGlossary ? 'teal' : 'blue'}
            leftSection={<Bot size={10} />}
          >
            {usedGlossary ? t('MT + Glossary') : t('Machine translated')}
          </Badge>
        </Tooltip>
      )}
      <GlossaryIndicator analysis={hasGlossarySignals ? glossaryAnalysis : null} />
      {qaReport && qaReport.errorCount > 0 && (
        <Badge size="xs" variant="light" color="red" leftSection={<ShieldAlert size={10} />}>
          {t('{{count}} QA error(s)', { count: qaReport.errorCount })}
        </Badge>
      )}
      {qaReport && qaReport.warningCount > 0 && (
        <Badge size="xs" variant="light" color="orange" leftSection={<AlertTriangle size={10} />}>
          {t('{{count}} QA warning(s)', { count: qaReport.warningCount })}
        </Badge>
      )}
      {showReviewSignals && unresolvedCommentCount > 0 && (
        <Badge size="xs" variant="light" color="red" leftSection={<MessageSquare size={10} />}>
          {t('{{count}} unresolved comment(s)', { count: unresolvedCommentCount })}
        </Badge>
      )}
    </Stack>
  );
}

function QaIssuesPanel({ report }: { report: QAEntryReport | null }) {
  const { t } = useTranslation();

  if (!report || report.issues.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('No QA issues for this string.')}
      </Text>
    );
  }

  return (
    <Stack gap={6}>
      {report.issues.map((issue, index) => (
        <Paper key={`${issue.ruleId}-${index}`} withBorder p="sm" radius="md">
          <Stack gap={4}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="sm" fw={500}>
                {t(QA_RULE_LABELS[issue.ruleId])}
              </Text>
              <Badge
                size="xs"
                color={issue.severity === 'error' ? 'red' : 'orange'}
                variant="light"
              >
                {issue.severity === 'error' ? t('Error') : t('Warning')}
              </Badge>
            </Group>
            {issue.details?.length ? (
              <Stack gap={2}>
                {issue.details.map((detail) => (
                  <Text key={detail} size="xs" c="dimmed">
                    {detail}
                  </Text>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function TranslationMemoryPanel({
  entry,
  scope,
}: {
  entry: POEntry;
  scope: TranslationMemoryScope | null;
}) {
  const { t } = useTranslation();
  const updateEntry = useEditorStore((state) => state.updateEntry);
  const updateEntryPlural = useEditorStore((state) => state.updateEntryPlural);
  const getSuggestions = useTranslationMemoryStore((state) => state.getSuggestions);

  const suggestions = useMemo(() => {
    if (!scope) return [];

    return getSuggestions(scope, entry).filter((suggestion) => {
      if (entry.msgidPlural) {
        return (
          JSON.stringify(suggestion.entry.targetTextPlural ?? []) !==
          JSON.stringify(entry.msgstrPlural ?? [])
        );
      }

      return suggestion.entry.targetText !== entry.msgstr;
    });
  }, [entry, getSuggestions, scope]);

  if (!scope) {
    return (
      <Text size="sm" c="dimmed">
        {t('Load a file with a target language before using translation memory.')}
      </Text>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('No translation memory suggestions yet.')}
      </Text>
    );
  }

  return (
    <Stack gap={6}>
      {suggestions.map((suggestion) => (
        <Paper key={`${suggestion.entry.id}-${suggestion.matchType}`} withBorder p="sm" radius="md">
          <Stack gap={6}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Group gap={6} wrap="wrap">
                <Badge
                  size="xs"
                  variant="light"
                  color={suggestion.matchType === 'exact' ? 'green' : 'blue'}
                >
                  {suggestion.matchType === 'exact' ? t('Exact match') : t('Fuzzy match')}
                </Badge>
                <Badge size="xs" variant="light" color="gray">
                  {t('{{score}}% match', { score: Math.round(suggestion.score * 100) })}
                </Badge>
              </Group>
              <Button
                size="xs"
                variant="light"
                onClick={() => {
                  if (entry.msgidPlural) {
                    updateEntryPlural(entry.id, suggestion.entry.targetTextPlural ?? ['', '']);
                    return;
                  }
                  updateEntry(entry.id, suggestion.entry.targetText);
                }}
              >
                {t('Apply')}
              </Button>
            </Group>

            {entry.msgidPlural ? (
              <Stack gap={3}>
                {(suggestion.entry.targetTextPlural ?? []).map((form, index) => (
                  <Text key={`${suggestion.entry.id}-plural-${index}`} size="sm" c="dimmed">
                    {t('Plural {{index}}: {{value}}', { index, value: form || t('Empty') })}
                  </Text>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                {suggestion.entry.targetText || t('Empty')}
              </Text>
            )}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

/**
 * Translation cell with inline editing support
 */
function TranslationCell({
  entry,
  onKeyDown,
  translateButtonSize = 'sm',
  translateButtonDisplay = 'icon',
  useNativeTextColor = false,
}: {
  entry: POEntry;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>, fieldId: string) => void;
  translateButtonSize?: 'xs' | 'sm' | 'md';
  translateButtonDisplay?: 'icon' | 'button';
  useNativeTextColor?: boolean;
}) {
  const { t } = useTranslation();
  const updateEntry = useEditorStore((state) => state.updateEntry);
  const updateEntryPlural = useEditorStore((state) => state.updateEntryPlural);
  const markAsMachineTranslated = useEditorStore((state) => state.markAsMachineTranslated);
  const clearMachineTranslated = useEditorStore((state) => state.clearMachineTranslated);
  const getGlossaryAnalysis = useEditorStore((state) => state.getGlossaryAnalysis);
  const reviewStatus = useEditorStore(
    (state) => state.reviewEntries.get(entry.id)?.status ?? 'draft',
  );
  const lockApprovedEntries = useEditorStore((state) => state.lockApprovedEntries);

  // Use individual selectors for reactive state
  const isMT = useEditorStore((state) => state.machineTranslatedIds.has(entry.id));
  const usedGlossary = useEditorStore(
    (state) => state.machineTranslationMeta.get(entry.id)?.usedGlossary ?? false,
  );
  const mtProvider = useEditorStore(
    (state) => state.machineTranslationMeta.get(entry.id)?.provider ?? 'deepl',
  );
  const mtProviderLabel =
    mtProvider === 'gemini' ? 'Gemini' : mtProvider === 'azure' ? 'Azure' : 'DeepL';
  const signalsColumnHidden = useEditorStore((state) => !state.visibleColumns.has('signals'));

  const translateSettings = useContext(TranslateSettingsContext);
  const hasPlural = Boolean(entry.msgidPlural);
  const pluralForms = useMemo(() => entry.msgstrPlural ?? [], [entry.msgstrPlural]);
  const glossaryAnalysis = signalsColumnHidden ? getGlossaryAnalysis(entry.id) : null;
  const translationLang = toSpeakLanguageTag(translateSettings.targetLang);
  const isLocked = isReviewLocked(reviewStatus, lockApprovedEntries);

  const handleSingularChange = useCallback(
    (value: string) => {
      updateEntry(entry.id, value);
      if (isMT) {
        clearMachineTranslated(entry.id);
      }
    },
    [entry.id, updateEntry, isMT, clearMachineTranslated],
  );

  const handlePluralChange = useCallback(
    (index: number, value: string) => {
      const newPlurals = [...pluralForms];
      while (newPlurals.length <= index) {
        newPlurals.push('');
      }
      newPlurals[index] = value;
      updateEntryPlural(entry.id, newPlurals);
      if (isMT) {
        clearMachineTranslated(entry.id);
      }
    },
    [entry.id, pluralForms, updateEntryPlural, isMT, clearMachineTranslated],
  );

  const handleTranslated = useCallback(
    (
      translatedText: string,
      meta?: {
        usedGlossary?: boolean;
        provider?: 'deepl' | 'azure' | 'gemini';
        glossaryMode?: 'native' | 'prompt' | 'none';
        contextUsed?: boolean;
      },
    ) => {
      updateEntry(entry.id, translatedText);
      markAsMachineTranslated(entry.id, meta);
    },
    [entry.id, updateEntry, markAsMachineTranslated],
  );

  const handlePluralTranslated = useCallback(
    (
      index: number,
      translatedText: string,
      meta?: {
        usedGlossary?: boolean;
        provider?: 'deepl' | 'azure' | 'gemini';
        glossaryMode?: 'native' | 'prompt' | 'none';
        contextUsed?: boolean;
      },
    ) => {
      const newPlurals = [...pluralForms];
      while (newPlurals.length <= index) {
        newPlurals.push('');
      }
      newPlurals[index] = translatedText;
      updateEntryPlural(entry.id, newPlurals);
      markAsMachineTranslated(entry.id, meta);
    },
    [entry.id, pluralForms, updateEntryPlural, markAsMachineTranslated],
  );

  if (hasPlural) {
    const displayForms = pluralForms.length >= 2 ? pluralForms : ['', ''];
    const sourceTexts = displayForms.map((_, index) =>
      index === 0 ? entry.msgid : entry.msgidPlural!,
    );

    return (
      <Stack gap={8}>
        {displayForms.map((form, index) => (
          <Group key={index} gap="xs" align="flex-start" wrap="nowrap">
            <Box style={{ flex: 1, minWidth: 0 }}>
              <EditableField
                value={form}
                onChange={(value) => handlePluralChange(index, value)}
                onKeyDown={onKeyDown}
                entryId={entry.id}
                fieldId={`${entry.id}-plural-${index}`}
                isPlural
                pluralIndex={index}
                placeholder={t('Plural form {{index}}', { index })}
                useNativeTextColor={useNativeTextColor}
                disabled={isLocked}
              />
            </Box>
            {translateSettings.translateEnabled &&
              translateSettings.targetLang &&
              sourceTexts[index]?.trim() && (
                <TranslateButton
                  text={sourceTexts[index]}
                  currentTranslation={form}
                  targetLang={translateSettings.targetLang}
                  sourceLang={translateSettings.sourceLang ?? undefined}
                  glossaryId={
                    translateSettings.glossaryEnforcementEnabled
                      ? (translateSettings.deeplGlossaryId ?? undefined)
                      : undefined
                  }
                  glossary={translateSettings.glossary}
                  references={entry.references}
                  onTranslated={(text, meta) => handlePluralTranslated(index, text, meta)}
                  size={translateButtonSize}
                  display={translateButtonDisplay}
                  disabled={isLocked}
                />
              )}
            {translateSettings.speechEnabled && (
              <SpeakButton
                kind="translation"
                entryId={`${entry.id}-translation-${index}`}
                text={form}
                lang={translationLang}
              />
            )}
          </Group>
        ))}

        {signalsColumnHidden && (
          <>
            {isMT && (
              <Tooltip
                label={
                  usedGlossary
                    ? t('Machine translated with glossary by {{provider}}', {
                        provider: mtProviderLabel,
                      })
                    : t('Machine translated by {{provider}}', { provider: mtProviderLabel })
                }
              >
                <Badge
                  size="xs"
                  variant="light"
                  color={usedGlossary ? 'teal' : 'blue'}
                  leftSection={<Bot size={10} />}
                >
                  {usedGlossary ? t('MT + Glossary') : t('Machine translated')}
                </Badge>
              </Tooltip>
            )}
            <GlossaryIndicator analysis={glossaryAnalysis} />
          </>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap={4}>
      <Group gap="xs" align="flex-start" wrap="nowrap">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <EditableField
            value={entry.msgstr}
            onChange={handleSingularChange}
            onKeyDown={onKeyDown}
            entryId={entry.id}
            fieldId={`${entry.id}-singular`}
            useNativeTextColor={useNativeTextColor}
            disabled={isLocked}
          />
        </Box>
        {translateSettings.translateEnabled &&
          translateSettings.targetLang &&
          entry.msgid.trim() && (
            <TranslateButton
              text={entry.msgid}
              currentTranslation={entry.msgstr}
              targetLang={translateSettings.targetLang}
              sourceLang={translateSettings.sourceLang ?? undefined}
              glossaryId={
                translateSettings.glossaryEnforcementEnabled
                  ? (translateSettings.deeplGlossaryId ?? undefined)
                  : undefined
              }
              glossary={translateSettings.glossary}
              references={entry.references}
              onTranslated={handleTranslated}
              size={translateButtonSize}
              display={translateButtonDisplay}
              disabled={isLocked}
            />
          )}
        {translateSettings.speechEnabled && (
          <SpeakButton
            kind="translation"
            entryId={`${entry.id}-translation`}
            text={entry.msgstr}
            lang={translationLang}
          />
        )}
      </Group>

      {signalsColumnHidden && (
        <>
          {isLocked && (
            <Badge size="xs" variant="light" color="gray">
              {t('Locked')}
            </Badge>
          )}
          {isMT && (
            <Tooltip
              label={
                usedGlossary
                  ? t('Machine translated with glossary by {{provider}}', {
                      provider: mtProviderLabel,
                    })
                  : t('Machine translated by {{provider}}', { provider: mtProviderLabel })
              }
            >
              <Badge
                size="xs"
                variant="light"
                color={usedGlossary ? 'teal' : 'blue'}
                leftSection={<Bot size={10} />}
              >
                {usedGlossary ? t('MT + Glossary') : t('Machine translated')}
              </Badge>
            </Tooltip>
          )}
          <GlossaryIndicator analysis={glossaryAnalysis} />
        </>
      )}
    </Stack>
  );
}

/**
 * Status badges component
 */
const StatusBadges = memo(function StatusBadges({
  entry,
  isModified,
  isManualEdit,
  hasGlossaryTerms,
  isMT,
  reviewStatus,
  unresolvedCommentCount,
  isReviewEntryLocked,
  showReviewStatus = true,
  showReviewComments = true,
}: {
  entry: POEntry;
  isModified: boolean;
  isManualEdit: boolean;
  hasGlossaryTerms: boolean;
  isMT?: boolean;
  reviewStatus: ReviewStatus;
  unresolvedCommentCount: number;
  isReviewEntryLocked: boolean;
  showReviewStatus?: boolean;
  showReviewComments?: boolean;
}) {
  const { t } = useTranslation();
  const status = getTranslationStatus(entry.msgstr, entry.flags, entry.msgstrPlural);

  return (
    <Group
      data-testid={`status-badges-${entry.id}`}
      gap={4}
      wrap="wrap"
      style={{
        maxWidth: '100%',
        overflowX: 'visible',
        overflowY: 'visible',
      }}
    >
      <Badge color={STATUS_COLORS[status]} size="sm" variant="filled" style={{ flexShrink: 0 }}>
        {t(STATUS_LABELS[status])}
      </Badge>

      {showReviewStatus && (
        <Badge
          color={REVIEW_STATUS_COLORS[reviewStatus]}
          size="xs"
          variant="light"
          style={{ flexShrink: 0 }}
        >
          {t(REVIEW_STATUS_LABELS[reviewStatus])}
        </Badge>
      )}

      {isReviewEntryLocked && (
        <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>
          {t('Locked')}
        </Badge>
      )}

      {isModified && (
        <Tooltip label={t('Modified this session')}>
          <Badge
            size="xs"
            variant="light"
            color="orange"
            leftSection={<Edit3 size={10} />}
            style={{ flexShrink: 0 }}
          >
            {t('Modified')}
          </Badge>
        </Tooltip>
      )}

      {isManualEdit && (
        <Tooltip label={t('Manually edited - protected from bulk translation')}>
          <Badge
            size="xs"
            variant="light"
            color="grape"
            leftSection={<Pencil size={10} />}
            style={{ flexShrink: 0 }}
          >
            {t('Manual')}
          </Badge>
        </Tooltip>
      )}

      {hasGlossaryTerms && (
        <Tooltip label={t('Contains glossary terms')}>
          <Badge size="xs" variant="dot" color="violet" style={{ flexShrink: 0 }}>
            {t('Glossary')}
          </Badge>
        </Tooltip>
      )}

      {isMT && (
        <Tooltip label={t('Machine translated')}>
          <Badge
            size="xs"
            variant="light"
            color="blue"
            leftSection={<Bot size={10} />}
            style={{ flexShrink: 0 }}
          >
            MT
          </Badge>
        </Tooltip>
      )}

      {showReviewComments && unresolvedCommentCount > 0 && (
        <Tooltip
          label={t('{{count}} unresolved review comment(s)', { count: unresolvedCommentCount })}
        >
          <Badge
            size="xs"
            variant="light"
            color="red"
            leftSection={<MessageSquare size={10} />}
            style={{ flexShrink: 0 }}
          >
            {t('{{count}} comments', { count: unresolvedCommentCount })}
          </Badge>
        </Tooltip>
      )}
    </Group>
  );
});

const ReviewStatusBadge = memo(function ReviewStatusBadge({
  status,
  compact = false,
}: {
  status: ReviewStatus;
  compact?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Badge
      color={REVIEW_STATUS_COLORS[status]}
      variant="light"
      size={compact ? 'xs' : 'sm'}
      style={{ flexShrink: 0 }}
    >
      {t(REVIEW_STATUS_LABELS[status])}
    </Badge>
  );
});

/**
 * Meta column with flags, references, and comments.
 * When a plugin slug is set, references become clickable links.
 */
function MetaCell({
  entry,
  onReferenceActivate,
}: {
  entry: POEntry;
  onReferenceActivate?: (ref: ParsedReference) => void;
}) {
  const { t } = useTranslation();
  const hasReferences = entry.references.length > 0;
  const hasComments = entry.translatorComments.length > 0;
  const flags = entry.flags.filter((f) => f !== 'fuzzy');
  const pluginSlug = useSourceStore((s) => getEffectiveSlug(s));
  const setActiveReference = useSourceStore((s) => s.setActiveReference);

  const parsedRefs = useMemo(
    () => (hasReferences ? parseReferences(entry.references) : []),
    [hasReferences, entry.references],
  );

  return (
    <Stack gap={4}>
      {flags.length > 0 && (
        <Group gap={4}>
          {flags.map((flag) => (
            <Badge key={flag} size="xs" variant="light" color={FLAG_COLORS[flag] ?? 'gray'}>
              {flag}
            </Badge>
          ))}
        </Group>
      )}

      {hasReferences && pluginSlug && (
        <Tooltip
          label={parsedRefs.map((r) => `${r.path}${r.line ? `:${r.line}` : ''}`).join('\n')}
          multiline
          maw={300}
        >
          <Group
            gap={4}
            style={{ cursor: 'pointer' }}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              if (onReferenceActivate) {
                onReferenceActivate(parsedRefs[0]);
                return;
              }
              setActiveReference(parsedRefs[0]);
            }}
          >
            <FileCode size={12} opacity={0.5} />
            <Text size="xs" c="dimmed" style={{ textDecoration: 'underline dotted' }}>
              {t('{{count}} ref(s)', { count: parsedRefs.length })}
            </Text>
          </Group>
        </Tooltip>
      )}

      {hasReferences && !pluginSlug && (
        <Tooltip label={entry.references.join('\n')} multiline maw={300}>
          <Group gap={4} style={{ cursor: 'help' }}>
            <FileCode size={12} opacity={0.5} />
            <Text size="xs" c="dimmed">
              {t('{{count}} ref(s)', { count: entry.references.length })}
            </Text>
          </Group>
        </Tooltip>
      )}

      {hasComments && (
        <Tooltip label={entry.translatorComments.join('\n')} multiline maw={300}>
          <Group gap={4} style={{ cursor: 'help' }}>
            <MessageSquare size={12} opacity={0.5} />
            <Text size="xs" c="dimmed">
              {t('{{count}} comment(s)', { count: entry.translatorComments.length })}
            </Text>
          </Group>
        </Tooltip>
      )}

      {!flags.length && !hasReferences && !hasComments && (
        <Text size="xs" c="dimmed">
          —
        </Text>
      )}
    </Stack>
  );
}

function isSameReference(a: ParsedReference | null, b: ParsedReference): boolean {
  return Boolean(a && a.path === b.path && a.line === b.line);
}

function formatReviewTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function describeReviewHistoryEvent(
  event: ReviewHistoryEvent,
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

function ReviewCommentThread({
  comment,
  comments,
  onReply,
  onToggleResolved,
}: {
  comment: ReviewComment;
  comments: ReviewComment[];
  onReply: (commentId: string) => void;
  onToggleResolved: (commentId: string, resolved: boolean) => void;
}) {
  const { t } = useTranslation();
  const replies = comments.filter((candidate) => candidate.parentId === comment.id);
  const resolved = Boolean(comment.resolvedAt);

  return (
    <Stack gap={6}>
      <Paper withBorder p="sm" radius="md">
        <Stack gap={6}>
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={2}>
              <Text size="sm" fw={500}>
                {comment.author}
              </Text>
              <Text size="xs" c="dimmed">
                {formatReviewTimestamp(comment.createdAt)}
              </Text>
            </Stack>
            <Group gap={6}>
              <Button size="compact-xs" variant="subtle" onClick={() => onReply(comment.id)}>
                {t('Reply')}
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                color={resolved ? 'gray' : 'green'}
                onClick={() => onToggleResolved(comment.id, !resolved)}
              >
                {resolved ? t('Reopen') : t('Resolve')}
              </Button>
            </Group>
          </Group>

          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {comment.message}
          </Text>

          {resolved && (
            <Text size="xs" c="dimmed">
              {t('Resolved by {{author}} on {{date}}', {
                author: comment.resolvedBy || t('Unknown'),
                date: comment.resolvedAt ? formatReviewTimestamp(comment.resolvedAt) : t('Unknown'),
              })}
            </Text>
          )}
        </Stack>
      </Paper>

      {replies.length > 0 && (
        <Stack gap={6} pl="md">
          {replies.map((reply) => (
            <ReviewCommentThread
              key={reply.id}
              comment={reply}
              comments={comments}
              onReply={onReply}
              onToggleResolved={onToggleResolved}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function ReviewCommentsPanel({
  entryId,
  reviewEntry,
}: {
  entryId: string;
  reviewEntry: ReviewEntryState;
}) {
  const { t } = useTranslation();
  const addReviewComment = useEditorStore((state) => state.addReviewComment);
  const setReviewCommentResolved = useEditorStore((state) => state.setReviewCommentResolved);
  const [draftComment, setDraftComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const rootComments = useMemo(
    () => reviewEntry.comments.filter((comment) => !comment.parentId),
    [reviewEntry.comments],
  );

  return (
    <Stack gap={8}>
      <Textarea
        value={draftComment}
        onChange={(event) => setDraftComment(event.currentTarget.value)}
        placeholder={
          replyTo ? t('Write a reply to this comment') : t('Add a review comment for this string')
        }
        minRows={2}
        maxRows={6}
      />

      <Group gap="xs">
        <Button
          size="xs"
          onClick={() => {
            addReviewComment(entryId, draftComment, replyTo ?? undefined);
            setDraftComment('');
            setReplyTo(null);
          }}
          disabled={!draftComment.trim()}
        >
          {replyTo ? t('Add reply') : t('Add comment')}
        </Button>
        {replyTo && (
          <Button size="xs" variant="default" onClick={() => setReplyTo(null)}>
            {t('Cancel reply')}
          </Button>
        )}
      </Group>

      {rootComments.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t('No review comments yet.')}
        </Text>
      ) : (
        <Stack gap={8}>
          {rootComments.map((comment) => (
            <ReviewCommentThread
              key={comment.id}
              comment={comment}
              comments={reviewEntry.comments}
              onReply={setReplyTo}
              onToggleResolved={(commentId, resolved) =>
                setReviewCommentResolved(entryId, commentId, resolved)
              }
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function ReviewHistoryPanel({ reviewEntry }: { reviewEntry: ReviewEntryState }) {
  const { t } = useTranslation();
  const history = useMemo(
    () => [...reviewEntry.history].reverse().slice(0, 12),
    [reviewEntry.history],
  );

  if (history.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('No review history yet.')}
      </Text>
    );
  }

  return (
    <Stack gap={6}>
      {history.map((event) => (
        <Paper key={event.id} withBorder p="sm" radius="md">
          <Stack gap={4}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="sm" fw={500}>
                {describeReviewHistoryEvent(event, t)}
              </Text>
              <Text size="xs" c="dimmed">
                {formatReviewTimestamp(event.createdAt)}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              {t('By {{actor}}', { actor: event.actor })}
            </Text>
            {(event.type === 'translation-updated' || event.type === 'comment-added') &&
              event.to && (
                <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                  {event.to}
                </Text>
              )}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function ReviewPanel({ entry, reviewEntry }: { entry: POEntry; reviewEntry: ReviewEntryState }) {
  const { t } = useTranslation();
  const setReviewStatus = useEditorStore((state) => state.setReviewStatus);
  const clearFuzzyBatch = useEditorStore((state) => state.clearFuzzyBatch);
  const addFuzzyBatch = useEditorStore((state) => state.addFuzzyBatch);
  const lockApprovedEntries = useEditorStore((state) => state.lockApprovedEntries);
  const translationStatus = getTranslationStatus(entry.msgstr, entry.flags, entry.msgstrPlural);
  const locked = isReviewLocked(reviewEntry.status, lockApprovedEntries);
  const unresolvedCount = reviewEntry.comments.filter((comment) => !comment.resolvedAt).length;
  const canApprove = reviewEntry.status !== 'approved';
  const canUnapprove = reviewEntry.status === 'approved';
  const canRequestChanges = reviewEntry.status !== 'needs-changes';

  const handleApprove = useCallback(() => {
    if (entry.flags.includes('fuzzy')) {
      clearFuzzyBatch([entry.id]);
    }
    setReviewStatus(entry.id, 'approved');
  }, [clearFuzzyBatch, entry.flags, entry.id, setReviewStatus]);

  const handleUnapprove = useCallback(() => {
    setReviewStatus(entry.id, 'in-review');
  }, [entry.id, setReviewStatus]);

  const handleRequestChanges = useCallback(() => {
    setReviewStatus(entry.id, 'needs-changes');

    if (translationStatus !== 'untranslated' && !entry.flags.includes('fuzzy')) {
      addFuzzyBatch([entry.id]);
    }
  }, [addFuzzyBatch, entry.flags, entry.id, setReviewStatus, translationStatus]);

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap="xs" wrap="wrap">
          <ReviewStatusBadge status={reviewEntry.status} />
          {locked && (
            <Badge color="gray" variant="light" size="sm">
              {t('Locked')}
            </Badge>
          )}
          {unresolvedCount > 0 && (
            <Badge color="red" variant="light" size="sm">
              {t('{{count}} unresolved', { count: unresolvedCount })}
            </Badge>
          )}
        </Group>
        <Group gap="xs" wrap="wrap">
          <Button
            size="xs"
            variant="light"
            color="green"
            onClick={handleApprove}
            disabled={!canApprove}
          >
            {t('Approve')}
          </Button>
          <Button size="xs" variant="default" onClick={handleUnapprove} disabled={!canUnapprove}>
            {t('Unapprove')}
          </Button>
          <Button
            size="xs"
            variant="light"
            color="orange"
            onClick={handleRequestChanges}
            disabled={!canRequestChanges}
          >
            {t('Request changes')}
          </Button>
        </Group>
      </Group>

      {lockApprovedEntries && (
        <Text size="xs" c="dimmed">
          {t('Approved strings stay read-only until they are unapproved.')}
        </Text>
      )}

      {translationStatus !== 'untranslated' && (
        <Group>
          <Button size="xs" variant="default" onClick={() => toggleFuzzy(entry.id)}>
            {translationStatus === 'fuzzy' ? t('Clear fuzzy flag') : t('Mark as fuzzy')}
          </Button>
        </Group>
      )}

      <Stack gap={6}>
        <Text size="xs" fw={600} c="dimmed">
          {t('Comments')}
        </Text>
        <ReviewCommentsPanel entryId={entry.id} reviewEntry={reviewEntry} />
      </Stack>

      <Divider />

      <Stack gap={6}>
        <Text size="xs" fw={600} c="dimmed">
          {t('Change history')}
        </Text>
        <ReviewHistoryPanel reviewEntry={reviewEntry} />
      </Stack>
    </Stack>
  );
}

function pluralSummary(
  entry: POEntry,
  t: (key: string, vars?: Record<string, unknown>) => string,
): string {
  if (!entry.msgidPlural) return t('Singular entry');
  const forms = entry.msgstrPlural ?? [];
  const completed = forms.filter((form) => form.trim()).length;
  const total = Math.max(forms.length, 2);
  return t('Plural entry: {{completed}}/{{total}} forms translated', { completed, total });
}

function EntryDetailsPanel({
  entry,
  status,
  isModified,
  isMT,
  isManualEdit,
  hasGlossaryTerms,
  qaReport = null,
  reviewEntry = {
    status: 'draft',
    comments: [],
    history: [],
  },
  translationMemoryScope = null,
  onActivateReference,
  mode = 'edit',
}: {
  entry: POEntry;
  status: TranslationStatus;
  isModified: boolean;
  isMT: boolean;
  isManualEdit: boolean;
  hasGlossaryTerms: boolean;
  qaReport?: QAEntryReport | null;
  reviewEntry?: ReviewEntryState;
  translationMemoryScope?: TranslationMemoryScope | null;
  onActivateReference: (ref: ParsedReference) => void;
  mode?: WorkspaceMode;
}) {
  const { t } = useTranslation();
  const pluginSlug = useSourceStore((s) => getEffectiveSlug(s));
  const basePath = useSourceStore((s) => s.resolvedBasePath) ?? 'trunk';
  const activeReference = useSourceStore((s) => s.activeReference);
  const sourceContent = useSourceStore((s) => s.sourceContent);
  const sourceError = useSourceStore((s) => s.sourceError);
  const isLoadingSource = useSourceStore((s) => s.isLoadingSource);

  const parsedRefs = useMemo(() => parseReferences(entry.references), [entry.references]);
  const entryActiveReference = useMemo(
    () => parsedRefs.find((ref) => isSameReference(activeReference, ref)) ?? null,
    [activeReference, parsedRefs],
  );
  const flags = entry.flags.filter((f) => f !== 'fuzzy');

  return (
    <Stack gap="sm" data-testid={`entry-details-${entry.id}`}>
      <Group gap="xs" wrap="wrap">
        <Badge color={STATUS_COLORS[status]} variant="light" size="sm">
          {t(STATUS_LABELS[status])}
        </Badge>
        {isModified && (
          <Badge color="orange" variant="light" size="sm">
            {t('Modified')}
          </Badge>
        )}
        {isManualEdit && (
          <Badge color="grape" variant="light" size="sm">
            {t('Manual edit')}
          </Badge>
        )}
        {isMT && (
          <Badge color="blue" variant="light" size="sm">
            {t('Machine translated')}
          </Badge>
        )}
        {hasGlossaryTerms && (
          <Badge color="violet" variant="light" size="sm">
            {t('Glossary match')}
          </Badge>
        )}
        {qaReport && qaReport.errorCount > 0 && (
          <Badge color="red" variant="light" size="sm">
            {t('{{count}} QA error(s)', { count: qaReport.errorCount })}
          </Badge>
        )}
        {qaReport && qaReport.warningCount > 0 && (
          <Badge color="orange" variant="light" size="sm">
            {t('{{count}} QA warning(s)', { count: qaReport.warningCount })}
          </Badge>
        )}
        {entry.lineNumber && (
          <Badge color="gray" variant="light" size="sm">
            {t('Line {{lineNumber}}', { lineNumber: entry.lineNumber })}
          </Badge>
        )}
      </Group>

      <Group align="flex-start" grow>
        <Stack gap={4}>
          <Text size="xs" fw={600} c="dimmed">
            {t('Context')}
          </Text>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {entry.msgctxt || t('No context')}
          </Text>
        </Stack>

        <Stack gap={4}>
          <Text size="xs" fw={600} c="dimmed">
            {t('Structure')}
          </Text>
          <Text size="sm">{pluralSummary(entry, t)}</Text>
        </Stack>
      </Group>

      {mode === 'edit' && (
        <>
          <Divider />

          <Stack gap={6}>
            <Text size="xs" fw={600} c="dimmed">
              {t('Translation memory')}
            </Text>
            <TranslationMemoryPanel entry={entry} scope={translationMemoryScope} />
          </Stack>
        </>
      )}

      <Divider />

      <Stack gap={6}>
        <Text size="xs" fw={600} c="dimmed">
          {t('QA checks')}
        </Text>
        <QaIssuesPanel report={qaReport} />
      </Stack>

      <Divider />

      <Stack gap={6}>
        <Text size="xs" fw={600} c="dimmed">
          {t('References')}
        </Text>

        {parsedRefs.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t('No source references')}
          </Text>
        ) : (
          <Stack gap={4}>
            {parsedRefs.map((ref) => {
              const refLabel = `${ref.path}${ref.line ? `:${ref.line}` : ''}`;
              const isActiveRef = isSameReference(activeReference, ref);
              return (
                <Group key={refLabel} gap="xs" justify="space-between" wrap="nowrap">
                  <Anchor
                    component="button"
                    type="button"
                    size="sm"
                    c={isActiveRef ? 'blue' : 'dimmed'}
                    style={{ textAlign: 'left' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onActivateReference(ref);
                    }}
                  >
                    <Group gap={4} wrap="nowrap">
                      <FileCode size={12} />
                      <Text size="sm" component="span">
                        {refLabel}
                      </Text>
                    </Group>
                  </Anchor>

                  {pluginSlug && (
                    <Tooltip label={t('Open in Trac')}>
                      <ActionIcon
                        component="a"
                        href={buildTracUrl(pluginSlug, ref.path, ref.line ?? undefined, basePath)}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="subtle"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              );
            })}
          </Stack>
        )}
      </Stack>

      {mode === 'review' && (
        <>
          <Divider />

          <Stack gap={6}>
            <Text size="xs" fw={600} c="dimmed">
              {t('Review')}
            </Text>
            <ReviewPanel entry={entry} reviewEntry={reviewEntry} />
          </Stack>
        </>
      )}

      <Divider />

      <Group align="flex-start" grow>
        <Stack gap={6}>
          <Text size="xs" fw={600} c="dimmed">
            {t('Translator comments')}
          </Text>
          {entry.translatorComments.length > 0 ? (
            <Stack gap={3}>
              {entry.translatorComments.map((comment, idx) => (
                <Text key={`${entry.id}-translator-comment-${idx}`} size="sm">
                  {comment}
                </Text>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              {t('None')}
            </Text>
          )}
        </Stack>

        <Stack gap={6}>
          <Text size="xs" fw={600} c="dimmed">
            {t('Extracted comments')}
          </Text>
          {entry.extractedComments.length > 0 ? (
            <Stack gap={3}>
              {entry.extractedComments.map((comment, idx) => (
                <Text key={`${entry.id}-extracted-comment-${idx}`} size="sm">
                  {comment}
                </Text>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              {t('None')}
            </Text>
          )}
        </Stack>
      </Group>

      {flags.length > 0 && (
        <>
          <Divider />
          <Stack gap={6}>
            <Text size="xs" fw={600} c="dimmed">
              {t('Flags')}
            </Text>
            <Group gap={6} wrap="wrap">
              {flags.map((flag) => (
                <Badge key={`${entry.id}-flag-${flag}`} size="xs" variant="light" color="gray">
                  {flag}
                </Badge>
              ))}
            </Group>
          </Stack>
        </>
      )}

      <Divider />

      <Stack gap={6}>
        <Text size="xs" fw={600} c="dimmed">
          {t('Source preview')}
        </Text>

        {!pluginSlug && (
          <Text size="sm" c="dimmed">
            {t('Set a plugin slug in Settings to enable source preview.')}
          </Text>
        )}

        {pluginSlug && parsedRefs.length > 0 && !entryActiveReference && (
          <Text size="sm" c="dimmed">
            {t('Select a reference above to load source context.')}
          </Text>
        )}

        {pluginSlug && entryActiveReference && isLoadingSource && (
          <Group gap="xs">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              {t('Loading source...')}
            </Text>
          </Group>
        )}

        {pluginSlug && entryActiveReference && sourceError && !isLoadingSource && (
          <Text size="sm" c="red">
            {sourceError}
          </Text>
        )}

        {pluginSlug && entryActiveReference && sourceContent && !isLoadingSource && (
          <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
            <SourceCodeViewer
              content={sourceContent}
              targetLine={entryActiveReference.line}
              filePath={entryActiveReference.path}
              maxHeight={280}
            />
          </Paper>
        )}
      </Stack>
    </Stack>
  );
}

/**
 * Single entry row component - memoized for performance
 */
const EntryRow = memo(function EntryRow({
  entry,
  mode,
  isChecked,
  visibleDataColumns,
  onToggleSelection,
  onSelect,
  onKeyDown,
}: {
  entry: POEntry;
  mode: WorkspaceMode;
  isChecked: boolean;
  visibleDataColumns: DataColumnKey[];
  onToggleSelection: (checked: boolean) => void;
  onSelect?: (sourceText: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>, fieldId: string) => void;
}) {
  /* Column widths are handled by table-layout: fixed + <col> widths from thead */
  const {
    selectedEntryId,
    selectEntry,
    dirtyEntryIds,
    machineTranslatedIds,
    manualEditIds,
    machineTranslationMeta,
  } = useEditorStore();
  const getGlossaryAnalysis = useEditorStore((state) => state.getGlossaryAnalysis);
  const getQaReport = useEditorStore((state) => state.getQaReport);
  const reviewStatus = useEditorStore(
    (state) => state.reviewEntries.get(entry.id)?.status ?? 'draft',
  );
  const unresolvedCommentCount = useEditorStore(
    (state) =>
      state.reviewEntries.get(entry.id)?.comments.filter((comment) => !comment.resolvedAt).length ??
      0,
  );
  const lockApprovedEntries = useEditorStore((state) => state.lockApprovedEntries);

  const isSelected = selectedEntryId === entry.id;
  const isModified = dirtyEntryIds.has(entry.id);
  const isMT = machineTranslatedIds.has(entry.id);
  const usedGlossary = machineTranslationMeta.get(entry.id)?.usedGlossary ?? false;
  const mtProvider = machineTranslationMeta.get(entry.id)?.provider;
  const isManualEdit = manualEditIds.has(entry.id) && !isMT;
  const glossaryAnalysis = getGlossaryAnalysis(entry.id);
  const qaReport = getQaReport(entry.id);
  const hasGlossaryTerms = (glossaryAnalysis?.matchedCount ?? 0) > 0;
  const status = getTranslationStatus(entry.msgstr, entry.flags, entry.msgstrPlural);
  const isUntranslated = status === 'untranslated';
  const isReviewEntryLocked = isReviewLocked(reviewStatus, lockApprovedEntries);

  const rowRef = useRef<HTMLTableRowElement>(null);
  const handleClick = useCallback(() => {
    selectEntry(entry.id);
    onSelect?.(entry.msgid);
    rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [entry.id, entry.msgid, selectEntry, onSelect]);

  return (
    <Table.Tr
      ref={rowRef}
      data-entry-id={entry.id}
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        backgroundColor: isSelected
          ? 'var(--gb-highlight-row)'
          : isUntranslated
            ? 'var(--gb-highlight-danger)'
            : undefined,
        boxShadow: isModified ? 'inset 4px 0 0 var(--mantine-color-orange-5)' : undefined,
      }}
    >
      <Table.Td
        style={{
          verticalAlign: 'middle',
          padding: '8px 8px',
          overflow: 'hidden',
        }}
      >
        <Box
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Checkbox
            checked={isChecked}
            onChange={(e) => onToggleSelection(e.currentTarget.checked)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select entry ${entry.msgid}`}
          />
        </Box>
      </Table.Td>
      {visibleDataColumns.map((columnKey) => {
        if (columnKey === 'status') {
          return (
            <Table.Td
              key={`${entry.id}-status`}
              style={{ verticalAlign: 'top', padding: '12px 8px', overflow: 'hidden' }}
            >
              <StatusBadges
                entry={entry}
                isModified={isModified}
                isManualEdit={isManualEdit}
                hasGlossaryTerms={hasGlossaryTerms}
                isMT={isMT}
                reviewStatus={reviewStatus}
                unresolvedCommentCount={unresolvedCommentCount}
                isReviewEntryLocked={isReviewEntryLocked}
                showReviewStatus={mode === 'review'}
                showReviewComments={mode === 'review'}
              />
            </Table.Td>
          );
        }

        if (columnKey === 'approve') {
          return (
            <Table.Td
              key={`${entry.id}-approve`}
              style={{ verticalAlign: 'middle', padding: '8px 4px', overflow: 'hidden' }}
            >
              <Box style={{ display: 'flex', justifyContent: 'center' }}>
                <ReviewStatusBadge status={reviewStatus} compact />
              </Box>
            </Table.Td>
          );
        }

        if (columnKey === 'source') {
          return (
            <Table.Td
              key={`${entry.id}-source`}
              style={{ verticalAlign: 'top', padding: '12px 8px', overflow: 'hidden' }}
            >
              <SourceCell entry={entry} />
            </Table.Td>
          );
        }

        if (columnKey === 'translation') {
          return (
            <Table.Td
              key={`${entry.id}-translation`}
              style={{ verticalAlign: 'top', padding: '12px 8px', overflow: 'hidden' }}
              onClick={(e) => e.stopPropagation()}
            >
              <TranslationCell entry={entry} onKeyDown={onKeyDown} />
            </Table.Td>
          );
        }

        return (
          <Table.Td
            key={`${entry.id}-signals`}
            style={{ verticalAlign: 'top', padding: '12px 8px', overflow: 'hidden' }}
          >
            <SignalsOverviewCell
              isMT={isMT}
              usedGlossary={usedGlossary}
              provider={mtProvider}
              glossaryAnalysis={glossaryAnalysis ?? null}
              qaReport={qaReport ?? null}
              unresolvedCommentCount={unresolvedCommentCount}
              showReviewSignals={mode === 'review'}
            />
          </Table.Td>
        );
      })}
    </Table.Tr>
  );
});

const MobileEntryCard = memo(function MobileEntryCard({
  entry,
  mode,
  isChecked,
  detailsExpanded,
  onToggleDetails,
  onToggleSelection,
  onKeyDown,
  onSelect,
  translationMemoryScope,
}: {
  entry: POEntry;
  mode: WorkspaceMode;
  isChecked: boolean;
  detailsExpanded: boolean;
  onToggleDetails: () => void;
  onToggleSelection: (checked: boolean) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>, fieldId: string) => void;
  onSelect?: (sourceText: string) => void;
  translationMemoryScope?: TranslationMemoryScope | null;
}) {
  const { t } = useTranslation();
  const {
    selectedEntryId,
    selectEntry,
    dirtyEntryIds,
    machineTranslatedIds,
    manualEditIds,
    getGlossaryAnalysis,
    getQaReport,
  } = useEditorStore();
  const setActiveReference = useSourceStore((state) => state.setActiveReference);
  const reviewStatus = useEditorStore(
    (state) => state.reviewEntries.get(entry.id)?.status ?? 'draft',
  );
  const unresolvedCommentCount = useEditorStore(
    (state) =>
      state.reviewEntries.get(entry.id)?.comments.filter((comment) => !comment.resolvedAt).length ??
      0,
  );
  const reviewEntryState = useEditorStore((state) => state.reviewEntries.get(entry.id));
  const lockApprovedEntries = useEditorStore((state) => state.lockApprovedEntries);

  const isSelected = selectedEntryId === entry.id;
  const isModified = dirtyEntryIds.has(entry.id);
  const isMT = machineTranslatedIds.has(entry.id);
  const isManualEdit = manualEditIds.has(entry.id) && !isMT;
  const glossaryAnalysis = getGlossaryAnalysis(entry.id);
  const qaReport = getQaReport(entry.id);
  const hasGlossaryTerms = (glossaryAnalysis?.matchedCount ?? 0) > 0;
  const status = getTranslationStatus(entry.msgstr, entry.flags, entry.msgstrPlural);
  const isUntranslated = status === 'untranslated';
  const reviewEntry = reviewEntryState ?? {
    status: 'draft',
    comments: [],
    history: [],
  };
  const isReviewEntryLocked = isReviewLocked(reviewStatus, lockApprovedEntries);

  const handleSelect = useCallback(() => {
    selectEntry(entry.id);
    onSelect?.(entry.msgid);
  }, [entry.id, entry.msgid, onSelect, selectEntry]);

  const handleActivateReference = useCallback(
    (ref: ParsedReference) => {
      selectEntry(entry.id);
      onSelect?.(entry.msgid);
      setActiveReference(ref);
    },
    [entry.id, entry.msgid, onSelect, selectEntry, setActiveReference],
  );

  return (
    <Paper
      withBorder
      p="sm"
      data-entry-id={entry.id}
      onClick={handleSelect}
      style={{
        cursor: 'pointer',
        borderColor: isSelected ? 'var(--mantine-color-blue-4)' : undefined,
        backgroundColor: isSelected
          ? 'var(--gb-highlight-row)'
          : isUntranslated
            ? 'var(--gb-highlight-danger)'
            : undefined,
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Group gap="xs" align="flex-start" wrap="nowrap">
          <Checkbox
            checked={isChecked}
            onChange={(e) => onToggleSelection(e.currentTarget.checked)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select entry ${entry.msgid}`}
            mt={2}
          />
          <StatusBadges
            entry={entry}
            isModified={isModified}
            isManualEdit={isManualEdit}
            hasGlossaryTerms={hasGlossaryTerms}
            isMT={isMT}
            reviewStatus={reviewStatus}
            unresolvedCommentCount={unresolvedCommentCount}
            isReviewEntryLocked={isReviewEntryLocked}
            showReviewStatus={mode === 'review'}
            showReviewComments={mode === 'review'}
          />
          {mode === 'review' && <ReviewStatusBadge status={reviewStatus} compact />}
        </Group>

        <UnstyledButton
          onClick={(e) => {
            e.stopPropagation();
            onToggleDetails();
          }}
          style={{ color: 'var(--mantine-color-dimmed)' }}
          aria-label={`Toggle details for ${entry.msgid}`}
        >
          <Group gap={4} wrap="nowrap">
            <Text size="xs" fw={500}>
              {t('Details')}
            </Text>
            {detailsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Group>
        </UnstyledButton>
      </Group>

      <Stack gap={8} mt="sm">
        <Box>
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            {t('Source')}
          </Text>
          <SourceCell entry={entry} />
        </Box>

        <Box>
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            {t('Translation')}
          </Text>
          <TranslationCell entry={entry} onKeyDown={onKeyDown} useNativeTextColor />
        </Box>

        <Box>
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            {t('Signals')}
          </Text>
          <MetaCell entry={entry} onReferenceActivate={handleActivateReference} />
        </Box>
      </Stack>

      <Collapse in={detailsExpanded}>
        <Divider my="sm" />
        <EntryDetailsPanel
          entry={entry}
          status={status}
          isModified={isModified}
          isMT={isMT}
          isManualEdit={isManualEdit}
          hasGlossaryTerms={hasGlossaryTerms}
          qaReport={qaReport ?? null}
          reviewEntry={reviewEntry}
          translationMemoryScope={translationMemoryScope}
          onActivateReference={handleActivateReference}
          mode={mode}
        />
      </Collapse>
    </Paper>
  );
});

const ReviewQueueRow = memo(function ReviewQueueRow({
  entry,
  isChecked,
  onToggleSelection,
  onSelect,
}: {
  entry: POEntry;
  isChecked: boolean;
  onToggleSelection: (checked: boolean) => void;
  onSelect?: (sourceText: string) => void;
}) {
  const { t } = useTranslation();
  const selectedEntryId = useEditorStore((state) => state.selectedEntryId);
  const selectEntry = useEditorStore((state) => state.selectEntry);
  const getQaReport = useEditorStore((state) => state.getQaReport);
  const reviewEntryState = useEditorStore((state) => state.reviewEntries.get(entry.id));

  const isSelected = selectedEntryId === entry.id;
  const qaReport = getQaReport(entry.id);
  const reviewEntry = reviewEntryState ?? getReviewEntryState(new Map(), entry.id);
  const reviewStatus = reviewEntry.status;
  const unresolvedCommentCount = reviewEntry.comments.filter(
    (comment) => !comment.resolvedAt,
  ).length;
  const hasChangedTranslation = hasReviewTranslationChanges(reviewEntry);
  const translationStatus = getTranslationStatus(entry.msgstr, entry.flags, entry.msgstrPlural);

  const handleClick = useCallback(() => {
    selectEntry(entry.id);
    onSelect?.(entry.msgid);
  }, [entry.id, entry.msgid, onSelect, selectEntry]);

  return (
    <Table.Tr
      data-entry-id={entry.id}
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        backgroundColor: isSelected ? 'var(--gb-highlight-row)' : undefined,
      }}
    >
      <Table.Td style={{ width: 48, padding: '10px 8px', verticalAlign: 'top' }}>
        <Checkbox
          checked={isChecked}
          onChange={(event) => onToggleSelection(event.currentTarget.checked)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select entry ${entry.msgid}`}
        />
      </Table.Td>
      <Table.Td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
        <Stack gap={4}>
          <Text size="sm" fw={500} lineClamp={3}>
            {getReviewQueueSourceText(entry)}
          </Text>
          {entry.msgctxt && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {entry.msgctxt}
            </Text>
          )}
        </Stack>
      </Table.Td>
      <Table.Td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
        <Text
          size="sm"
          c={translationStatus === 'untranslated' ? 'dimmed' : undefined}
          lineClamp={3}
        >
          {getReviewQueueTranslationText(entry, t)}
        </Text>
      </Table.Td>
      <Table.Td style={{ padding: '10px 12px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
        <ReviewStatusBadge status={reviewStatus} compact />
      </Table.Td>
      <Table.Td style={{ padding: '10px 12px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
        {unresolvedCommentCount > 0 ? (
          <Badge size="xs" variant="light" color="red">
            {t('{{count}} open', { count: unresolvedCommentCount })}
          </Badge>
        ) : (
          <Text size="xs" c="dimmed">
            —
          </Text>
        )}
      </Table.Td>
      <Table.Td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
        <Group gap={6} wrap="wrap">
          {hasChangedTranslation && (
            <Badge size="xs" variant="light" color="violet">
              {t('Changed')}
            </Badge>
          )}
          {translationStatus === 'fuzzy' && (
            <Badge size="xs" variant="light" color="yellow">
              {t('Fuzzy')}
            </Badge>
          )}
          {qaReport && qaReport.errorCount > 0 && (
            <Badge size="xs" variant="light" color="red">
              {t('{{count}} QA', { count: qaReport.errorCount })}
            </Badge>
          )}
          {qaReport && qaReport.warningCount > 0 && (
            <Badge size="xs" variant="light" color="orange">
              {t('{{count}} warning(s)', { count: qaReport.warningCount })}
            </Badge>
          )}
          {!hasChangedTranslation &&
            translationStatus !== 'fuzzy' &&
            (!qaReport || (qaReport.errorCount === 0 && qaReport.warningCount === 0)) && (
              <Text size="xs" c="dimmed">
                —
              </Text>
            )}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
});

/**
 * Main editor table component
 */
export interface EditorTableProps {
  targetLang?: TargetLanguage | null;
  sourceLang?: SourceLanguage | null;
  glossary?: Glossary | null;
  deeplGlossaryId?: string | null;
  glossaryEnforcementEnabled?: boolean;
  onEntrySelect?: (sourceText: string) => void;
  speechEnabled?: boolean;
  translateEnabled?: boolean;
  mode?: WorkspaceMode;
}

export function EditorTable({
  targetLang = null,
  sourceLang = null,
  glossary = null,
  deeplGlossaryId = null,
  glossaryEnforcementEnabled = false,
  onEntrySelect,
  speechEnabled = true,
  translateEnabled = true,
  mode = 'edit',
}: EditorTableProps) {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const entries = useEditorStore((state) => state.entries);
  const filename = useEditorStore((state) => state.filename);
  const selectedEntryId = useEditorStore((state) => state.selectedEntryId);
  const dirtyEntryIds = useEditorStore((state) => state.dirtyEntryIds);
  const machineTranslatedIds = useEditorStore((state) => state.machineTranslatedIds);
  const manualEditIds = useEditorStore((state) => state.manualEditIds);
  const header = useEditorStore((state) => state.header);
  const projectName = useEditorStore((state) => state.projectName);
  const getGlossaryAnalysis = useEditorStore((state) => state.getGlossaryAnalysis);
  const getQaReport = useEditorStore((state) => state.getQaReport);
  const getReviewEntry = useEditorStore((state) => state.getReviewEntry);
  const selectEntry = useEditorStore((state) => state.selectEntry);
  const selectedEntryIds = useEditorStore((state) => state.selectedEntryIds);
  const setEntrySelection = useEditorStore((state) => state.setEntrySelection);
  const setSelectedEntries = useEditorStore((state) => state.setSelectedEntries);
  const clearSelectedEntries = useEditorStore((state) => state.clearSelectedEntries);
  const getFilteredEntries = useEditorStore((state) => state.getFilteredEntries);
  const visibleColumns = useEditorStore((state) => state.visibleColumns);
  const columnOrder = useEditorStore((state) => state.columnOrder);
  const moveColumnToIndex = useEditorStore((state) => state.moveColumnToIndex);
  const clearFuzzyBatch = useEditorStore((state) => state.clearFuzzyBatch);
  const addFuzzyBatch = useEditorStore((state) => state.addFuzzyBatch);
  const setReviewStatus = useEditorStore((state) => state.setReviewStatus);
  const sortField = useEditorStore((state) => state.sortField);
  const sortDirection = useEditorStore((state) => state.sortDirection);
  const activeReference = useSourceStore((state) => state.activeReference);
  const setActiveReference = useSourceStore((state) => state.setActiveReference);
  // Subscribe to activeFilters changes - serialize to detect any change
  const activeFiltersKey = useEditorStore((state) =>
    JSON.stringify(Array.from(state.activeFilters.entries())),
  );
  const filterQuery = useEditorStore((state) => state.filterQuery);

  // Re-compute filtered entries when filters, query, or entries change
  const filteredEntries = useMemo(() => {
    return getFilteredEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFilteredEntries, activeFiltersKey, filterQuery, entries, sortField, sortDirection]);

  // Navigation: skip already-translated entries on Ctrl/Cmd+Enter
  const [skipTranslated] = useLocalStorage<boolean>({
    key: NAV_SKIP_TRANSLATED_KEY,
    defaultValue: true,
  });

  // Pending entry to focus after page change
  const [pendingFocusEntryId, setPendingFocusEntryId] = useState<string | null>(null);
  const [expandedMobileEntryIds, setExpandedMobileEntryIds] = useState<Set<string>>(new Set());
  const [inspectorMode, setInspectorMode] = useState<'context' | 'browse'>('context');

  // Refs for stable handleKeyDown callback (avoids re-creating and re-rendering all rows)
  const navRef = useRef({
    filteredEntries,
    skipTranslated,
    currentPage: 1,
    rowsPerPageNum: 50,
    onEntrySelect,
  });
  navRef.current.filteredEntries = filteredEntries;
  navRef.current.skipTranslated = skipTranslated;
  navRef.current.onEntrySelect = onEntrySelect;

  // Column widths (proportional) with localStorage persistence
  const [columnWidths, setColumnWidths] = useLocalStorage<number[]>({
    key: 'po-editor-column-widths',
    defaultValue: DEFAULT_COLUMN_WIDTHS,
  });

  // Ensure stored widths have the right length (in case columns were added/removed)
  const safeWidths =
    columnWidths.length === COLUMN_KEYS.length ? columnWidths : DEFAULT_COLUMN_WIDTHS;
  const widthByKey = useMemo(
    () =>
      COLUMN_KEYS.reduce(
        (acc, key, index) => {
          acc[key] = safeWidths[index];
          return acc;
        },
        {} as Record<TableColumnKey, number>,
      ),
    [safeWidths],
  );
  const visibleColumnKeys = useMemo(() => {
    const dataColumns = columnOrder.filter(
      (column) => visibleColumns.has(column) && (mode === 'review' || column !== 'approve'),
    );
    return ['select', ...dataColumns] as TableColumnKey[];
  }, [columnOrder, mode, visibleColumns]);
  const visibleDataColumns = useMemo(
    () => visibleColumnKeys.filter((column): column is DataColumnKey => column !== 'select'),
    [visibleColumnKeys],
  );
  const visibleTotalWidth = visibleColumnKeys.reduce((sum, key) => sum + widthByKey[key], 0);
  const columnPercentByKey = useMemo(
    () =>
      visibleColumnKeys.reduce(
        (acc, key) => {
          acc[key] = `${((widthByKey[key] / visibleTotalWidth) * 100).toFixed(2)}%`;
          return acc;
        },
        {} as Record<TableColumnKey, string>,
      ),
    [visibleColumnKeys, visibleTotalWidth, widthByKey],
  );
  const tableRef = useRef<HTMLTableElement>(null);

  const handleColumnResize = useCallback(
    (leftKey: TableColumnKey, rightKey: TableColumnKey, deltaX: number) => {
      // Double-click sentinel: reset all columns to defaults
      if (!isFinite(deltaX)) {
        setColumnWidths(DEFAULT_COLUMN_WIDTHS);
        return;
      }

      setColumnWidths((prev) => {
        const widths = [...(prev.length === COLUMN_KEYS.length ? prev : DEFAULT_COLUMN_WIDTHS)];
        const tableWidth = tableRef.current?.offsetWidth ?? 1000;
        const visibleTotal = visibleColumnKeys.reduce(
          (sum, key) => sum + widths[COLUMN_KEYS.indexOf(key)],
          0,
        );
        // Convert pixel delta to proportion delta
        const proportionDelta = (deltaX / tableWidth) * visibleTotal;

        const leftIndex = COLUMN_KEYS.indexOf(leftKey);
        const rightIndex = COLUMN_KEYS.indexOf(rightKey);
        const newLeft = widths[leftIndex] + proportionDelta;
        const newRight = widths[rightIndex] - proportionDelta;

        if (newLeft < MIN_COLUMN_WIDTH || newRight < MIN_COLUMN_WIDTH) {
          return prev;
        }

        widths[leftIndex] = newLeft;
        widths[rightIndex] = newRight;
        return widths;
      });
    },
    [setColumnWidths, visibleColumnKeys],
  );

  // Column header drag-and-drop state
  const [draggingHeaderColumn, setDraggingHeaderColumn] = useState<DataColumnKey | null>(null);
  const [headerDropTarget, setHeaderDropTarget] = useState<{
    column: DataColumnKey;
    position: 'before' | 'after';
  } | null>(null);
  const headerDragPointerId = useRef<number | null>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const headerDragGhost = useDragGhost();

  const handleHeaderPointerDown = useCallback(
    (columnKey: DataColumnKey) => (e: ReactPointerEvent<HTMLTableCellElement>) => {
      if (e.button !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (e.clientX > rect.right - 8) return;

      headerDragPointerId.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraggingHeaderColumn(columnKey);
      setHeaderDropTarget(null);
      headerDragGhost.show(e.currentTarget, e.clientX, e.clientY, t(DATA_COLUMN_LABELS[columnKey]));
    },
    [headerDragGhost, t],
  );

  const handleHeaderPointerMove = useCallback(
    (e: React.PointerEvent<HTMLTableSectionElement>) => {
      if (headerDragPointerId.current !== e.pointerId || !draggingHeaderColumn) return;
      headerDragGhost.move(e.clientX, e.clientY);
      if (!theadRef.current) return;

      const cells = theadRef.current.querySelectorAll<HTMLTableCellElement>('[data-column-key]');
      for (const cell of cells) {
        const col = cell.getAttribute('data-column-key') as DataColumnKey;
        if (!col) continue;
        const rect = cell.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          if (col === draggingHeaderColumn) {
            setHeaderDropTarget(null);
          } else {
            const midX = rect.left + rect.width / 2;
            setHeaderDropTarget({
              column: col,
              position: e.clientX < midX ? 'before' : 'after',
            });
          }
          return;
        }
      }
      setHeaderDropTarget(null);
    },
    [draggingHeaderColumn, headerDragGhost],
  );

  const finishHeaderDrag = useCallback(
    (pointerId: number, shouldCommit: boolean) => {
      if (headerDragPointerId.current !== pointerId) return;
      headerDragPointerId.current = null;

      if (shouldCommit && draggingHeaderColumn && headerDropTarget) {
        const targetIdx = columnOrder.indexOf(headerDropTarget.column);
        if (targetIdx !== -1) {
          const fromIdx = columnOrder.indexOf(draggingHeaderColumn);
          const finalIdx =
            headerDropTarget.position === 'after'
              ? fromIdx < targetIdx
                ? targetIdx
                : targetIdx + 1
              : fromIdx > targetIdx
                ? targetIdx
                : targetIdx - 1;
          moveColumnToIndex(draggingHeaderColumn, finalIdx);
        }
      }
      setDraggingHeaderColumn(null);
      setHeaderDropTarget(null);
      headerDragGhost.hide();
    },
    [draggingHeaderColumn, headerDropTarget, columnOrder, moveColumnToIndex, headerDragGhost],
  );

  // Pagination state with localStorage persistence
  const [rowsPerPage, setRowsPerPage] = useLocalStorage<string>({
    key: 'po-editor-rows-per-page',
    defaultValue: '50',
  });
  const [inspectorWidth, setInspectorWidth] = useLocalStorage<number>({
    key: INSPECTOR_WIDTH_KEY,
    defaultValue: INSPECTOR_DEFAULT_WIDTH,
  });
  const [inspectorOpen, setInspectorOpen] = useLocalStorage<boolean>({
    key: INSPECTOR_OPEN_KEY,
    defaultValue: true,
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate pagination
  const rowsPerPageNum = parseInt(rowsPerPage, 10);
  const totalPages = Math.ceil(filteredEntries.length / rowsPerPageNum);

  // Reset to page 1 when filters change or rows per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredEntries.length, rowsPerPage]);

  // Get paginated entries
  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPageNum;
    const endIndex = startIndex + rowsPerPageNum;
    return filteredEntries.slice(startIndex, endIndex);
  }, [filteredEntries, currentPage, rowsPerPageNum]);

  const selectedEntry = useMemo(() => {
    if (selectedEntryId) {
      const fromFiltered = filteredEntries.find((entry) => entry.id === selectedEntryId);
      if (fromFiltered) return fromFiltered;
    }
    return filteredEntries[0] ?? null;
  }, [filteredEntries, selectedEntryId]);

  const filteredEntryIds = useMemo(
    () => filteredEntries.map((entry) => entry.id),
    [filteredEntries],
  );
  const filteredEntryIdSet = useMemo(() => new Set(filteredEntryIds), [filteredEntryIds]);
  const selectedFilteredCount = useMemo(
    () => filteredEntryIds.filter((id) => selectedEntryIds.has(id)).length,
    [filteredEntryIds, selectedEntryIds],
  );
  const allFilteredSelected =
    filteredEntryIds.length > 0 && selectedFilteredCount === filteredEntryIds.length;
  const someFilteredSelected = selectedFilteredCount > 0 && !allFilteredSelected;

  const handleSelectAllFiltered = useCallback(
    (checked: boolean) => {
      if (checked) {
        const merged = new Set(selectedEntryIds);
        filteredEntryIds.forEach((id) => merged.add(id));
        setSelectedEntries(Array.from(merged));
        return;
      }

      const remaining = Array.from(selectedEntryIds).filter((id) => !filteredEntryIdSet.has(id));
      setSelectedEntries(remaining);
    },
    [selectedEntryIds, filteredEntryIds, filteredEntryIdSet, setSelectedEntries],
  );

  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedEntryIds.has(entry.id)),
    [entries, selectedEntryIds],
  );
  const selectedReviewApprovedCount = useMemo(
    () => selectedEntries.filter((entry) => getReviewEntry(entry.id).status === 'approved').length,
    [getReviewEntry, selectedEntries],
  );
  const selectedReviewPendingCount = selectedEntries.length - selectedReviewApprovedCount;

  const handleApproveSelected = useCallback(() => {
    if (selectedEntries.length === 0) return;

    const fuzzyEntryIds = selectedEntries
      .filter((entry) => entry.flags.includes('fuzzy'))
      .map((entry) => entry.id);

    if (fuzzyEntryIds.length > 0) {
      clearFuzzyBatch(fuzzyEntryIds);
    }

    selectedEntries.forEach((entry) => {
      setReviewStatus(entry.id, 'approved');
    });
  }, [clearFuzzyBatch, selectedEntries, setReviewStatus]);

  const handleUnapproveSelected = useCallback(() => {
    selectedEntries.forEach((entry) => {
      if (getReviewEntry(entry.id).status === 'approved') {
        setReviewStatus(entry.id, 'in-review');
      }
    });
  }, [getReviewEntry, selectedEntries, setReviewStatus]);

  const handleRequestChangesSelected = useCallback(() => {
    if (selectedEntries.length === 0) return;

    const fuzzyCandidateIds = selectedEntries
      .filter(
        (entry) =>
          getTranslationStatus(entry.msgstr, entry.flags, entry.msgstrPlural) !== 'untranslated',
      )
      .filter((entry) => !entry.flags.includes('fuzzy'))
      .map((entry) => entry.id);

    if (fuzzyCandidateIds.length > 0) {
      addFuzzyBatch(fuzzyCandidateIds);
    }

    selectedEntries.forEach((entry) => {
      setReviewStatus(entry.id, 'needs-changes');
    });
  }, [addFuzzyBatch, selectedEntries, setReviewStatus]);

  const handleInspectorResizeStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = inspectorWidth;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const onPointerMove = (ev: globalThis.PointerEvent) => {
        const delta = ev.clientX - startX;
        const viewportMax = Math.max(INSPECTOR_MIN_WIDTH, window.innerWidth - 300);
        const maxWidth = Math.min(INSPECTOR_MAX_WIDTH, viewportMax);
        const nextWidth = Math.min(maxWidth, Math.max(INSPECTOR_MIN_WIDTH, startWidth - delta));
        setInspectorWidth(nextWidth);
      };

      const onPointerUp = () => {
        target.removeEventListener('pointermove', onPointerMove);
        target.removeEventListener('pointerup', onPointerUp);
      };

      target.addEventListener('pointermove', onPointerMove);
      target.addEventListener('pointerup', onPointerUp);
    },
    [inspectorWidth, setInspectorWidth],
  );

  const toggleMobileDetails = useCallback((entryId: string) => {
    setExpandedMobileEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isMobile || !selectedEntryId) return;
    setExpandedMobileEntryIds((prev) => {
      if (prev.has(selectedEntryId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(selectedEntryId);
      return next;
    });
  }, [isMobile, selectedEntryId]);

  useEffect(() => {
    if (!selectedEntryId && filteredEntries.length > 0) {
      selectEntry(filteredEntries[0].id);
    }
  }, [filteredEntries, selectedEntryId, selectEntry]);

  // Keep navRef in sync with pagination state
  navRef.current.currentPage = currentPage;
  navRef.current.rowsPerPageNum = rowsPerPageNum;

  const translateSettings: TranslateSettings = useMemo(
    () => ({
      targetLang,
      sourceLang,
      glossary,
      deeplGlossaryId,
      glossaryEnforcementEnabled,
      speechEnabled,
      translateEnabled,
    }),
    [
      targetLang,
      sourceLang,
      glossary,
      deeplGlossaryId,
      glossaryEnforcementEnabled,
      speechEnabled,
      translateEnabled,
    ],
  );
  const targetLanguageForMemory = header?.language ?? targetLang ?? null;
  const translationMemoryScope = useMemo(
    () =>
      targetLanguageForMemory
        ? createTranslationMemoryScope(projectName, targetLanguageForMemory, sourceLang ?? null)
        : null,
    [projectName, sourceLang, targetLanguageForMemory],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>, fieldId: string) => {
      // Ctrl/Cmd+Enter: navigate to next entry (optionally skip translated)
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const {
          filteredEntries: allEntries,
          skipTranslated: skip,
          rowsPerPageNum: rpp,
        } = navRef.current;

        // Extract entry ID from field ID (format: "{entryId}-singular" or "{entryId}-plural-N")
        const currentEntryId = fieldId.replace(/-(singular|plural-\d+)$/, '');
        const curIdx = allEntries.findIndex((entry) => entry.id === currentEntryId);
        if (curIdx === -1) return;

        // Find next entry, optionally skipping already-translated ones
        let nextEntry: POEntry | null = null;
        const len = allEntries.length;
        for (let offset = 1; offset < len; offset++) {
          const candidate = allEntries[(curIdx + offset) % len];
          if (!skip || entryNeedsTranslation(candidate)) {
            nextEntry = candidate;
            break;
          }
        }
        if (!nextEntry) return;

        // Select the entry and navigate to its page
        selectEntry(nextEntry.id);
        navRef.current.onEntrySelect?.(nextEntry.msgid);
        const nextIndex = allEntries.indexOf(nextEntry);
        const targetPage = Math.floor(nextIndex / rpp) + 1;
        if (targetPage !== navRef.current.currentPage) {
          setCurrentPage(targetPage);
        }
        setPendingFocusEntryId(nextEntry.id);
        return;
      }

      // Tab / Enter: navigate between fields sequentially
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        const allFields = document.querySelectorAll('[data-field-id]');
        const fieldArray = Array.from(allFields);
        const currentIndex = fieldArray.findIndex(
          (el) => el.getAttribute('data-field-id') === fieldId,
        );
        if (currentIndex === -1) return;

        let nextIndex: number;
        if (e.key === 'Tab' && e.shiftKey) {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : fieldArray.length - 1;
        } else {
          nextIndex = currentIndex < fieldArray.length - 1 ? currentIndex + 1 : 0;
        }

        const nextField = fieldArray[nextIndex] as HTMLElement;
        if (nextField) {
          const wrapper = nextField.closest('.editable-text-wrapper');
          if (wrapper) {
            (wrapper as HTMLElement).click();
          } else {
            nextField.focus();
          }
          nextField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    },
    [selectEntry, setCurrentPage],
  );

  // Focus the pending entry's translation field after page change / render
  useEffect(() => {
    if (!pendingFocusEntryId) return;
    const raf = requestAnimationFrame(() => {
      const fieldSelector = `[data-entry-id="${pendingFocusEntryId}"][data-field-id]`;
      const field = document.querySelector(fieldSelector) as HTMLElement | null;

      if (field) {
        const wrapper = field.classList.contains('editable-text-wrapper')
          ? field
          : (field.closest('.editable-text-wrapper') as HTMLElement | null);

        if (wrapper) {
          wrapper.click();
          wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          field.focus();
          field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        const row = document.querySelector(`tr[data-entry-id="${pendingFocusEntryId}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      setPendingFocusEntryId(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [pendingFocusEntryId, paginatedEntries]);

  const handleInspectorReference = useCallback(
    (ref: ParsedReference) => {
      if (selectedEntry) {
        selectEntry(selectedEntry.id);
        onEntrySelect?.(selectedEntry.msgid);
      }
      setActiveReference(ref);
    },
    [onEntrySelect, selectEntry, selectedEntry, setActiveReference],
  );

  if (!filename) {
    return null;
  }

  // Calculate display range for "Showing X-Y of Z"
  const startItem = filteredEntries.length === 0 ? 0 : (currentPage - 1) * rowsPerPageNum + 1;
  const endItem = Math.min(currentPage * rowsPerPageNum, filteredEntries.length);
  const selectedStatus = selectedEntry
    ? getTranslationStatus(selectedEntry.msgstr, selectedEntry.flags, selectedEntry.msgstrPlural)
    : null;
  const selectedIsModified = selectedEntry ? dirtyEntryIds.has(selectedEntry.id) : false;
  const selectedIsMT = selectedEntry ? machineTranslatedIds.has(selectedEntry.id) : false;
  const selectedIsManualEdit = selectedEntry
    ? manualEditIds.has(selectedEntry.id) && !selectedIsMT
    : false;
  const selectedHasGlossaryTerms = selectedEntry
    ? (getGlossaryAnalysis(selectedEntry.id)?.matchedCount ?? 0) > 0
    : false;
  const selectedQaReport = selectedEntry ? (getQaReport(selectedEntry.id) ?? null) : null;
  const selectedReviewEntry = selectedEntry ? getReviewEntry(selectedEntry.id) : null;
  const inspectorTitle = mode === 'review' ? t('Review Inspector') : t('String Inspector');
  const selectedInspectorLabel = (() => {
    if (!selectedEntry) return t('No selection');

    const linePart = selectedEntry.lineNumber
      ? t('Line {{lineNumber}}', { lineNumber: selectedEntry.lineNumber })
      : '';
    const sourcePreview =
      selectedEntry.msgid.trim() || selectedEntry.msgctxt?.trim() || t('Selected string');

    return linePart ? `${linePart} · ${sourcePreview}` : sourcePreview;
  })();

  return (
    <TranslateSettingsContext.Provider value={translateSettings}>
      {selectedEntryIds.size > 0 && (
        <Group justify="space-between" align="center" mb={6} wrap="wrap">
          <Text size="xs" c="dimmed">
            {t('{{count}} selected', { count: selectedEntryIds.size })}
          </Text>
          {mode === 'review' && (
            <Group gap="xs" wrap="wrap">
              <Button size="xs" variant="light" color="green" onClick={handleApproveSelected}>
                {t('Approve selected')}
              </Button>
              <Button
                size="xs"
                variant="default"
                onClick={handleUnapproveSelected}
                disabled={selectedReviewApprovedCount === 0}
              >
                {t('Unapprove selected')}
              </Button>
              <Button
                size="xs"
                variant="light"
                color="orange"
                onClick={handleRequestChangesSelected}
                disabled={selectedReviewPendingCount === 0 && selectedReviewApprovedCount === 0}
              >
                {t('Request changes selected')}
              </Button>
              <Button size="xs" variant="subtle" color="gray" onClick={clearSelectedEntries}>
                {t('Clear selection')}
              </Button>
            </Group>
          )}
        </Group>
      )}

      {isMobile ? (
        <Stack gap="sm" data-testid="mobile-entry-card-list">
          {paginatedEntries.map((entry) => (
            <MobileEntryCard
              key={entry.id}
              entry={entry}
              mode={mode}
              isChecked={selectedEntryIds.has(entry.id)}
              detailsExpanded={expandedMobileEntryIds.has(entry.id)}
              onToggleDetails={() => toggleMobileDetails(entry.id)}
              onToggleSelection={(checked) => setEntrySelection(entry.id, checked)}
              onKeyDown={handleKeyDown}
              onSelect={onEntrySelect}
              translationMemoryScope={translationMemoryScope}
            />
          ))}
        </Stack>
      ) : (
        <Stack gap="xs">
          <Group justify="flex-end">
            <Button
              variant={inspectorOpen ? 'light' : 'subtle'}
              size="xs"
              leftSection={
                inspectorOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />
              }
              onClick={() => setInspectorOpen(!inspectorOpen)}
              data-testid="toggle-inspector-btn"
            >
              {inspectorOpen ? t('Hide info') : t('More info')}
            </Button>
          </Group>
          <Box style={{ display: 'flex', alignItems: 'flex-start' }}>
            <Box style={{ flex: 1, minWidth: 0 }}>
              {mode === 'review' ? (
                <Table
                  striped
                  highlightOnHover
                  verticalSpacing="sm"
                  style={{ tableLayout: 'fixed' }}
                  data-testid="review-queue-table"
                >
                  <Table.Thead
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                      background: 'var(--gb-surface-2)',
                    }}
                  >
                    <Table.Tr>
                      <Table.Th style={{ width: 48 }}>
                        <Checkbox
                          checked={allFilteredSelected}
                          indeterminate={someFilteredSelected}
                          onChange={(event) => handleSelectAllFiltered(event.currentTarget.checked)}
                          aria-label={t('Select all filtered entries')}
                        />
                      </Table.Th>
                      <Table.Th>{t('Source')}</Table.Th>
                      <Table.Th>{t('Translation')}</Table.Th>
                      <Table.Th>{t('Review status')}</Table.Th>
                      <Table.Th>{t('Comments')}</Table.Th>
                      <Table.Th>{t('Signals')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedEntries.map((entry) => (
                      <ReviewQueueRow
                        key={entry.id}
                        entry={entry}
                        isChecked={selectedEntryIds.has(entry.id)}
                        onToggleSelection={(checked) => setEntrySelection(entry.id, checked)}
                        onSelect={onEntrySelect}
                      />
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Table
                  ref={tableRef}
                  striped
                  highlightOnHover
                  verticalSpacing="md"
                  style={{ tableLayout: 'fixed' }}
                  data-testid="editor-table-desktop"
                >
                  <Table.Thead
                    ref={theadRef}
                    onPointerMove={handleHeaderPointerMove}
                    onPointerUp={(e) => finishHeaderDrag(e.pointerId, true)}
                    onPointerCancel={(e) => finishHeaderDrag(e.pointerId, false)}
                    onLostPointerCapture={(e) => finishHeaderDrag(e.pointerId, false)}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                      background: 'var(--gb-surface-2)',
                      touchAction: 'none',
                    }}
                  >
                    <Table.Tr>
                      {visibleColumnKeys.map((columnKey, i) => {
                        const nextColumn = visibleColumnKeys[i + 1];
                        const isDataColumn = columnKey !== 'select';
                        const label =
                          columnKey === 'select' ? (
                            <Checkbox
                              key="select-all-checkbox-input"
                              checked={allFilteredSelected}
                              indeterminate={someFilteredSelected}
                              onChange={(e) => handleSelectAllFiltered(e.currentTarget.checked)}
                              aria-label={t('Select all filtered entries')}
                              data-testid="select-all-checkbox"
                            />
                          ) : (
                            t(DATA_COLUMN_LABELS[columnKey])
                          );

                        const dropIndicator =
                          isDataColumn && headerDropTarget?.column === columnKey
                            ? headerDropTarget.position
                            : undefined;

                        return (
                          <ResizableTh
                            key={columnKey}
                            widthPercent={columnPercentByKey[columnKey]}
                            isLast={!nextColumn}
                            onResize={
                              nextColumn
                                ? (delta) => handleColumnResize(columnKey, nextColumn, delta)
                                : undefined
                            }
                            align={columnKey === 'select' ? 'center' : 'left'}
                            padding={columnKey === 'select' ? '8px 4px' : undefined}
                            dataColumnKey={isDataColumn ? columnKey : undefined}
                            onCellPointerDown={
                              isDataColumn ? handleHeaderPointerDown(columnKey) : undefined
                            }
                            isDragging={draggingHeaderColumn === columnKey}
                            dropIndicatorPosition={dropIndicator}
                          >
                            {typeof label === 'string' ? (
                              label
                            ) : (
                              <Box
                                style={{
                                  display: 'flex',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                }}
                              >
                                {label}
                              </Box>
                            )}
                          </ResizableTh>
                        );
                      })}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedEntries.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        mode={mode}
                        isChecked={selectedEntryIds.has(entry.id)}
                        visibleDataColumns={visibleDataColumns}
                        onToggleSelection={(checked) => setEntrySelection(entry.id, checked)}
                        onSelect={onEntrySelect}
                        onKeyDown={handleKeyDown}
                      />
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Box>

            <Box
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--mantine-spacing-md)',
                overflow:
                  typeof CSS !== 'undefined' &&
                  typeof CSS.supports === 'function' &&
                  CSS.supports('overflow', 'clip')
                    ? 'clip'
                    : 'hidden',
                flexShrink: 0,
                width: inspectorOpen ? inspectorWidth + 24 : 0,
                marginLeft: inspectorOpen ? 'var(--mantine-spacing-md)' : 0,
                opacity: inspectorOpen ? 1 : 0,
                transition: 'width 250ms ease, margin-left 250ms ease, opacity 150ms ease',
                pointerEvents: inspectorOpen ? 'auto' : 'none',
              }}
            >
              <Box
                role="separator"
                aria-orientation="vertical"
                aria-label={t('Resize inspector')}
                onPointerDown={handleInspectorResizeStart}
                onDoubleClick={() => setInspectorWidth(INSPECTOR_DEFAULT_WIDTH)}
                style={{
                  width: 8,
                  flexShrink: 0,
                  alignSelf: 'stretch',
                  cursor: 'col-resize',
                  borderRadius: 6,
                  backgroundColor: 'var(--mantine-color-default-border)',
                  opacity: 0.35,
                  transition: 'opacity 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.35';
                }}
              />

              <Paper
                withBorder
                p="sm"
                w={inspectorWidth}
                style={{
                  flexShrink: 0,
                  position: 'sticky',
                  top: 16,
                  height: 'calc(100vh - 32px)',
                  maxHeight: 'calc(100vh - 32px)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Stack gap="sm" pt={2} style={{ height: '100%', minHeight: 0 }}>
                  <Group justify="space-between" align="center">
                    <Text fw={600} size="sm">
                      {inspectorTitle}
                    </Text>
                    <Tooltip
                      label={selectedInspectorLabel}
                      disabled={!selectedEntry}
                      position="bottom"
                    >
                      <Text size="xs" c="dimmed" maw="58%" ta="right" truncate="end">
                        {selectedInspectorLabel}
                      </Text>
                    </Tooltip>
                  </Group>

                  <Group justify="space-between" align="center">
                    <SegmentedControl
                      size="xs"
                      value={inspectorMode}
                      onChange={(value) => setInspectorMode(value as 'context' | 'browse')}
                      data={[
                        { label: t('Context'), value: 'context' },
                        { label: t('Browse'), value: 'browse' },
                      ]}
                    />

                    {inspectorMode === 'context' && activeReference && (
                      <Tooltip label={t('Clear active source reference')}>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => setActiveReference(null)}
                        >
                          <X size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>

                  <Divider />

                  <Box style={{ flex: 1, minHeight: 0 }}>
                    {inspectorMode === 'browse' ? (
                      <Paper withBorder radius="md" style={{ overflow: 'hidden', height: '100%' }}>
                        <SourceBrowser listingMaxHeight={420} viewerMaxHeight={420} />
                      </Paper>
                    ) : (
                      <ScrollArea h="100%" type="auto" offsetScrollbars="y">
                        {selectedEntry && selectedStatus ? (
                          <Stack gap="sm">
                            {mode === 'review' && (
                              <>
                                <Stack gap={6}>
                                  <Text size="xs" fw={600} c="dimmed">
                                    {t('Source')}
                                  </Text>
                                  <SourceCell entry={selectedEntry} />
                                </Stack>

                                <Divider />
                              </>
                            )}

                            <Stack gap={6}>
                              <Text size="xs" fw={600} c="dimmed">
                                {t('Translation')}
                              </Text>
                              <TranslationCell
                                entry={selectedEntry}
                                onKeyDown={handleKeyDown}
                                translateButtonSize="md"
                                translateButtonDisplay="icon"
                              />
                            </Stack>

                            <Divider />

                            <EntryDetailsPanel
                              entry={selectedEntry}
                              status={selectedStatus}
                              isModified={selectedIsModified}
                              isMT={selectedIsMT}
                              isManualEdit={selectedIsManualEdit}
                              hasGlossaryTerms={selectedHasGlossaryTerms}
                              qaReport={selectedQaReport}
                              reviewEntry={
                                selectedReviewEntry ?? {
                                  status: 'draft',
                                  comments: [],
                                  history: [],
                                }
                              }
                              translationMemoryScope={translationMemoryScope}
                              onActivateReference={handleInspectorReference}
                              mode={mode}
                            />
                          </Stack>
                        ) : (
                          <Text size="sm" c="dimmed">
                            {mode === 'review'
                              ? t('Select a string to inspect review context and comments.')
                              : t('Select a row to inspect context and metadata.')}
                          </Text>
                        )}
                      </ScrollArea>
                    )}
                  </Box>
                </Stack>
              </Paper>
            </Box>
          </Box>

          {/* Pagination controls */}
          {filteredEntries.length > 0 && (
            <Group justify="space-between" align="center" mt="xs" wrap="wrap">
              <Group gap="sm">
                <Select
                  value={rowsPerPage}
                  onChange={(value) => value && setRowsPerPage(value)}
                  data={ROWS_PER_PAGE_OPTIONS.map((opt) => ({ ...opt, label: t(opt.label) }))}
                  size="xs"
                  w={120}
                  aria-label={t('Rows per page')}
                />
                {!isMobile && (
                  <Text size="sm" c="dimmed">
                    {t('Showing {{start}}–{{end}} of {{total}} entries', {
                      start: startItem,
                      end: endItem,
                      total: filteredEntries.length,
                    })}
                  </Text>
                )}
              </Group>

              {totalPages > 1 && (
                <Pagination
                  value={currentPage}
                  onChange={setCurrentPage}
                  total={totalPages}
                  size={isMobile ? 'xs' : 'sm'}
                  withEdges
                />
              )}
            </Group>
          )}
        </Stack>
      )}

      {/* Empty state for filtered results */}
      {filteredEntries.length === 0 && entries.length > 0 && (
        <Paper p="xl" withBorder radius="md" mt="md">
          <Stack align="center" gap="sm">
            <Text c="dimmed" ta="center">
              {t('No entries match the current filters.')}
            </Text>
            <Text size="sm" c="dimmed">
              {t('Try adjusting your search or clearing some filters.')}
            </Text>
          </Stack>
        </Paper>
      )}
    </TranslateSettingsContext.Provider>
  );
}
