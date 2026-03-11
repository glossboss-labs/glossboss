/**
 * GlossBoss - Main Page
 *
 * The primary interface for loading and editing .po files.
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
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
  Divider,
  Modal,
  useMantineColorScheme,
  Menu,
  TextInput,
  useComputedColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { useLocalStorage, useMediaQuery } from '@mantine/hooks';
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
  Link,
  ExternalLink,
  Info,
  Archive,
} from 'lucide-react';
import { ConfirmModal } from '@/components/ui';
import { EditorTable, FilterToolbar, HeaderEditor, TranslateToolbar } from '@/components/editor';
import { FeedbackModal } from '@/components/feedback';
import { SettingsModal } from '@/components/SettingsModal';
import { useEditorStore, useSourceStore, useTranslationMemoryStore } from '@/stores';
import { detectPluginSlug } from '@/lib/wp-source';
import { contentVariants, fadeVariants, sectionVariants, buttonStates } from '@/lib/motion';
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
import { QA_RULE_LABELS, analyzeQaForEntries, summarizeQaReports } from '@/lib/qa';
import {
  getActiveTranslationProvider,
  getTranslationProviderLabel,
  TRANSLATION_PROVIDER_CAPABILITIES,
} from '@/lib/translation';
import { debugError, debugLog } from '@/lib/debug';
import { getBundledExamplePo } from '@/lib/example-po';
import {
  saveDraft,
  loadDraft,
  deleteDraft,
  formatDraftAge,
  cleanupExpiredDrafts,
  type DraftData,
} from '@/lib/storage';
import { CONTAINER_WIDTH_KEY, type ContainerWidth } from '@/lib/container-width';
import { useSearchParams } from 'react-router';
import { msgid, useTranslation } from '@/lib/app-language';
import { createTranslationMemoryScope, isApprovedTranslationEntry } from '@/lib/translation-memory';
const appIcon = '/icon.svg';

const MotionDiv = motion.div;
const DEV_BRANCH_CHIP_STORAGE_KEY = 'glossboss-dev-branch-chip-enabled';
const SPEECH_ENABLED_KEY = 'glossboss-speech-enabled';
const TRANSLATE_ENABLED_KEY = 'glossboss-translate-enabled';

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

function ThemeToggle({ onToggle }: { onToggle: () => void }) {
  const { t } = useTranslation();
  const computedColorScheme = useComputedColorScheme('light');

  return (
    <Tooltip label={computedColorScheme === 'dark' ? t('Light mode') : t('Dark mode')}>
      <motion.div {...buttonStates}>
        <ActionIcon
          variant="default"
          size="lg"
          onClick={onToggle}
          aria-label={
            computedColorScheme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')
          }
        >
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
          background: 'color-mix(in srgb, var(--gb-surface-1) 85%, transparent)',
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

  // Settings modal state
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

  // Draft state
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [isFromDraft, setIsFromDraft] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<number | null>(null);

  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLButtonElement>(null);
  const fileResetRef = useRef<(() => void) | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    filename,
    projectName,
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
    qaReports,
    setQaReports,
    mergeEntries,
  } = useEditorStore();
  const upsertApprovedEntries = useTranslationMemoryStore((state) => state.upsertApprovedEntries);

  /**
   * Derive locale from PO header for glossary
   */
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
  const qaSummary = useMemo(() => summarizeQaReports(qaReports), [qaReports]);

  /**
   * Handle glossary loaded - sync to provider and run analysis
   */
  const handleGlossaryLoaded = useCallback(
    async (loadedGlossary: Glossary) => {
      setGlossary(loadedGlossary);
      setGlossaryTermCount(loadedGlossary.entries.length);

      // Run glossary analysis on all entries
      if (entries.length > 0) {
        const analyses = batchAnalyzeTranslations(entries, loadedGlossary);
        clearGlossaryAnalysis();
        setGlossaryAnalysisBatch(analyses);
        setQaReports(analyzeQaForEntries(entries, analyses));
      }

      const provider = getActiveTranslationProvider();
      const capabilities = TRANSLATION_PROVIDER_CAPABILITIES[provider];

      if (capabilities.nativeGlossary) {
        // DeepL: sync to native glossary API
        const providerLabel = getTranslationProviderLabel(provider);
        setGlossarySyncStatus(`Syncing to ${providerLabel}...`);
        try {
          const glossaryId = await syncGlossaryToDeepL(loadedGlossary, setGlossarySyncStatus);
          setDeeplGlossaryId(glossaryId);
          debugLog('[Glossary] DeepL glossary ID:', glossaryId);
        } catch (error) {
          debugError('[Glossary] Failed to sync to DeepL:', error);
          setGlossarySyncStatus('Sync failed - using fallback');
        }
      } else if (capabilities.promptGlossary) {
        // Gemini: terms are sent in the prompt, no sync needed
        setDeeplGlossaryId(null);
        setGlossarySyncStatus('ready');
      } else {
        // Azure: no glossary support in translations, analysis only
        setDeeplGlossaryId(null);
        setGlossarySyncStatus('ready');
      }
    },
    [clearGlossaryAnalysis, entries, setGlossaryAnalysisBatch, setQaReports],
  );

  /**
   * Handle glossary cleared
   */
  const handleGlossaryCleared = useCallback(() => {
    setGlossary(null);
    setDeeplGlossaryId(null);
    setGlossaryTermCount(0);
    setGlossarySyncStatus(null);
    clearGlossaryAnalysis();
    setQaReports(analyzeQaForEntries(entries, new Map()));
  }, [clearGlossaryAnalysis, entries, setQaReports]);

  /**
   * Handle glossary enforcement toggle
   */
  const handleEnforcementChange = useCallback((enabled: boolean) => {
    setGlossaryEnforcementEnabled(enabled);
  }, []);

  /**
   * Handle force resync glossary (DeepL only — other providers don't need sync)
   */
  const handleForceResync = useCallback(async (glossaryToSync: Glossary) => {
    const provider = getActiveTranslationProvider();
    if (!TRANSLATION_PROVIDER_CAPABILITIES[provider].nativeGlossary) return;

    setGlossarySyncStatus('Force resyncing to DeepL...');

    try {
      const glossaryId = await syncGlossaryToDeepL(glossaryToSync, setGlossarySyncStatus, true);
      setDeeplGlossaryId(glossaryId);
      setGlossaryTermCount(glossaryToSync.entries.length);
      debugLog('[Glossary] Force resync complete, DeepL glossary ID:', glossaryId);
    } catch (error) {
      debugError('[Glossary] Force resync failed:', error);
      setGlossarySyncStatus('Sync failed - using fallback');
      setGlossaryTermCount(0);
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
    if (entries.length === 0) {
      clearGlossaryAnalysis();
      setQaReports(new Map());
      return;
    }

    // Debounce to avoid excessive analysis during rapid edits
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
            message: t('Invalid file type: .{{ext}}. Please upload a .po, .pot, or .json file.', {
              ext,
            }),
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
                message: t('Invalid JSON file. Expected an i18next JSON resource object.'),
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
              message: t(
                'Encoding detected as {{encoding}} with {{confidence}} confidence. If characters appear incorrect, the file may use a different encoding.',
                { encoding: encoding.toUpperCase(), confidence },
              ),
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
            message: err instanceof Error ? err.message : t('Failed to parse file'),
          },
        ]);
      }
    },
    [loadFile, t],
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

    try {
      const examplePo = getBundledExamplePo();
      const result = parsePOFileWithDiagnostics(examplePo.content, examplePo.filename);

      if (!result.success || !result.file) {
        setErrors(result.errors);
        return;
      }

      if (result.warnings.length > 0) {
        setWarnings(result.warnings);
        setShowWarnings(true);
      }

      loadFile(result.file);

      const detected = detectPluginSlug(result.file.header, result.file.filename);
      if (detected) {
        useSourceStore.getState().setAutoDetectedSlug(detected.slug, detected.version);
        debugLog('[Source] Auto-detected plugin from example:', detected.slug, detected.version);
      }
    } finally {
      setIsLoadingExample(false);
    }
  }, [loadFile]);

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

      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 10_000);

        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();

        // Derive filename from URL path
        let name = 'remote.po';
        try {
          const last = new URL(url).pathname.split('/').filter(Boolean).pop();
          if (last && /\.(po|pot|json)$/i.test(last)) name = last;
        } catch {
          /* keep default */
        }

        // Try i18next JSON if content looks like JSON
        if (isI18nextContent(text)) {
          const i18nResult = parseI18nextJSON(text, name);

          loadFile(i18nResult.file);
        } else {
          const result = parsePOFileWithDiagnostics(text, name);

          if (!result.success || !result.file) {
            setErrors(result.errors);
            return;
          }

          if (result.warnings.length > 0) {
            setWarnings(result.warnings);
            setShowWarnings(true);
          }

          loadFile(result.file);

          const detected = detectPluginSlug(result.file.header, name);
          if (detected) {
            useSourceStore.getState().setAutoDetectedSlug(detected.slug, detected.version);
            debugLog('[URL] Auto-detected plugin:', detected.slug, detected.version);
          }
        }

        setUrlInput('');
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === 'AbortError'
            ? t('Request timed out. Try downloading the file and uploading it directly.')
            : err instanceof TypeError
              ? t(
                  'Could not fetch the file. The server may not allow cross-origin requests. Try downloading the file and uploading it directly.',
                )
              : err instanceof Error
                ? err.message
                : t('Unknown error');

        setErrors([{ severity: 'error', code: 'INVALID_SYNTAX', message }]);
      } finally {
        clearTimeout(timeout);
        setIsLoadingUrl(false);
      }
    },
    [loadFile, t],
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

      // If a file is already loaded, ask for confirmation first
      if (filename) {
        setPendingUrl(url);
        return;
      }

      void executeUrlLoad(url);
    },
    [filename, executeUrlLoad, t],
  );

  // Auto-load from ?url= query parameter on mount
  useEffect(() => {
    const urlParam = searchParams.get('url');
    if (urlParam) {
      setSearchParams({}, { replace: true });
      // If no file loaded yet, load directly; otherwise handleLoadFromUrl will prompt
      void handleLoadFromUrl(urlParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, [loadFile, pendingDraft]);

  const handleOpenSettings = useCallback((tab?: string) => {
    setSettingsInitialTab(typeof tab === 'string' ? tab : undefined);
    setSettingsOpen(true);
  }, []);

  const handleOpenFeedback = useCallback(() => {
    setFeedbackOpen(true);
  }, []);

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
        setDragError(t('No file was dropped'));
        return;
      }

      if (files.length > 1) {
        setDragError(t('Please drop only one file at a time'));
        return;
      }

      const file = files[0];
      const ext = file.name.toLowerCase().split('.').pop();

      if (ext !== 'po' && ext !== 'pot' && ext !== 'json') {
        setDragError(
          t('Invalid file type: .{{ext}}. Please drop a .po, .pot, or .json file.', { ext }),
        );
        return;
      }

      handleFileUpload(file);
    },
    [handleFileUpload, t],
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
            message: err instanceof Error ? err.message : t('Failed to parse POT file'),
          },
        ]);
      }
    },
    [entries, mergeEntries, t],
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
    // Avoid carrying the example-derived language selection into the next file after a reset.
    setTranslateSourceLang(undefined);
    setTranslateTargetLang(undefined);
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
              backgroundColor: 'color-mix(in srgb, var(--gb-surface-0) 75%, transparent)',
              backdropFilter: 'blur(4px)',
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
                  <Title order={4}>{t("Drop it like it's hot")}</Title>
                  <Text c="dimmed" size="sm" ta="center">
                    {t('Release to load your translation file')}
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
            title={t('File downloaded')}
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
            title={t('Updated')}
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
              {t('Updated from {{filename}}: +{{added}} new, -{{removed}} removed, {{kept}} kept', {
                filename: mergeSuccess?.potFilename,
                added: mergeSuccess?.added,
                removed: mergeSuccess?.removed,
                kept: mergeSuccess?.kept,
              })}
              {mergeSuccess?.updatedMeta
                ? ` (${t('{{count}} with updated references', { count: mergeSuccess.updatedMeta })})`
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
            title={t('Feedback submitted')}
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
            <Text size="sm">
              {t('Thanks. Issue #{issueNumber} was created.', {
                issueNumber: feedbackSuccess?.issueNumber ?? '',
              })}
            </Text>
            {feedbackSuccess?.issueUrl && (
              <Text
                component="a"
                href={feedbackSuccess.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                mt={4}
              >
                {t('Open issue')}
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
            title={t('Feedback failed')}
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

      <Box component="main">
        <Container
          size={containerWidth === '100%' ? undefined : containerWidth}
          fluid={containerWidth === '100%'}
          py="xl"
        >
          <Stack gap="lg">
            {/* Header */}
            <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
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
                  <Text size="sm" mt={4} style={{ color: 'var(--gb-text-secondary)' }}>
                    {t('Edit gettext translation files with DeepL integration')}
                  </Text>
                </div>

                <Group gap="sm">
                  <Group gap="sm">
                    <motion.div {...buttonStates}>
                      <FileButton
                        onChange={handleFileUpload}
                        accept=".po,.pot,.json"
                        resetRef={fileResetRef}
                      >
                        {(props) => (
                          <Button leftSection={<Upload size={16} />} {...props} ref={fileInputRef}>
                            {t('Upload')}
                          </Button>
                        )}
                      </FileButton>
                    </motion.div>

                    <AnimatePresence>
                      {filename && (
                        <MotionDiv
                          variants={fadeVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                        >
                          <Group gap="sm">
                            <Group gap={0} style={{ position: 'relative', overflow: 'visible' }}>
                              <Tooltip
                                label={
                                  hasUnsavedChanges
                                    ? t('You have unsaved changes')
                                    : t('Download as {format}', {
                                        format: sourceFormat === 'i18next' ? 'JSON' : 'PO',
                                      })
                                }
                              >
                                <motion.div {...buttonStates}>
                                  <Button
                                    leftSection={<Download size={16} />}
                                    variant="light"
                                    onClick={handleDownload}
                                    aria-label={
                                      hasUnsavedChanges
                                        ? t('Download (unsaved changes)')
                                        : undefined
                                    }
                                    style={{
                                      borderTopRightRadius: 0,
                                      borderBottomRightRadius: 0,
                                      position: 'relative',
                                      overflow: 'visible',
                                    }}
                                  >
                                    {t('Download')}
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
                                    aria-label={t('Download format options')}
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
                                  <Menu.Label>{t('Download as')}</Menu.Label>
                                  <Menu.Item onClick={() => handleDownloadAs('po')}>
                                    {t('PO file (.po)')}
                                  </Menu.Item>
                                  <Menu.Item onClick={() => handleDownloadAs('i18next')}>
                                    {t('i18next JSON (.json)')}
                                  </Menu.Item>
                                  <Menu.Divider />
                                  <Menu.Item
                                    leftSection={<Archive size={14} />}
                                    onClick={() => handleOpenSettings('transfer')}
                                  >
                                    {t('Backup')}
                                  </Menu.Item>
                                </Menu.Dropdown>
                              </Menu>
                            </Group>

                            <Tooltip
                              multiline
                              w={340}
                              label={t(
                                'Update this file using a .pot template. Existing translations are kept when source strings still match, new strings are added, and obsolete strings are removed.',
                              )}
                            >
                              <motion.div {...buttonStates}>
                                <FileButton onChange={handlePotUpload} accept=".pot">
                                  {(props) => (
                                    <Button
                                      leftSection={<FileUp size={16} />}
                                      variant="light"
                                      {...props}
                                    >
                                      {t('Update')}
                                    </Button>
                                  )}
                                </FileButton>
                              </motion.div>
                            </Tooltip>
                          </Group>
                        </MotionDiv>
                      )}
                    </AnimatePresence>
                  </Group>

                  {!isMobile && <Divider orientation="vertical" />}

                  {!isMobile && (
                    <Group gap="sm">
                      <Tooltip label={t('Share feedback')}>
                        <motion.div {...buttonStates}>
                          <Button
                            variant="subtle"
                            leftSection={<MessageSquare size={16} />}
                            onClick={handleOpenFeedback}
                          >
                            {t('Feedback')}
                          </Button>
                        </motion.div>
                      </Tooltip>

                      <ThemeToggle onToggle={toggleColorScheme} />
                    </Group>
                  )}

                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <Tooltip label={t('Settings and actions')}>
                        <motion.div {...buttonStates}>
                          <ActionIcon
                            variant="default"
                            size="lg"
                            aria-label={t('Settings and actions')}
                          >
                            <Settings size={18} />
                          </ActionIcon>
                        </motion.div>
                      </Tooltip>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {isMobile && (
                        <Menu.Item
                          leftSection={<MessageSquare size={14} />}
                          onClick={handleOpenFeedback}
                        >
                          {t('Share feedback')}
                        </Menu.Item>
                      )}
                      {isMobile && (
                        <Menu.Item
                          leftSection={
                            computedColorScheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />
                          }
                          onClick={toggleColorScheme}
                        >
                          {computedColorScheme === 'dark' ? t('Light mode') : t('Dark mode')}
                        </Menu.Item>
                      )}
                      {isMobile && <Menu.Divider />}
                      <Menu.Label>{t('Settings')}</Menu.Label>
                      <Menu.Item leftSection={<Settings size={14} />} onClick={handleOpenSettings}>
                        {t('Open settings')}
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Label>{t('Actions')}</Menu.Label>
                      <Menu.Item
                        color="red"
                        leftSection={<Trash2 size={14} />}
                        onClick={handleClearClick}
                      >
                        {t('Clear editor')}
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Label>
                        {t('GlossBoss v{version}', { version: __APP_VERSION__ })}
                      </Menu.Label>
                      <Menu.Item
                        component="a"
                        href="https://github.com/lammersbjorn/glossboss"
                        target="_blank"
                        rel="noopener noreferrer"
                        leftSection={<ExternalLink size={14} />}
                      >
                        {t('Source')}
                      </Menu.Item>
                      <Menu.Item
                        component="a"
                        href="/license/"
                        target="_blank"
                        rel="noopener noreferrer"
                        leftSection={<Info size={14} />}
                      >
                        {t('License')}
                      </Menu.Item>
                      <Menu.Item
                        component="a"
                        href="/translate/"
                        target="_blank"
                        rel="noopener noreferrer"
                        leftSection={<ExternalLink size={14} />}
                      >
                        {t('Translate')}
                      </Menu.Item>
                      <Menu.Item
                        component="a"
                        href="/privacy/"
                        target="_blank"
                        rel="noopener noreferrer"
                        leftSection={<Info size={14} />}
                      >
                        {t('Privacy')}
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
              title={t('Clear editor?')}
              message={t('You have unsaved changes. Are you sure you want to clear the editor?')}
              detail={t('This will remove all your work on the current file.')}
              confirmLabel={msgid('Clear anyway')}
              confirmColor="red"
              variant="danger"
            />

            {/* Confirmation modal for URL overwrite */}
            <ConfirmModal
              opened={pendingUrl !== null}
              onClose={() => setPendingUrl(null)}
              onConfirm={() => {
                if (pendingUrl) void executeUrlLoad(pendingUrl);
              }}
              title={t('Replace current file?')}
              message={t(
                'Loading a new file from URL will replace the currently loaded file. Any unsaved changes will be lost.',
              )}
              confirmLabel={msgid('Replace')}
              variant="warning"
            />

            {/* Drag error display */}
            <AnimatePresence>
              {dragError && (
                <MotionDiv
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Alert
                    color="red"
                    title={t('Upload failed')}
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
                title={t('Failed to parse file')}
                onClose={() => setErrors([])}
                withCloseButton
              >
                <List size="sm" spacing="xs">
                  {errors.map((error, idx) => (
                    <List.Item key={idx}>
                      {error.line && <Code mr={8}>{t('Line {line}', { line: error.line })}</Code>}
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
                      {t('{{count}} warning(s) during parsing', { count: warnings.length })}
                    </span>
                  </Group>
                }
                onClose={() => setShowWarnings(false)}
                withCloseButton
              >
                <List size="sm" spacing="xs">
                  {warnings.slice(0, 5).map((warning, idx) => (
                    <List.Item key={idx}>
                      {warning.line && (
                        <Code mr={8}>{t('Line {{line}}', { line: warning.line })}</Code>
                      )}
                      {warning.message}
                    </List.Item>
                  ))}
                  {warnings.length > 5 && (
                    <List.Item>
                      <Text size="sm" c="dimmed">
                        {t('...and {{count}} more warnings', { count: warnings.length - 5 })}
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
                    <span data-ev-id="ev_be4d010bf8">{t('Unsaved draft found')}</span>
                  </Group>
                }
                withCloseButton
                onClose={handleDiscardDraft}
              >
                <Stack gap="sm">
                  <Text size="sm">
                    {t(
                      'You have unsaved changes from {age}. Would you like to restore your previous work?',
                      {
                        age: formatDraftAge(pendingDraft.draft.savedAt, t),
                      },
                    )}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t('{count} modified entries will be restored.', {
                      count: pendingDraft.draft.dirtyEntryIds.length,
                    })}
                  </Text>
                  <Group gap="sm">
                    <Button
                      size="xs"
                      leftSection={<RotateCcw size={14} />}
                      onClick={handleRestoreDraft}
                    >
                      {t('Restore draft')}
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="gray"
                      leftSection={<X size={14} />}
                      onClick={handleDiscardDraft}
                    >
                      {t('Discard and use new file')}
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
                    {t('Editing draft')}
                  </Badge>
                )}
                {lastAutoSave && (
                  <Text size="xs" c="dimmed">
                    {t('Auto-saved {age}', { age: formatDraftAge(lastAutoSave, t) })}
                  </Text>
                )}
              </Group>
            )}

            {/* Header and control workspace */}
            {filename && (
              <Stack gap="md">
                <HeaderEditor encodingInfo={encodingInfo} />
                <Paper p="md" withBorder>
                  <Stack gap="sm">
                    <FilterToolbar />
                    <Divider />
                    <TranslateToolbar
                      onLanguageChange={handleLanguageChange}
                      deeplGlossaryId={glossaryEnforcementEnabled ? deeplGlossaryId : null}
                      glossary={glossary}
                      translateEnabled={translateEnabled}
                    />
                    {glossary && (
                      <Group gap="xs">
                        <Badge
                          color="green"
                          variant="light"
                          size="sm"
                          leftSection={<Check size={10} />}
                        >
                          {t('Glossary: {count} terms ({locale})', {
                            count: glossary.entries.length,
                            locale: glossary.targetLocale,
                          })}
                        </Badge>
                        {glossarySyncStatus === 'ready' || deeplGlossaryId ? (
                          <Badge color="blue" variant="light" size="sm">
                            {t('{{provider}} ready', {
                              provider: getTranslationProviderLabel(getActiveTranslationProvider()),
                            })}
                          </Badge>
                        ) : null}
                      </Group>
                    )}
                  </Stack>
                </Paper>
              </Stack>
            )}

            {/* Editor table or empty state */}
            {filename ? (
              <MotionDiv variants={sectionVariants} initial="hidden" animate="visible" key="editor">
                <EditorTable
                  targetLang={translateTargetLang}
                  sourceLang={translateSourceLang}
                  glossary={glossary}
                  deeplGlossaryId={glossaryEnforcementEnabled ? deeplGlossaryId : null}
                  glossaryEnforcementEnabled={glossaryEnforcementEnabled}
                  onEntrySelect={handleEntrySelect}
                  speechEnabled={speechEnabled}
                  translateEnabled={translateEnabled}
                />
              </MotionDiv>
            ) : (
              <MotionDiv
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
                onClick={handleEmptyStateClick}
                style={{ cursor: 'pointer' }}
              >
                <Paper
                  p={rem(80)}
                  withBorder
                  style={{
                    borderStyle: 'dashed',
                    borderWidth: 2,
                    borderColor: 'var(--mantine-color-default-border)',
                  }}
                >
                  <Stack align="center" gap="lg">
                    <img
                      data-ev-id="ev_1ff14ea799"
                      src={appIcon}
                      alt="GlossBoss"
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 16,
                      }}
                    />

                    <Stack align="center" gap="xs">
                      <Title order={2}>{t('Upload a translation file to start')}</Title>
                      <Text ta="center" maw={400} style={{ color: 'var(--gb-text-secondary)' }}>
                        {t(
                          'Drag and drop your translation file here, or click to browse. Your translations will be saved locally in your browser.',
                        )}
                      </Text>
                    </Stack>
                    <Group gap="xs">
                      <Badge variant="light" color="blue">
                        .po
                      </Badge>
                      <Badge variant="light" color="blue">
                        .pot
                      </Badge>
                      <Badge variant="light" color="blue">
                        .json
                      </Badge>
                    </Group>
                    <Group
                      gap="xs"
                      w="100%"
                      maw={500}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      <TextInput
                        placeholder={t('Paste a .po file URL')}
                        aria-label={t('PO file URL')}
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.currentTarget.value)}
                        onKeyDown={(e: KeyboardEvent) => {
                          if (e.key === 'Enter' && urlInput.trim() && !isLoadingUrl) {
                            void handleLoadFromUrl(urlInput.trim());
                          }
                        }}
                        style={{ flex: 1 }}
                        leftSection={<Link size={16} />}
                        disabled={isLoadingUrl}
                      />
                      <Button
                        onClick={() => void handleLoadFromUrl(urlInput.trim())}
                        loading={isLoadingUrl}
                        disabled={!urlInput.trim() || isLoadingUrl}
                      >
                        {t('Load')}
                      </Button>
                    </Group>

                    <Text size="sm" style={{ color: 'var(--gb-text-secondary)' }}>
                      {t('or')}
                    </Text>

                    <Tooltip
                      label={t('Load a small example WordPress plugin PO file (Hello Dolly)')}
                    >
                      <motion.div {...buttonStates}>
                        <Button
                          variant="default"
                          leftSection={<FileUp size={16} />}
                          loading={isLoadingExample}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleLoadExamplePo();
                          }}
                        >
                          {t('Load example PO')}
                        </Button>
                      </motion.div>
                    </Tooltip>
                  </Stack>
                </Paper>
              </MotionDiv>
            )}
          </Stack>
        </Container>
      </Box>

      {/* Settings Modal — mount only when open to avoid background effects */}
      {settingsOpen && (
        <SettingsModal
          opened={settingsOpen}
          onClose={() => {
            setSettingsOpen(false);
            setSettingsInitialTab(undefined);
          }}
          initialTab={settingsInitialTab}
          initialLocale={glossaryLocale}
          onGlossaryLoaded={handleGlossaryLoaded}
          onGlossaryCleared={handleGlossaryCleared}
          onEnforcementChange={handleEnforcementChange}
          onForceResync={handleForceResync}
          glossary={glossary}
          syncStatus={glossarySyncStatus}
          deeplGlossaryId={deeplGlossaryId}
          glossaryTermCount={glossaryTermCount}
          selectedSourceText={selectedSourceText}
          branchChipEnabled={branchChipEnabled}
          onBranchChipEnabledChange={setBranchChipEnabled}
          containerWidth={containerWidth}
          onContainerWidthChange={setContainerWidth}
          speechEnabled={speechEnabled}
          onSpeechEnabledChange={setSpeechEnabled}
          translateEnabled={translateEnabled}
          onTranslateEnabledChange={setTranslateEnabled}
        />
      )}

      <Modal
        opened={qaSummaryOpen}
        onClose={() => {
          setQaSummaryOpen(false);
          setPendingExportFormat(null);
        }}
        title={t('QA summary before export')}
        centered
        size="lg"
        closeButtonProps={{ 'aria-label': t('Close QA summary') }}
      >
        <Stack gap="md">
          <Alert color="yellow" icon={<AlertTriangle size={16} />}>
            <Text size="sm">
              {t(
                'GlossBoss found QA issues in the current file. You can review them now or export anyway.',
              )}
            </Text>
          </Alert>

          <Group gap="xs" wrap="wrap">
            <Badge color="red" variant="light">
              {t('{{count}} error issue(s)', { count: qaSummary.errors })}
            </Badge>
            <Badge color="orange" variant="light">
              {t('{{count}} warning issue(s)', { count: qaSummary.warnings })}
            </Badge>
            <Badge color="gray" variant="light">
              {t('{{count}} total issues', { count: qaSummary.totalIssues })}
            </Badge>
          </Group>

          <Stack gap="xs">
            {Object.entries(qaSummary.byRule)
              .filter(([, count]) => count > 0)
              .map(([ruleId, count]) => (
                <Group key={ruleId} justify="space-between">
                  <Text size="sm">{t(QA_RULE_LABELS[ruleId as keyof typeof QA_RULE_LABELS])}</Text>
                  <Badge variant="light" color="gray">
                    {count}
                  </Badge>
                </Group>
              ))}
          </Stack>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setQaSummaryOpen(false)}>
              {t('Review issues')}
            </Button>
            <Button
              onClick={() => {
                if (pendingExportFormat) {
                  performDownloadAs(pendingExportFormat);
                }
                setQaSummaryOpen(false);
                setPendingExportFormat(null);
              }}
            >
              {t('Export anyway')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {isDevelopment && branchChipEnabled && <DevBranchChip branch={__GIT_BRANCH__} />}

      {/* Feedback Modal — mount only when open to avoid background effects */}
      {feedbackOpen && (
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
      )}
    </Box>
  );
}
