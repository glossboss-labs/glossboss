/**
 * Editor Table Component
 * 
 * Translation table with inline editing, animations, and status badges.
 * Uses standard rendering (virtualization removed for stability).
 */

import { useState, useCallback, useRef, type KeyboardEvent, createContext, useContext, useMemo, memo, useEffect } from 'react';
import { Table, Badge, Text, Stack, Group, Box, Paper, Tooltip, Textarea, ScrollArea, Pagination, Select } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { MessageSquare, FileCode, Pencil, Bot, Edit3 } from 'lucide-react';
import { useEditorStore } from '@/stores';
import type { POEntry } from '@/lib/po';
import { getTranslationStatus, type TranslationStatus } from '@/types';
import { TranslateButton } from './TranslateButton';
import { GlossaryIndicator } from './GlossaryIndicator';
import type { TargetLanguage, SourceLanguage } from '@/lib/deepl/types';
import type { Glossary } from '@/lib/glossary/types';

/** Rows per page options */
const ROWS_PER_PAGE_OPTIONS = [
  { value: '25', label: '25 rows' },
  { value: '50', label: '50 rows' },
  { value: '100', label: '100 rows' },
  { value: '250', label: '250 rows' },
  { value: '500', label: '500 rows' },
];

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
  glossaryEnforcementEnabled: false
});

/**
 * Regex to match code-like tokens in translation strings:
 * - Printf: %s, %d, %1$s, %-10.2f, etc.
 * - PHP/named: %(name)s
 * - Positional braces: {0}, {name}, {{variable}}
 * - HTML tags: <br/>, <a href="...">, </strong>, etc.
 * - Escape sequences: \n, \t, \r, \\
 */
