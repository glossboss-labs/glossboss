import { useCallback, useRef, useState } from 'react';
import type { EncodingInfo, WordPressProjectOpenRequest } from '@/components/editor';
import type { ParseIssue } from '@/lib/po';
import { parseUploadedFile, parseFileContent, parseAndApplySourceFile } from '@/lib/po';
import { trackEvent } from '@/lib/analytics';
import { loadDraft } from '@/lib/storage';
import {
  detectWordPressProject,
  fetchWordPressTranslationFile,
  type WordPressPluginTranslationTrack,
} from '@/lib/wp-source';
import {
  parseGitHubRawUrl,
  fetchGitHubRawContent,
  GitHubPrivateRepoError,
} from '@/lib/github/raw-url';
import { getBundledExamplePo } from '@/lib/example-po';
import { useTranslation } from '@/lib/app-language';
import { useEditorStore, useSourceStore } from '@/stores';
import { debugLog } from '@/lib/debug';
import { getFileExtension, isSupportedExtension } from '@/lib/po';
import type { POEntry } from '@/lib/po';
import type { PendingDraft } from './types';

export interface FileLoaderState {
  errors: ParseIssue[];
  warnings: ParseIssue[];
  showWarnings: boolean;
  encodingInfo: EncodingInfo | null;
  isDragging: boolean;
  dragError: string | null;
  isLoadingExample: boolean;
  isLoadingUrl: boolean;
  urlInput: string;
  pendingUrl: string | null;
  pendingProject: WordPressProjectOpenRequest | null;
  pendingDraft: PendingDraft | null;
  isFromDraft: boolean;
}

export interface FileLoaderActions {
  setErrors: (errors: ParseIssue[]) => void;
  setWarnings: (warnings: ParseIssue[]) => void;
  setShowWarnings: (show: boolean) => void;
  setEncodingInfo: (info: EncodingInfo | null) => void;
  setDragError: (error: string | null) => void;
  setPendingDraft: (draft: PendingDraft | null) => void;
  setPendingUrl: (url: string | null) => void;
  setPendingProject: (project: WordPressProjectOpenRequest | null) => void;
  setIsFromDraft: (value: boolean) => void;
  setUrlInput: (value: string) => void;
  handleFileUpload: (file: File | null) => Promise<void>;
  handleSourceFileUpload: (file: File | null) => Promise<void>;
  handleRepoFileLoaded: (content: string, repoFilename: string) => void;
  handleLoadExamplePo: () => void;
  executeUrlLoad: (url: string) => Promise<void>;
  handleLoadFromUrl: (url: string) => void;
  handleDragEnter: (event: React.DragEvent) => void;
  handleDragLeave: (event: React.DragEvent) => void;
  handleDragOver: (event: React.DragEvent) => void;
  handleDrop: (event: React.DragEvent) => void;
  executeWordPressProjectLoad: (request: WordPressProjectOpenRequest) => Promise<void>;
  handleOpenWordPressProject: (request: WordPressProjectOpenRequest) => Promise<void>;
  handleApplyWordPressRefresh: (params: {
    mergedEntries: POEntry[];
    deltaEntryIds: string[];
    release: string | null;
    track: WordPressPluginTranslationTrack;
    summary: { added: number; removed: number; changed: number; metaUpdated: number };
    refreshGlossary: boolean;
  }) => Promise<void>;
}

interface UseFileLoaderOptions {
  filename: string | null;
  entries: POEntry[];
  glossaryLocale: string;
  handleGlossaryLoaded: (glossary: import('@/lib/glossary/types').Glossary) => Promise<void>;
  setWorkspaceMode: (mode: import('@/components/editor').WorkspaceMode) => void;
}

