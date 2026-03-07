/**
 * Translate Toolbar Component
 *
 * Language selection and bulk translation controls with safeguards.
 * Integrates with DeepL via secure edge function.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Paper,
  Group,
  Select,
  Button,
  Text,
  Progress,
  Stack,
  Alert,
  Checkbox,
  Tooltip,
} from '@mantine/core';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, AlertCircle, Square, RefreshCw, ShieldAlert, Key } from 'lucide-react';
import { useEditorStore } from '@/stores';
import { getDeepLClient, hasUserApiKey } from '@/lib/deepl';
import { ConfirmModal } from '@/components/ui';
import { slideUpVariants, buttonStates } from '@/lib/motion';
import type { TargetLanguage, SourceLanguage } from '@/lib/deepl/types';

const MotionDiv = motion.div;
const MotionStack = motion.create(Stack);

/** DeepL supported languages */
const SOURCE_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Auto-detect' },
  { value: 'BG', label: 'Bulgarian' },
  { value: 'CS', label: 'Czech' },
  { value: 'DA', label: 'Danish' },
  { value: 'DE', label: 'German' },
  { value: 'EL', label: 'Greek' },
  { value: 'EN', label: 'English' },
  { value: 'ES', label: 'Spanish' },
  { value: 'ET', label: 'Estonian' },
  { value: 'FI', label: 'Finnish' },
  { value: 'FR', label: 'French' },
  { value: 'HU', label: 'Hungarian' },
  { value: 'ID', label: 'Indonesian' },
  { value: 'IT', label: 'Italian' },
  { value: 'JA', label: 'Japanese' },
  { value: 'KO', label: 'Korean' },
  { value: 'LT', label: 'Lithuanian' },
  { value: 'LV', label: 'Latvian' },
  { value: 'NB', label: 'Norwegian' },
  { value: 'NL', label: 'Dutch' },
  { value: 'PL', label: 'Polish' },
  { value: 'PT', label: 'Portuguese' },
  { value: 'RO', label: 'Romanian' },
  { value: 'RU', label: 'Russian' },
  { value: 'SK', label: 'Slovak' },
  { value: 'SL', label: 'Slovenian' },
  { value: 'SV', label: 'Swedish' },
  { value: 'TR', label: 'Turkish' },
  { value: 'UK', label: 'Ukrainian' },
  { value: 'ZH', label: 'Chinese' },
];

const TARGET_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: 'BG', label: 'Bulgarian' },
  { value: 'CS', label: 'Czech' },
  { value: 'DA', label: 'Danish' },
  { value: 'DE', label: 'German' },
  { value: 'EL', label: 'Greek' },
  { value: 'EN-GB', label: 'English (UK)' },
  { value: 'EN-US', label: 'English (US)' },
  { value: 'ES', label: 'Spanish' },
  { value: 'ET', label: 'Estonian' },
  { value: 'FI', label: 'Finnish' },
  { value: 'FR', label: 'French' },
  { value: 'HU', label: 'Hungarian' },
  { value: 'ID', label: 'Indonesian' },
  { value: 'IT', label: 'Italian' },
  { value: 'JA', label: 'Japanese' },
  { value: 'KO', label: 'Korean' },
  { value: 'LT', label: 'Lithuanian' },
  { value: 'LV', label: 'Latvian' },
  { value: 'NB', label: 'Norwegian' },
  { value: 'NL', label: 'Dutch' },
  { value: 'PL', label: 'Polish' },
  { value: 'PT-BR', label: 'Portuguese (Brazil)' },
  { value: 'PT-PT', label: 'Portuguese (Portugal)' },
  { value: 'RO', label: 'Romanian' },
  { value: 'RU', label: 'Russian' },
  { value: 'SK', label: 'Slovak' },
  { value: 'SL', label: 'Slovenian' },
  { value: 'SV', label: 'Swedish' },
  { value: 'TR', label: 'Turkish' },
  { value: 'UK', label: 'Ukrainian' },
  { value: 'ZH', label: 'Chinese' },
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
}

