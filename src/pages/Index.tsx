/**
 * GlossBoss - Main Page
 *
 * The primary interface for loading and editing .po files.
 */

import { useState, useCallback, useRef, useEffect, type DragEvent } from 'react';
import {
  Container,
  Title,
  Text,
  Stack,
  Group,
  Button,
  FileButton,
  Paper,
  Alert,
  List,
  Code,
  Badge,
  Tooltip,
  Box,
  rem,
  Notification,
  ActionIcon,
  Transition,
  useMantineColorScheme,
  Menu,
  useComputedColorScheme,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  Download,
  Trash2,
  AlertTriangle,
  MessageSquare,
  FileUp,
  Check,
  RotateCcw,
  X,
  Settings,
  Sun,
  Moon,
  ChevronDown,
  GitBranch,
} from 'lucide-react';
import { EditorTable, FilterToolbar, HeaderEditor, TranslateToolbar } from '@/components/editor';
import { FeedbackModal } from '@/components/feedback';
import { SettingsModal } from '@/components/SettingsModal';
import { ConfirmModal } from '@/components/ui';
import { useEditorStore, useSourceStore } from '@/stores';
import { detectPluginSlug } from '@/lib/wp-source';
import { slideUpVariants, fadeScaleVariants, buttonStates, gentleSpring } from '@/lib/motion';
import {
  parsePOFileWithDiagnostics,
  serializePOFile,
  detectAndDecode,
  mergePotIntoPo,
  type SupportedEncoding,
} from '@/lib/po';
import type { ParseIssue } from '@/lib/po';
import { parseI18nextJSON, isI18nextContent, serializeToI18next } from '@/lib/i18next';
import type { FileFormat } from '@/stores';
import type { TargetLanguage, SourceLanguage } from '@/lib/deepl/types';
import type { FeedbackIssueSuccess } from '@/lib/feedback';
import type { Glossary } from '@/lib/glossary/types';
import { batchAnalyzeTranslations, syncGlossaryToDeepL } from '@/lib/glossary';
import { debugError, debugLog } from '@/lib/debug';
import {
  saveDraft,
  loadDraft,
  deleteDraft,
  formatDraftAge,
  cleanupExpiredDrafts,
  type DraftData,
} from '@/lib/storage';
import { CONTAINER_WIDTH_KEY, type ContainerWidth } from '@/lib/container-width';
const appIcon = '/icon.svg';

const MotionDiv = motion.div;
const DEV_BRANCH_CHIP_STORAGE_KEY = 'glossboss-dev-branch-chip-enabled';

/** Encoding info for display */
interface EncodingInfo {
  encoding: SupportedEncoding;
  confidence: string;
  method: string;
}

/** Download success info */
interface DownloadInfo {
  filename: string;
  size: string;
}

/** Merge result info for notification */
interface MergeInfo {
  potFilename: string;
  kept: number;
  added: number;
  removed: number;
  updatedMeta: number;
}

type FeedbackInfo = Pick<FeedbackIssueSuccess, 'issueNumber' | 'issueUrl'>;

/** Pending draft info for recovery prompt */
interface PendingDraft {
  draft: DraftData;
  filename: string;
}

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');

  const toggleColorScheme = () => {
    const oldBg = getComputedStyle(document.body).backgroundColor;
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
    const overlay = document.createElement('div');
    overlay.className = 'theme-transition-overlay';
    overlay.style.backgroundColor = oldBg;
    document.body.appendChild(overlay);
    overlay.addEventListener('animationend', () => overlay.remove());
  };

  return (
    <Tooltip label={computedColorScheme === 'dark' ? 'Light mode' : 'Dark mode'}>
      <motion.div {...buttonStates}>
        <ActionIcon variant="default" size="lg" onClick={toggleColorScheme}>
          {computedColorScheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </ActionIcon>
      </motion.div>
    </Tooltip>
  );
}