const CODE_TOKEN_RE = /(%(?:\d+\$)?[-+0 #]*(?:\*|\d+)?(?:\.(?:\*|\d+))?(?:hh?|ll?|[ljztL])?[diouxXeEfFgGaAcspn%]|%\([^)]+\)[diouxXeEfFgGaAcspn]|\{\{?\w+\}?\}?|\{\d+\}|<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^>]*)?\s*\/?>|\\[nrt\\])/g;

/**
 * Renders text with code-like tokens highlighted
 */
function HighlightedText({ children, dimmed }: { children: string; dimmed?: boolean }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  CODE_TOKEN_RE.lastIndex = 0;
  while ((match = CODE_TOKEN_RE.exec(children)) !== null) {
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
      </Text>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < children.length) {
    parts.push(children.slice(lastIndex));
  }

  // No tokens found, return plain text
  if (parts.length === 1 && typeof parts[0] === 'string') {
    return (
      <Text component="span" size="sm" style={{ whiteSpace: 'pre-wrap' }} c={dimmed ? 'dimmed' : undefined}>
        {children}
      </Text>
    );
  }

  return (
    <Text component="span" size="sm" style={{ whiteSpace: 'pre-wrap' }} c={dimmed ? 'dimmed' : undefined}>
      {parts}
    </Text>
  );
}

/** Status badge colors */
const STATUS_COLORS: Record<TranslationStatus, string> = {
  translated: 'green',
  untranslated: 'red',
  fuzzy: 'yellow'
};

/** Status badge labels */
const STATUS_LABELS: Record<TranslationStatus, string> = {
  translated: 'Translated',
  untranslated: 'Untranslated',
  fuzzy: 'Fuzzy'
};

/** Flag badge colors */
const FLAG_COLORS: Record<string, string> = {
  fuzzy: 'yellow',
  'c-format': 'violet',
  'no-c-format': 'gray',
  'php-format': 'violet',
  'no-php-format': 'gray',
  'python-format': 'violet',
  'no-python-format': 'gray'
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
  pluralIndex
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
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (editValue !== value) {
      onChange(editValue);
    }
  }, [editValue, value, onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
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
  }, [editValue, value, onChange, onKeyDown, fieldId]);

  if (isEditing) {
    return (
      <Box
        style={{
          margin: '-6px -8px',
          padding: 2,
          borderRadius: 6,
          backgroundColor: 'var(--mantine-color-blue-light)',
          boxShadow: '0 0 0 2px var(--mantine-color-blue-filled)',
        }}
      >
        {isPlural && pluralIndex !== undefined && (
          <Text component="span" size="xs" c="dimmed" mb={4} ml={6} style={{ display: 'block' }}>
            [{pluralIndex}]
          </Text>
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
          styles={{
            input: {
              fontFamily: 'inherit',
              fontSize: 'var(--mantine-font-size-sm)',
              border: 'none',
              backgroundColor: 'var(--mantine-color-body)',
            }
          }}
          data-field-id={fieldId}
          data-entry-id={entryId}
        />
      </Box>
    );
  }

  return (
    <Box
      className="editable-text-wrapper"
      onClick={handleClick}
      style={{
        cursor: 'text',
        padding: '6px 8px',
        margin: '-6px -8px',
        borderRadius: 4,
        minHeight: 32,
        transition: 'background-color 150ms ease'
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
          <Badge size="xs" variant="light" color="gray">singular</Badge>
          <HighlightedText>{entry.msgid}</HighlightedText>
        </Group>
        <Group gap={4}>
          <Badge size="xs" variant="light" color="gray">plural</Badge>
          <HighlightedText>{entry.msgidPlural!}</HighlightedText>
        </Group>
      </Stack>
    );
  }

  return <HighlightedText>{entry.msgid}</HighlightedText>;
}

/**
 * Translation cell with inline editing support
 */
function TranslationCell({
  entry,
  onKeyDown
}: {
  entry: POEntry;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>, fieldId: string) => void;
}) {
  const updateEntry = useEditorStore(state => state.updateEntry);
  const updateEntryPlural = useEditorStore(state => state.updateEntryPlural);
  const markAsMachineTranslated = useEditorStore(state => state.markAsMachineTranslated);
  const clearMachineTranslated = useEditorStore(state => state.clearMachineTranslated);
  const getGlossaryAnalysis = useEditorStore(state => state.getGlossaryAnalysis);
  
  // Use individual selectors for reactive state
  const isMT = useEditorStore(state => state.machineTranslatedIds.has(entry.id));
  const usedGlossary = useEditorStore(
    state => state.machineTranslationMeta.get(entry.id)?.usedGlossary ?? false
  );
  
  const translateSettings = useContext(TranslateSettingsContext);
  const hasPlural = Boolean(entry.msgidPlural);
  const pluralForms = entry.msgstrPlural ?? [];
  const glossaryAnalysis = getGlossaryAnalysis(entry.id);

  const handleSingularChange = useCallback((value: string) => {
    updateEntry(entry.id, value);
    if (isMT) {
      clearMachineTranslated(entry.id);
    }
  }, [entry.id, updateEntry, isMT, clearMachineTranslated]);

  const handlePluralChange = useCallback((index: number, value: string) => {
    const newPlurals = [...pluralForms];
    while (newPlurals.length <= index) {
      newPlurals.push('');
    }
    newPlurals[index] = value;
    updateEntryPlural(entry.id, newPlurals);
    if (isMT) {
      clearMachineTranslated(entry.id);
    }
  }, [entry.id, pluralForms, updateEntryPlural, isMT, clearMachineTranslated]);

  const handleTranslated = useCallback((translatedText: string, withGlossary?: boolean) => {
    updateEntry(entry.id, translatedText);
    markAsMachineTranslated(entry.id, withGlossary);
  }, [entry.id, updateEntry, markAsMachineTranslated]);

  const handlePluralTranslated = useCallback((index: number, translatedText: string, withGlossary?: boolean) => {
    const newPlurals = [...pluralForms];
    while (newPlurals.length <= index) {
      newPlurals.push('');
    }
    newPlurals[index] = translatedText;
    updateEntryPlural(entry.id, newPlurals);
    markAsMachineTranslated(entry.id, withGlossary);
  }, [entry.id, pluralForms, updateEntryPlural, markAsMachineTranslated]);

  if (hasPlural) {
    const displayForms = pluralForms.length >= 2 ? pluralForms : ['', ''];
    const sourceTexts = displayForms.map((_, index) =>
      index === 0 ? entry.msgid : entry.msgidPlural!
    );

    return (
      <Stack gap={8}>
        {displayForms.map((form, index) => (
          <Group key={index} gap="xs" align="flex-start" wrap="nowrap">
            <Box style={{ flex: 1 }}>
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
                glossaryId={translateSettings.glossaryEnforcementEnabled ? (translateSettings.deeplGlossaryId ?? undefined) : undefined}
                onTranslated={(text, withGlossary) => handlePluralTranslated(index, text, withGlossary)}
                size="sm"
              />
            )}
          </Group>
        ))}
        
        {/* MT badge under translation */}
        {isMT && (
          <Tooltip label={usedGlossary ? "Machine translated with glossary" : "Machine translated by DeepL"}>
            <Badge 
              size="xs" 
              variant="light" 
              color={usedGlossary ? "teal" : "blue"} 
              leftSection={<Bot size={10} />}
            >
              {usedGlossary ? "MT + Glossary" : "Machine translated"}
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
        <Box style={{ flex: 1 }}>
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
            glossaryId={translateSettings.glossaryEnforcementEnabled ? (translateSettings.deeplGlossaryId ?? undefined) : undefined}
            onTranslated={handleTranslated}
            size="sm"
          />
        )}
      </Group>
      
      {/* MT badge under translation */}
      {isMT && (
        <Tooltip label={usedGlossary ? "Machine translated with glossary" : "Machine translated by DeepL"}>
          <Badge 
            size="xs" 
            variant="light" 
            color={usedGlossary ? "teal" : "blue"} 
            leftSection={<Bot size={10} />}
          >
            {usedGlossary ? "MT + Glossary" : "Machine translated"}
          </Badge>
        </Tooltip>
      )}
      
      <GlossaryIndicator analysis={glossaryAnalysis ?? null} />
    </Stack>
  );
}

/**
 * Context display (read-only)
 */
function ContextCell({ entry }: { entry: POEntry }) {
  if (!entry.msgctxt) {
    return <Text size="sm" c="dimmed">—</Text>;
  }

  return (
    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
      {entry.msgctxt}
    </Text>
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
}: { 
  entry: POEntry; 
  isModified: boolean;
  isManualEdit: boolean;
  hasGlossaryTerms: boolean;
}) {
  const status = getTranslationStatus(entry.msgstr, entry.flags, entry.msgstrPlural);

  return (
    <Stack gap={4}>
      <Badge color={STATUS_COLORS[status]} size="sm" variant="filled">
        {STATUS_LABELS[status]}
      </Badge>
      
      {/* Secondary indicators */}
      {(isModified || isManualEdit || hasGlossaryTerms) && (
        <Group gap={4} wrap="wrap">
          {isModified && (
            <Tooltip label="Modified this session">
              <Badge size="xs" variant="light" color="orange" leftSection={<Edit3 size={10} />}>
                Modified
              </Badge>
            </Tooltip>
          )}
          
          {isManualEdit && (
            <Tooltip label="Manually edited - protected from bulk translation">
              <Badge size="xs" variant="light" color="grape" leftSection={<Pencil size={10} />}>
                Manual
              </Badge>
            </Tooltip>
          )}
          
          {hasGlossaryTerms && (
            <Tooltip label="Contains glossary terms">
              <Badge size="xs" variant="dot" color="violet">
                Glossary
              </Badge>
            </Tooltip>
          )}
        </Group>
      )}
    </Stack>
  );
});

