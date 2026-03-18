import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QASummary } from '@/lib/qa';
import { analyzeQaForEntries, summarizeQaReports } from '@/lib/qa';
import { batchAnalyzeTranslations, syncGlossaryToDeepL } from '@/lib/glossary';
import { cleanupExpiredDrafts, deleteDraft, saveDraft } from '@/lib/storage';
import { serializePOFile, mergePotIntoPo, parseUploadedFile, type POEntry } from '@/lib/po';
import { serializeToI18next } from '@/lib/i18next';
import { trackEvent } from '@/lib/analytics';
import { getActiveTranslationProvider, TRANSLATION_PROVIDER_CAPABILITIES } from '@/lib/translation';
import { createTranslationMemoryScope, isApprovedTranslationEntry } from '@/lib/translation-memory';
import { debugError, debugLog } from '@/lib/debug';
import { useTranslationMemoryStore } from '@/stores';
import type { SourceLanguage, TargetLanguage } from '@/lib/deepl/types';
import type { Glossary } from '@/lib/glossary/types';
import type { FileFormat } from '@/stores';
import type { DownloadInfo, MergeInfo } from './types';

interface UseProjectSyncOptions {
  filename: string | null;
  header: import('@/lib/po').POHeader | null;
  entries: POEntry[];
  sourceFormat: FileFormat;
  projectName: string | null;
  dirtyEntryIds: Set<string>;
  machineTranslatedIds: Set<string>;
  reviewEntries: Map<string, import('@/lib/review').ReviewEntryState>;
  hasUnsavedChanges: boolean;
  markAsSaved: () => void;
  clearGlossaryAnalysis: () => void;
  setGlossaryAnalysisBatch: (
    analyses: Map<string, import('@/lib/glossary/types').GlossaryAnalysisResult>,
  ) => void;
  setQaReports: (reports: Map<string, import('@/lib/qa').QAEntryReport>) => void;
  qaReports: Map<string, import('@/lib/qa').QAEntryReport>;
  mergeEntries: (entries: POEntry[]) => void;
  setIsFromDraft: (value: boolean) => void;
}