function DevBranchChip({ branch }: { branch: string }) {
  const [isHidden, setIsHidden] = useState(false);
  const [hiddenOffset, setHiddenOffset] = useState(220);
  const chipRef = useRef<HTMLDivElement | null>(null);
  const isHiddenRef = useRef(false);

  useEffect(() => {
    const chipMargin = 16;
    const hidePadding = 12;
    const revealPadding = 72;
    let rafId: number | null = null;
    let latestPointer: { x: number; y: number } | null = null;

    const measureChip = () => {
      if (!chipRef.current) return;
      setHiddenOffset(chipRef.current.offsetWidth + 40);
    };

    const getAnchorRect = () => {
      const width = chipRef.current?.offsetWidth ?? 0;
      const height = chipRef.current?.offsetHeight ?? 0;

      return {
        left: window.innerWidth - chipMargin - width,
        right: window.innerWidth - chipMargin,
        top: window.innerHeight - chipMargin - height,
        bottom: window.innerHeight - chipMargin,
      };
    };

    const isWithinExpandedRect = (x: number, y: number, padding: number) => {
      const rect = getAnchorRect();

      return (
        x >= rect.left - padding &&
        x <= rect.right + padding &&
        y >= rect.top - padding &&
        y <= rect.bottom + padding
      );
    };

    const updateHiddenState = (x: number, y: number) => {
      if (!isHiddenRef.current && isWithinExpandedRect(x, y, hidePadding)) {
        isHiddenRef.current = true;
        setIsHidden(true);
      } else if (isHiddenRef.current && !isWithinExpandedRect(x, y, revealPadding)) {
        isHiddenRef.current = false;
        setIsHidden(false);
      }
    };

    const flushPointerMove = () => {
      rafId = null;

      if (!latestPointer) return;

      updateHiddenState(latestPointer.x, latestPointer.y);
      latestPointer = null;
    };

    const handlePointerMove = (event: MouseEvent) => {
      latestPointer = { x: event.clientX, y: event.clientY };

      if (rafId === null) {
        rafId = window.requestAnimationFrame(flushPointerMove);
      }
    };

    const handlePointerLeave = () => {
      isHiddenRef.current = false;
      setIsHidden(false);
      latestPointer = null;

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    measureChip();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureChip) : null;

    if (chipRef.current && resizeObserver) {
      resizeObserver.observe(chipRef.current);
    }

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('blur', handlePointerLeave);
    window.addEventListener('mouseleave', handlePointerLeave);
    window.addEventListener('resize', measureChip);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('blur', handlePointerLeave);
      window.removeEventListener('mouseleave', handlePointerLeave);
      window.removeEventListener('resize', measureChip);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <motion.div
      ref={chipRef}
      animate={{
        x: isHidden ? hiddenOffset : 0,
        opacity: isHidden ? 0.22 : 1,
      }}
      transition={{
        x: {
          type: 'spring',
          stiffness: 180,
          damping: 24,
          mass: 0.95,
        },
        opacity: {
          duration: 0.24,
          ease: 'easeOut',
        },
      }}
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 200,
        pointerEvents: isHidden ? 'none' : 'auto',
        willChange: 'transform, opacity',
      }}
    >
      <Paper
        withBorder
        shadow="md"
        radius="xl"
        px="sm"
        py={6}
        style={{
          backdropFilter: 'blur(12px)',
          background: 'color-mix(in srgb, var(--mantine-color-body) 82%, transparent)',
        }}
      >
        <Group gap={6} wrap="nowrap">
          <GitBranch size={14} />
          <Text size="xs" fw={600}>
            {branch}
          </Text>
        </Group>
      </Paper>
    </motion.div>
  );
}