/**
 * Meta column with flags, references, and comments
 */
function MetaCell({ entry }: { entry: POEntry }) {
  const hasReferences = entry.references.length > 0;
  const hasComments = entry.translatorComments.length > 0;
  const flags = entry.flags.filter((f) => f !== 'fuzzy');

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
      
      {hasReferences && (
        <Tooltip label={entry.references.join('\n')} multiline maw={300}>
          <Group gap={4} style={{ cursor: 'help' }}>
            <FileCode size={12} opacity={0.5} />
            <Text size="xs" c="dimmed">{entry.references.length} ref{entry.references.length !== 1 ? 's' : ''}</Text>
          </Group>
        </Tooltip>
      )}
      
      {hasComments && (
        <Tooltip label={entry.translatorComments.join('\n')} multiline maw={300}>
          <Group gap={4} style={{ cursor: 'help' }}>
            <MessageSquare size={12} opacity={0.5} />
            <Text size="xs" c="dimmed">{entry.translatorComments.length} comment{entry.translatorComments.length !== 1 ? 's' : ''}</Text>
          </Group>
        </Tooltip>
      )}
      
      {!flags.length && !hasReferences && !hasComments && (
        <Text size="xs" c="dimmed">—</Text>
      )}
    </Stack>
  );
}

/**
 * Single entry row component - memoized for performance
 */
