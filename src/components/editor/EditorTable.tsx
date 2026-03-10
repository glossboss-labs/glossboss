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
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useEditorStore, useSourceStore, getEffectiveSlug } from '@/stores';
import type { POEntry } from '@/lib/po';
import { parseReferences, buildTracUrl, type ParsedReference } from '@/lib/wp-source';
import { getTranslationStatus, type TranslationStatus } from '@/types';
import { TranslateButton } from './TranslateButton';
import { GlossaryIndicator } from './GlossaryIndicator';
import { SourceCodeViewer } from './SourceCodeViewer';
import { SourceBrowser } from './SourceBrowser';
import type { TargetLanguage, SourceLanguage } from '@/lib/deepl/types';
import type { Glossary, GlossaryAnalysisResult } from '@/lib/glossary/types';
import { useDragGhost } from '@/hooks/use-drag-ghost';

/** localStorage key for skip-translated navigation setting */
export const NAV_SKIP_TRANSLATED_KEY = 'glossboss-nav-skip-translated';
const INSPECTOR_WIDTH_KEY = 'glossboss-inspector-width';
const INSPECTOR_OPEN_KEY = 'glossboss-inspector-open';
const INSPECTOR_DEFAULT_WIDTH = 500;
const INSPECTOR_MIN_WIDTH = 380;
const INSPECTOR_MAX_WIDTH = 780;

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
  { value: '25', label: '25 rows' },
  { value: '50', label: '50 rows' },
  { value: '100', label: '100 rows' },
  { value: '250', label: '250 rows' },
  { value: '500', label: '500 rows' },
];

/** Column definitions with default proportional widths */
const COLUMN_KEYS = ['select', 'status', 'approve', 'source', 'translation', 'signals'] as const;
type TableColumnKey = (typeof COLUMN_KEYS)[number];
type DataColumnKey = Exclude<TableColumnKey, 'select'>;
const DATA_COLUMN_LABELS: Record<DataColumnKey, string> = {
  status: 'Status',
  approve: 'Approve',
  source: 'Source string',
  translation: 'Translated string',
  signals: 'Signals',
};
const DEFAULT_COLUMN_WIDTHS = [72, 210, 70, 320, 320, 220];
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
        opacity: isDragging ? 0.3 : 1,
        background: isDragging ? 'var(--mantine-color-gray-light)' : undefined,
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
            e.currentTarget.style.backgroundColor = 'var(--mantine-color-blue-light)';
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
}