export function TranslateToolbar({ onLanguageChange, deeplGlossaryId }: TranslateToolbarProps) {
  const {
    header,
    entries,
    updateEntry,
    updateEntryPlural,
    markAsMachineTranslated,
    manualEditIds,
    machineTranslatedIds,
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

  // Find untranslated entries
  const untranslatedEntries = useMemo(
    () =>
      entries.filter((e) => {
        if (!e.msgid.trim()) return false;
        if (e.msgidPlural) {
          const plurals = e.msgstrPlural ?? [];
          return plurals.length < 2 || plurals.some((p) => !p.trim());
        }
        return !e.msgstr.trim();
      }),
    [entries],
  );

  // All translatable entries (for retranslate all)
  const allTranslatableEntries = useMemo(() => entries.filter((e) => e.msgid.trim()), [entries]);

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
    async (entriesToTranslate: typeof entries, overwriteAll: boolean) => {
      if (!targetLang || entriesToTranslate.length === 0) return;

      setIsTranslating(true);
      setIsRetranslateMode(overwriteAll);
      setError(null);
      setProgress(0);
      setTranslateCount(0);
      setFailedCount(0);
      cancelRef.current = false;
      batchCountRef.current = 0;

      const client = getDeepLClient();
      let completed = 0;
      let failed = 0;

      try {
        interface TranslationJob {
          entryId: string;
          text: string;
          isPlural: boolean;
          pluralIndex?: number;
          originalPluralForms?: string[];
        }

        const jobs: TranslationJob[] = [];

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

            displayForms.forEach((form, index) => {
              if (overwriteAll || !form.trim()) {
                jobs.push({
                  entryId: entry.id,
                  text: index === 0 ? entry.msgid : entry.msgidPlural!,
                  isPlural: true,
                  pluralIndex: index,
                  originalPluralForms: displayForms,
                });
              }
            });
          } else {
            if (overwriteAll || !entry.msgstr.trim()) {
              jobs.push({
                entryId: entry.id,
                text: entry.msgid,
                isPlural: false,
              });
            }
          }
        }

        const totalJobs = jobs.length;
        const batchSize = 10;

        for (let i = 0; i < jobs.length; i += batchSize) {
          if (cancelRef.current) break;

          const batch = jobs.slice(i, i + batchSize);
          const texts = batch.map((j) => j.text);

          try {
            const translations = await client.translateBatch(
              texts,
              targetLang as TargetLanguage,
              sourceLang ? (sourceLang as SourceLanguage) : undefined,
              deeplGlossaryId ?? undefined,
            );

            batch.forEach((job, idx) => {
              if (translations[idx]) {
                if (job.isPlural && job.pluralIndex !== undefined) {
                  const newPlurals = [...(job.originalPluralForms || ['', ''])];
                  newPlurals[job.pluralIndex] = translations[idx];
                  updateEntryPlural(job.entryId, newPlurals);
                } else {
                  updateEntry(job.entryId, translations[idx]);
                }
                markAsMachineTranslated(job.entryId);
              }
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
          setError(`${failed} translations failed`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Translation failed');
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
    ],
  );

  const handleBulkTranslate = useCallback(() => {
    handleTranslate(untranslatedEntries, false);
  }, [handleTranslate, untranslatedEntries]);

  const handleRetranslateAll = useCallback(() => {
    setConfirmRetranslateOpen(false);
    handleTranslate(allTranslatableEntries, true);
  }, [handleTranslate, allTranslatableEntries]);

  if (!entries.length) return null;

  // Count already translated entries
  const translatedCount = allTranslatableEntries.length - untranslatedEntries.length;

  return (
    <Paper p="sm" withBorder>
      {/* Retranslate confirmation modal */}
      <ConfirmModal
        opened={confirmRetranslateOpen}
        onClose={() => setConfirmRetranslateOpen(false)}
        onConfirm={handleRetranslateAll}
        title="Retranslate all entries?"
        message={`This will overwrite ${translatedCount} existing translations with new machine translations.`}
        detail={
          manualEditCount > 0 && skipManualEdits
            ? `${manualEditCount} manually edited entries will be skipped.`
            : manualEditCount > 0
              ? `⚠️ ${manualEditCount} manually edited entries will be overwritten!`
              : 'Consider downloading a backup first.'
        }
        confirmLabel="Retranslate All"
        confirmColor="orange"
        variant={manualEditCount > 0 && !skipManualEdits ? 'danger' : 'warning'}
      />

      <Stack gap="sm">
        {/* API Key Warning */}
        <AnimatePresence>
          {!hasApiKey && (
            <MotionDiv variants={slideUpVariants} initial="hidden" animate="visible" exit="exit">
              <Alert color="yellow" icon={<Key size={16} />}>
                <Text size="sm">Add your DeepL API key in Settings to enable translations.</Text>
              </Alert>
            </MotionDiv>
          )}
        </AnimatePresence>

        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Group gap="sm" align="flex-end">
            <Select
              label="Source language"
              description="Leave empty for auto-detect"
              data={SOURCE_LANGUAGES}
              value={sourceLang}
              onChange={handleSourceChange}
              placeholder="Auto-detect"
              searchable
              clearable
              w={180}
              size="sm"
              disabled={!hasApiKey}
            />

            <Text c="dimmed" pb={8}>
              →
            </Text>

            <Select
              label="Target language"
              description={inferredTarget ? `Detected: ${inferredTarget}` : 'Select target'}
              data={TARGET_LANGUAGES}
              value={targetLang}
              onChange={handleTargetChange}
              placeholder="Select target..."
              searchable
              required
              w={180}
              size="sm"
              disabled={!hasApiKey}
            />
          </Group>

          <Group gap="sm">
            <AnimatePresence mode="wait">
              {isTranslating ? (
                <MotionDiv
                  key="cancel"
                  variants={slideUpVariants}
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
                      Cancel
                    </Button>
                  </motion.div>
                </MotionDiv>
              ) : (
                <MotionDiv
                  key="actions"
                  variants={slideUpVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Group gap="sm">
                    <Tooltip
                      label={
                        manualEditCount > 0
                          ? `${manualEditCount} manual edits will be ${skipManualEdits ? 'skipped' : 'overwritten'}`
                          : 'Retranslate all entries'
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
                          Retranslate All
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
                        Translate {untranslatedEntries.length} untranslated
                      </Button>
                    </motion.div>
                  </Group>
                </MotionDiv>
              )}
            </AnimatePresence>
          </Group>
        </Group>

        {/* Skip manual edits option */}
        <AnimatePresence>
          {manualEditCount > 0 && !isTranslating && (
            <MotionDiv variants={slideUpVariants} initial="hidden" animate="visible" exit="exit">
              <Group gap="xs">
                <Checkbox
                  size="xs"
                  checked={skipManualEdits}
                  onChange={(e) => setSkipManualEdits(e.currentTarget.checked)}
                  label={
                    <Group gap={4}>
                      <ShieldAlert size={14} />
                      <Text size="xs">
                        Protect {manualEditCount} manual edits from bulk translation
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
              variants={slideUpVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {isRetranslateMode ? 'Retranslating' : 'Translating'}... {translateCount}
                  {failedCount > 0 ? ` (${failedCount} failed)` : ''}
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
              />
            </MotionStack>
          )}
        </AnimatePresence>

        {/* Error display */}
        <AnimatePresence>
          {error && !isTranslating && (
            <MotionDiv variants={slideUpVariants} initial="hidden" animate="visible" exit="exit">
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

        {/* Success message */}
        <AnimatePresence>
          {!isTranslating && translateCount > 0 && !error && (
            <MotionDiv variants={slideUpVariants} initial="hidden" animate="visible" exit="exit">
              <Alert color="green" withCloseButton onClose={() => setTranslateCount(0)}>
                Successfully translated {translateCount} entries
              </Alert>
            </MotionDiv>
          )}
        </AnimatePresence>
      </Stack>
    </Paper>
  );
}
