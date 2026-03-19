import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from '@mantine/hooks';
import type { EditorHeaderProps, EmptyStateProps, WorkspaceMode } from '@/components/editor';
import type { EditorWorkspaceProps } from '@/components/editor';
import { deleteDraft } from '@/lib/storage';
import { useTranslation } from '@/lib/app-language';
import { getStorageAdapter } from '@/lib/cloud';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { hasKeyBasedMsgids } from '@/lib/po';
import { debugLog } from '@/lib/debug';
import {
  getEffectiveProjectType,
  getEffectiveRelease,
  getEffectiveSlug,
  useEditorStore,
  useRepoSyncStore,
  useSourceStore,
} from '@/stores';
import { CONTAINER_WIDTH_KEY, type ContainerWidth } from '@/lib/container-width';
import {
  SPEECH_ENABLED_KEY,
  TRANSLATE_ENABLED_KEY,
  WORKSPACE_MODE_KEY,
  API_KEY_SETUP_PROMPTED_KEY,
} from '@/lib/constants/storage-keys';
import { getActiveTranslationProvider, hasProviderCredentials } from '@/lib/translation';
import type { IndexPageBannersProps } from './IndexPageBanners';
import type { IndexPageDialogsProps } from './IndexPageDialogs';
import type { IndexPageNotificationsProps } from './IndexPageNotifications';
import { useFileLoader } from './useFileLoader';
import { useProjectSync } from './useProjectSync';
import { useEditorDialogs } from './useEditorDialogs';
import { buildTranslationSettingsHref } from '@/lib/settings/navigation';

interface IndexPageControllerOptions {
  /** When true, disables editing actions (viewer role in cloud projects). */
  readOnly?: boolean;
}

