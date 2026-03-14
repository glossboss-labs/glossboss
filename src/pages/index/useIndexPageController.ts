import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useComputedColorScheme, useMantineColorScheme, useMantineTheme } from '@mantine/core';
import { useLocalStorage, useMediaQuery } from '@mantine/hooks';
import type {
  EditorHeaderProps,
  EmptyStateProps,
  EncodingInfo,
  WorkspaceMode,
  WordPressProjectOpenRequest,
} from '@/components/editor';
import type { EditorWorkspaceProps } from '@/components/editor';
import type { FeedbackIssueSuccess } from '@/lib/feedback';
import type { Glossary } from '@/lib/glossary/types';
import { batchAnalyzeTranslations, syncGlossaryToDeepL } from '@/lib/glossary';
import { fetchWPGlossary } from '@/lib/glossary/wp-fetcher';
import { serializeToI18next } from '@/lib/i18next';
import {
  mergePotIntoPo,
  serializePOFile,
  parseUploadedFile,
  parseFileContent,
  isSupportedExtension,
  getFileExtension,
  type POEntry,
  type ParseIssue,
} from '@/lib/po';
import { analyzeQaForEntries, summarizeQaReports } from '@/lib/qa';
import type { QASummary } from '@/lib/qa';
import { cleanupExpiredDrafts, deleteDraft, loadDraft, saveDraft } from '@/lib/storage';
import { CONTAINER_WIDTH_KEY, type ContainerWidth } from '@/lib/container-width';
import { getActiveTranslationProvider, TRANSLATION_PROVIDER_CAPABILITIES } from '@/lib/translation';
import { createTranslationMemoryScope, isApprovedTranslationEntry } from '@/lib/translation-memory';
import { debugError, debugLog } from '@/lib/debug';
import type { SourceLanguage, TargetLanguage } from '@/lib/deepl/types';
import { getBundledExamplePo } from '@/lib/example-po';
import {
  detectWordPressProject,
  fetchWordPressTranslationFile,
  type WordPressPluginTranslationTrack,
} from '@/lib/wp-source';
import { useTranslation } from '@/lib/app-language';
import { useSearchParams } from 'react-router';
import type { FileFormat } from '@/stores';
import {
  getEffectiveProjectType,
  getEffectiveRelease,
  getEffectiveSlug,
  useEditorStore,
  useRepoSyncStore,
  useSourceStore,
  useTranslationMemoryStore,
} from '@/stores';
import type { IndexPageBannersProps } from './IndexPageBanners';
import type { IndexPageDialogsProps } from './IndexPageDialogs';
import type { IndexPageNotificationsProps } from './IndexPageNotifications';
import type { DownloadInfo, FeedbackInfo, MergeInfo, PendingDraft } from './types';