const TranslateSettingsContext = createContext<TranslateSettings>({
  targetLang: null,
  sourceLang: null,
  glossary: null,
  deeplGlossaryId: null,
  glossaryEnforcementEnabled: false,
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
  translated: 'Translated',
  untranslated: 'Untranslated',
  fuzzy: 'Fuzzy',
};

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
  placeholder = 'Click to add translation',
  onChange,
  onKeyDown,
  entryId,
  fieldId,
  isPlural = false,
  pluralIndex,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>, fieldId: string) => void;
  entryId: string;
  fieldId: string;
  isPlural?: boolean;
  pluralIndex?: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEmpty = !value || value.trim() === '';

  const handleClick = useCallback(() => {
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
  }, [value]);

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
          {/* Highlighted backdrop */}
          <Box
            aria-hidden
            style={{
              ...sharedStyles,
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              overflow: 'hidden',
              borderRadius: 'var(--mantine-radius-default)',
              backgroundColor: 'var(--mantine-color-body)',
            }}
          >
            <HighlightedText>{editValue || ' '}</HighlightedText>
          </Box>
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
            styles={{
              input: {
                ...sharedStyles,
                fontFamily: 'inherit',
                color: 'transparent',
                caretColor: 'var(--mantine-color-text)',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                position: 'relative',
                zIndex: 1,
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
        cursor: 'text',
        padding: '6px 8px',
        margin: '-6px -8px',
        borderRadius: 4,
        minHeight: 32,
        transition: 'background-color 150ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--mantine-color-default-hover)';
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
  const hasPlural = Boolean(entry.msgidPlural);

  if (hasPlural) {
    return (
      <Stack gap={4}>
        <Group gap={4}>
          <Badge size="xs" variant="light" color="gray">
            singular
          </Badge>
          <HighlightedText>{entry.msgid}</HighlightedText>
        </Group>
        <Group gap={4}>
          <Badge size="xs" variant="light" color="gray">
            plural
          </Badge>
          <HighlightedText>{entry.msgidPlural!}</HighlightedText>
        </Group>
      </Stack>
    );
  }

  return <HighlightedText>{entry.msgid}</HighlightedText>;
}

function SignalsOverviewCell({
  isMT,
  usedGlossary,
  glossaryAnalysis,
}: {
  isMT: boolean;
  usedGlossary: boolean;
  glossaryAnalysis: GlossaryAnalysisResult | null;
}) {
  const hasGlossarySignals = (glossaryAnalysis?.terms.length ?? 0) > 0;

  if (!isMT && !hasGlossarySignals) {
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
          label={usedGlossary ? 'Machine translated with glossary' : 'Machine translated by DeepL'}
        >
          <Badge
            size="xs"
            variant="light"
            color={usedGlossary ? 'teal' : 'blue'}
            leftSection={<Bot size={10} />}
          >
            {usedGlossary ? 'MT + Glossary' : 'Machine translated'}
          </Badge>
        </Tooltip>
      )}
      <GlossaryIndicator analysis={hasGlossarySignals ? glossaryAnalysis : null} />
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
}: {
  entry: POEntry;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>, fieldId: string) => void;
  translateButtonSize?: 'xs' | 'sm' | 'md';
  translateButtonDisplay?: 'icon' | 'button';
}) {
  const updateEntry = useEditorStore((state) => state.updateEntry);
  const updateEntryPlural = useEditorStore((state) => state.updateEntryPlural);
  const markAsMachineTranslated = useEditorStore((state) => state.markAsMachineTranslated);
  const clearMachineTranslated = useEditorStore((state) => state.clearMachineTranslated);
  const getGlossaryAnalysis = useEditorStore((state) => state.getGlossaryAnalysis);

  // Use individual selectors for reactive state
  const isMT = useEditorStore((state) => state.machineTranslatedIds.has(entry.id));
  const usedGlossary = useEditorStore(
    (state) => state.machineTranslationMeta.get(entry.id)?.usedGlossary ?? false,
  );

  const translateSettings = useContext(TranslateSettingsContext);
  const hasPlural = Boolean(entry.msgidPlural);
  const pluralForms = useMemo(() => entry.msgstrPlural ?? [], [entry.msgstrPlural]);
  const glossaryAnalysis = getGlossaryAnalysis(entry.id);

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
    (translatedText: string, withGlossary?: boolean) => {
      updateEntry(entry.id, translatedText);
      markAsMachineTranslated(entry.id, withGlossary);
    },
    [entry.id, updateEntry, markAsMachineTranslated],
  );

  const handlePluralTranslated = useCallback(
    (index: number, translatedText: string, withGlossary?: boolean) => {
      const newPlurals = [...pluralForms];
      while (newPlurals.length <= index) {
        newPlurals.push('');
      }
      newPlurals[index] = translatedText;
      updateEntryPlural(entry.id, newPlurals);
      markAsMachineTranslated(entry.id, withGlossary);
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
                placeholder={`Plural form ${index}`}
              />
            </Box>
            {translateSettings.targetLang && sourceTexts[index]?.trim() && (
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
                onTranslated={(text, withGlossary) =>
                  handlePluralTranslated(index, text, withGlossary)
                }
                size={translateButtonSize}
                display={translateButtonDisplay}
              />
            )}
          </Group>
        ))}

        {/* MT badge under translation */}
        {isMT && (
          <Tooltip
            label={
              usedGlossary ? 'Machine translated with glossary' : 'Machine translated by DeepL'
            }
          >
            <Badge
              size="xs"
              variant="light"
              color={usedGlossary ? 'teal' : 'blue'}
              leftSection={<Bot size={10} />}
            >
              {usedGlossary ? 'MT + Glossary' : 'Machine translated'}
            </Badge>
          </Tooltip>
        )}

        <GlossaryIndicator analysis={glossaryAnalysis ?? null} />
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
          />
        </Box>
        {translateSettings.targetLang && entry.msgid.trim() && (
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
            onTranslated={handleTranslated}
            size={translateButtonSize}
            display={translateButtonDisplay}
          />
        )}
      </Group>

      {/* MT badge under translation */}
      {isMT && (
        <Tooltip
          label={usedGlossary ? 'Machine translated with glossary' : 'Machine translated by DeepL'}
        >
          <Badge
            size="xs"
            variant="light"
            color={usedGlossary ? 'teal' : 'blue'}
            leftSection={<Bot size={10} />}
          >
            {usedGlossary ? 'MT + Glossary' : 'Machine translated'}
          </Badge>
        </Tooltip>
      )}

      <GlossaryIndicator analysis={glossaryAnalysis ?? null} />
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
}: {
  entry: POEntry;
  isModified: boolean;
  isManualEdit: boolean;
  hasGlossaryTerms: boolean;
  isMT?: boolean;
}) {
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
        {STATUS_LABELS[status]}
      </Badge>

      {isModified && (
        <Tooltip label="Modified this session">
          <Badge
            size="xs"
            variant="light"
            color="orange"
            leftSection={<Edit3 size={10} />}
            style={{ flexShrink: 0 }}
          >
            Modified
          </Badge>
        </Tooltip>
      )}

      {isManualEdit && (
        <Tooltip label="Manually edited - protected from bulk translation">
          <Badge
            size="xs"
            variant="light"
            color="grape"
            leftSection={<Pencil size={10} />}
            style={{ flexShrink: 0 }}
          >
            Manual
          </Badge>
        </Tooltip>
      )}

      {hasGlossaryTerms && (
        <Tooltip label="Contains glossary terms">
          <Badge size="xs" variant="dot" color="violet" style={{ flexShrink: 0 }}>
            Glossary
          </Badge>
        </Tooltip>
      )}

      {isMT && (
        <Tooltip label="Machine translated">
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
    </Group>
  );
});

