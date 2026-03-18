/**
 * Row components for the editor table.
 * Contains EntryRow (desktop), MobileEntryCard, and supporting sub-components
 * (SourceCell, TranslationCell, StatusBadges, SignalsOverviewCell, MetaCell).
 */

import { useCallback, useRef, use, useMemo, memo, type KeyboardEvent } from 'react';
import {
  Table,
  Badge,
  Text,
  Stack,
  Group,
  Box,
  Paper,
  Tooltip,
  Checkbox,
  Collapse,
  UnstyledButton,
  Divider,
} from '@mantine/core';
import {
  MessageSquare,
  FileCode,
  Pencil,
  Bot,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { useEditorStore, useSourceStore, getEffectiveSlug } from '@/stores';
import type { POEntry } from '@/lib/po';
import { parseReferences, type ParsedReference } from '@/lib/wp-source';
import { getTranslationStatus } from '@/types';
import { isReviewLocked, type ReviewStatus } from '@/lib/review';
import { TranslateButton } from './TranslateButton';
import { GlossaryIndicator } from './GlossaryIndicator';
import { CellLockIndicator } from './CellLockIndicator';
import type { GlossaryAnalysisResult } from '@/lib/glossary/types';
import { useCollaborationStore } from '@/stores/collaboration-store';
import { toSpeakLanguageTag } from '@/lib/tts';
import { SpeakButton } from '@/components/ui';
import { useTranslation } from '@/lib/app-language';
import type { TranslationMemoryScope } from '@/lib/translation-memory';
import type { QAEntryReport } from '@/lib/qa';
import { getTranslationProviderLabel } from '@/lib/translation';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  REVIEW_STATUS_COLORS,
  REVIEW_STATUS_LABELS,
  FLAG_COLORS,
  TranslateSettingsContext,
  RealtimeBroadcastContext,
  ReadOnlyContext,
  type DataColumnKey,
  type WorkspaceMode,
} from './editor-table-utils';
import { EditableField, HighlightedText, SourceKeyBadge } from './EditorCellEditor';
import { EntryDetailsPanel, ReviewStatusBadge } from './EditorInspector';

/**
 * Source text display with plural support (read-only).
 */
