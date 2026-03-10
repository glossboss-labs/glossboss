/**
 * Translate Toolbar Component
 *
 * Language selection and bulk translation controls with safeguards.
 * Integrates with DeepL via secure edge function.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Group,
  Select,
  Button,
  Text,
  Progress,
  Stack,
  Alert,
  Checkbox,
  Tooltip,
  Badge,
} from '@mantine/core';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  AlertCircle,
  Square,
  RefreshCw,
  ShieldAlert,
  Key,
  CheckCheck,
  BookCheck,
  RotateCcw,
  WandSparkles,
} from 'lucide-react';
import { msgid, useTranslation } from '@/lib/app-language';
import { useEditorStore } from '@/stores';
import { getDeepLClient, hasUserApiKey } from '@/lib/deepl';
import {
  DEEPL_GLOSSARY_FALLBACK_EVENT,
  formatDeepLError,
  isGlossaryNotFoundError,
  notifyGlossaryFallback,
} from '@/lib/deepl/errors';
import { analyzeTranslation } from '@/lib/glossary';
import { ConfirmModal } from '@/components/ui';
import { contentVariants, buttonStates, badgeVariants } from '@/lib/motion';
import type { TargetLanguage, SourceLanguage } from '@/lib/deepl/types';
import type { Glossary, GlossaryAnalysisResult } from '@/lib/glossary/types';
import { shouldAutoTranslateEntry } from './translate-utils';

const MotionDiv = motion.div;
const MotionStack = motion.create(Stack);

type TranslateMode = 'untranslated' | 'overwrite-all' | 'selected-empty-or-fuzzy';

/** DeepL supported languages */
const SOURCE_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: '', label: msgid('Auto-detect') },
  { value: 'BG', label: msgid('Bulgarian') },
  { value: 'CS', label: msgid('Czech') },
  { value: 'DA', label: msgid('Danish') },
  { value: 'DE', label: msgid('German') },
  { value: 'EL', label: msgid('Greek') },
  { value: 'EN', label: msgid('English') },
  { value: 'ES', label: msgid('Spanish') },
  { value: 'ET', label: msgid('Estonian') },
  { value: 'FI', label: msgid('Finnish') },
  { value: 'FR', label: msgid('French') },
  { value: 'HU', label: msgid('Hungarian') },
  { value: 'ID', label: msgid('Indonesian') },
  { value: 'IT', label: msgid('Italian') },
  { value: 'JA', label: msgid('Japanese') },
  { value: 'KO', label: msgid('Korean') },
  { value: 'LT', label: msgid('Lithuanian') },
  { value: 'LV', label: msgid('Latvian') },
  { value: 'NB', label: msgid('Norwegian') },
  { value: 'NL', label: msgid('Dutch') },
  { value: 'PL', label: msgid('Polish') },
  { value: 'PT', label: msgid('Portuguese') },
  { value: 'RO', label: msgid('Romanian') },
  { value: 'RU', label: msgid('Russian') },
  { value: 'SK', label: msgid('Slovak') },
  { value: 'SL', label: msgid('Slovenian') },
  { value: 'SV', label: msgid('Swedish') },
  { value: 'TR', label: msgid('Turkish') },
  { value: 'UK', label: msgid('Ukrainian') },
  { value: 'ZH', label: msgid('Chinese') },
];

const TARGET_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: 'BG', label: msgid('Bulgarian') },
  { value: 'CS', label: msgid('Czech') },
  { value: 'DA', label: msgid('Danish') },
  { value: 'DE', label: msgid('German') },
  { value: 'EL', label: msgid('Greek') },
  { value: 'EN-GB', label: msgid('English (UK)') },
  { value: 'EN-US', label: msgid('English (US)') },
  { value: 'ES', label: msgid('Spanish') },
  { value: 'ET', label: msgid('Estonian') },
  { value: 'FI', label: msgid('Finnish') },
  { value: 'FR', label: msgid('French') },
  { value: 'HU', label: msgid('Hungarian') },
  { value: 'ID', label: msgid('Indonesian') },
  { value: 'IT', label: msgid('Italian') },
  { value: 'JA', label: msgid('Japanese') },
  { value: 'KO', label: msgid('Korean') },
  { value: 'LT', label: msgid('Lithuanian') },
  { value: 'LV', label: msgid('Latvian') },
  { value: 'NB', label: msgid('Norwegian') },
  { value: 'NL', label: msgid('Dutch') },
  { value: 'PL', label: msgid('Polish') },
  { value: 'PT-BR', label: msgid('Portuguese (Brazil)') },
  { value: 'PT-PT', label: msgid('Portuguese (Portugal)') },
  { value: 'RO', label: msgid('Romanian') },
  { value: 'RU', label: msgid('Russian') },
  { value: 'SK', label: msgid('Slovak') },
  { value: 'SL', label: msgid('Slovenian') },
  { value: 'SV', label: msgid('Swedish') },
  { value: 'TR', label: msgid('Turkish') },
  { value: 'UK', label: msgid('Ukrainian') },
  { value: 'ZH', label: msgid('Chinese') },
];