export default function Index() {
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
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<FeedbackInfo | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [translateSourceLang, setTranslateSourceLang] = useState<SourceLanguage | undefined>(
    undefined,
  );
  const [translateTargetLang, setTranslateTargetLang] = useState<TargetLanguage | undefined>(
    undefined,
  );
  const [glossary, setGlossary] = useState<Glossary | null>(null);
  const [deeplGlossaryId, setDeeplGlossaryId] = useState<string | null>(null);
  const [deeplTermCount, setDeeplTermCount] = useState<number>(0);
  const [glossarySyncStatus, setGlossarySyncStatus] = useState<string | null>(null);
  const [glossaryEnforcementEnabled, setGlossaryEnforcementEnabled] = useState(true);
  const [selectedSourceText, setSelectedSourceText] = useState<string | null>(null);

  // Settings modal state
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // Draft state
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [isFromDraft, setIsFromDraft] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<number | null>(null);

  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLButtonElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    filename,
    sourceFormat,
    header,
    entries,
    dirtyEntryIds,
    machineTranslatedIds,
    hasUnsavedChanges,
    loadFile,
    clearEditor,
    markAsSaved,
    setGlossaryAnalysisBatch,
    clearGlossaryAnalysis,
    mergeEntries,
  } = useEditorStore();

  /**
   * Derive locale from PO header for glossary
   */
  const glossaryLocale = header?.language?.toLowerCase().split('_')[0] || '';

  /**
   * Handle glossary loaded - sync to DeepL and run analysis
   */
  const handleGlossaryLoaded = useCallback(
    async (loadedGlossary: Glossary) => {
      setGlossary(loadedGlossary);
      setGlossarySyncStatus('Syncing to DeepL...');

      // Run glossary analysis on all entries
      if (entries.length > 0) {
        const analyses = batchAnalyzeTranslations(entries, loadedGlossary);
        setGlossaryAnalysisBatch(analyses);
      }

      // Sync to DeepL for native glossary support
      try {
        const glossaryId = await syncGlossaryToDeepL(loadedGlossary, setGlossarySyncStatus);
        setDeeplGlossaryId(glossaryId);
        setDeeplTermCount(loadedGlossary.entries.length);
        debugLog('[Glossary] DeepL glossary ID:', glossaryId);
      } catch (error) {
        debugError('[Glossary] Failed to sync to DeepL:', error);
        setGlossarySyncStatus('Sync failed - using fallback');
        setDeeplTermCount(0);
        // Continue without DeepL glossary - translations will still work, just without glossary enforcement
      }
    },
    [entries, setGlossaryAnalysisBatch],
  );

  /**
   * Handle glossary cleared
   */
  const handleGlossaryCleared = useCallback(() => {
    setGlossary(null);
    setDeeplGlossaryId(null);
    setDeeplTermCount(0);
    setGlossarySyncStatus(null);
    clearGlossaryAnalysis();
  }, [clearGlossaryAnalysis]);

  /**
   * Handle glossary enforcement toggle
   */
  const handleEnforcementChange = useCallback((enabled: boolean) => {
    setGlossaryEnforcementEnabled(enabled);
  }, []);

  /**
   * Handle force resync glossary to DeepL
   */
  const handleForceResync = useCallback(async (glossaryToSync: Glossary) => {
    setGlossarySyncStatus('Force resyncing to DeepL...');

    try {
      const glossaryId = await syncGlossaryToDeepL(glossaryToSync, setGlossarySyncStatus, true);
      setDeeplGlossaryId(glossaryId);
      setDeeplTermCount(glossaryToSync.entries.length);
      debugLog('[Glossary] Force resync complete, DeepL glossary ID:', glossaryId);
    } catch (error) {
      debugError('[Glossary] Force resync failed:', error);
      setGlossarySyncStatus('Sync failed - using fallback');
      setDeeplTermCount(0);
    }
  }, []);

  /**
   * Handle entry selection - track source text for glossary preview
   */
  const handleEntrySelect = useCallback((sourceText: string) => {
    setSelectedSourceText(sourceText);
  }, []);

  /**
   * Re-run glossary analysis when entries change (e.g., after translation)
   * This uses a simple debounce approach - only analyze if glossary is loaded
   */
  useEffect(() => {
    if (glossary && entries.length > 0) {
      // Debounce to avoid excessive analysis during rapid edits
      const timer = setTimeout(() => {
        const analyses = batchAnalyzeTranslations(entries, glossary);
        setGlossaryAnalysisBatch(analyses);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [entries, glossary, setGlossaryAnalysisBatch]);

  /**
   * Auto-save draft when entries change
   * Debounced to avoid excessive writes during rapid edits
   */
  useEffect(() => {
    // Only auto-save if we have a file loaded with changes
    if (!filename || entries.length === 0 || !hasUnsavedChanges) {
      return;
    }

    // Clear any existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Debounce auto-save by 2 seconds
    autoSaveTimerRef.current = setTimeout(() => {
      const saved = saveDraft({
        filename,
        header,
        entries,
        dirtyEntryIds: Array.from(dirtyEntryIds),
        machineTranslatedIds: Array.from(machineTranslatedIds),
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
  }, [filename, header, entries, dirtyEntryIds, machineTranslatedIds, hasUnsavedChanges]);

  /**
   * Cleanup expired drafts on mount
   */
  useEffect(() => {
    cleanupExpiredDrafts();
  }, []);

  /**
   * Handle language change from translate toolbar
   */
  const handleLanguageChange = useCallback(
    (source: SourceLanguage | undefined, target: TargetLanguage) => {
      setTranslateSourceLang(source);
      setTranslateTargetLang(target);
    },
    [],
  );

  /**
   * Handle file upload with encoding detection
   */
  const handleFileUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;

      setErrors([]);
      setWarnings([]);
      setEncodingInfo(null);
      setDragError(null);
      setIsFromDraft(false);

      // Validate file extension
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext !== 'po' && ext !== 'pot' && ext !== 'json') {
        setErrors([
          {
            severity: 'error',
            code: 'INVALID_SYNTAX',
            message: `Invalid file type: .${ext}. Please upload a .po, .pot, or .json file.`,
          },
        ]);
        return;
      }

      try {
        if (ext === 'json') {
          // Handle i18next JSON file
          const text = await file.text();

          if (!isI18nextContent(text)) {
            setErrors([
              {
                severity: 'error',
                code: 'INVALID_SYNTAX',
                message: 'Invalid JSON file. Expected an i18next JSON resource object.',
              },
            ]);
            return;
          }

          const poFile = parseI18nextJSON(text, file.name);
          loadFile(poFile, 'i18next');

          debugLog(`[i18next] Parsed ${poFile.entries.length} entries from ${file.name}`);
        } else {
          // Handle PO/POT file
          // Read file as ArrayBuffer for encoding detection
          const buffer = await file.arrayBuffer();

          // Detect encoding and decode content
          const { encoding, confidence, method, content } = detectAndDecode(buffer);

          // Store encoding info for display
          setEncodingInfo({ encoding, confidence, method });

          // Log encoding detection result
          debugLog(`[Encoding] Detected: ${encoding} (${confidence} confidence, via ${method})`);

          // Parse the decoded content
          const result = parsePOFileWithDiagnostics(content, file.name);

          // Add encoding warning if confidence is low
          if (confidence === 'low' || confidence === 'medium') {
            result.warnings.unshift({
              severity: 'warning',
              code: 'ENCODING_ERROR',
              message: `Encoding detected as ${encoding.toUpperCase()} with ${confidence} confidence. If characters appear incorrect, the file may use a different encoding.`,
            });
          }

          // Store warnings for display
          if (result.warnings.length > 0) {
            setWarnings(result.warnings);
            setShowWarnings(true);
          }

          // Handle parse errors
          if (!result.success || !result.file) {
            setErrors(result.errors);
            return;
          }

          // Check if there's an existing draft for this file
          const existingDraft = loadDraft(file.name);
          if (existingDraft && existingDraft.dirtyEntryIds.length > 0) {
            // Show recovery prompt
            setPendingDraft({ draft: existingDraft, filename: file.name });
            // Still load the fresh file - user can choose to restore draft
            loadFile(result.file);
          } else {
            // No draft or draft has no changes - load fresh
            loadFile(result.file);
          }

          // Auto-detect plugin slug for source code links
          const detected = detectPluginSlug(result.file.header, file.name);
          if (detected) {
            useSourceStore.getState().setAutoDetectedSlug(detected.slug, detected.version);
            debugLog('[Source] Auto-detected plugin:', detected.slug, detected.version);
          }

          // Log stats for debugging
          debugLog('[PO Parser] Stats:', result.stats);
        }
      } catch (err) {
        setErrors([
          {
            severity: 'error',
            code: 'INVALID_SYNTAX',
            message: err instanceof Error ? err.message : 'Failed to parse file',
          },
        ]);
      }
    },
    [loadFile],
  );

  /**
   * Restore from pending draft
   */
  const handleRestoreDraft = useCallback(() => {
    if (!pendingDraft) return;

    const { draft } = pendingDraft;

    // Reconstruct the POFile from draft data
    const restoredFile = {
      filename: draft.filename,
      header: draft.header ?? {},
      entries: draft.entries,
      charset: 'UTF-8' as const,
    };

    loadFile(restoredFile);
    setIsFromDraft(true);
    setPendingDraft(null);

    debugLog('[Drafts] Restored from draft');
  }, [pendingDraft, loadFile]);

  /**
   * Discard pending draft and continue with fresh file
   */
  const handleDiscardDraft = useCallback(() => {
    if (pendingDraft) {
      deleteDraft(pendingDraft.filename);
    }
    setPendingDraft(null);
    setIsFromDraft(false);
    debugLog('[Drafts] Discarded draft, using fresh file');
  }, [pendingDraft]);

  /**
   * Handle drag enter event
   */
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;

    // Check if dragging files
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDragging(true);
      setDragError(null);
    }
  }, []);

  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;

    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  /**
   * Handle drag over event
   */
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  /**
   * Handle drop event
   */
  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(false);
      dragCounterRef.current = 0;

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) {
        setDragError('No file was dropped');
        return;
      }

      if (files.length > 1) {
        setDragError('Please drop only one file at a time');
        return;
      }

      const file = files[0];
      const ext = file.name.toLowerCase().split('.').pop();

      if (ext !== 'po' && ext !== 'pot' && ext !== 'json') {
        setDragError(`Invalid file type: .${ext}. Please drop a .po, .pot, or .json file.`);
        return;
      }

      handleFileUpload(file);
    },
    [handleFileUpload],
  );

  /**
   * Reset drag counter when dragging ends outside window
   */
  useEffect(() => {
    const handleWindowDragEnd = () => {
      setIsDragging(false);
      dragCounterRef.current = 0;
    };

    window.addEventListener('dragend', handleWindowDragEnd);
    return () => window.removeEventListener('dragend', handleWindowDragEnd);
  }, []);

  /**
   * Format bytes to human readable size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Handle file download
   */
  const handleDownloadAs = useCallback(
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
        const poFile = {
          filename,
          header: header ?? {},
          entries,
          charset: 'UTF-8',
        };
        content = serializePOFile(poFile, { updateRevisionDate: true });
        downloadFilename = filename.replace(/\.json$/i, '.po');
        if (!downloadFilename.endsWith('.po') && !downloadFilename.endsWith('.pot')) {
          downloadFilename += '.po';
        }
        mimeType = 'text/x-gettext-translation;charset=utf-8';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
    [filename, header, entries, markAsSaved],
  );

  const handleDownload = useCallback(() => {
    handleDownloadAs(sourceFormat);
  }, [handleDownloadAs, sourceFormat]);

  /**
   * Handle POT file upload for merging
   */
  const handlePotUpload = useCallback(
    async (file: File | null) => {
      if (!file || entries.length === 0) return;

      try {
        const buffer = await file.arrayBuffer();
        const { content } = detectAndDecode(buffer);
        const result = parsePOFileWithDiagnostics(content, file.name);

        if (!result.success || !result.file) {
          setErrors(result.errors);
          return;
        }

        const mergeResult = mergePotIntoPo(entries, result.file.entries);
        mergeEntries(mergeResult.entries);

        setMergeSuccess({
          potFilename: file.name,
          ...mergeResult.stats,
        });

        setTimeout(() => setMergeSuccess(null), 8000);
      } catch (err) {
        setErrors([
          {
            severity: 'error',
            code: 'INVALID_SYNTAX',
            message: err instanceof Error ? err.message : 'Failed to parse POT file',
          },
        ]);
      }
    },
    [entries, mergeEntries],
  );

  /**
   * Clear all state
   */
  const handleClear = useCallback(() => {
    // Delete the draft for current file before clearing
    if (filename) {
      deleteDraft(filename);
    }

    clearEditor();
    useSourceStore.getState().clearSource();
    setErrors([]);
    setWarnings([]);
    setEncodingInfo(null);
    setDragError(null);
    setConfirmClearOpen(false);
    setPendingDraft(null);
    setIsFromDraft(false);
    setLastAutoSave(null);
  }, [clearEditor, filename]);

  /**
   * Open clear confirmation modal
   */
  const handleClearClick = useCallback(() => {
    if (hasUnsavedChanges) {
      setConfirmClearOpen(true);
    } else {
      handleClear();
    }
  }, [hasUnsavedChanges, handleClear]);

  /**
   * Trigger file picker for empty state click
   */
  const handleEmptyStateClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <Box
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ minHeight: '100vh', position: 'relative' }}
    >
      {/* Drag overlay */}
      <Transition mounted={isDragging} transition="fade" duration={150} timingFunction="ease">
        {(styles) => (
          <Box
            style={{
              ...styles,
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <Paper p="xl" radius="md" shadow="lg" style={{ maxWidth: 340 }}>
              <Stack align="center" gap="md">
                <Box
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 'var(--mantine-radius-md)',
                    backgroundColor: 'var(--mantine-color-blue-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileUp size={32} color="var(--mantine-color-blue-filled)" />
                </Box>
                <Stack align="center" gap={4}>
                  <Title order={4}>Drop it like it's hot</Title>
                  <Text c="dimmed" size="sm" ta="center">
                    Release to load your translation file
                  </Text>
                </Stack>
              </Stack>
            </Paper>
          </Box>
        )}
      </Transition>

      {/* Download success notification */}
      <Transition
        mounted={downloadSuccess !== null}
        transition="slide-left"
        duration={200}
        timingFunction="ease"
      >
        {(styles) => (
          <Notification
            icon={<Check size={18} />}
            color="green"
            title="File downloaded"
            onClose={() => setDownloadSuccess(null)}
            style={{
              ...styles,
              position: 'fixed',
              bottom: 20,
              right: 20,
              zIndex: 1000,
              minWidth: 280,
            }}
          >
            <Text size="sm">
              <strong data-ev-id="ev_e901455cf4">{downloadSuccess?.filename}</strong> (
              {downloadSuccess?.size})
            </Text>
          </Notification>
        )}
      </Transition>

      {/* Merge success notification */}
      <Transition
        mounted={mergeSuccess !== null}
        transition="slide-left"
        duration={200}
        timingFunction="ease"
      >
        {(styles) => (
          <Notification
            icon={<Check size={18} />}
            color="blue"
            title="Updated"
            onClose={() => setMergeSuccess(null)}
            style={{
              ...styles,
              position: 'fixed',
              bottom: 20,
              right: 20,
              zIndex: 1000,
              minWidth: 320,
            }}
          >
            <Text size="sm">
              Updated from <strong>{mergeSuccess?.potFilename}</strong>: +{mergeSuccess?.added} new,
              -{mergeSuccess?.removed} removed, {mergeSuccess?.kept} kept
              {mergeSuccess?.updatedMeta
                ? ` (${mergeSuccess.updatedMeta} with updated references)`
                : ''}
            </Text>
          </Notification>
        )}
      </Transition>

      {/* Feedback success notification */}
      <Transition
        mounted={feedbackSuccess !== null}
        transition="slide-left"
        duration={200}
        timingFunction="ease"
      >
        {(styles) => (
          <Notification
            icon={<Check size={18} />}
            color="teal"
            title="Feedback submitted"
            onClose={() => setFeedbackSuccess(null)}
            style={{
              ...styles,
              position: 'fixed',
              top: 20,
              right: 20,
              zIndex: 1000,
              minWidth: 300,
            }}
          >
            <Text size="sm">Thanks. Issue #{feedbackSuccess?.issueNumber} was created.</Text>
            {feedbackSuccess?.issueUrl && (
              <Text
                component="a"
                href={feedbackSuccess.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                mt={4}
              >
                Open issue
              </Text>
            )}
          </Notification>
        )}
      </Transition>

      {/* Feedback error notification */}
      <Transition
        mounted={feedbackError !== null}
        transition="slide-left"
        duration={200}
        timingFunction="ease"
      >
        {(styles) => (
          <Notification
            icon={<AlertTriangle size={18} />}
            color="red"
            title="Feedback failed"
            onClose={() => setFeedbackError(null)}
            style={{
              ...styles,
              position: 'fixed',
              top: 20,
              right: 20,
              zIndex: 1000,
              minWidth: 320,
            }}
          >
            <Text size="sm">{feedbackError}</Text>
          </Notification>
        )}
      </Transition>

      <Container
        size={containerWidth === '100%' ? undefined : containerWidth}
        fluid={containerWidth === '100%'}
        py="xl"
      >
        <Stack gap="lg">
          {/* Header */}
          <MotionDiv
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={gentleSpring}
          >
            <Group justify="space-between" align="flex-start">
              <div data-ev-id="ev_c00be328c4">
                <Group gap="xs" align="center">
                  <img
                    src={appIcon}
                    alt="GlossBoss"
                    style={{ width: 28, height: 28, borderRadius: 6 }}
                  />
                  <Title order={1}>GlossBoss</Title>
                </Group>
                <Text c="dimmed" size="sm" mt={4}>
                  Edit gettext translation files with DeepL integration
                </Text>
              </div>

              <Group gap="sm">
                <motion.div {...buttonStates}>
                  <FileButton
                    onChange={handleFileUpload}
                    accept=".po,.pot,.json"
                    resetRef={fileInputRef as React.MutableRefObject<() => void>}
                  >
                    {(props) => (
                      <Button leftSection={<Upload size={16} />} {...props} ref={fileInputRef}>
                        Upload
                      </Button>
                    )}
                  </FileButton>
                </motion.div>

                <AnimatePresence>
                  {filename && (
                    <MotionDiv
                      variants={slideUpVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <Group gap="sm">
                        <Group gap={0} style={{ position: 'relative', overflow: 'visible' }}>
                          <Tooltip
                            label={
                              hasUnsavedChanges
                                ? 'You have unsaved changes'
                                : `Download as ${sourceFormat === 'i18next' ? 'JSON' : 'PO'}`
                            }
                          >
                            <motion.div {...buttonStates}>
                              <Button
                                leftSection={<Download size={16} />}
                                variant="light"
                                onClick={handleDownload}
                                style={{
                                  borderTopRightRadius: 0,
                                  borderBottomRightRadius: 0,
                                  position: 'relative',
                                  overflow: 'visible',
                                }}
                              >
                                Download
                                <AnimatePresence>
                                  {hasUnsavedChanges && (
                                    <MotionDiv
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      exit={{ scale: 0 }}
                                      style={{
                                        position: 'absolute',
                                        top: -4,
                                        right: -4,
                                        width: 10,
                                        height: 10,
                                        borderRadius: '50%',
                                        backgroundColor: 'var(--mantine-color-orange-5)',
                                        border: '2px solid var(--mantine-color-body)',
                                        zIndex: 1,
                                      }}
                                    />
                                  )}
                                </AnimatePresence>
                              </Button>
                            </motion.div>
                          </Tooltip>
                          <Menu position="bottom-end" withinPortal>
                            <Menu.Target>
                              <Button
                                variant="light"
                                px={8}
                                style={{
                                  borderTopLeftRadius: 0,
                                  borderBottomLeftRadius: 0,
                                  borderLeft: '1px solid var(--mantine-color-default-border)',
                                }}
                              >
                                <ChevronDown size={14} />
                              </Button>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Label>Download as</Menu.Label>
                              <Menu.Item onClick={() => handleDownloadAs('po')}>
                                PO file (.po)
                              </Menu.Item>
                              <Menu.Item onClick={() => handleDownloadAs('i18next')}>
                                i18next JSON (.json)
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>

                        <Tooltip
                          multiline
                          w={340}
                          label="Update this file using a .pot template. Existing translations are kept when source strings still match, new strings are added, and obsolete strings are removed."
                        >
                          <motion.div {...buttonStates}>
                            <FileButton onChange={handlePotUpload} accept=".pot">
                              {(props) => (
                                <Button
                                  leftSection={<FileUp size={16} />}
                                  variant="light"
                                  {...props}
                                >
                                  Update
                                </Button>
                              )}
                            </FileButton>
                          </motion.div>
                        </Tooltip>
                      </Group>
                    </MotionDiv>
                  )}
                </AnimatePresence>

                <Tooltip label="Share feedback">
                  <motion.div {...buttonStates}>
                    <Button
                      variant="default"
                      leftSection={<MessageSquare size={16} />}
                      onClick={() => setFeedbackOpen(true)}
                    >
                      Feedback
                    </Button>
                  </motion.div>
                </Tooltip>

                <ThemeToggle />

                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <Tooltip label="Settings and actions">
                      <motion.div {...buttonStates}>
                        <ActionIcon variant="default" size="lg">
                          <Settings size={18} />
                        </ActionIcon>
                      </motion.div>
                    </Tooltip>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Settings</Menu.Label>
                    <Menu.Item
                      leftSection={<Settings size={14} />}
                      onClick={() => setSettingsOpen(true)}
                    >
                      Open settings
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Label>Actions</Menu.Label>
                    <Menu.Item
                      color="red"
                      leftSection={<Trash2 size={14} />}
                      onClick={handleClearClick}
                    >
                      Clear editor
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>
          </MotionDiv>

          {/* Confirmation modal for clear */}
          <ConfirmModal
            opened={confirmClearOpen}
            onClose={() => setConfirmClearOpen(false)}
            onConfirm={handleClear}
            title="Clear editor?"
            message="You have unsaved changes. Are you sure you want to clear the editor?"
            detail="This will remove all your work on the current file."
            confirmLabel="Clear anyway"
            confirmColor="red"
            variant="danger"
          />

          {/* Drag error display */}
          <AnimatePresence>
            {dragError && (
              <MotionDiv variants={slideUpVariants} initial="hidden" animate="visible" exit="exit">
                <Alert
                  color="red"
                  title="Upload failed"
                  onClose={() => setDragError(null)}
                  withCloseButton
                >
                  {dragError}
                </Alert>
              </MotionDiv>
            )}
          </AnimatePresence>

          {/* Error display */}
          {errors.length > 0 && (
            <Alert
              color="red"
              title="Failed to parse file"
              onClose={() => setErrors([])}
              withCloseButton
            >
              <List size="sm" spacing="xs">
                {errors.map((error, idx) => (
                  <List.Item key={idx}>
                    {error.line && <Code mr={8}>Line {error.line}</Code>}
                    {error.message}
                  </List.Item>
                ))}
              </List>
            </Alert>
          )}

          {/* Warnings display */}
          {warnings.length > 0 && showWarnings && (
            <Alert
              color="yellow"
              title={
                <Group gap="xs">
                  <AlertTriangle size={16} />
                  <span data-ev-id="ev_76292818e0">
                    {warnings.length} warning{warnings.length > 1 ? 's' : ''} during parsing
                  </span>
                </Group>
              }
              onClose={() => setShowWarnings(false)}
              withCloseButton
            >
              <List size="sm" spacing="xs">
                {warnings.slice(0, 5).map((warning, idx) => (
                  <List.Item key={idx}>
                    {warning.line && <Code mr={8}>Line {warning.line}</Code>}
                    {warning.message}
                  </List.Item>
                ))}
                {warnings.length > 5 && (
                  <List.Item>
                    <Text size="sm" c="dimmed">
                      ...and {warnings.length - 5} more warnings
                    </Text>
                  </List.Item>
                )}
              </List>
            </Alert>
          )}

          {/* Draft recovery banner */}
          {pendingDraft && (
            <Alert
              color="blue"
              title={
                <Group gap="xs">
                  <RotateCcw size={16} />
                  <span data-ev-id="ev_be4d010bf8">Unsaved draft found</span>
                </Group>
              }
              withCloseButton
              onClose={handleDiscardDraft}
            >
              <Stack gap="sm">
                <Text size="sm">
                  You have unsaved changes from {formatDraftAge(pendingDraft.draft.savedAt)}. Would
                  you like to restore your previous work?
                </Text>
                <Text size="xs" c="dimmed">
                  {pendingDraft.draft.dirtyEntryIds.length} modified entries will be restored.
                </Text>
                <Group gap="sm">
                  <Button
                    size="xs"
                    leftSection={<RotateCcw size={14} />}
                    onClick={handleRestoreDraft}
                  >
                    Restore draft
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="gray"
                    leftSection={<X size={14} />}
                    onClick={handleDiscardDraft}
                  >
                    Discard and use fresh file
                  </Button>
                </Group>
              </Stack>
            </Alert>
          )}

          {/* Draft status indicator */}
          {filename && (isFromDraft || lastAutoSave) && (
            <Group gap="xs">
              {isFromDraft && (
                <Badge color="orange" variant="light" size="sm">
                  Working from draft
                </Badge>
              )}
              {lastAutoSave && (
                <Text size="xs" c="dimmed">
                  Auto-saved {formatDraftAge(lastAutoSave)}
                </Text>
              )}
            </Group>
          )}

          {/* Header and control workspace */}
          {filename && (
            <Stack gap="sm">
              <HeaderEditor encodingInfo={encodingInfo} />

              {/* Glossary status indicator (quick view) */}
              {glossary && (
                <Group gap="xs">
                  <Badge color="green" variant="light" size="sm" leftSection={<Check size={10} />}>
                    Glossary: {glossary.entries.length} terms ({glossary.targetLocale})
                  </Badge>
                  {deeplGlossaryId && (
                    <Badge color="blue" variant="light" size="sm">
                      DeepL synced
                    </Badge>
                  )}
                </Group>
              )}

              <Stack gap="sm">
                <FilterToolbar />
                <TranslateToolbar
                  onLanguageChange={handleLanguageChange}
                  deeplGlossaryId={glossaryEnforcementEnabled ? deeplGlossaryId : null}
                  glossary={glossary}
                />
              </Stack>
            </Stack>
          )}

          {/* Editor table or empty state */}
          {filename ? (
            <MotionDiv variants={fadeScaleVariants} initial="hidden" animate="visible" key="editor">
              <EditorTable
                targetLang={translateTargetLang}
                sourceLang={translateSourceLang}
                glossary={glossary}
                deeplGlossaryId={glossaryEnforcementEnabled ? deeplGlossaryId : null}
                glossaryEnforcementEnabled={glossaryEnforcementEnabled}
                onEntrySelect={handleEntrySelect}
              />
            </MotionDiv>
          ) : (
            <MotionDiv
              variants={fadeScaleVariants}
              initial="hidden"
              animate="visible"
              onClick={handleEmptyStateClick}
              style={{ cursor: 'pointer' }}
            >
              <Paper
                p={rem(60)}
                withBorder
                style={{
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  borderColor: 'var(--mantine-color-blue-4)',
                }}
              >
                <Stack align="center" gap="lg">
                  <img
                    data-ev-id="ev_1ff14ea799"
                    src={appIcon}
                    alt="GlossBoss"
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 16,
                    }}
                  />

                  <Stack align="center" gap="xs">
                    <Title order={3}>Upload a translation file to start</Title>
                    <Text c="dimmed" ta="center" maw={400}>
                      Drag and drop your translation file here, or click to browse. Your
                      translations will be saved locally in your browser.
                    </Text>
                  </Stack>
                  <Group gap="xs">
                    <Badge variant="filled" color="blue">
                      .po
                    </Badge>
                    <Badge variant="filled" color="blue">
                      .pot
                    </Badge>
                    <Badge variant="filled" color="blue">
                      .json
                    </Badge>
                  </Group>
                </Stack>
              </Paper>
            </MotionDiv>
          )}
        </Stack>

        <Group
          justify="space-between"
          mt="xl"
          pt="md"
          style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
        >
          <Text size="xs" c="dimmed">
            GlossBoss v{__APP_VERSION__}
          </Text>
          <Group gap="md">
            <Text
              component="a"
              href="https://github.com/toineenzo/glossboss"
              target="_blank"
              rel="noopener noreferrer"
              size="xs"
              c="dimmed"
            >
              Source
            </Text>
            <Text
              component="a"
              href="/license/"
              target="_blank"
              rel="noopener noreferrer"
              size="xs"
              c="dimmed"
            >
              License
            </Text>
            <Text
              component="a"
              href="/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              size="xs"
              c="dimmed"
            >
              Privacy
            </Text>
          </Group>
        </Group>
      </Container>

      {/* Settings Modal */}
      <SettingsModal
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialLocale={glossaryLocale}
        onGlossaryLoaded={handleGlossaryLoaded}
        onGlossaryCleared={handleGlossaryCleared}
        onEnforcementChange={handleEnforcementChange}
        onForceResync={handleForceResync}
        glossary={glossary}
        syncStatus={glossarySyncStatus}
        deeplGlossaryId={deeplGlossaryId}
        deeplTermCount={deeplTermCount}
        selectedSourceText={selectedSourceText}
        branchChipEnabled={branchChipEnabled}
        onBranchChipEnabledChange={setBranchChipEnabled}
        containerWidth={containerWidth}
        onContainerWidthChange={setContainerWidth}
      />

      {isDevelopment && branchChipEnabled && <DevBranchChip branch={__GIT_BRANCH__} />}

      <FeedbackModal
        opened={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        currentFilename={filename}
        onSubmitted={(result) => {
          setFeedbackSuccess({ issueNumber: result.issueNumber, issueUrl: result.issueUrl });
          setFeedbackError(null);
          window.setTimeout(() => setFeedbackSuccess(null), 5000);
        }}
        onSubmitError={(message) => {
          setFeedbackError(message);
          window.setTimeout(() => setFeedbackError(null), 6000);
        }}
      />
    </Box>
  );
}