/**
 * Approve/unapprove toggle for fuzzy entries
 */
const ApproveCell = memo(function ApproveCell({ entry }: { entry: POEntry }) {
  const toggleFuzzy = useEditorStore((state) => state.toggleFuzzy);
  const status = getTranslationStatus(entry.msgstr, entry.flags, entry.msgstrPlural);
  const isFuzzy = status === 'fuzzy';
  const isUntranslated = status === 'untranslated';

  return (
    <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Tooltip
        label={isFuzzy ? 'Approve: clear fuzzy flag' : 'Unapprove: mark as fuzzy'}
        disabled={isUntranslated}
      >
        <ActionIcon
          variant={isFuzzy ? 'light' : 'subtle'}
          color={isFuzzy ? 'yellow' : 'green'}
          size="sm"
          disabled={isUntranslated}
          onClick={(e) => {
            e.stopPropagation();
            toggleFuzzy(entry.id);
          }}
          aria-label={isFuzzy ? 'Approve translation' : 'Mark as fuzzy'}
        >
          {isFuzzy ? <AlertTriangle size={14} /> : <Check size={14} />}
        </ActionIcon>
      </Tooltip>
    </Box>
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
              {parsedRefs.length} ref{parsedRefs.length !== 1 ? 's' : ''}
            </Text>
          </Group>
        </Tooltip>
      )}

      {hasReferences && !pluginSlug && (
        <Tooltip label={entry.references.join('\n')} multiline maw={300}>
          <Group gap={4} style={{ cursor: 'help' }}>
            <FileCode size={12} opacity={0.5} />
            <Text size="xs" c="dimmed">
              {entry.references.length} ref{entry.references.length !== 1 ? 's' : ''}
            </Text>
          </Group>
        </Tooltip>
      )}

      {hasComments && (
        <Tooltip label={entry.translatorComments.join('\n')} multiline maw={300}>
          <Group gap={4} style={{ cursor: 'help' }}>
            <MessageSquare size={12} opacity={0.5} />
            <Text size="xs" c="dimmed">
              {entry.translatorComments.length} comment
              {entry.translatorComments.length !== 1 ? 's' : ''}
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

function pluralSummary(entry: POEntry): string {
  if (!entry.msgidPlural) return 'Singular entry';
  const forms = entry.msgstrPlural ?? [];
  const completed = forms.filter((form) => form.trim()).length;
  const total = Math.max(forms.length, 2);
  return `Plural entry: ${completed}/${total} forms translated`;
}

function EntryDetailsPanel({
  entry,
  status,
  isModified,
  isMT,
  isManualEdit,
  hasGlossaryTerms,
  onActivateReference,
}: {
  entry: POEntry;
  status: TranslationStatus;
  isModified: boolean;
  isMT: boolean;
  isManualEdit: boolean;
  hasGlossaryTerms: boolean;
  onActivateReference: (ref: ParsedReference) => void;
}) {
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
          {STATUS_LABELS[status]}
        </Badge>
        {isModified && (
          <Badge color="orange" variant="light" size="sm">
            Modified
          </Badge>
        )}
        {isManualEdit && (
          <Badge color="grape" variant="light" size="sm">
            Manual edit
          </Badge>
        )}
        {isMT && (
          <Badge color="blue" variant="light" size="sm">
            Machine translated
          </Badge>
        )}
        {hasGlossaryTerms && (
          <Badge color="violet" variant="light" size="sm">
            Glossary match
          </Badge>
        )}
        {entry.lineNumber && (
          <Badge color="gray" variant="light" size="sm">
            Line {entry.lineNumber}
          </Badge>
        )}
        <ApproveCell entry={entry} />
      </Group>

      <Group align="flex-start" grow>
        <Stack gap={4}>
          <Text size="xs" fw={600} c="dimmed">
            Context
          </Text>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {entry.msgctxt || 'No context'}
          </Text>
        </Stack>

        <Stack gap={4}>
          <Text size="xs" fw={600} c="dimmed">
            Structure
          </Text>
          <Text size="sm">{pluralSummary(entry)}</Text>
        </Stack>
      </Group>

      <Divider />

      <Stack gap={6}>
        <Text size="xs" fw={600} c="dimmed">
          References
        </Text>

        {parsedRefs.length === 0 ? (
          <Text size="sm" c="dimmed">
            No source references
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
                    <Tooltip label="Open in Trac">
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

      <Divider />

      <Group align="flex-start" grow>
        <Stack gap={6}>
          <Text size="xs" fw={600} c="dimmed">
            Translator comments
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
              None
            </Text>
          )}
        </Stack>

        <Stack gap={6}>
          <Text size="xs" fw={600} c="dimmed">
            Extracted comments
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
              None
            </Text>
          )}
        </Stack>
      </Group>

      {flags.length > 0 && (
        <>
          <Divider />
          <Stack gap={6}>
            <Text size="xs" fw={600} c="dimmed">
              Flags
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
          Source preview
        </Text>

        {!pluginSlug && (
          <Text size="sm" c="dimmed">
            Set a plugin slug in Settings to enable source preview.
          </Text>
        )}

        {pluginSlug && parsedRefs.length > 0 && !entryActiveReference && (
          <Text size="sm" c="dimmed">
            Select a reference above to load source context.
          </Text>
        )}

        {pluginSlug && entryActiveReference && isLoadingSource && (
          <Group gap="xs">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Loading source...
            </Text>
          </Group>
        )}

        {pluginSlug && entryActiveReference && sourceError && !isLoadingSource && (
          <Text size="sm" c="red">
            {sourceError}
          </Text>
        )}

        {pluginSlug && entryActiveReference && sourceContent && !isLoadingSource && (
          <Paper withBorder style={{ overflow: 'hidden' }}>
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
  isChecked,
  visibleDataColumns,
  onToggleSelection,
  onSelect,
  onKeyDown,
}: {
  entry: POEntry;
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

  const isSelected = selectedEntryId === entry.id;
  const isModified = dirtyEntryIds.has(entry.id);
  const isMT = machineTranslatedIds.has(entry.id);
  const usedGlossary = machineTranslationMeta.get(entry.id)?.usedGlossary ?? false;
  const isManualEdit = manualEditIds.has(entry.id) && !isMT;
  const glossaryAnalysis = getGlossaryAnalysis(entry.id);
  const hasGlossaryTerms = (glossaryAnalysis?.matchedCount ?? 0) > 0;
  const status = getTranslationStatus(entry.msgstr, entry.flags, entry.msgstrPlural);
  const isUntranslated = status === 'untranslated';

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
          ? 'var(--mantine-color-blue-light)'
          : isUntranslated
            ? 'var(--mantine-color-red-light)'
            : undefined,
        borderLeft: isModified
          ? '4px solid var(--mantine-color-orange-5)'
          : '4px solid transparent',
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
              <ApproveCell entry={entry} />
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
              glossaryAnalysis={glossaryAnalysis ?? null}
            />
          </Table.Td>
        );
      })}
    </Table.Tr>
  );
});