/** Map PO language codes to DeepL codes */
function mapToDeepLCode(poLang: string): string | null {
  const code = poLang.toUpperCase().replace('_', '-');
  const directMatch = TARGET_LANGUAGES.find((l) => l.value === code);
  if (directMatch) return directMatch.value;
  const baseCode = code.split('-')[0];
  const baseMatch = TARGET_LANGUAGES.find(
    (l) => l.value === baseCode || l.value.startsWith(baseCode + '-'),
  );
  if (baseMatch) return baseMatch.value;
  return null;
}

interface TranslateToolbarProps {
  sourceLang?: SourceLanguage;
  targetLang?: TargetLanguage;
  onLanguageChange?: (source: SourceLanguage | undefined, target: TargetLanguage) => void;
  deeplGlossaryId?: string | null;
  glossary?: Glossary | null;
  translateEnabled?: boolean;
}

export function TranslateToolbar({
  onLanguageChange,
  deeplGlossaryId,
  glossary = null,
  translateEnabled = true,
}: TranslateToolbarProps) {
  const { t } = useTranslation();
  const {
    header,
    entries,
    updateEntry,
    updateEntryPlural,
    markAsMachineTranslated,
    manualEditIds,
    machineTranslatedIds,
    selectedEntryIds,
    setSelectedEntries,
    clearSelectedEntries,
    clearFuzzyBatch,
    addFuzzyBatch,
    setGlossaryAnalysisBatch,
    getFilteredEntries,
  } = useEditorStore();

  // Infer target language from PO header
  const inferredTarget = useMemo(() => {
    if (header?.language) {
      return mapToDeepLCode(header.language);
    }
    return null;
  }, [header?.language]);

  const [sourceLang, setSourceLang] = useState<string>('');
  const [targetLang, setTargetLang] = useState<string>(inferredTarget ?? '');
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [translateCount, setTranslateCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [confirmRetranslateOpen, setConfirmRetranslateOpen] = useState(false);
  const [isRetranslateMode, setIsRetranslateMode] = useState(false);
  const [skipManualEdits, setSkipManualEdits] = useState(true);
  const [bulkActionMessage, setBulkActionMessage] = useState<string | null>(null);
  const [glossaryFallbackNotice, setGlossaryFallbackNotice] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const batchCountRef = useRef(0);

  // Check if API key is configured
  const hasApiKey = hasUserApiKey();

  // Sync inferred target language when header changes
  useEffect(() => {
    if (inferredTarget && !targetLang) {
      setTargetLang(inferredTarget);
    }
  }, [inferredTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent of language changes
  useEffect(() => {
    if (targetLang) {
      onLanguageChange?.(
        sourceLang ? (sourceLang as SourceLanguage) : undefined,
        targetLang as TargetLanguage,
      );
    }
  }, [targetLang, sourceLang, onLanguageChange]);

  // Show inline banner whenever glossary fallback is triggered by any translate action
  useEffect(() => {
    const handleFallback = (event: Event) => {
      const custom = event as CustomEvent<{ context?: 'single' | 'bulk' }>;
      const context = custom.detail?.context;
      setGlossaryFallbackNotice(
        context === 'bulk'
          ? t(
              'Glossary not found in DeepL. Continued bulk translation without glossary. Re-sync in Settings is recommended.',
            )
          : t(
              'Glossary not found in DeepL. This translation was done without glossary. Re-sync in Settings is recommended.',
            ),
      );
    };

    window.addEventListener(DEEPL_GLOSSARY_FALLBACK_EVENT, handleFallback as EventListener);
    return () =>
      window.removeEventListener(DEEPL_GLOSSARY_FALLBACK_EVENT, handleFallback as EventListener);
  }, [t]);

  // Find untranslated entries
  const untranslatedEntries = useMemo(
    () =>
      entries.filter((e) => {
        if (!e.msgid.trim()) return false;
        if (e.flags.includes('fuzzy')) return false;
        return shouldAutoTranslateEntry(e);
      }),
    [entries],
  );

  // All translatable entries (for retranslate all)
  const allTranslatableEntries = useMemo(() => entries.filter((e) => e.msgid.trim()), [entries]);

  // Currently filtered entries (across all pages)
  const filteredEntries = getFilteredEntries();

  const selectedEntries = useMemo(
    () => allTranslatableEntries.filter((entry) => selectedEntryIds.has(entry.id)),
    [allTranslatableEntries, selectedEntryIds],
  );

  const selectedAutoTranslateEntries = useMemo(
    () => selectedEntries.filter((entry) => shouldAutoTranslateEntry(entry)),
    [selectedEntries],
  );

  const selectedFuzzyCount = useMemo(
    () => selectedEntries.filter((entry) => entry.flags.includes('fuzzy')).length,
    [selectedEntries],
  );
  const selectedNonFuzzyCount = selectedEntries.length - selectedFuzzyCount;

  // Count of manual edits that would be overwritten
  const manualEditCount = useMemo(() => {
    return allTranslatableEntries.filter(
      (e) => manualEditIds.has(e.id) && !machineTranslatedIds.has(e.id),
    ).length;
  }, [allTranslatableEntries, manualEditIds, machineTranslatedIds]);

  const handleSourceChange = useCallback(
    (value: string | null) => {
      const newSource = value || '';
      setSourceLang(newSource);
      onLanguageChange?.((newSource as SourceLanguage) || undefined, targetLang as TargetLanguage);
    },
    [targetLang, onLanguageChange],
  );

  const handleTargetChange = useCallback(
    (value: string | null) => {
      const newTarget = value || '';
      setTargetLang(newTarget);
      onLanguageChange?.((sourceLang as SourceLanguage) || undefined, newTarget as TargetLanguage);
    },
    [sourceLang, onLanguageChange],
  );

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  // Generic translate handler
  const handleTranslate = useCallback(
    async (entriesToTranslate: typeof entries, mode: TranslateMode) => {
      if (!targetLang || entriesToTranslate.length === 0) return;
      const overwriteAll = mode === 'overwrite-all';

      setIsTranslating(true);
      setIsRetranslateMode(overwriteAll);
      setError(null);
      setBulkActionMessage(null);
      setProgress(0);
      setTranslateCount(0);
      setFailedCount(0);
      cancelRef.current = false;
      batchCountRef.current = 0;

      const client = getDeepLClient();
      let completed = 0;
      let failed = 0;
      let activeGlossaryId = deeplGlossaryId ?? undefined;

      try {
        interface TranslationJob {
          entryId: string;
          text: string;
          isPlural: boolean;
          pluralIndex?: number;
        }

        const jobs: TranslationJob[] = [];
        const entryById = new Map(entriesToTranslate.map((entry) => [entry.id, entry]));

        for (const entry of entriesToTranslate) {
          // Skip manual edits if option is enabled and we're in retranslate mode
          if (
            overwriteAll &&
            skipManualEdits &&
            manualEditIds.has(entry.id) &&
            !machineTranslatedIds.has(entry.id)
          ) {
            continue;
          }

          if (entry.msgidPlural) {
            const plurals = entry.msgstrPlural ?? ['', ''];
            const displayForms = plurals.length >= 2 ? plurals : ['', ''];
            const shouldTranslateAllForms =
              mode === 'overwrite-all' ||
              (mode === 'selected-empty-or-fuzzy' && entry.flags.includes('fuzzy'));

            displayForms.forEach((form, index) => {
              if (shouldTranslateAllForms || !form.trim()) {
                jobs.push({
                  entryId: entry.id,
                  text: index === 0 ? entry.msgid : entry.msgidPlural!,
                  isPlural: true,
                  pluralIndex: index,
                });
              }
            });
          } else {
            if (
              mode === 'overwrite-all' ||
              !entry.msgstr.trim() ||
              (mode === 'selected-empty-or-fuzzy' && entry.flags.includes('fuzzy'))
            ) {
              jobs.push({
                entryId: entry.id,
                text: entry.msgid,
                isPlural: false,
              });
            }
          }
        }

        const totalJobs = jobs.length;
        if (totalJobs === 0) {
          setIsTranslating(false);
          setIsRetranslateMode(false);
          return;
        }

        const batchSize = 10;

        for (let i = 0; i < jobs.length; i += batchSize) {
          if (cancelRef.current) break;

          const batch = jobs.slice(i, i + batchSize);
          const texts = batch.map((j) => j.text);
          const effectiveSourceLang = activeGlossaryId
            ? ((sourceLang || 'EN') as SourceLanguage)
            : sourceLang
              ? (sourceLang as SourceLanguage)
              : undefined;

          try {
            let translations: string[];
            try {
              translations = await client.translateBatch(
                texts,
                targetLang as TargetLanguage,
                effectiveSourceLang,
                activeGlossaryId,
              );
            } catch (batchErr) {
              if (activeGlossaryId && isGlossaryNotFoundError(batchErr)) {
                // Disable glossary for remaining batches when DeepL reports stale glossary.
                activeGlossaryId = undefined;
                notifyGlossaryFallback('bulk');
                translations = await client.translateBatch(
                  texts,
                  targetLang as TargetLanguage,
                  sourceLang ? (sourceLang as SourceLanguage) : undefined,
                  undefined,
                );
              } else {
                throw batchErr;
              }
            }

            const pluralUpdates = new Map<string, string[]>();
            const translatedEntryIds = new Set<string>();

            batch.forEach((job, idx) => {
              const translated = translations[idx];
              if (!translated) return;

              if (job.isPlural && job.pluralIndex !== undefined) {
                let nextPlurals = pluralUpdates.get(job.entryId);
                if (!nextPlurals) {
                  const existing = entryById.get(job.entryId)?.msgstrPlural ?? [];
                  nextPlurals = existing.length >= 2 ? [...existing] : ['', ''];
                }
                while (nextPlurals.length <= job.pluralIndex) {
                  nextPlurals.push('');
                }
                nextPlurals[job.pluralIndex] = translated;
                pluralUpdates.set(job.entryId, nextPlurals);
                translatedEntryIds.add(job.entryId);
                return;
              }

              updateEntry(job.entryId, translated);
              translatedEntryIds.add(job.entryId);
            });

            pluralUpdates.forEach((plurals, entryId) => {
              updateEntryPlural(entryId, plurals);
              const entry = entryById.get(entryId);
              if (entry) {
                entry.msgstrPlural = plurals;
              }
            });

            translatedEntryIds.forEach((entryId) => {
              markAsMachineTranslated(entryId, Boolean(activeGlossaryId));
            });

            completed += batch.length;
          } catch (batchErr) {
            failed += batch.length;
            console.error('Batch translation failed:', batchErr);
          }

          setProgress(Math.round(((completed + failed) / totalJobs) * 100));
          setTranslateCount(completed);
          setFailedCount(failed);

          // Signal usage refresh every other batch
          batchCountRef.current++;
          if (batchCountRef.current % 2 === 0) {
            window.dispatchEvent(new Event('deepl-usage-refresh'));
          }
        }

        if (failed > 0) {
          setError(t('{{count}} translations failed', { count: failed }));
        }
      } catch (err) {
        setError(formatDeepLError(err));
      } finally {
        setIsTranslating(false);
        setIsRetranslateMode(false);
        cancelRef.current = false;
        // Signal final usage refresh
        window.dispatchEvent(new Event('deepl-usage-refresh'));
      }
    },
    [
      targetLang,
      sourceLang,
      deeplGlossaryId,
      updateEntry,
      updateEntryPlural,
      markAsMachineTranslated,
      skipManualEdits,
      manualEditIds,
      machineTranslatedIds,
      t,
    ],
  );

  const handleBulkTranslate = useCallback(() => {
    handleTranslate(untranslatedEntries, 'untranslated');
  }, [handleTranslate, untranslatedEntries]);

  const handleRetranslateAll = useCallback(() => {
    setConfirmRetranslateOpen(false);
    handleTranslate(allTranslatableEntries, 'overwrite-all');
  }, [handleTranslate, allTranslatableEntries]);

  const handleSelectAllFiltered = useCallback(() => {
    const merged = new Set(selectedEntryIds);
    filteredEntries.forEach((entry) => merged.add(entry.id));
    setSelectedEntries(Array.from(merged));
  }, [selectedEntryIds, filteredEntries, setSelectedEntries]);

  const handleSelectedAutoTranslate = useCallback(() => {
    handleTranslate(selectedAutoTranslateEntries, 'selected-empty-or-fuzzy');
  }, [handleTranslate, selectedAutoTranslateEntries]);

  const handleGlossaryCheckSelected = useCallback(() => {
    if (!glossary || selectedEntries.length === 0) return;

    const analyses = new Map<string, GlossaryAnalysisResult>();
    selectedEntries.forEach((entry) => {
      analyses.set(entry.id, analyzeTranslation(entry.msgid, entry.msgstr, glossary, entry.id));
    });

    setGlossaryAnalysisBatch(analyses);

    const withTerms = Array.from(analyses.values()).filter((analysis) => analysis.terms.length > 0);
    const needsReviewRows = withTerms.filter((analysis) => analysis.needsReviewCount > 0).length;

    if (withTerms.length === 0) {
      setBulkActionMessage(t('Glossary check complete: no glossary terms found in selected rows.'));
      return;
    }

    if (needsReviewRows === 0) {
      setBulkActionMessage(t('Glossary check complete: all selected rows match glossary terms.'));
      return;
    }

    setBulkActionMessage(
      t('Glossary check complete: {{count}} selected row(s) need review.', {
        count: needsReviewRows,
      }),
    );
  }, [glossary, selectedEntries, setGlossaryAnalysisBatch, t]);

  const handleApproveSelected = useCallback(() => {
    clearFuzzyBatch(Array.from(selectedEntryIds));
    setBulkActionMessage(
      selectedFuzzyCount > 0
        ? t('Approved {{count}} row(s): fuzzy flag cleared.', { count: selectedFuzzyCount })
        : t('No selected fuzzy rows to approve.'),
    );
  }, [clearFuzzyBatch, selectedEntryIds, selectedFuzzyCount, t]);

  const handleUnapproveSelected = useCallback(() => {
    addFuzzyBatch(Array.from(selectedEntryIds));
    setBulkActionMessage(
      selectedNonFuzzyCount > 0
        ? t('Unapproved {{count}} row(s): fuzzy flag added.', { count: selectedNonFuzzyCount })
        : t('No selected rows available to unapprove.'),
    );
  }, [addFuzzyBatch, selectedEntryIds, selectedNonFuzzyCount, t]);

  if (!entries.length) return null;

  // Count already translated entries
  const translatedCount = allTranslatableEntries.length - untranslatedEntries.length;

  if (!translateEnabled) return null;

  return (
    <>
      {/* Retranslate confirmation modal */}
      <ConfirmModal
        opened={confirmRetranslateOpen}
        onClose={() => setConfirmRetranslateOpen(false)}
        onConfirm={handleRetranslateAll}
        title={t('Retranslate all entries?')}
        message={t(
          'This will overwrite {{count}} existing translations with new machine translations.',
          { count: translatedCount },
        )}
        detail={
          manualEditCount > 0 && skipManualEdits
            ? t('{{count}} manually edited entries will be skipped.', { count: manualEditCount })
            : manualEditCount > 0
              ? t('\u26a0\ufe0f {{count}} manually edited entries will be overwritten!', {
                  count: manualEditCount,
                })
              : t('Consider downloading a backup first.')
        }
        confirmLabel={msgid('Retranslate All')}
        confirmColor="orange"
        variant={manualEditCount > 0 && !skipManualEdits ? 'danger' : 'warning'}
      />

      <Stack gap="sm">
        <AnimatePresence>
          {glossaryFallbackNotice && (
            <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
              <Alert color="yellow" withCloseButton onClose={() => setGlossaryFallbackNotice(null)}>
                <Text size="xs">{glossaryFallbackNotice}</Text>
              </Alert>
            </MotionDiv>
          )}
        </AnimatePresence>

        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="xs">
            <WandSparkles size={14} />
            <Text size="sm" fw={600}>
              {t('Machine Translation')}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            {selectedEntryIds.size > 0
              ? t('{{count}} selected', { count: selectedEntryIds.size })
              : t('{{count}} untranslated', { count: untranslatedEntries.length })}
          </Text>
        </Group>

        {/* API Key Warning */}
        <AnimatePresence>
          {!hasApiKey && (
            <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
              <Alert color="yellow" icon={<Key size={16} />}>
                <Text size="sm">
                  {t('Add your DeepL API key in Settings to enable translations.')}
                </Text>
              </Alert>
            </MotionDiv>
          )}
        </AnimatePresence>

        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="xs" align="center">
            <Text size="xs" c="dimmed" fw={500}>
              {t('From')}
            </Text>
            <Select
              data={SOURCE_LANGUAGES}
              value={sourceLang}
              onChange={handleSourceChange}
              placeholder={t('Auto-detect')}
              searchable
              clearable
              w={160}
              size="xs"
              disabled={!hasApiKey}
              aria-label={t('Source language')}
            />

            <Text c="dimmed" size="sm" aria-hidden="true">
              →
            </Text>

            <Text size="xs" c="dimmed" fw={500}>
              {t('To')}
            </Text>
            <Select
              data={TARGET_LANGUAGES}
              value={targetLang}
              onChange={handleTargetChange}
              placeholder={t('Select target...')}
              searchable
              required
              w={170}
              size="xs"
              disabled={!hasApiKey}
              aria-label={t('Target language')}
            />

            {inferredTarget && (
              <Badge size="xs" variant="light" color="gray">
                {t('Detected: {{target}}', { target: inferredTarget })}
              </Badge>
            )}
          </Group>

          <Group gap="sm">
            <AnimatePresence mode="wait">
              {isTranslating ? (
                <MotionDiv
                  key="cancel"
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <motion.div {...buttonStates}>
                    <Button
                      leftSection={<Square size={16} />}
                      onClick={handleCancel}
                      variant="light"
                      color="red"
                    >
                      {t('Cancel')}
                    </Button>
                  </motion.div>
                </MotionDiv>
              ) : (
                <MotionDiv
                  key="actions"
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Group gap="sm">
                    <Tooltip
                      label={
                        manualEditCount > 0
                          ? t('{{count}} manual edits will be {{action}}', {
                              count: manualEditCount,
                              action: skipManualEdits ? t('skipped') : t('overwritten'),
                            })
                          : t('Retranslate all entries')
                      }
                    >
                      <motion.div {...buttonStates}>
                        <Button
                          leftSection={<RefreshCw size={16} />}
                          onClick={() => setConfirmRetranslateOpen(true)}
                          disabled={
                            !targetLang || allTranslatableEntries.length === 0 || !hasApiKey
                          }
                          variant="subtle"
                          color="orange"
                        >
                          {t('Retranslate All')}
                        </Button>
                      </motion.div>
                    </Tooltip>
                    <motion.div {...buttonStates}>
                      <Button
                        leftSection={<Zap size={16} />}
                        onClick={handleBulkTranslate}
                        disabled={!targetLang || untranslatedEntries.length === 0 || !hasApiKey}
                        variant="light"
                      >
                        {t('Translate {{count}} untranslated', {
                          count: untranslatedEntries.length,
                        })}
                      </Button>
                    </motion.div>
                  </Group>
                </MotionDiv>
              )}
            </AnimatePresence>
          </Group>
        </Group>

        {/* Bulk selection + selected-row actions */}
        {!isTranslating && (
          <Group gap="xs" align="center" wrap="wrap">
            <MotionDiv
              layout
              variants={badgeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <Button
                size="xs"
                variant="subtle"
                onClick={handleSelectAllFiltered}
                disabled={filteredEntries.length === 0}
              >
                {t('Select all filtered')}
              </Button>
            </MotionDiv>

            <AnimatePresence mode="popLayout">
              {selectedEntryIds.size > 0 && (
                <MotionDiv
                  key="clear-selection"
                  layout
                  variants={badgeVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Button size="xs" variant="subtle" color="gray" onClick={clearSelectedEntries}>
                    {t('Clear')}
                  </Button>
                </MotionDiv>
              )}
            </AnimatePresence>

            <AnimatePresence mode="popLayout">
              {selectedAutoTranslateEntries.length > 0 && (
                <MotionDiv
                  key="auto-translate-selected"
                  layout
                  variants={badgeVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Tooltip label={t('Auto translate selected rows that are empty or fuzzy')}>
                    <Button
                      size="xs"
                      variant="light"
                      color="blue"
                      leftSection={<Zap size={14} />}
                      disabled={!hasApiKey || !targetLang}
                      onClick={handleSelectedAutoTranslate}
                      aria-label={t('Auto translate selected')}
                    >
                      {t('Auto Translate ({{count}})', {
                        count: selectedAutoTranslateEntries.length,
                      })}
                    </Button>
                  </Tooltip>
                </MotionDiv>
              )}
            </AnimatePresence>

            <AnimatePresence mode="popLayout">
              {selectedEntryIds.size > 0 && glossary && (
                <MotionDiv
                  key="glossary-check-selected"
                  layout
                  variants={badgeVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Tooltip label={t('Re-run glossary analysis on selected rows')}>
                    <Button
                      size="xs"
                      variant="light"
                      color="violet"
                      leftSection={<BookCheck size={14} />}
                      onClick={handleGlossaryCheckSelected}
                      aria-label={t('Glossary check selected')}
                    >
                      {t('Glossary Check')}
                    </Button>
                  </Tooltip>
                </MotionDiv>
              )}
            </AnimatePresence>

            <AnimatePresence mode="popLayout">
              {selectedFuzzyCount > 0 && (
                <MotionDiv
                  key="approve-selected"
                  layout
                  variants={badgeVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Tooltip label={t('Approve selected rows by clearing fuzzy flag')}>
                    <Button
                      size="xs"
                      variant="light"
                      color="green"
                      leftSection={<CheckCheck size={14} />}
                      onClick={handleApproveSelected}
                      aria-label={t('Approve selected')}
                    >
                      {t('Approve ({{count}})', { count: selectedFuzzyCount })}
                    </Button>
                  </Tooltip>
                </MotionDiv>
              )}
            </AnimatePresence>

            <AnimatePresence mode="popLayout">
              {selectedNonFuzzyCount > 0 && (
                <MotionDiv
                  key="unapprove-selected"
                  layout
                  variants={badgeVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Tooltip label={t('Unapprove selected rows by adding fuzzy flag')}>
                    <Button
                      size="xs"
                      variant="light"
                      color="yellow"
                      leftSection={<RotateCcw size={14} />}
                      onClick={handleUnapproveSelected}
                      aria-label={t('Unapprove selected')}
                    >
                      {t('Unapprove ({{count}})', { count: selectedNonFuzzyCount })}
                    </Button>
                  </Tooltip>
                </MotionDiv>
              )}
            </AnimatePresence>
          </Group>
        )}

        {/* Skip manual edits option */}
        <AnimatePresence>
          {manualEditCount > 0 && !isTranslating && (
            <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
              <Group gap="xs">
                <Checkbox
                  size="xs"
                  checked={skipManualEdits}
                  onChange={(e) => setSkipManualEdits(e.currentTarget.checked)}
                  label={
                    <Group gap={4}>
                      <ShieldAlert size={14} aria-hidden="true" />
                      <Text size="xs">
                        {t('Protect {{count}} manual edits from bulk translation', {
                          count: manualEditCount,
                        })}
                      </Text>
                    </Group>
                  }
                />
              </Group>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Progress bar during bulk translation */}
        <AnimatePresence>
          {isTranslating && (
            <MotionStack
              gap="xs"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {isRetranslateMode ? t('Retranslating') : t('Translating')}... {translateCount}
                  {failedCount > 0 ? ` (${t('{{count}} failed', { count: failedCount })})` : ''}
                </Text>
                <Text size="sm" fw={500}>
                  {progress}%
                </Text>
              </Group>
              <Progress
                value={progress}
                size="sm"
                animated
                color={failedCount > 0 ? 'orange' : 'blue'}
                aria-label={t('Translation progress')}
              />
            </MotionStack>
          )}
        </AnimatePresence>

        {/* Error display */}
        <AnimatePresence>
          {error && !isTranslating && (
            <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
              <Alert
                color="red"
                icon={<AlertCircle size={16} />}
                withCloseButton
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Bulk action feedback */}
        <AnimatePresence>
          {bulkActionMessage && !isTranslating && (
            <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
              <Alert color="blue" withCloseButton onClose={() => setBulkActionMessage(null)}>
                {bulkActionMessage}
              </Alert>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Success message */}
        <AnimatePresence>
          {!isTranslating && translateCount > 0 && !error && (
            <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
              <Alert color="green" withCloseButton onClose={() => setTranslateCount(0)}>
                {t('Successfully translated {{count}} entries', { count: translateCount })}
              </Alert>
            </MotionDiv>
          )}
        </AnimatePresence>
      </Stack>
    </>
  );
}