export function useIndexPageController(options?: IndexPageControllerOptions) {
  const readOnly = options?.readOnly ?? false;
  const { t } = useTranslation();
  const [, setSelectedSourceText] = useState<string | null>(null);
  const settingsNavigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [containerWidth] = useLocalStorage<ContainerWidth>({
    key: CONTAINER_WIDTH_KEY,
    defaultValue: 'xl',
    getInitialValueInEffect: false,
  });
  const [speechEnabled] = useLocalStorage<boolean>({
    key: SPEECH_ENABLED_KEY,
    defaultValue: true,
    getInitialValueInEffect: false,
  });
  const [translateEnabled] = useLocalStorage<boolean>({
    key: TRANSLATE_ENABLED_KEY,
    defaultValue: true,
    getInitialValueInEffect: false,
  });
  const [workspaceMode, setWorkspaceMode] = useLocalStorage<WorkspaceMode>({
    key: WORKSPACE_MODE_KEY,
    defaultValue: 'edit',
    getInitialValueInEffect: false,
  });

  const clearRepoConnection = useRepoSyncStore((state) => state.clearConnection);
  const currentProjectType = useSourceStore((state) => getEffectiveProjectType(state));
  const currentProjectSlug = useSourceStore((state) => getEffectiveSlug(state));
  const currentProjectRelease = useSourceStore((state) => getEffectiveRelease(state));

  const fileInputRef = useRef<HTMLButtonElement>(null);
  const fileResetRef = useRef<(() => void) | null>(null);

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
    mergeEntries,
    sourceFilename,
    clearSourceFile,
  } = useEditorStore();

  const showSourceFileOption = useMemo(() => hasKeyBasedMsgids(entries), [entries]);

  // --- Project sync (glossary, TM, QA, downloads, drafts) ---
  const sync = useProjectSync({
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
    setIsFromDraft: (value: boolean) => fileLoader.setIsFromDraft(value),
  });

  // --- File loading (upload, URL, drag-drop, WP) ---
  const fileLoader = useFileLoader({
    filename,
    entries,
    glossaryLocale: sync.glossaryLocale,
    handleGlossaryLoaded: sync.handleGlossaryLoaded,
    setWorkspaceMode,
  });

  // --- Dialog state ---
  const dialogs = useEditorDialogs();

  // Handle URL param on mount
  useEffect(() => {
    const urlParam = searchParams.get('url');
    if (urlParam) {
      setSearchParams({}, { replace: true });
      void fileLoader.handleLoadFromUrl(urlParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag end listener
  useEffect(() => {
    const handleWindowDragEnd = () => {
      // Reset drag state when drag ends outside window
    };

    window.addEventListener('dragend', handleWindowDragEnd);
    return () => window.removeEventListener('dragend', handleWindowDragEnd);
  }, []);

  const handleEntrySelect = useCallback((sourceText: string) => {
    setSelectedSourceText(sourceText);
  }, []);

  const handleRestoreDraft = useCallback(() => {
    if (!fileLoader.pendingDraft) return;

    const restoredFile = {
      filename: fileLoader.pendingDraft.draft.filename,
      header: fileLoader.pendingDraft.draft.header ?? {},
      entries: fileLoader.pendingDraft.draft.entries,
      charset: 'UTF-8' as const,
    };

    loadFile(restoredFile);
    try {
      restoreReviewEntries(new Map(fileLoader.pendingDraft.draft.reviewEntries ?? []));
    } catch {
      debugLog('[Drafts] Failed to restore reviewEntries, using empty map');
      restoreReviewEntries(new Map());
    }
    fileLoader.setIsFromDraft(true);
    fileLoader.setPendingDraft(null);

    debugLog('[Drafts] Restored from draft');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFile, fileLoader.pendingDraft, restoreReviewEntries]);

  const handleOpenSettings = useCallback(
    (tab?: string) => {
      const query = typeof tab === 'string' ? `?tab=${tab}` : '';
      settingsNavigate(`/settings${query}`);
    },
    [settingsNavigate],
  );

  // One-time nudge: when a file is first loaded and no provider has an API key,
  // auto-navigate to translation settings so the user can set one up.
  const hasPromptedApiKey = useRef(false);
  useEffect(() => {
    if (!filename || hasPromptedApiKey.current || readOnly) return;
    try {
      if (localStorage.getItem(API_KEY_SETUP_PROMPTED_KEY)) return;
    } catch {
      return;
    }
    const anyConfigured =
      hasProviderCredentials('deepl') ||
      hasProviderCredentials('azure') ||
      hasProviderCredentials('google');
    if (!anyConfigured) {
      hasPromptedApiKey.current = true;
      try {
        localStorage.setItem(API_KEY_SETUP_PROMPTED_KEY, '1');
      } catch {
        // Ignore storage errors
      }
      // Short delay to let the editor render before navigating
      const timer = setTimeout(
        () =>
          settingsNavigate(
            buildTranslationSettingsHref({
              provider: getActiveTranslationProvider(),
              returnTo: `${location.pathname}${location.search}${location.hash}`,
            }),
          ),
        600,
      );
      return () => clearTimeout(timer);
    }
  }, [filename, location.hash, location.pathname, location.search, readOnly, settingsNavigate]);

  const handleDiscardDraft = useCallback(() => {
    if (fileLoader.pendingDraft) {
      deleteDraft(fileLoader.pendingDraft.filename);
    }
    fileLoader.setPendingDraft(null);
    fileLoader.setIsFromDraft(false);
    debugLog('[Drafts] Discarded draft, using fresh file');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileLoader.pendingDraft]);

  const handleClear = useCallback(() => {
    if (filename) {
      deleteDraft(filename);
    }

    clearEditor();
    clearUpstreamDeltaEntries();
    useSourceStore.getState().clearSource();
    fileLoader.setErrors([]);
    fileLoader.setWarnings([]);
    fileLoader.setEncodingInfo(null);
    fileLoader.setDragError(null);
    dialogs.setConfirmClearOpen(false);
    fileLoader.setPendingDraft(null);
    fileLoader.setIsFromDraft(false);
    sync.setLastAutoSave(null);
    sync.setTranslateSourceLang(undefined);
    sync.setTranslateTargetLang(undefined);
    clearRepoConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearEditor, clearRepoConnection, clearUpstreamDeltaEntries, filename]);

  const handleClearClick = useCallback(() => {
    if (hasUnsavedChanges) {
      dialogs.setConfirmClearOpen(true);
    } else {
      handleClear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleClear, hasUnsavedChanges]);

  const handleEmptyStateClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const confirmPendingUrl = useCallback(() => {
    if (fileLoader.pendingUrl) {
      void fileLoader.executeUrlLoad(fileLoader.pendingUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileLoader.executeUrlLoad, fileLoader.pendingUrl]);

  const confirmPendingProject = useCallback(() => {
    if (!fileLoader.pendingProject) return;

    void fileLoader.executeWordPressProjectLoad(fileLoader.pendingProject).catch((error) => {
      fileLoader.setErrors([
        {
          severity: 'error',
          code: 'INVALID_SYNTAX',
          message:
            error instanceof Error ? error.message : t('Failed to open the WordPress.org project.'),
        },
      ]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileLoader.executeWordPressProjectLoad, fileLoader.pendingProject, t]);

  // --- Build props objects ---

  const headerProps: EditorHeaderProps = {
    onFileUpload: fileLoader.handleFileUpload,
    fileInputRef,
    fileResetRef,
    filename,
    hasUnsavedChanges,
    sourceFormat,
    onDownload: sync.handleDownload,
    onDownloadAs: sync.handleDownloadAs,
    onPotUpload: sync.handlePotUpload,
    onSourceFileUpload: readOnly ? undefined : (f) => void fileLoader.handleSourceFileUpload(f),
    showSourceFileOption,
    sourceFilename,
    onSourceFileRemove: readOnly ? undefined : clearSourceFile,
    repoConnection: dialogs.repoConnection,
    onPushToRepo: readOnly ? undefined : dialogs.openRepoSyncPush,
    onOpenSettings: handleOpenSettings,
    onLoadFromUrl: readOnly ? undefined : dialogs.openUrlPrompt,
    onOpenWordPressProject: readOnly ? undefined : dialogs.openWordPressProjectModal,
    onRefreshWordPress:
      !readOnly && currentProjectType && currentProjectSlug && filename
        ? dialogs.openWordPressRefreshModal
        : undefined,
    onOpenRepoSync: readOnly ? undefined : dialogs.openRepoSyncConnectOrPush,
    onClearClick: readOnly ? undefined : handleClearClick,
    onSaveToCloud:
      !readOnly && filename && getStorageAdapter().type === 'local'
        ? () => dialogs.setSaveToCloudOpen(true)
        : undefined,
  };

  const workspaceProps: EditorWorkspaceProps | null = filename
    ? {
        workspaceMode,
        onWorkspaceModeChange: setWorkspaceMode,
        encodingInfo: fileLoader.encodingInfo,
        currentProjectType,
        currentProjectSlug,
        currentProjectRelease,
        onRefreshWordPress: readOnly ? undefined : dialogs.openWordPressRefreshModal,
        onLanguageChange: sync.handleLanguageChange,
        deeplGlossaryId: sync.glossaryEnforcementEnabled ? sync.deeplGlossaryId : null,
        glossary: sync.glossary,
        glossaryEnforcementEnabled: sync.glossaryEnforcementEnabled,
        translateEnabled,
        glossarySyncStatus: sync.glossarySyncStatus,
        targetLang: sync.translateTargetLang,
        sourceLang: sync.translateSourceLang,
        speechEnabled,
        onEntrySelect: handleEntrySelect,
        readOnly,
        onOpenSettings: handleOpenSettings,
      }
    : null;

  const emptyStateProps: EmptyStateProps = {
    onFileClick: handleEmptyStateClick,
    urlInput: fileLoader.urlInput,
    onUrlInputChange: fileLoader.setUrlInput,
    isLoadingUrl: fileLoader.isLoadingUrl,
    onLoadFromUrl: fileLoader.handleLoadFromUrl,
    onOpenWordPressProject: dialogs.openWordPressProjectModal,
    onOpenRepoSync: dialogs.openRepoSyncConnect,
    isLoadingExample: fileLoader.isLoadingExample,
    onLoadExamplePo: fileLoader.handleLoadExamplePo,
  };

  const notificationsProps: IndexPageNotificationsProps = {
    isDragging: fileLoader.isDragging,
    downloadSuccess: sync.downloadSuccess,
    onCloseDownloadSuccess: () => sync.setDownloadSuccess(null),
    mergeSuccess: sync.mergeSuccess,
    onCloseMergeSuccess: () => sync.setMergeSuccess(null),
    feedbackSuccess: dialogs.feedbackSuccess,
    onCloseFeedbackSuccess: () => dialogs.setFeedbackSuccess(null),
    feedbackError: dialogs.feedbackError,
    onCloseFeedbackError: () => dialogs.setFeedbackError(null),
  };

  const bannersProps: IndexPageBannersProps = {
    dragError: fileLoader.dragError,
    onCloseDragError: () => fileLoader.setDragError(null),
    errors: fileLoader.errors,
    onCloseErrors: () => fileLoader.setErrors([]),
    warnings: fileLoader.warnings,
    showWarnings: fileLoader.showWarnings,
    onCloseWarnings: () => fileLoader.setShowWarnings(false),
    pendingDraft: fileLoader.pendingDraft,
    onRestoreDraft: handleRestoreDraft,
    onDiscardDraft: handleDiscardDraft,
    hasFileLoaded: Boolean(filename),
    isFromDraft: fileLoader.isFromDraft,
    lastAutoSave: sync.lastAutoSave,
    repoConnection: dialogs.repoConnection,
    onOpenRepoPush: dialogs.openRepoSyncPush,
  };

  const dialogsProps: IndexPageDialogsProps = {
    confirmClearOpen: dialogs.confirmClearOpen,
    onCloseConfirmClear: () => dialogs.setConfirmClearOpen(false),
    onConfirmClear: handleClear,
    pendingUrl: fileLoader.pendingUrl,
    onClosePendingUrl: () => fileLoader.setPendingUrl(null),
    onConfirmPendingUrl: confirmPendingUrl,
    pendingProject: fileLoader.pendingProject,
    onClosePendingProject: () => fileLoader.setPendingProject(null),
    onConfirmPendingProject: confirmPendingProject,
    urlPromptOpen: dialogs.urlPromptOpen,
    onCloseUrlPrompt: dialogs.closeUrlPrompt,
    onSubmitUrlPrompt: fileLoader.handleLoadFromUrl,
    wordpressProjectOpen: dialogs.wordpressProjectOpen,
    onCloseWordPressProject: dialogs.closeWordPressProjectModal,
    initialLocale: sync.glossaryLocale,
    onOpenWordPressProject: fileLoader.handleOpenWordPressProject,
    canRefreshWordPress: Boolean(currentProjectType && currentProjectSlug),
    wordpressRefreshOpen: dialogs.wordpressRefreshOpen,
    onCloseWordPressRefresh: dialogs.closeWordPressRefreshModal,
    currentProjectType,
    currentProjectSlug,
    currentEntries: entries,
    currentProjectRelease,
    onApplyWordPressRefresh: fileLoader.handleApplyWordPressRefresh,
    repoSyncOpen: dialogs.repoSyncOpen,
    onCloseRepoSync: dialogs.closeRepoSync,
    onRepoFileLoaded: fileLoader.handleRepoFileLoaded,
    serializedContentForPush: sync.serializedContentForPush,
    repoSyncInitialTab: dialogs.repoSyncInitialTab,
    qaSummaryOpen: dialogs.qaSummaryOpen,
    onCloseQaSummary: dialogs.closeQaSummary,
    qaSummary: sync.qaSummary,
    pendingExportFormat: sync.pendingExportFormat,
    onConfirmExportAnyway: sync.confirmExportAnyway,
    feedbackOpen: dialogs.feedbackOpen,
    onCloseFeedback: () => dialogs.setFeedbackOpen(false),
    currentFilename: filename,
    onFeedbackSubmitted: dialogs.handleFeedbackSubmitted,
    onFeedbackSubmitError: dialogs.handleFeedbackSubmitError,
    saveToCloudOpen: dialogs.saveToCloudOpen,
    onCloseSaveToCloud: () => dialogs.setSaveToCloudOpen(false),
  };

  return {
    containerWidth,
    dragAreaProps: {
      onDragEnter: fileLoader.handleDragEnter,
      onDragLeave: fileLoader.handleDragLeave,
      onDragOver: fileLoader.handleDragOver,
      onDrop: fileLoader.handleDrop,
    },
    headerProps,
    workspaceProps,
    emptyStateProps,
    notificationsProps,
    bannersProps,
    dialogsProps,
    /** Load glossary for a specific locale (used by cloud projects to auto-load). */
    loadGlossaryForLocale: sync.handleGlossaryLoaded,
  };
}