export function useFileLoader({
  filename,
  entries,
  glossaryLocale,
  handleGlossaryLoaded,
  setWorkspaceMode,
}: UseFileLoaderOptions): FileLoaderState & FileLoaderActions {
  const { t } = useTranslation();
  const [errors, setErrors] = useState<ParseIssue[]>([]);
  const [warnings, setWarnings] = useState<ParseIssue[]>([]);
  const [showWarnings, setShowWarnings] = useState(false);
  const [encodingInfo, setEncodingInfo] = useState<EncodingInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const [isLoadingExample, setIsLoadingExample] = useState(false);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pendingProject, setPendingProject] = useState<WordPressProjectOpenRequest | null>(null);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [isFromDraft, setIsFromDraft] = useState(false);

  const dragCounterRef = useRef(0);

  const {
    loadFile,
    applySourceEntries,
    clearUpstreamDeltaEntries,
    mergeEntries,
    setUpstreamDeltaEntries,
  } = useEditorStore();

  const applyDetectedWordPressProject = useCallback(
    (fileHeader: import('@/lib/po').POHeader | null, fileName: string) => {
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

  const handleSourceFileUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const result = await parseAndApplySourceFile(file, entries);
      if (result.ok) {
        applySourceEntries(result.result.entries, result.result.filename);
      }
    },
    [entries, applySourceEntries],
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

      const { file: poFile, format, encoding, warnings: fileWarnings } = outcome.result;

      if (encoding) {
        setEncodingInfo(encoding);
        debugLog(
          `[Encoding] Detected: ${encoding.encoding} (${encoding.confidence} confidence, via ${encoding.method})`,
        );
      }

      if (fileWarnings.length > 0) {
        setWarnings(fileWarnings);
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
        trackEvent('file_opened', { format: 'po', entries: poFile.entries.length });
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

      const { file: poFile, format, warnings: fileWarnings } = outcome.result;

      if (fileWarnings.length > 0) {
        setWarnings(fileWarnings);
        setShowWarnings(true);
      }

      loadFile(poFile, format === 'i18next' ? 'i18next' : undefined);

      if (format !== 'i18next') {
        applyDetectedWordPressProject(poFile.header, repoFilename);
      }
    },
    [applyDetectedWordPressProject, loadFile],
  );

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

      try {
        let text: string;
        let name = 'remote.po';

        // GitHub raw URLs: use the GitHub API for private repo support
        const ghParsed = parseGitHubRawUrl(url);
        if (ghParsed) {
          text = await fetchGitHubRawContent(ghParsed);
          const lastSegment = ghParsed.path.split('/').pop();
          if (lastSegment && /\.(po|pot|json)$/i.test(lastSegment)) name = lastSegment;
        } else {
          // Generic URL fetch with timeout
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            text = await response.text();
          } finally {
            clearTimeout(timeout);
          }

          try {
            const last = new URL(url).pathname.split('/').filter(Boolean).pop();
            if (last && /\.(po|pot|json)$/i.test(last)) name = last;
          } catch {
            // Keep default filename when the URL is malformed.
          }
        }

        const outcome = parseFileContent(text, name);

        if (!outcome.ok) {
          setErrors(outcome.errors);
          return;
        }

        const { file: poFile, format, warnings: fileWarnings } = outcome.result;

        if (fileWarnings.length > 0) {
          setWarnings(fileWarnings);
          setShowWarnings(true);
        }

        loadFile(poFile, format === 'i18next' ? 'i18next' : undefined);

        if (format !== 'i18next') {
          applyDetectedWordPressProject(poFile.header, name);
        }

        setUrlInput('');
      } catch (error) {
        const message =
          error instanceof GitHubPrivateRepoError
            ? error.message
            : error instanceof DOMException && error.name === 'AbortError'
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
      mergedEntries: refreshedEntries,
      deltaEntryIds,
      release,
      track,
      summary: _summary,
      refreshGlossary,
    }: {
      mergedEntries: POEntry[];
      deltaEntryIds: string[];
      release: string | null;
      track: WordPressPluginTranslationTrack;
      summary: { added: number; removed: number; changed: number; metaUpdated: number };
      refreshGlossary: boolean;
    }) => {
      void _summary; // Used by the caller for merge success notification
      mergeEntries(refreshedEntries);
      setUpstreamDeltaEntries(deltaEntryIds);
      if (deltaEntryIds.length > 0) {
        useEditorStore.getState().setFilterState('upstream-delta', 'include');
      }
      useSourceStore.getState().setSelectedRelease(release);
      useSourceStore.getState().setPluginTranslationTrack(track);
      setWorkspaceMode('edit');

      if (refreshGlossary && glossaryLocale) {
        const { fetchWPGlossary } = await import('@/lib/glossary/wp-fetcher');
        const result = await fetchWPGlossary(glossaryLocale, true);
        if (result.glossary) {
          await handleGlossaryLoaded(result.glossary);
        }
      }
    },
    [glossaryLocale, handleGlossaryLoaded, mergeEntries, setUpstreamDeltaEntries, setWorkspaceMode],
  );

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    // Only intercept external file drags, not text selection drags
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
    setDragError(null);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    dragCounterRef.current -= 1;

    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    // Only intercept external file drags, not text selection drags
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      // Only intercept external file drops, not text selection drops
      if (!event.dataTransfer?.types.includes('Files')) return;
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

      const file = files[0]!;
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

  return {
    // State
    errors,
    warnings,
    showWarnings,
    encodingInfo,
    isDragging,
    dragError,
    isLoadingExample,
    isLoadingUrl,
    urlInput,
    pendingUrl,
    pendingProject,
    pendingDraft,
    isFromDraft,
    // Actions
    setErrors,
    setWarnings,
    setShowWarnings,
    setEncodingInfo,
    setDragError,
    setPendingDraft,
    setPendingUrl,
    setPendingProject,
    setIsFromDraft,
    setUrlInput,
    handleFileUpload,
    handleSourceFileUpload,
    handleRepoFileLoaded,
    handleLoadExamplePo,
    executeUrlLoad,
    handleLoadFromUrl,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    executeWordPressProjectLoad,
    handleOpenWordPressProject,
    handleApplyWordPressRefresh,
  };
}
