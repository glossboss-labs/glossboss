/**
 * Translate Toolbar Component
 *
 * Language selection and bulk translation controls with safeguards.
 * Layout wrapper that composes ProviderPicker, BatchTranslateControls,
 * and GlossaryControls.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Group, Button, Text, Stack, Alert, Tooltip } from '@mantine/core';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Square, RefreshCw, CheckCheck, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { trackEvent } from '@/lib/analytics';
import { useEditorStore } from '@/stores';
import { getEffectiveProjectType, getEffectiveSlug, useSourceStore } from '@/stores/source-store';
import {
  DEEPL_GLOSSARY_FALLBACK_EVENT,
  formatDeepLError,
  isGlossaryNotFoundError,
  notifyGlossaryFallback,
} from '@/lib/deepl/errors';
import { contentVariants, buttonStates, badgeVariants } from '@/lib/motion';
import type { TargetLanguage, SourceLanguage } from '@/lib/deepl/types';
import type { Glossary } from '@/lib/glossary/types';
import {
  getTranslationProviderLabel,
  hasProviderCredentials,
  recordTranslationUsage,
  TRANSLATION_USAGE_REFRESH_EVENT,
  translateWithProvider,
} from '@/lib/translation';
import { isLlmProvider } from '@/lib/llm';
import { getReviewEntryState, isReviewLocked } from '@/lib/review';
import { useTranslationProvider } from '@/hooks/use-translation-provider';
import { shouldAutoTranslateEntry } from './translate-utils';
import { getTranslationStatus } from '@/types';
import { ProviderPicker } from './ProviderPicker';
import { mapToDeepLCode } from './translate-languages';
import { GlossaryControls } from './GlossaryControls';
import { BatchTranslateControls } from './BatchTranslateControls';

const MotionDiv = motion.div;

type TranslateMode = 'untranslated' | 'overwrite-all' | 'selected-empty-or-fuzzy';

interface TranslateToolbarProps {
  sourceLang?: SourceLanguage;
  targetLang?: TargetLanguage;
  onLanguageChange?: (source: SourceLanguage | undefined, target: TargetLanguage) => void;
  deeplGlossaryId?: string | null;
  glossary?: Glossary | null;
  translateEnabled?: boolean;
  mode?: 'edit' | 'review';
}

export function TranslateToolbar({
  onLanguageChange,
  deeplGlossaryId,
  glossary = null,
  translateEnabled = true,
  mode = 'edit',
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
    reviewEntries,
    lockApprovedEntries,
    selectedEntryIds,
    setSelectedEntries,
    clearSelectedEntries,
    clearFuzzyBatch,
    addFuzzyBatch,
    setGlossaryAnalysisBatch,
    getFilteredEntries,
    setReviewStatus,
  } = useEditorStore();
  const getReviewEntry = useEditorStore((state) => state.getReviewEntry);

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
  const activeProvider = useTranslationProvider();
  const projectSlug = useSourceStore((state) => getEffectiveSlug(state));
  const projectType = useSourceStore((state) => getEffectiveProjectType(state));
  const providerLabel = getTranslationProviderLabel(activeProvider);

  // Check if API key is configured
  const hasApiKey = hasProviderCredentials(activeProvider);

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
  const allTranslatableEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.msgid.trim() &&
          !isReviewLocked(getReviewEntryState(reviewEntries, entry.id).status, lockApprovedEntries),
      ),
    [entries, lockApprovedEntries, reviewEntries],
  );

  const untranslatedEntries = useMemo(
    () =>
      allTranslatableEntries.filter((e) => {
        if (!e.msgid.trim()) return false;
        // Skip fuzzy entries that already have a translation (needs review, not untranslated)
        if (e.flags.includes('fuzzy') && e.msgstr.trim()) return false;
        return shouldAutoTranslateEntry(e);
      }),
    [allTranslatableEntries],
  );

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

  const selectedReviewApprovedCount = useMemo(
    () => selectedEntries.filter((entry) => getReviewEntry(entry.id).status === 'approved').length,
    [getReviewEntry, selectedEntries],
  );
  const selectedRequestChangesEligibleCount = useMemo(
    () =>
      selectedEntries.filter((entry) => {
        const status = getReviewEntry(entry.id).status;
        return status !== 'needs-changes' && status !== 'approved';
      }).length,
    [getReviewEntry, selectedEntries],
  );

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
    async (entriesToTranslate: typeof entries, translateMode: TranslateMode) => {
      if (!targetLang || entriesToTranslate.length === 0) return;
      const overwriteAll = translateMode === 'overwrite-all';

      setIsTranslating(true);
      setIsRetranslateMode(overwriteAll);
      setError(null);
      setBulkActionMessage(null);
      setProgress(0);
      setTranslateCount(0);
      setFailedCount(0);
      cancelRef.current = false;
      batchCountRef.current = 0;

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
              translateMode === 'overwrite-all' ||
              (translateMode === 'selected-empty-or-fuzzy' && entry.flags.includes('fuzzy'));

            displayForms.forEach((form, index) => {
              if (shouldTranslateAllForms || !form.trim()) {
                jobs.push({
                  entryId: entry.id,
                  text:
                    index === 0
                      ? (entry.sourceText ?? entry.msgid)
                      : (entry.sourceTextPlural ?? entry.msgidPlural!),
                  isPlural: true,
                  pluralIndex: index,
                });
              }
            });
          } else {
            if (
              translateMode === 'overwrite-all' ||
              !entry.msgstr.trim() ||
              (translateMode === 'selected-empty-or-fuzzy' && entry.flags.includes('fuzzy'))
            ) {
              jobs.push({
                entryId: entry.id,
                text: entry.sourceText ?? entry.msgid,
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

        const applyTranslationResult = (
          job: TranslationJob,
          translated: NonNullable<
            Awaited<ReturnType<typeof translateWithProvider>>['translations'][number]
          >,
        ) => {
          const entry = entryById.get(job.entryId);

          if (job.isPlural && job.pluralIndex !== undefined) {
            const existing = entry?.msgstrPlural ?? [];
            const nextPlurals = existing.length >= 2 ? [...existing] : ['', ''];
            while (nextPlurals.length <= job.pluralIndex) {
              nextPlurals.push('');
            }
            nextPlurals[job.pluralIndex] = translated.text;
            updateEntryPlural(job.entryId, nextPlurals);
            if (entry) {
              entry.msgstrPlural = nextPlurals;
            }
          } else {
            updateEntry(job.entryId, translated.text);
            if (entry) {
              entry.msgstr = translated.text;
            }
          }

          markAsMachineTranslated(job.entryId, translated.metadata);
        };

        if (isLlmProvider(activeProvider)) {
          // LLM providers translate one-at-a-time to support per-entry context
          for (const job of jobs) {
            if (cancelRef.current) break;

            try {
              const effectiveSourceLang = activeGlossaryId
                ? ((sourceLang || 'EN') as SourceLanguage)
                : sourceLang
                  ? (sourceLang as SourceLanguage)
                  : undefined;
              const entry = entryById.get(job.entryId);
              const translationResponse = await translateWithProvider(activeProvider, {
                text: job.text,
                targetLang: targetLang as TargetLanguage,
                sourceLang: effectiveSourceLang,
                glossary,
                references: entry?.references,
                projectSlug,
                projectType,
              });
              const translated = translationResponse.translations[0];
              if (!translated?.text) {
                failed += 1;
              } else {
                recordTranslationUsage(activeProvider, job.text.length);
                applyTranslationResult(job, translated);
                completed += 1;
              }
            } catch (jobErr) {
              failed += 1;
              console.error('Translation failed:', jobErr);
            }

            setProgress(Math.round(((completed + failed) / totalJobs) * 100));
            setTranslateCount(completed);
            setFailedCount(failed);

            batchCountRef.current++;
            if (batchCountRef.current % 2 === 0) {
              window.dispatchEvent(new Event(TRANSLATION_USAGE_REFRESH_EVENT));
            }
          }
        } else {
          const batchSize = 10;

          for (let i = 0; i < jobs.length; i += batchSize) {
            if (cancelRef.current) break;

            const batch = jobs.slice(i, i + batchSize);
            const texts = batch.map((job) => job.text);
            const effectiveSourceLang = activeGlossaryId
              ? ((sourceLang || 'EN') as SourceLanguage)
              : sourceLang
                ? (sourceLang as SourceLanguage)
                : undefined;

            try {
              let translationResponse;
              try {
                translationResponse = await translateWithProvider(activeProvider, {
                  text: texts,
                  targetLang: targetLang as TargetLanguage,
                  sourceLang: effectiveSourceLang,
                  glossary,
                  deeplGlossaryId: activeProvider === 'deepl' ? activeGlossaryId : undefined,
                  projectSlug,
                  projectType,
                });
              } catch (translationError) {
                if (
                  activeProvider === 'deepl' &&
                  activeGlossaryId &&
                  isGlossaryNotFoundError(translationError)
                ) {
                  activeGlossaryId = undefined;
                  notifyGlossaryFallback('bulk');
                  translationResponse = await translateWithProvider('deepl', {
                    text: texts,
                    targetLang: targetLang as TargetLanguage,
                    sourceLang: sourceLang ? (sourceLang as SourceLanguage) : undefined,
                    glossary,
                    deeplGlossaryId: undefined,
                    projectSlug,
                    projectType,
                  });
                } else {
                  throw translationError;
                }
              }

              batch.forEach((job, index) => {
                const translated = translationResponse.translations[index];
                if (!translated?.text) {
                  failed += 1;
                  return;
                }

                recordTranslationUsage(activeProvider, job.text.length);
                applyTranslationResult(job, translated);
                completed += 1;
              });
            } catch (batchErr) {
              failed += batch.length;
              console.error('Batch translation failed:', batchErr);
            }

            setProgress(Math.round(((completed + failed) / totalJobs) * 100));
            setTranslateCount(completed);
            setFailedCount(failed);

            batchCountRef.current++;
            if (batchCountRef.current % 2 === 0) {
              window.dispatchEvent(new Event(TRANSLATION_USAGE_REFRESH_EVENT));
            }
          }
        }

        if (failed > 0) {
          trackEvent('translation_failed', {
            provider: activeProvider,
            error_type: 'batch_partial_failure',
          });
          setError(t('{{count}} translations failed', { count: failed }));
        }
      } catch (err) {
        trackEvent('translation_failed', {
          provider: activeProvider,
          error_type: err instanceof Error ? err.constructor.name : 'unknown',
        });
        setError(formatDeepLError(err));
      } finally {
        setIsTranslating(false);
        setIsRetranslateMode(false);
        cancelRef.current = false;
        window.dispatchEvent(new Event(TRANSLATION_USAGE_REFRESH_EVENT));
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
      glossary,
      t,
      activeProvider,
      projectSlug,
      projectType,
    ],
  );

  const handleBulkTranslate = useCallback(() => {
    trackEvent('batch_translation_triggered', {
      mode: 'untranslated',
      count: untranslatedEntries.length,
      provider: activeProvider,
      source_lang: sourceLang || 'auto',
      target_lang: targetLang,
      had_glossary: Boolean(deeplGlossaryId || glossary),
    });
    handleTranslate(untranslatedEntries, 'untranslated');
  }, [
    handleTranslate,
    untranslatedEntries,
    activeProvider,
    sourceLang,
    targetLang,
    deeplGlossaryId,
    glossary,
  ]);

  const handleRetranslateAll = useCallback(() => {
    setConfirmRetranslateOpen(false);
    trackEvent('batch_translation_triggered', {
      mode: 'overwrite-all',
      count: allTranslatableEntries.length,
      provider: activeProvider,
      source_lang: sourceLang || 'auto',
      target_lang: targetLang,
      had_glossary: Boolean(deeplGlossaryId || glossary),
    });
    handleTranslate(allTranslatableEntries, 'overwrite-all');
  }, [
    handleTranslate,
    allTranslatableEntries,
    activeProvider,
    sourceLang,
    targetLang,
    deeplGlossaryId,
    glossary,
  ]);

  const handleSelectAllFiltered = useCallback(() => {
    const merged = new Set(selectedEntryIds);
    filteredEntries.forEach((entry) => merged.add(entry.id));
    setSelectedEntries(Array.from(merged));
  }, [selectedEntryIds, filteredEntries, setSelectedEntries]);

  const handleSelectedAutoTranslate = useCallback(() => {
    handleTranslate(selectedAutoTranslateEntries, 'selected-empty-or-fuzzy');
  }, [handleTranslate, selectedAutoTranslateEntries]);

  const handleClearFuzzySelected = useCallback(() => {
    clearFuzzyBatch(Array.from(selectedEntryIds));
    setBulkActionMessage(
      selectedFuzzyCount > 0
        ? t('Cleared fuzzy on {{count}} row(s).', { count: selectedFuzzyCount })
        : t('No selected fuzzy rows to clear.'),
    );
  }, [clearFuzzyBatch, selectedEntryIds, selectedFuzzyCount, t]);

  const handleMarkFuzzySelected = useCallback(() => {
    addFuzzyBatch(Array.from(selectedEntryIds));
    setBulkActionMessage(
      selectedNonFuzzyCount > 0
        ? t('Marked {{count}} row(s) as fuzzy.', { count: selectedNonFuzzyCount })
        : t('No selected rows available to mark as fuzzy.'),
    );
  }, [addFuzzyBatch, selectedEntryIds, selectedNonFuzzyCount, t]);

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
    const eligible = selectedEntries.filter((entry) => {
      const status = getReviewEntry(entry.id).status;
      return status !== 'needs-changes' && status !== 'approved';
    });
    if (eligible.length === 0) return;
    const fuzzyCandidateIds = eligible
      .filter(
        (entry) =>
          getTranslationStatus(entry.msgstr, entry.flags, entry.msgstrPlural) !== 'untranslated',
      )
      .filter((entry) => !entry.flags.includes('fuzzy'))
      .map((entry) => entry.id);
    if (fuzzyCandidateIds.length > 0) {
      addFuzzyBatch(fuzzyCandidateIds);
    }
    eligible.forEach((entry) => {
      setReviewStatus(entry.id, 'needs-changes');
    });
  }, [addFuzzyBatch, getReviewEntry, selectedEntries, setReviewStatus]);

  if (!entries.length) return null;

  // Count already translated entries
  const translatedCount = allTranslatableEntries.length - untranslatedEntries.length;

  if (!translateEnabled) return null;

  return (
    <Stack gap="sm">
      {mode === 'edit' && (
        <>
          {/* Glossary fallback notice */}
          <AnimatePresence>
            {glossaryFallbackNotice && (
              <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
                <Alert
                  color="yellow"
                  withCloseButton
                  onClose={() => setGlossaryFallbackNotice(null)}
                >
                  <Text size="xs">{glossaryFallbackNotice}</Text>
                </Alert>
              </MotionDiv>
            )}
          </AnimatePresence>

          {/* Provider header + language selectors + translate/cancel buttons */}
          <ProviderPicker
            sourceLang={sourceLang}
            targetLang={targetLang}
            inferredTarget={inferredTarget}
            providerLabel={providerLabel}
            hasApiKey={hasApiKey}
            selectedCount={selectedEntryIds.size}
            untranslatedCount={untranslatedEntries.length}
            onSourceChange={handleSourceChange}
            onTargetChange={handleTargetChange}
            actionSlot={
              <Group gap="sm" wrap="wrap">
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
                              {t('Retranslate all')}
                            </Button>
                          </motion.div>
                        </Tooltip>
                        <motion.div {...buttonStates} data-tour="bulk-translate">
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
            }
          />
        </>
      )}

      {/* Bulk selection + selected-row actions */}
      {!isTranslating && (
        <Group gap="xs" align="center" wrap="wrap">
          <MotionDiv layout variants={badgeVariants} initial="hidden" animate="visible" exit="exit">
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

          {/* Edit-mode bulk actions */}
          {mode === 'edit' && (
            <>
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
                        {t('Auto translate ({{count}})', {
                          count: selectedAutoTranslateEntries.length,
                        })}
                      </Button>
                    </Tooltip>
                  </MotionDiv>
                )}
              </AnimatePresence>

              <GlossaryControls
                glossary={glossary}
                selectedEntries={selectedEntries}
                selectedEntryIds={selectedEntryIds}
                onGlossaryAnalysisBatch={setGlossaryAnalysisBatch}
                onBulkActionMessage={setBulkActionMessage}
              />

              <AnimatePresence mode="popLayout">
                {selectedFuzzyCount > 0 && (
                  <MotionDiv
                    key="clear-fuzzy-selected"
                    layout
                    variants={badgeVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Tooltip label={t('Clear fuzzy on selected rows')}>
                      <Button
                        size="xs"
                        variant="light"
                        color="green"
                        leftSection={<CheckCheck size={14} />}
                        onClick={handleClearFuzzySelected}
                        aria-label={t('Clear fuzzy selected')}
                      >
                        {t('Clear fuzzy ({{count}})', { count: selectedFuzzyCount })}
                      </Button>
                    </Tooltip>
                  </MotionDiv>
                )}
              </AnimatePresence>

              <AnimatePresence mode="popLayout">
                {selectedNonFuzzyCount > 0 && (
                  <MotionDiv
                    key="mark-fuzzy-selected"
                    layout
                    variants={badgeVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Tooltip label={t('Mark selected rows as fuzzy')}>
                      <Button
                        size="xs"
                        variant="light"
                        color="yellow"
                        leftSection={<RotateCcw size={14} />}
                        onClick={handleMarkFuzzySelected}
                        aria-label={t('Mark fuzzy selected')}
                      >
                        {t('Mark fuzzy ({{count}})', { count: selectedNonFuzzyCount })}
                      </Button>
                    </Tooltip>
                  </MotionDiv>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Review-mode bulk actions */}
          {mode === 'review' && (
            <>
              <AnimatePresence mode="popLayout">
                {selectedEntryIds.size > 0 && (
                  <MotionDiv
                    key="approve-selected"
                    layout
                    variants={badgeVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Button size="xs" variant="light" color="green" onClick={handleApproveSelected}>
                      {t('Approve selected')}
                    </Button>
                  </MotionDiv>
                )}
              </AnimatePresence>

              <AnimatePresence mode="popLayout">
                {selectedReviewApprovedCount > 0 && (
                  <MotionDiv
                    key="unapprove-selected"
                    layout
                    variants={badgeVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Button size="xs" variant="default" onClick={handleUnapproveSelected}>
                      {t('Unapprove selected')}
                    </Button>
                  </MotionDiv>
                )}
              </AnimatePresence>

              <AnimatePresence mode="popLayout">
                {selectedRequestChangesEligibleCount > 0 && (
                  <MotionDiv
                    key="request-changes-selected"
                    layout
                    variants={badgeVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Button
                      size="xs"
                      variant="light"
                      color="orange"
                      onClick={handleRequestChangesSelected}
                    >
                      {t('Request changes selected')}
                    </Button>
                  </MotionDiv>
                )}
              </AnimatePresence>
            </>
          )}
        </Group>
      )}

      {/* Batch translate controls — edit mode only */}
      {mode === 'edit' && (
        <BatchTranslateControls
          isTranslating={isTranslating}
          isRetranslateMode={isRetranslateMode}
          progress={progress}
          translateCount={translateCount}
          failedCount={failedCount}
          error={error}
          skipManualEdits={skipManualEdits}
          manualEditCount={manualEditCount}
          translatedCount={translatedCount}
          bulkActionMessage={bulkActionMessage}
          confirmRetranslateOpen={confirmRetranslateOpen}
          onRetranslateAll={handleRetranslateAll}
          onSetConfirmRetranslateOpen={setConfirmRetranslateOpen}
          onSetSkipManualEdits={setSkipManualEdits}
          onClearError={() => setError(null)}
          onClearTranslateCount={() => setTranslateCount(0)}
          onClearBulkActionMessage={() => setBulkActionMessage(null)}
        />
      )}
    </Stack>
  );
}