const EntryRow = memo(function EntryRow({
  entry,
  onKeyDown,
  onSelect,
}: {
  entry: POEntry;
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
  
  const isSelected = selectedEntryId === entry.id;
  const isModified = dirtyEntryIds.has(entry.id);
  const isMT = machineTranslatedIds.has(entry.id);
  const isManualEdit = manualEditIds.has(entry.id) && !isMT;
  const glossaryAnalysis = getGlossaryAnalysis(entry.id);
  const hasGlossaryTerms = (glossaryAnalysis?.matchedCount ?? 0) > 0;
  const status = getTranslationStatus(entry.msgstr, entry.flags, entry.msgstrPlural);
  const isUntranslated = status === 'untranslated';

  const handleClick = useCallback(() => {
    selectEntry(entry.id);
    onSelect?.(entry.msgid);
  }, [entry.id, entry.msgid, selectEntry, onSelect]);

  return (
    <Table.Tr
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        backgroundColor: isSelected
          ? 'var(--mantine-color-blue-light)'
          : isUntranslated
            ? 'var(--mantine-color-red-light)'
            : undefined,
        borderLeft: isModified ? '4px solid var(--mantine-color-orange-5)' : '4px solid transparent',
      }}
    >
      <Table.Td style={{ width: 130, verticalAlign: 'top', padding: '12px 8px' }}>
        <StatusBadges 
          entry={entry} 
          isModified={isModified}
          isManualEdit={isManualEdit}
          hasGlossaryTerms={hasGlossaryTerms}
        />
      </Table.Td>
      <Table.Td style={{ width: '35%', verticalAlign: 'top', padding: '12px 8px' }}>
        <SourceCell entry={entry} />
      </Table.Td>
      <Table.Td style={{ width: '35%', verticalAlign: 'top', padding: '12px 8px' }}>
        <TranslationCell entry={entry} onKeyDown={onKeyDown} />
      </Table.Td>
      <Table.Td style={{ width: 100, verticalAlign: 'top', padding: '12px 8px' }}>
        <ContextCell entry={entry} />
      </Table.Td>
      <Table.Td style={{ width: 120, verticalAlign: 'top', padding: '12px 8px' }}>
        <MetaCell entry={entry} />
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
}

export function EditorTable({ 
  targetLang = null, 
  sourceLang = null, 
  glossary = null, 
  deeplGlossaryId = null,
  glossaryEnforcementEnabled = false,
  onEntrySelect
}: EditorTableProps) {
  const entries = useEditorStore(state => state.entries);
  const filename = useEditorStore(state => state.filename);
  const getFilteredEntries = useEditorStore(state => state.getFilteredEntries);
  // Subscribe to activeFilters changes - serialize to detect any change
  const activeFiltersKey = useEditorStore(state => 
    JSON.stringify(Array.from(state.activeFilters.entries()))
  );
  const filterQuery = useEditorStore(state => state.filterQuery);
  
  // Re-compute filtered entries when filters, query, or entries change
  const filteredEntries = useMemo(() => {
    return getFilteredEntries();
  }, [getFilteredEntries, activeFiltersKey, filterQuery, entries]);
  
  // Pagination state with localStorage persistence
  const [rowsPerPage, setRowsPerPage] = useLocalStorage<string>({
    key: 'po-editor-rows-per-page',
    defaultValue: '50',
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

  const translateSettings: TranslateSettings = useMemo(() => ({
    targetLang,
    sourceLang,
    glossary,
    deeplGlossaryId,
    glossaryEnforcementEnabled
  }), [targetLang, sourceLang, glossary, deeplGlossaryId, glossaryEnforcementEnabled]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>, fieldId: string) => {
    if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      const allFields = document.querySelectorAll('[data-field-id]');
      const fieldArray = Array.from(allFields);
      const currentIndex = fieldArray.findIndex((el) => el.getAttribute('data-field-id') === fieldId);
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
  }, []);

  if (!filename) {
    return null;
  }

  // Calculate display range for "Showing X-Y of Z"
  const startItem = filteredEntries.length === 0 ? 0 : (currentPage - 1) * rowsPerPageNum + 1;
  const endItem = Math.min(currentPage * rowsPerPageNum, filteredEntries.length);

  return (
    <TranslateSettingsContext.Provider value={translateSettings}>
      <ScrollArea h={600} type="auto">
        <Table striped highlightOnHover verticalSpacing="md">
          <Table.Thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--mantine-color-body)' }}>
            <Table.Tr>
              <Table.Th style={{ width: 130 }}>Status</Table.Th>
              <Table.Th style={{ width: '35%' }}>Source</Table.Th>
              <Table.Th style={{ width: '35%' }}>Translation</Table.Th>
              <Table.Th style={{ width: 100 }}>Context</Table.Th>
              <Table.Th style={{ width: 120 }}>Meta</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {paginatedEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onKeyDown={handleKeyDown}
                onSelect={onEntrySelect}
              />
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      
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