const MobileEntryCard = memo(function MobileEntryCard({
  entry,
  isChecked,
  detailsExpanded,
  onToggleDetails,
  onToggleSelection,
  onKeyDown,
  onSelect,
}: {
  entry: POEntry;
  isChecked: boolean;
  detailsExpanded: boolean;
  onToggleDetails: () => void;
  onToggleSelection: (checked: boolean) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>, fieldId: string) => void;
  onSelect?: (sourceText: string) => void;
}) {
  const {
    selectedEntryId,
    selectEntry,
    dirtyEntryIds,
    machineTranslatedIds,
    manualEditIds,
    getGlossaryAnalysis,
  } = useEditorStore();
  const setActiveReference = useSourceStore((state) => state.setActiveReference);

  const isSelected = selectedEntryId === entry.id;
  const isModified = dirtyEntryIds.has(entry.id);
  const isMT = machineTranslatedIds.has(entry.id);
  const isManualEdit = manualEditIds.has(entry.id) && !isMT;
  const glossaryAnalysis = getGlossaryAnalysis(entry.id);
  const hasGlossaryTerms = (glossaryAnalysis?.matchedCount ?? 0) > 0;
  const status = getTranslationStatus(entry.msgstr, entry.flags, entry.msgstrPlural);
  const isUntranslated = status === 'untranslated';

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
          ? 'var(--mantine-color-blue-light)'
          : isUntranslated
            ? 'var(--mantine-color-red-light)'
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
          />
          <ApproveCell entry={entry} />
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
              Details
            </Text>
            {detailsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Group>
        </UnstyledButton>
      </Group>

      <Stack gap={8} mt="sm">
        <Box>
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            Source
          </Text>
          <SourceCell entry={entry} />
        </Box>

        <Box>
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            Translation
          </Text>
          <TranslationCell entry={entry} onKeyDown={onKeyDown} />
        </Box>

        <Box>
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            Signals
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
          onActivateReference={handleActivateReference}
        />
      </Collapse>
    </Paper>
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
}

export function EditorTable({
  targetLang = null,
  sourceLang = null,
  glossary = null,
  deeplGlossaryId = null,
  glossaryEnforcementEnabled = false,
  onEntrySelect,
}: EditorTableProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const entries = useEditorStore((state) => state.entries);
  const filename = useEditorStore((state) => state.filename);
  const selectedEntryId = useEditorStore((state) => state.selectedEntryId);
  const dirtyEntryIds = useEditorStore((state) => state.dirtyEntryIds);
  const machineTranslatedIds = useEditorStore((state) => state.machineTranslatedIds);
  const manualEditIds = useEditorStore((state) => state.manualEditIds);
  const getGlossaryAnalysis = useEditorStore((state) => state.getGlossaryAnalysis);
  const selectEntry = useEditorStore((state) => state.selectEntry);
  const selectedEntryIds = useEditorStore((state) => state.selectedEntryIds);
  const setEntrySelection = useEditorStore((state) => state.setEntrySelection);
  const setSelectedEntries = useEditorStore((state) => state.setSelectedEntries);
  const getFilteredEntries = useEditorStore((state) => state.getFilteredEntries);
  const visibleColumns = useEditorStore((state) => state.visibleColumns);
  const columnOrder = useEditorStore((state) => state.columnOrder);
  const moveColumnToIndex = useEditorStore((state) => state.moveColumnToIndex);
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
    const dataColumns = columnOrder.filter((column) => visibleColumns.has(column));
    return ['select', ...dataColumns] as TableColumnKey[];
  }, [columnOrder, visibleColumns]);
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
      headerDragGhost.show(e.currentTarget, e.clientX, e.clientY, DATA_COLUMN_LABELS[columnKey]);
    },
    [headerDragGhost],
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
    }),
    [targetLang, sourceLang, glossary, deeplGlossaryId, glossaryEnforcementEnabled],
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
  const selectedInspectorLabel = (() => {
    if (!selectedEntry) return 'No selection';

    const linePart = selectedEntry.lineNumber ? `Line ${selectedEntry.lineNumber}` : '';
    const sourcePreview =
      selectedEntry.msgid.trim() || selectedEntry.msgctxt?.trim() || 'Selected string';

    return linePart ? `${linePart} · ${sourcePreview}` : sourcePreview;
  })();

  return (
    <TranslateSettingsContext.Provider value={translateSettings}>
      {selectedEntryIds.size > 0 && (
        <Group gap={6} mb={6}>
          <Text size="xs" c="dimmed">
            {selectedEntryIds.size} selected
          </Text>
        </Group>
      )}

      {isMobile ? (
        <Stack gap="sm" data-testid="mobile-entry-card-list">
          {paginatedEntries.map((entry) => (
            <MobileEntryCard
              key={entry.id}
              entry={entry}
              isChecked={selectedEntryIds.has(entry.id)}
              detailsExpanded={expandedMobileEntryIds.has(entry.id)}
              onToggleDetails={() => toggleMobileDetails(entry.id)}
              onToggleSelection={(checked) => setEntrySelection(entry.id, checked)}
              onKeyDown={handleKeyDown}
              onSelect={onEntrySelect}
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
              {inspectorOpen ? 'Hide info' : 'More info'}
            </Button>
          </Group>
          <Group align="flex-start" wrap="nowrap" gap="md">
            <Box style={{ flex: 1, minWidth: 0 }}>
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
                    background: 'var(--mantine-color-body)',
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
                            aria-label="Select all filtered entries"
                            data-testid="select-all-checkbox"
                          />
                        ) : (
                          DATA_COLUMN_LABELS[columnKey]
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
                          padding={columnKey === 'select' ? '8px 8px' : undefined}
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
                      isChecked={selectedEntryIds.has(entry.id)}
                      visibleDataColumns={visibleDataColumns}
                      onToggleSelection={(checked) => setEntrySelection(entry.id, checked)}
                      onSelect={onEntrySelect}
                      onKeyDown={handleKeyDown}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </Box>

            {inspectorOpen && (
              <>
                <Box
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize inspector"
                  onPointerDown={handleInspectorResizeStart}
                  onDoubleClick={() => setInspectorWidth(INSPECTOR_DEFAULT_WIDTH)}
                  style={{
                    width: 8,
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
                        String Inspector
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
                          { label: 'Context', value: 'context' },
                          { label: 'Browse', value: 'browse' },
                        ]}
                      />

                      {inspectorMode === 'context' && activeReference && (
                        <Tooltip label="Clear active source reference">
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
                        <Paper withBorder style={{ overflow: 'hidden', height: '100%' }}>
                          <SourceBrowser listingMaxHeight={420} viewerMaxHeight={420} />
                        </Paper>
                      ) : (
                        <ScrollArea h="100%" type="auto" offsetScrollbars="y">
                          {selectedEntry && selectedStatus ? (
                            <Stack gap="sm">
                              <Stack gap={6}>
                                <Text size="xs" fw={600} c="dimmed">
                                  Translation
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
                                onActivateReference={handleInspectorReference}
                              />
                            </Stack>
                          ) : (
                            <Text size="sm" c="dimmed">
                              Select a row to inspect context and metadata.
                            </Text>
                          )}
                        </ScrollArea>
                      )}
                    </Box>
                  </Stack>
                </Paper>
              </>
            )}
          </Group>
        </Stack>
      )}

      {/* Pagination controls */}
      {filteredEntries.length > 0 && (
        <Paper p="sm" mt="md" withBorder>
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <Select
                value={rowsPerPage}
                onChange={(value) => value && setRowsPerPage(value)}
                data={ROWS_PER_PAGE_OPTIONS}
                size="xs"
                w={120}
                aria-label="Rows per page"
              />
              <Text size="sm" c="dimmed">
                Showing {startItem}–{endItem} of {filteredEntries.length} entries
              </Text>
            </Group>

            {totalPages > 1 && (
              <Pagination
                value={currentPage}
                onChange={setCurrentPage}
                total={totalPages}
                size="sm"
                withEdges
              />
            )}
          </Group>
        </Paper>
      )}

      {/* Empty state for filtered results */}
      {filteredEntries.length === 0 && entries.length > 0 && (
        <Paper p="xl" withBorder mt="md">
          <Stack align="center" gap="sm">
            <Text c="dimmed" ta="center">
              No entries match the current filters.
            </Text>
            <Text size="sm" c="dimmed">
              Try adjusting your search or clearing some filters.
            </Text>
          </Stack>
        </Paper>
      )}
    </TranslateSettingsContext.Provider>
  );
}