export function SourceCell({ entry }: { entry: POEntry }) {
  const { t } = useTranslation();
  const translateSettings = use(TranslateSettingsContext);
  const sourceLang = toSpeakLanguageTag(translateSettings.sourceLang);
  const hasPlural = Boolean(entry.msgidPlural);
  const hasSourceText = Boolean(entry.sourceText);

  const displayText = entry.sourceText ?? entry.msgid;
  const displayPlural = entry.sourceTextPlural ?? entry.msgidPlural;

  if (hasPlural) {
    return (
      <Stack gap={4}>
        {hasSourceText && <SourceKeyBadge keyText={entry.msgid} />}
        <Group gap={4} wrap="nowrap" align="flex-start">
          <Badge size="xs" variant="light" color="gray">
            {t('singular')}
          </Badge>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <HighlightedText>{displayText}</HighlightedText>
          </Box>
          {translateSettings.speechEnabled && (
            <SpeakButton
              kind="source"
              entryId={`${entry.id}-source-0`}
              text={displayText}
              lang={sourceLang}
            />
          )}
        </Group>
        {displayPlural && (
          <Group gap={4} wrap="nowrap" align="flex-start">
            <Badge size="xs" variant="light" color="gray">
              {t('plural')}
            </Badge>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <HighlightedText>{displayPlural}</HighlightedText>
            </Box>
            {translateSettings.speechEnabled && (
              <SpeakButton
                kind="source"
                entryId={`${entry.id}-source-1`}
                text={displayPlural}
                lang={sourceLang}
              />
            )}
          </Group>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap={2}>
      {hasSourceText && <SourceKeyBadge keyText={entry.msgid} />}
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <HighlightedText>{displayText}</HighlightedText>
        </Box>
        {translateSettings.speechEnabled && (
          <SpeakButton
            kind="source"
            entryId={`${entry.id}-source`}
            text={displayText}
            lang={sourceLang}
          />
        )}
      </Group>
    </Stack>
  );
}

export function SignalsOverviewCell({
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
  const qaErrors = qaReport?.errorCount ?? 0;
  const qaWarnings = qaReport?.warningCount ?? 0;
  const hasQaSignals = qaErrors > 0 || qaWarnings > 0;
  const providerLabel = getTranslationProviderLabel(provider);

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
    <Group gap={6} wrap="nowrap">
      {isMT && (
        <Tooltip
          label={
            usedGlossary
              ? t('Machine translated with glossary by {{provider}}', { provider: providerLabel })
              : t('Machine translated by {{provider}}', { provider: providerLabel })
          }
        >
          <Box style={{ color: `var(--mantine-color-blue-6)`, lineHeight: 0 }}>
            <Bot size={16} />
          </Box>
        </Tooltip>
      )}
      {hasGlossarySignals && <GlossaryIndicator analysis={glossaryAnalysis} />}
      {hasQaSignals && (
        <Tooltip
          label={
            qaErrors > 0 && qaWarnings > 0
              ? `${t('{{count}} QA error(s)', { count: qaErrors })}, ${t('{{count}} QA warning(s)', { count: qaWarnings })}`
              : qaErrors > 0
                ? t('{{count}} QA error(s)', { count: qaErrors })
                : t('{{count}} QA warning(s)', { count: qaWarnings })
          }
        >
          <Box
            style={{
              color: qaErrors > 0 ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-orange-6)',
              lineHeight: 0,
            }}
          >
            {qaErrors > 0 ? <ShieldAlert size={16} /> : <AlertTriangle size={16} />}
          </Box>
        </Tooltip>
      )}
      {showReviewSignals && unresolvedCommentCount > 0 && (
        <Tooltip label={t('{{count}} unresolved comment(s)', { count: unresolvedCommentCount })}>
          <Box style={{ color: 'var(--mantine-color-red-6)', lineHeight: 0, position: 'relative' }}>
            <MessageSquare size={16} />
            <Text
              size="xs"
              fw={700}
              style={{
                position: 'absolute',
                top: -4,
                right: -6,
                fontSize: 9,
                lineHeight: 1,
                color: 'var(--mantine-color-red-6)',
              }}
              className="gb-tabular-nums"
            >
              {unresolvedCommentCount}
            </Text>
          </Box>
        </Tooltip>
      )}
    </Group>
  );
}

/**
 * Status badges component
 */
export const StatusBadges = memo(function StatusBadges({
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
      style={{ maxWidth: '100%', overflowX: 'visible', overflowY: 'visible' }}
    >
      {/* Primary: translation status badge with text */}
      <Badge color={STATUS_COLORS[status]} size="sm" variant="filled" style={{ flexShrink: 0 }}>
        {t(STATUS_LABELS[status])}
      </Badge>

      {/* Review status */}
      {showReviewStatus && reviewStatus !== 'draft' && (
        <Badge
          color={REVIEW_STATUS_COLORS[reviewStatus]}
          size="xs"
          variant="light"
          style={{ flexShrink: 0 }}
        >
          {t(REVIEW_STATUS_LABELS[reviewStatus])}
        </Badge>
      )}

      {/* Secondary indicators: icon-only with tooltips */}
      {isReviewEntryLocked && (
        <Tooltip label={t('Locked')}>
          <Box style={{ color: 'var(--mantine-color-gray-6)', lineHeight: 0 }}>
            <ShieldAlert size={14} />
          </Box>
        </Tooltip>
      )}
      {isModified && (
        <Tooltip label={t('Modified this session')}>
          <Box style={{ color: 'var(--mantine-color-orange-6)', lineHeight: 0 }}>
            <Pencil size={14} />
          </Box>
        </Tooltip>
      )}

      {isManualEdit && (
        <Tooltip label={t('Manually edited - protected from bulk translation')}>
          <Box style={{ color: 'var(--mantine-color-gray-6)', lineHeight: 0 }}>
            <Pencil size={14} />
          </Box>
        </Tooltip>
      )}
      {hasGlossaryTerms && (
        <Tooltip label={t('Contains glossary terms')}>
          <Box style={{ color: 'var(--mantine-color-blue-6)', lineHeight: 0 }}>
            <FileCode size={14} />
          </Box>
        </Tooltip>
      )}
      {isMT && (
        <Tooltip label={t('Machine translated')}>
          <Box style={{ color: 'var(--mantine-color-blue-6)', lineHeight: 0 }}>
            <Bot size={14} />
          </Box>
        </Tooltip>
      )}
      {showReviewComments && unresolvedCommentCount > 0 && (
        <Tooltip
          label={t('{{count}} unresolved review comment(s)', { count: unresolvedCommentCount })}
        >
          <Box style={{ color: 'var(--mantine-color-red-6)', lineHeight: 0 }}>
            <MessageSquare size={14} />
          </Box>
        </Tooltip>
      )}
    </Group>
  );
});

/**
 * Translation cell with inline editing support
 */
export function TranslationCell({
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

  const isMT = useEditorStore((state) => state.machineTranslatedIds.has(entry.id));
  const usedGlossary = useEditorStore(
    (state) => state.machineTranslationMeta.get(entry.id)?.usedGlossary ?? false,
  );
  const mtProvider = useEditorStore(
    (state) => state.machineTranslationMeta.get(entry.id)?.provider ?? 'deepl',
  );
  const mtProviderLabel = getTranslationProviderLabel(mtProvider);
  const signalsColumnHidden = useEditorStore((state) => !state.visibleColumns.has('signals'));

  const remoteLock = useCollaborationStore((s) => s.cellLocks.get(entry.id));
  const localUserId = useCollaborationStore((s) => {
    const lock = s.cellLocks.get(entry.id);
    return lock ? lock.userId : null;
  });

  const translateSettings = use(TranslateSettingsContext);
  const { broadcastEntryUpdate, broadcastLock, broadcastUnlock } = use(RealtimeBroadcastContext);

  const handleEditStart = useCallback(() => {
    broadcastLock?.(entry.id);
  }, [broadcastLock, entry.id]);

  const handleEditEnd = useCallback(() => {
    broadcastUnlock?.(entry.id);
  }, [broadcastUnlock, entry.id]);
  const hasPlural = Boolean(entry.msgidPlural);
  const pluralForms = useMemo(() => entry.msgstrPlural ?? [], [entry.msgstrPlural]);
  const glossaryAnalysis = signalsColumnHidden ? getGlossaryAnalysis(entry.id) : null;
  const translationLang = toSpeakLanguageTag(translateSettings.targetLang);
  const editorReadOnly = use(ReadOnlyContext);
  const isReviewEntryLocked = isReviewLocked(reviewStatus, lockApprovedEntries);
  const isRemoteLocked = Boolean(remoteLock && localUserId !== undefined);
  const isLocked = editorReadOnly || isReviewEntryLocked || isRemoteLocked;

  const handleSingularChange = useCallback(
    (value: string) => {
      updateEntry(entry.id, value);
      if (isMT) {
        clearMachineTranslated(entry.id);
      }
      broadcastEntryUpdate?.({ entryId: entry.id, msgstr: value });
    },
    [entry.id, updateEntry, isMT, clearMachineTranslated, broadcastEntryUpdate],
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
      broadcastEntryUpdate?.({ entryId: entry.id, msgstrPlural: newPlurals });
    },
    [entry.id, pluralForms, updateEntryPlural, isMT, clearMachineTranslated, broadcastEntryUpdate],
  );

  const handleTranslated = useCallback(
    (
      translatedText: string,
      meta?: {
        usedGlossary?: boolean;
        provider?: string;
        glossaryMode?: 'native' | 'prompt' | 'none';
        contextUsed?: boolean;
      },
    ) => {
      updateEntry(entry.id, translatedText);
      markAsMachineTranslated(entry.id, meta);
      broadcastEntryUpdate?.({ entryId: entry.id, msgstr: translatedText });
    },
    [entry.id, updateEntry, markAsMachineTranslated, broadcastEntryUpdate],
  );

  const handlePluralTranslated = useCallback(
    (
      index: number,
      translatedText: string,
      meta?: {
        usedGlossary?: boolean;
        provider?: string;
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
      broadcastEntryUpdate?.({ entryId: entry.id, msgstrPlural: newPlurals });
    },
    [entry.id, pluralForms, updateEntryPlural, markAsMachineTranslated, broadcastEntryUpdate],
  );

  if (hasPlural) {
    const displayForms = pluralForms.length >= 2 ? pluralForms : ['', ''];
    const sourceTexts = displayForms.map((_, index) =>
      index === 0
        ? (entry.sourceText ?? entry.msgid)
        : (entry.sourceTextPlural ?? entry.msgidPlural!),
    );

    return (
      <Stack gap={8}>
        {isRemoteLocked && remoteLock && <CellLockIndicator lock={remoteLock} />}
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
                onEditStart={handleEditStart}
                onEditEnd={handleEditEnd}
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
        <Box style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {isRemoteLocked && remoteLock && <CellLockIndicator lock={remoteLock} />}
          <EditableField
            value={entry.msgstr}
            onChange={handleSingularChange}
            onKeyDown={onKeyDown}
            entryId={entry.id}
            fieldId={`${entry.id}-singular`}
            useNativeTextColor={useNativeTextColor}
            disabled={isLocked}
            onEditStart={handleEditStart}
            onEditEnd={handleEditEnd}
          />
        </Box>
        {translateSettings.translateEnabled &&
          translateSettings.targetLang &&
          (entry.sourceText ?? entry.msgid).trim() && (
            <TranslateButton
              text={entry.sourceText ?? entry.msgid}
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
 * Meta column with flags, references, and comments.
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
  const projectSlug = useSourceStore((state) => getEffectiveSlug(state));
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

      {hasReferences && projectSlug && (
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

      {hasReferences && !projectSlug && (
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

/**
 * Single entry row component - memoized for performance
 */
export const EntryRow = memo(function EntryRow({
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
  const { t } = useTranslation();
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
  const remoteLock = useCollaborationStore((s) => s.cellLocks.get(entry.id));

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
        backgroundColor: remoteLock
          ? `${remoteLock.color}12`
          : isSelected
            ? 'var(--gb-highlight-row)'
            : isUntranslated
              ? 'var(--gb-highlight-danger)'
              : undefined,
        boxShadow: remoteLock
          ? `inset 4px 0 0 ${remoteLock.color}`
          : isModified
            ? 'inset 4px 0 0 var(--mantine-color-orange-5)'
            : undefined,
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
            aria-label={t('Select entry {{entry}}', { entry: entry.msgid })}
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
            />
          </Table.Td>
        );
      })}
    </Table.Tr>
  );
});

export const MobileEntryCard = memo(function MobileEntryCard({
  entry,
  isChecked,
  detailsExpanded,
  onToggleDetails,
  onToggleSelection,
  onKeyDown,
  onSelect,
  translationMemoryScope,
  mode = 'edit',
}: {
  entry: POEntry;
  isChecked: boolean;
  detailsExpanded: boolean;
  onToggleDetails: () => void;
  onToggleSelection: (checked: boolean) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>, fieldId: string) => void;
  onSelect?: (sourceText: string) => void;
  translationMemoryScope?: TranslationMemoryScope | null;
  mode?: WorkspaceMode;
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
    status: 'draft' as const,
    comments: [],
    history: [],
  };
  const isReviewEntryLocked = isReviewLocked(reviewStatus, lockApprovedEntries);
  const remoteLock = useCollaborationStore((s) => s.cellLocks.get(entry.id));

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
        borderLeftColor: remoteLock ? remoteLock.color : undefined,
        borderLeftWidth: remoteLock ? 3 : undefined,
        backgroundColor: remoteLock
          ? `${remoteLock.color}12`
          : isSelected
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
            aria-label={t('Select entry {{entry}}', { entry: entry.msgid })}
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
          />
        </Group>

        <UnstyledButton
          onClick={(e) => {
            e.stopPropagation();
            onToggleDetails();
          }}
          style={{ color: 'var(--mantine-color-dimmed)' }}
          aria-label={t('Toggle details for {{entry}}', { entry: entry.msgid })}
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
          qaReport={qaReport ?? null}
          reviewEntry={reviewEntry}
          translationMemoryScope={translationMemoryScope}
          onActivateReference={handleActivateReference}
          mode={mode}
          isRemoteLocked={Boolean(remoteLock)}
        />
      </Collapse>
    </Paper>
  );
});