export function useProjectSync({
  filename,
  header,
  entries,
  sourceFormat,
  projectName,
  dirtyEntryIds,
  machineTranslatedIds,
  reviewEntries,
  hasUnsavedChanges,
  markAsSaved,
  clearGlossaryAnalysis,
  setGlossaryAnalysisBatch,
  setQaReports,
  qaReports,
  mergeEntries,
  setIsFromDraft,
}: UseProjectSyncOptions) {
  const [translateSourceLang, setTranslateSourceLang] = useState<SourceLanguage | undefined>(
    undefined,
  );
  const [translateTargetLang, setTranslateTargetLang] = useState<TargetLanguage | undefined>(
    undefined,
  );
  const [glossary, setGlossary] = useState<Glossary | null>(null);
  const [deeplGlossaryId, setDeeplGlossaryId] = useState<string | null>(null);
  const [, setGlossaryTermCount] = useState<number>(0);
  const [glossarySyncStatus, setGlossarySyncStatus] = useState<string | null>(null);
  const [glossaryEnforcementEnabled] = useState(true);
  const [downloadSuccess, setDownloadSuccess] = useState<DownloadInfo | null>(null);
  const [mergeSuccess, setMergeSuccess] = useState<MergeInfo | null>(null);
  const [pendingExportFormat, setPendingExportFormat] = useState<FileFormat | null>(null);
  const [lastAutoSave, setLastAutoSave] = useState<number | null>(null);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upsertApprovedEntries = useTranslationMemoryStore((state) => state.upsertApprovedEntries);

  const glossaryLocale = header?.language?.toLowerCase().split('_')[0] || '';
  const targetLanguageForMemory = header?.language ?? translateTargetLang ?? null;
  const translationMemoryScope = useMemo(
    () =>
      targetLanguageForMemory
        ? createTranslationMemoryScope(
            projectName,
            targetLanguageForMemory,
            translateSourceLang ?? null,
          )
        : null,
    [projectName, targetLanguageForMemory, translateSourceLang],
  );
  const qaSummary = useMemo<QASummary>(() => summarizeQaReports(qaReports), [qaReports]);

  const handleGlossaryLoaded = useCallback(
    async (loadedGlossary: Glossary) => {
      setGlossary(loadedGlossary);
      setGlossaryTermCount(loadedGlossary.entries.length);

      trackEvent('glossary_loaded', {
        provider: getActiveTranslationProvider(),
        entries_count: loadedGlossary.entries.length,
      });

      if (entries.length > 0) {
        const analyses = batchAnalyzeTranslations(entries, loadedGlossary);
        clearGlossaryAnalysis();
        setGlossaryAnalysisBatch(analyses);
        setQaReports(analyzeQaForEntries(entries, analyses));
      }

      const provider = getActiveTranslationProvider();
      const capabilities = TRANSLATION_PROVIDER_CAPABILITIES[provider];

      if (capabilities.nativeGlossary) {
        setGlossarySyncStatus('syncing');
        try {
          const glossaryId = await syncGlossaryToDeepL(loadedGlossary, setGlossarySyncStatus);
          setDeeplGlossaryId(glossaryId);
          debugLog('[Glossary] DeepL glossary ID:', glossaryId);
        } catch (error) {
          debugError('[Glossary] Failed to sync to DeepL:', error);
          setGlossarySyncStatus('sync-failed');
        }
      } else {
        setDeeplGlossaryId(null);
        setGlossarySyncStatus('ready');
      }
    },
    [clearGlossaryAnalysis, entries, setGlossaryAnalysisBatch, setQaReports],
  );

  const handleLanguageChange = useCallback(
    (source: SourceLanguage | undefined, target: TargetLanguage) => {
      setTranslateSourceLang(source);
      setTranslateTargetLang(target);
    },
    [],
  );

  // QA & glossary analysis effect
  useEffect(() => {
    if (entries.length === 0) {
      clearGlossaryAnalysis();
      setQaReports(new Map());
      return;
    }

    const timer = setTimeout(() => {
      const analyses = glossary ? batchAnalyzeTranslations(entries, glossary) : new Map();
      clearGlossaryAnalysis();
      if (analyses.size > 0) {
        setGlossaryAnalysisBatch(analyses);
      }
      setQaReports(analyzeQaForEntries(entries, analyses));

      if (translationMemoryScope && entries.some(isApprovedTranslationEntry)) {
        upsertApprovedEntries(translationMemoryScope, entries);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    clearGlossaryAnalysis,
    entries,
    glossary,
    setGlossaryAnalysisBatch,
    setQaReports,
    translationMemoryScope,
    upsertApprovedEntries,
  ]);

  // Auto-save draft effect
  useEffect(() => {
    if (!filename || entries.length === 0 || !hasUnsavedChanges) {
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      const saved = saveDraft({
        filename,
        header,
        entries,
        dirtyEntryIds: Array.from(dirtyEntryIds),
        machineTranslatedIds: Array.from(machineTranslatedIds),
        reviewEntries: Array.from(reviewEntries.entries()),
      });

      if (saved) {
        setLastAutoSave(Date.now());
        debugLog('[Drafts] Auto-saved draft');
      }
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    filename,
    header,
    entries,
    dirtyEntryIds,
    machineTranslatedIds,
    reviewEntries,
    hasUnsavedChanges,
  ]);

  // Cleanup expired drafts on mount
  useEffect(() => {
    cleanupExpiredDrafts();
  }, []);

  const serializedContentForPush = useMemo(() => {
    if (!filename || entries.length === 0) return null;
    if (sourceFormat === 'i18next') {
      return serializeToI18next(entries);
    }
    return serializePOFile(
      {
        filename,
        header: header ?? {},
        entries,
        charset: 'UTF-8',
      },
      { updateRevisionDate: true },
    );
  }, [filename, sourceFormat, header, entries]);

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const performDownloadAs = useCallback(
    (format: FileFormat) => {
      if (!filename || entries.length === 0) return;

      let content: string;
      let downloadFilename: string;
      let mimeType: string;

      if (format === 'i18next') {
        content = serializeToI18next(entries);
        downloadFilename = filename.replace(/\.(po|pot|json)$/i, '.json');
        if (!downloadFilename.endsWith('.json')) downloadFilename += '.json';
        mimeType = 'application/json;charset=utf-8';
      } else {
        content = serializePOFile(
          {
            filename,
            header: header ?? {},
            entries,
            charset: 'UTF-8',
          },
          { updateRevisionDate: true },
        );
        downloadFilename = filename.replace(/\.json$/i, '.po');
        if (!downloadFilename.endsWith('.po') && !downloadFilename.endsWith('.pot')) {
          downloadFilename += '.po';
        }
        mimeType = 'text/x-gettext-translation;charset=utf-8';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = downloadFilename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      trackEvent('file_exported', {
        format: downloadFilename.endsWith('.json') ? 'i18next' : 'po',
        size: blob.size,
      });
      setDownloadSuccess({
        filename: downloadFilename,
        size: formatFileSize(blob.size),
      });
      setTimeout(() => setDownloadSuccess(null), 4000);

      deleteDraft(filename);
      setIsFromDraft(false);
      setLastAutoSave(null);
      markAsSaved();
    },
    [entries, filename, header, markAsSaved, setIsFromDraft],
  );

  const handleDownloadAs = useCallback(
    (format: FileFormat) => {
      if (qaSummary.totalIssues > 0) {
        setPendingExportFormat(format);
        return;
      }

      performDownloadAs(format);
    },
    [performDownloadAs, qaSummary.totalIssues],
  );

  const handleDownload = useCallback(() => {
    handleDownloadAs(sourceFormat);
  }, [handleDownloadAs, sourceFormat]);

  const handlePotUpload = useCallback(
    async (file: File | null) => {
      if (!file || entries.length === 0) return;

      const outcome = await parseUploadedFile(file);

      if (!outcome.ok) {
        return;
      }

      const mergeResult = mergePotIntoPo(entries, outcome.result.file.entries);
      mergeEntries(mergeResult.entries);

      trackEvent('file_merge_completed', {
        new_entries: mergeResult.stats.added,
        total_entries: mergeResult.entries.length,
      });

      setMergeSuccess({
        potFilename: file.name,
        ...mergeResult.stats,
      });

      setTimeout(() => setMergeSuccess(null), 8000);
    },
    [entries, mergeEntries],
  );

  const confirmExportAnyway = useCallback(() => {
    if (pendingExportFormat) {
      performDownloadAs(pendingExportFormat);
    }
    setPendingExportFormat(null);
  }, [pendingExportFormat, performDownloadAs]);

  return {
    translateSourceLang,
    setTranslateSourceLang,
    translateTargetLang,
    setTranslateTargetLang,
    glossary,
    deeplGlossaryId,
    glossarySyncStatus,
    glossaryEnforcementEnabled,
    glossaryLocale,
    translationMemoryScope,
    qaSummary,
    handleGlossaryLoaded,
    handleLanguageChange,
    downloadSuccess,
    setDownloadSuccess,
    mergeSuccess,
    setMergeSuccess,
    pendingExportFormat,
    setPendingExportFormat,
    lastAutoSave,
    setLastAutoSave,
    serializedContentForPush,
    performDownloadAs,
    handleDownloadAs,
    handleDownload,
    handlePotUpload,
    confirmExportAnyway,
  };
}