const DEV_BRANCH_CHIP_STORAGE_KEY = 'glossboss-dev-branch-chip-enabled';
const SPEECH_ENABLED_KEY = 'glossboss-speech-enabled';
const TRANSLATE_ENABLED_KEY = 'glossboss-translate-enabled';
const WORKSPACE_MODE_KEY = 'glossboss-editor-workspace-mode';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function useIndexPageController() {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const isDevelopment = import.meta.env.DEV;
  const [errors, setErrors] = useState<ParseIssue[]>([]);
  const [warnings, setWarnings] = useState<ParseIssue[]>([]);
  const [showWarnings, setShowWarnings] = useState(false);
  const [encodingInfo, setEncodingInfo] = useState<EncodingInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<DownloadInfo | null>(null);
  const [mergeSuccess, setMergeSuccess] = useState<MergeInfo | null>(null);
  const [qaSummaryOpen, setQaSummaryOpen] = useState(false);
  const [pendingExportFormat, setPendingExportFormat] = useState<FileFormat | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<FeedbackInfo | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isLoadingExample, setIsLoadingExample] = useState(false);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pendingProject, setPendingProject] = useState<WordPressProjectOpenRequest | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [translateSourceLang, setTranslateSourceLang] = useState<SourceLanguage | undefined>(
    undefined,
  );
  const [translateTargetLang, setTranslateTargetLang] = useState<TargetLanguage | undefined>(
    undefined,
  );
  const [glossary, setGlossary] = useState<Glossary | null>(null);
  const [deeplGlossaryId, setDeeplGlossaryId] = useState<string | null>(null);
  const [glossaryTermCount, setGlossaryTermCount] = useState<number>(0);
  const [glossarySyncStatus, setGlossarySyncStatus] = useState<string | null>(null);
  const [glossaryEnforcementEnabled, setGlossaryEnforcementEnabled] = useState(true);
  const [selectedSourceText, setSelectedSourceText] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>(undefined);
  const [branchChipEnabled, setBranchChipEnabled] = useLocalStorage<boolean>({
    key: DEV_BRANCH_CHIP_STORAGE_KEY,
    defaultValue: true,
    getInitialValueInEffect: false,
  });
  const [containerWidth, setContainerWidth] = useLocalStorage<ContainerWidth>({
    key: CONTAINER_WIDTH_KEY,
    defaultValue: 'xl',
    getInitialValueInEffect: false,
  });
  const [speechEnabled, setSpeechEnabled] = useLocalStorage<boolean>({
    key: SPEECH_ENABLED_KEY,
    defaultValue: true,
    getInitialValueInEffect: false,
  });
  const [translateEnabled, setTranslateEnabled] = useLocalStorage<boolean>({
    key: TRANSLATE_ENABLED_KEY,
    defaultValue: true,
    getInitialValueInEffect: false,
  });
  const [workspaceMode, setWorkspaceMode] = useLocalStorage<WorkspaceMode>({
    key: WORKSPACE_MODE_KEY,
    defaultValue: 'edit',
    getInitialValueInEffect: false,
  });
  const [urlPromptOpen, setUrlPromptOpen] = useState(false);
  const [wordpressProjectOpen, setWordpressProjectOpen] = useState(false);
  const [wordpressRefreshOpen, setWordpressRefreshOpen] = useState(false);
  const [repoSyncOpen, setRepoSyncOpen] = useState(false);
  const [saveToCloudOpen, setSaveToCloudOpen] = useState(false);
  const [repoSyncInitialTab, setRepoSyncInitialTab] = useState<
    'connect' | 'browse' | 'push' | undefined
  >(undefined);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [isFromDraft, setIsFromDraft] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<number | null>(null);

  const repoConnection = useRepoSyncStore((state) => state.connection);
  const clearRepoConnection = useRepoSyncStore((state) => state.clearConnection);
  const currentProjectType = useSourceStore((state) => getEffectiveProjectType(state));
  const currentProjectSlug = useSourceStore((state) => getEffectiveSlug(state));
  const currentProjectRelease = useSourceStore((state) => getEffectiveRelease(state));

  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLButtonElement>(null);
  const fileResetRef = useRef<(() => void) | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    filename,
    projectName,
    sourceFormat,
    header,
    entries,
    dirtyEntryIds,
    machineTranslatedIds,
    reviewEntries,
    hasUnsavedChanges,
    loadFile,
    restoreReviewEntries,
    clearEditor,
    markAsSaved,
    setGlossaryAnalysisBatch,
    clearGlossaryAnalysis,
    clearUpstreamDeltaEntries,
    qaReports,
    setQaReports,
    setUpstreamDeltaEntries,
    mergeEntries,
  } = useEditorStore();
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

  const toggleColorScheme = useCallback(() => {
    const oldBg = getComputedStyle(document.body).backgroundColor;
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const overlay = document.createElement('div');
    overlay.className = 'theme-transition-overlay';
    overlay.style.backgroundColor = oldBg;
    document.body.appendChild(overlay);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      overlay.remove();
    };

    overlay.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, 1500);
  }, [computedColorScheme, setColorScheme]);

  const handleGlossaryLoaded = useCallback(
    async (loadedGlossary: Glossary) => {
      setGlossary(loadedGlossary);
      setGlossaryTermCount(loadedGlossary.entries.length);

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

  const handleGlossaryCleared = useCallback(() => {
    setGlossary(null);
    setDeeplGlossaryId(null);
    setGlossaryTermCount(0);
    setGlossarySyncStatus(null);
    clearGlossaryAnalysis();
    setQaReports(analyzeQaForEntries(entries, new Map()));
  }, [clearGlossaryAnalysis, entries, setQaReports]);

  const handleEnforcementChange = useCallback((enabled: boolean) => {
    setGlossaryEnforcementEnabled(enabled);
  }, []);

  const handleForceResync = useCallback(async (glossaryToSync: Glossary) => {
    const provider = getActiveTranslationProvider();
    if (!TRANSLATION_PROVIDER_CAPABILITIES[provider].nativeGlossary) return;

    setGlossarySyncStatus('syncing');

    try {
      const glossaryId = await syncGlossaryToDeepL(glossaryToSync, setGlossarySyncStatus, true);
      setDeeplGlossaryId(glossaryId);
      setGlossaryTermCount(glossaryToSync.entries.length);
      debugLog('[Glossary] Force resync complete, DeepL glossary ID:', glossaryId);
    } catch (error) {
      debugError('[Glossary] Force resync failed:', error);
      setGlossarySyncStatus('sync-failed');
      setGlossaryTermCount(glossaryToSync.entries.length);
    }
  }, []);

  const handleEntrySelect = useCallback((sourceText: string) => {
    setSelectedSourceText(sourceText);
  }, []);

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

  useEffect(() => {
    cleanupExpiredDrafts();
  }, []);

  const handleLanguageChange = useCallback(
    (source: SourceLanguage | undefined, target: TargetLanguage) => {
      setTranslateSourceLang(source);
      setTranslateTargetLang(target);
    },
    [],
  );

  const applyDetectedWordPressProject = useCallback(
    (fileHeader: typeof header, fileName: string) => {
      const detected = fileHeader ? detectWordPressProject(fileHeader, fileName) : null;
      useSourceStore
        .getState()
        .setAutoDetectedProject(
          detected?.type ?? null,
          detected?.slug ?? null,
          detected?.version ?? null,
        );
      if (detected) {
        debugLog(
          '[Source] Auto-detected WordPress project:',
          detected.type,
          detected.slug,
          detected.version,
        );
      }
    },
    [],
  );

  const executeWordPressProjectLoad = useCallback(
    async (request: WordPressProjectOpenRequest) => {
      const { projectType, slug, locale, track, release } = request;
      setErrors([]);
      setWarnings([]);
      setShowWarnings(false);
      setEncodingInfo(null);
      setDragError(null);
      setPendingDraft(null);
      setPendingProject(null);
      setIsFromDraft(false);
      clearUpstreamDeltaEntries();

      const text = await fetchWordPressTranslationFile({ projectType, slug, locale, track });
      const wpFilename = `${slug}-${locale.replaceAll('-', '_')}.po`;
      const outcome = parseFileContent(text, wpFilename);

      if (!outcome.ok) {
        setErrors(outcome.errors);
        throw new Error(t('The WordPress.org translation export could not be parsed.'));
      }

      if (outcome.result.warnings.length > 0) {
        setWarnings(outcome.result.warnings);
        setShowWarnings(true);
      }

      loadFile(outcome.result.file);
      applyDetectedWordPressProject(outcome.result.file.header, wpFilename);
      useSourceStore.getState().setProjectContext(projectType, slug, { release, track });
    },
    [applyDetectedWordPressProject, clearUpstreamDeltaEntries, loadFile, t],
  );

  const handleOpenWordPressProject = useCallback(
    async (request: WordPressProjectOpenRequest) => {
      if (filename) {
        setPendingProject(request);
        return;
      }
      await executeWordPressProjectLoad(request);
    },
    [executeWordPressProjectLoad, filename],
  );

  const handleApplyWordPressRefresh = useCallback(
    async ({
      mergedEntries,
      deltaEntryIds,
      release,
      track,
      summary,
      refreshGlossary,
    }: {
      mergedEntries: POEntry[];
      deltaEntryIds: string[];
      release: string | null;
      track: WordPressPluginTranslationTrack;
      summary: { added: number; removed: number; changed: number; metaUpdated: number };
      refreshGlossary: boolean;
    }) => {
      mergeEntries(mergedEntries);
      setUpstreamDeltaEntries(deltaEntryIds);
      if (deltaEntryIds.length > 0) {
        useEditorStore.getState().setFilterState('upstream-delta', 'include');
      }
      useSourceStore.getState().setSelectedRelease(release);
      useSourceStore.getState().setPluginTranslationTrack(track);
      setWorkspaceMode('edit');
      setMergeSuccess({
        potFilename: t('WordPress.org refresh'),
        kept: mergedEntries.length - summary.added,
        added: summary.added,
        removed: summary.removed,
        updatedMeta: summary.metaUpdated,
      });

      if (refreshGlossary && glossaryLocale) {
        const result = await fetchWPGlossary(glossaryLocale, true);
        if (result.glossary) {
          await handleGlossaryLoaded(result.glossary);
        }
      }
    },
    [
      glossaryLocale,
      handleGlossaryLoaded,
      mergeEntries,
      setUpstreamDeltaEntries,
      setWorkspaceMode,
      t,
    ],
  );

  const handleFileUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;

      setErrors([]);
      setWarnings([]);
      setEncodingInfo(null);
      setDragError(null);
      setIsFromDraft(false);
      clearUpstreamDeltaEntries();

      const outcome = await parseUploadedFile(file);

      if (!outcome.ok) {
        setErrors(outcome.errors);
        return;
      }

      const { file: poFile, format, encoding, warnings } = outcome.result;

      if (encoding) {
        setEncodingInfo(encoding);
        debugLog(
          `[Encoding] Detected: ${encoding.encoding} (${encoding.confidence} confidence, via ${encoding.method})`,
        );
      }

      if (warnings.length > 0) {
        setWarnings(warnings);
        setShowWarnings(true);
      }

      if (format === 'i18next') {
        loadFile(poFile, 'i18next');
        debugLog(`[i18next] Parsed ${poFile.entries.length} entries from ${file.name}`);
      } else {
        const existingDraft = loadDraft(file.name);

        if (existingDraft && existingDraft.dirtyEntryIds.length > 0) {
          setPendingDraft({ draft: existingDraft, filename: file.name });
        }

        loadFile(poFile);
        applyDetectedWordPressProject(poFile.header, file.name);
      }
    },
    [applyDetectedWordPressProject, clearUpstreamDeltaEntries, loadFile],
  );

  const handleRepoFileLoaded = useCallback(
    (content: string, repoFilename: string) => {
      setErrors([]);
      setWarnings([]);
      setEncodingInfo(null);
      setDragError(null);
      setIsFromDraft(false);

      const outcome = parseFileContent(content, repoFilename);

      if (!outcome.ok) {
        setErrors(outcome.errors);
        return;
      }

      const { file: poFile, format, warnings } = outcome.result;

      if (warnings.length > 0) {
        setWarnings(warnings);
        setShowWarnings(true);
      }

      loadFile(poFile, format === 'i18next' ? 'i18next' : undefined);

      if (format !== 'i18next') {
        applyDetectedWordPressProject(poFile.header, repoFilename);
      }
    },
    [applyDetectedWordPressProject, loadFile],
  );

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

  const handleLoadExamplePo = useCallback(() => {
    setIsLoadingExample(true);
    setErrors([]);
    setWarnings([]);
    setShowWarnings(false);
    setEncodingInfo(null);
    setDragError(null);
    setPendingDraft(null);
    setIsFromDraft(false);
    clearUpstreamDeltaEntries();

    try {
      const examplePo = getBundledExamplePo();
      const outcome = parseFileContent(examplePo.content, examplePo.filename);

      if (!outcome.ok) {
        setErrors(outcome.errors);
        return;
      }

      if (outcome.result.warnings.length > 0) {
        setWarnings(outcome.result.warnings);
        setShowWarnings(true);
      }

      loadFile(outcome.result.file);
      applyDetectedWordPressProject(outcome.result.file.header, outcome.result.file.filename);
    } finally {
      setIsLoadingExample(false);
    }
  }, [applyDetectedWordPressProject, clearUpstreamDeltaEntries, loadFile]);

  const executeUrlLoad = useCallback(
    async (url: string) => {
      setIsLoadingUrl(true);
      setErrors([]);
      setWarnings([]);
      setShowWarnings(false);
      setEncodingInfo(null);
      setDragError(null);
      setPendingDraft(null);
      setIsFromDraft(false);
      setPendingUrl(null);
      clearUpstreamDeltaEntries();

      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 10_000);

        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();

        let name = 'remote.po';
        try {
          const last = new URL(url).pathname.split('/').filter(Boolean).pop();
          if (last && /\.(po|pot|json)$/i.test(last)) name = last;
        } catch {
          // Keep default filename when the URL is malformed.
        }

        const outcome = parseFileContent(text, name);

        if (!outcome.ok) {
          setErrors(outcome.errors);
          return;
        }

        const { file: poFile, format, warnings } = outcome.result;

        if (warnings.length > 0) {
          setWarnings(warnings);
          setShowWarnings(true);
        }

        loadFile(poFile, format === 'i18next' ? 'i18next' : undefined);

        if (format !== 'i18next') {
          applyDetectedWordPressProject(poFile.header, name);
        }

        setUrlInput('');
      } catch (error) {
        const message =
          error instanceof DOMException && error.name === 'AbortError'
            ? t('Request timed out. Try downloading the file and uploading it directly.')
            : error instanceof TypeError
              ? t(
                  'Could not fetch the file. The server may not allow cross-origin requests. Try downloading the file and uploading it directly.',
                )
              : error instanceof Error
                ? error.message
                : t('Unknown error');

        setErrors([{ severity: 'error', code: 'INVALID_SYNTAX', message }]);
      } finally {
        clearTimeout(timeout);
        setIsLoadingUrl(false);
      }
    },
    [applyDetectedWordPressProject, clearUpstreamDeltaEntries, loadFile, t],
  );

  const handleLoadFromUrl = useCallback(
    (url: string) => {
      if (!url.startsWith('https://')) {
        setErrors([
          {
            severity: 'error',
            code: 'INVALID_SYNTAX',
            message: t('The URL must start with https://'),
          },
        ]);
        return;
      }

      if (filename) {
        setPendingUrl(url);
        return;
      }

      void executeUrlLoad(url);
    },
    [executeUrlLoad, filename, t],
  );

  useEffect(() => {
    const urlParam = searchParams.get('url');
    if (urlParam) {
      setSearchParams({}, { replace: true });
      void handleLoadFromUrl(urlParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestoreDraft = useCallback(() => {
    if (!pendingDraft) return;

    const restoredFile = {
      filename: pendingDraft.draft.filename,
      header: pendingDraft.draft.header ?? {},
      entries: pendingDraft.draft.entries,
      charset: 'UTF-8' as const,
    };

    loadFile(restoredFile);
    try {
      restoreReviewEntries(new Map(pendingDraft.draft.reviewEntries ?? []));
    } catch {
      debugLog('[Drafts] Failed to restore reviewEntries, using empty map');
      restoreReviewEntries(new Map());
    }
    setIsFromDraft(true);
    setPendingDraft(null);

    debugLog('[Drafts] Restored from draft');
  }, [loadFile, pendingDraft, restoreReviewEntries]);

  const handleOpenSettings = useCallback((tab?: string) => {
    setSettingsInitialTab(typeof tab === 'string' ? tab : undefined);
    setSettingsOpen(true);
  }, []);

  const handleOpenFeedback = useCallback(() => {
    setFeedbackOpen(true);
  }, []);

  const handleDiscardDraft = useCallback(() => {
    if (pendingDraft) {
      deleteDraft(pendingDraft.filename);
    }
    setPendingDraft(null);
    setIsFromDraft(false);
    debugLog('[Drafts] Discarded draft, using fresh file');
  }, [pendingDraft]);

  const handleDragEnter = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;

    if (event.dataTransfer?.types.includes('Files')) {
      setIsDragging(true);
      setDragError(null);
    }
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current -= 1;

    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      setIsDragging(false);
      dragCounterRef.current = 0;

      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) {
        setDragError(t('No file was dropped'));
        return;
      }

      if (files.length > 1) {
        setDragError(t('Please drop only one file at a time'));
        return;
      }

      const file = files[0];
      const ext = getFileExtension(file.name);

      if (!isSupportedExtension(ext)) {
        setDragError(
          t('Invalid file type: .{{ext}}. Please drop a .po, .pot, or .json file.', { ext }),
        );
        return;
      }

      void handleFileUpload(file);
    },
    [handleFileUpload, t],
  );

  useEffect(() => {
    const handleWindowDragEnd = () => {
      setIsDragging(false);
      dragCounterRef.current = 0;
    };

    window.addEventListener('dragend', handleWindowDragEnd);
    return () => window.removeEventListener('dragend', handleWindowDragEnd);
  }, []);

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
    [entries, filename, header, markAsSaved],
  );

  const handleDownloadAs = useCallback(
    (format: FileFormat) => {
      if (qaSummary.totalIssues > 0) {
        setPendingExportFormat(format);
        setQaSummaryOpen(true);
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

      try {
        const outcome = await parseUploadedFile(file);

        if (!outcome.ok) {
          setErrors(outcome.errors);
          return;
        }

        const mergeResult = mergePotIntoPo(entries, outcome.result.file.entries);
        mergeEntries(mergeResult.entries);

        setMergeSuccess({
          potFilename: file.name,
          ...mergeResult.stats,
        });

        setTimeout(() => setMergeSuccess(null), 8000);
      } catch (error) {
        setErrors([
          {
            severity: 'error',
            code: 'INVALID_SYNTAX',
            message: error instanceof Error ? error.message : t('Failed to parse POT file'),
          },
        ]);
      }
    },
    [entries, mergeEntries, t],
  );

  const handleClear = useCallback(() => {
    if (filename) {
      deleteDraft(filename);
    }

    clearEditor();
    clearUpstreamDeltaEntries();
    useSourceStore.getState().clearSource();
    setErrors([]);
    setWarnings([]);
    setEncodingInfo(null);
    setDragError(null);
    setConfirmClearOpen(false);
    setPendingDraft(null);
    setIsFromDraft(false);
    setLastAutoSave(null);
    setTranslateSourceLang(undefined);
    setTranslateTargetLang(undefined);
    clearRepoConnection();
  }, [clearEditor, clearRepoConnection, clearUpstreamDeltaEntries, filename]);

  const handleClearClick = useCallback(() => {
    if (hasUnsavedChanges) {
      setConfirmClearOpen(true);
    } else {
      handleClear();
    }
  }, [handleClear, hasUnsavedChanges]);

  const handleEmptyStateClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const openUrlPrompt = useCallback(() => {
    setUrlPromptOpen(true);
  }, []);

  const closeUrlPrompt = useCallback(() => {
    setUrlPromptOpen(false);
  }, []);

  const openWordPressProjectModal = useCallback(() => {
    setWordpressProjectOpen(true);
  }, []);

  const closeWordPressProjectModal = useCallback(() => {
    setWordpressProjectOpen(false);
  }, []);

  const openWordPressRefreshModal = useCallback(() => {
    setWordpressRefreshOpen(true);
  }, []);

  const closeWordPressRefreshModal = useCallback(() => {
    setWordpressRefreshOpen(false);
  }, []);

  const openRepoSyncPush = useCallback(() => {
    setRepoSyncInitialTab('push');
    setRepoSyncOpen(true);
  }, []);

  const openRepoSyncConnect = useCallback(() => {
    setRepoSyncInitialTab('connect');
    setRepoSyncOpen(true);
  }, []);

  const openRepoSyncConnectOrPush = useCallback(() => {
    setRepoSyncInitialTab(repoConnection ? 'push' : 'connect');
    setRepoSyncOpen(true);
  }, [repoConnection]);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setSettingsInitialTab(undefined);
  }, []);

  const closeRepoSync = useCallback(() => {
    setRepoSyncOpen(false);
    setRepoSyncInitialTab(undefined);
  }, []);

  const closeQaSummary = useCallback(() => {
    setQaSummaryOpen(false);
    setPendingExportFormat(null);
  }, []);

  const confirmPendingUrl = useCallback(() => {
    if (pendingUrl) {
      void executeUrlLoad(pendingUrl);
    }
  }, [executeUrlLoad, pendingUrl]);

  const confirmPendingProject = useCallback(() => {
    if (!pendingProject) return;

    void executeWordPressProjectLoad(pendingProject).catch((error) => {
      setErrors([
        {
          severity: 'error',
          code: 'INVALID_SYNTAX',
          message:
            error instanceof Error ? error.message : t('Failed to open the WordPress.org project.'),
        },
      ]);
    });
  }, [executeWordPressProjectLoad, pendingProject, t]);

  const confirmExportAnyway = useCallback(() => {
    if (pendingExportFormat) {
      performDownloadAs(pendingExportFormat);
    }
    setQaSummaryOpen(false);
    setPendingExportFormat(null);
  }, [pendingExportFormat, performDownloadAs]);

  const handleFeedbackSubmitted = useCallback((result: FeedbackIssueSuccess) => {
    setFeedbackSuccess({ issueNumber: result.issueNumber, issueUrl: result.issueUrl });
    setFeedbackError(null);
    window.setTimeout(() => setFeedbackSuccess(null), 5000);
  }, []);

  const handleFeedbackSubmitError = useCallback((message: string) => {
    setFeedbackError(message);
    window.setTimeout(() => setFeedbackError(null), 6000);
  }, []);

  const headerProps: EditorHeaderProps = {
    onFileUpload: handleFileUpload,
    fileInputRef,
    fileResetRef,
    filename,
    hasUnsavedChanges,
    sourceFormat,
    onDownload: handleDownload,
    onDownloadAs: handleDownloadAs,
    onPotUpload: handlePotUpload,
    repoConnection,
    onPushToRepo: openRepoSyncPush,
    isMobile,
    onOpenFeedback: handleOpenFeedback,
    onToggleColorScheme: toggleColorScheme,
    onOpenSettings: handleOpenSettings,
    onLoadFromUrl: openUrlPrompt,
    onOpenWordPressProject: openWordPressProjectModal,
    onRefreshWordPress:
      currentProjectType && currentProjectSlug && filename ? openWordPressRefreshModal : undefined,
    onOpenRepoSync: openRepoSyncConnectOrPush,
    onClearClick: handleClearClick,
    onSaveToCloud: filename ? () => setSaveToCloudOpen(true) : undefined,
  };

  const workspaceProps: EditorWorkspaceProps | null = filename
    ? {
        workspaceMode,
        onWorkspaceModeChange: setWorkspaceMode,
        encodingInfo,
        currentProjectType,
        currentProjectSlug,
        currentProjectRelease,
        onRefreshWordPress: openWordPressRefreshModal,
        onLanguageChange: handleLanguageChange,
        deeplGlossaryId: glossaryEnforcementEnabled ? deeplGlossaryId : null,
        glossary,
        glossaryEnforcementEnabled,
        translateEnabled,
        glossarySyncStatus,
        targetLang: translateTargetLang,
        sourceLang: translateSourceLang,
        speechEnabled,
        onEntrySelect: handleEntrySelect,
      }
    : null;

  const emptyStateProps: EmptyStateProps = {
    onFileClick: handleEmptyStateClick,
    urlInput,
    onUrlInputChange: setUrlInput,
    isLoadingUrl,
    onLoadFromUrl: handleLoadFromUrl,
    onOpenWordPressProject: openWordPressProjectModal,
    onOpenRepoSync: openRepoSyncConnect,
    isLoadingExample,
    onLoadExamplePo: handleLoadExamplePo,
  };

  const notificationsProps: IndexPageNotificationsProps = {
    isDragging,
    downloadSuccess,
    onCloseDownloadSuccess: () => setDownloadSuccess(null),
    mergeSuccess,
    onCloseMergeSuccess: () => setMergeSuccess(null),
    feedbackSuccess,
    onCloseFeedbackSuccess: () => setFeedbackSuccess(null),
    feedbackError,
    onCloseFeedbackError: () => setFeedbackError(null),
  };

  const bannersProps: IndexPageBannersProps = {
    dragError,
    onCloseDragError: () => setDragError(null),
    errors,
    onCloseErrors: () => setErrors([]),
    warnings,
    showWarnings,
    onCloseWarnings: () => setShowWarnings(false),
    pendingDraft,
    onRestoreDraft: handleRestoreDraft,
    onDiscardDraft: handleDiscardDraft,
    hasFileLoaded: Boolean(filename),
    isFromDraft,
    lastAutoSave,
    repoConnection,
    onOpenRepoPush: openRepoSyncPush,
  };

  const dialogsProps: IndexPageDialogsProps = {
    confirmClearOpen,
    onCloseConfirmClear: () => setConfirmClearOpen(false),
    onConfirmClear: handleClear,
    pendingUrl,
    onClosePendingUrl: () => setPendingUrl(null),
    onConfirmPendingUrl: confirmPendingUrl,
    pendingProject,
    onClosePendingProject: () => setPendingProject(null),
    onConfirmPendingProject: confirmPendingProject,
    urlPromptOpen,
    onCloseUrlPrompt: closeUrlPrompt,
    onSubmitUrlPrompt: handleLoadFromUrl,
    wordpressProjectOpen,
    onCloseWordPressProject: closeWordPressProjectModal,
    initialLocale: glossaryLocale,
    onOpenWordPressProject: handleOpenWordPressProject,
    canRefreshWordPress: Boolean(currentProjectType && currentProjectSlug),
    wordpressRefreshOpen,
    onCloseWordPressRefresh: closeWordPressRefreshModal,
    currentProjectType,
    currentProjectSlug,
    currentEntries: entries,
    currentProjectRelease,
    onApplyWordPressRefresh: handleApplyWordPressRefresh,
    settingsOpen,
    onCloseSettings: closeSettings,
    settingsInitialTab,
    glossary,
    glossarySyncStatus,
    deeplGlossaryId,
    glossaryTermCount,
    selectedSourceText,
    branchChipEnabled,
    onBranchChipEnabledChange: setBranchChipEnabled,
    containerWidth,
    onContainerWidthChange: setContainerWidth,
    speechEnabled,
    onSpeechEnabledChange: setSpeechEnabled,
    translateEnabled,
    onTranslateEnabledChange: setTranslateEnabled,
    onGlossaryLoaded: handleGlossaryLoaded,
    onGlossaryCleared: handleGlossaryCleared,
    onEnforcementChange: handleEnforcementChange,
    onForceResync: handleForceResync,
    repoSyncOpen,
    onCloseRepoSync: closeRepoSync,
    onRepoFileLoaded: handleRepoFileLoaded,
    serializedContentForPush,
    repoSyncInitialTab,
    qaSummaryOpen,
    onCloseQaSummary: closeQaSummary,
    qaSummary,
    pendingExportFormat,
    onConfirmExportAnyway: confirmExportAnyway,
    feedbackOpen,
    onCloseFeedback: () => setFeedbackOpen(false),
    currentFilename: filename,
    onFeedbackSubmitted: handleFeedbackSubmitted,
    onFeedbackSubmitError: handleFeedbackSubmitError,
    saveToCloudOpen,
    onCloseSaveToCloud: () => setSaveToCloudOpen(false),
  };

  return {
    containerWidth,
    dragAreaProps: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
    headerProps,
    workspaceProps,
    emptyStateProps,
    notificationsProps,
    bannersProps,
    dialogsProps,
    showBranchChip: isDevelopment && branchChipEnabled,
  };
}
