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
  useComputedColorScheme } from
'@mantine/core';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Download, Trash2, AlertTriangle, FileUp, Check, RotateCcw, X, Settings, FileText, Sun, Moon } from 'lucide-react';
import { EditorTable, FilterToolbar, HeaderEditor, TranslateToolbar } from '@/components/editor';
import { SettingsModal } from '@/components/SettingsModal';
import { ConfirmModal } from '@/components/ui';
import { useEditorStore } from '@/stores';
import { slideUpVariants, fadeScaleVariants, buttonStates, gentleSpring } from '@/lib/motion';
import {
  parsePOFileWithDiagnostics,
  serializePOFile,
  detectAndDecode,
  type SupportedEncoding } from
'@/lib/po';
import type { ParseIssue } from '@/lib/po';
import type { TargetLanguage, SourceLanguage } from '@/lib/deepl/types';
import type { Glossary } from '@/lib/glossary/types';
import { batchAnalyzeTranslations, syncGlossaryToDeepL } from '@/lib/glossary';
import { saveDraft, loadDraft, hasDraft, deleteDraft, formatDraftAge, cleanupExpiredDrafts, type DraftData } from '@/lib/storage';
const appIcon = '/icon.svg';

const MotionDiv = motion.div;

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
        <ActionIcon
          variant="default"
          size="lg"
          onClick={toggleColorScheme}>
          {computedColorScheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </ActionIcon>
      </motion.div>
    </Tooltip>
  );
}

export default function Index() {
  const [errors, setErrors] = useState<ParseIssue[]>([]);
  const [warnings, setWarnings] = useState<ParseIssue[]>([]);
  const [showWarnings, setShowWarnings] = useState(false);
  const [encodingInfo, setEncodingInfo] = useState<EncodingInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<DownloadInfo | null>(null);
  const [translateSourceLang, setTranslateSourceLang] = useState<SourceLanguage | undefined>(undefined);
  const [translateTargetLang, setTranslateTargetLang] = useState<TargetLanguage | undefined>(undefined);
  const [glossary, setGlossary] = useState<Glossary | null>(null);
  const [deeplGlossaryId, setDeeplGlossaryId] = useState<string | null>(null);
  const [deeplTermCount, setDeeplTermCount] = useState<number>(0);
  const [glossarySyncStatus, setGlossarySyncStatus] = useState<string | null>(null);
  const [glossaryEnforcementEnabled, setGlossaryEnforcementEnabled] = useState(true);
  const [selectedSourceText, setSelectedSourceText] = useState<string | null>(null);

  // Settings modal state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Draft state
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [isFromDraft, setIsFromDraft] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<number | null>(null);

  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLButtonElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    filename,
    header,
    entries,
    dirtyEntryIds,
    machineTranslatedIds,
    hasUnsavedChanges,
    loadFile,
    clearEditor,
    markAsSaved,
    setGlossaryAnalysisBatch,
    clearGlossaryAnalysis
  } = useEditorStore();

  /**
   * Derive locale from PO header for glossary
   */
  const glossaryLocale = header?.language?.toLowerCase().split('_')[0] || '';

  /**
   * Handle glossary loaded - sync to DeepL and run analysis
   */
  const handleGlossaryLoaded = useCallback(async (loadedGlossary: Glossary) => {
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
      console.log('[Glossary] DeepL glossary ID:', glossaryId);
    } catch (error) {
      console.error('[Glossary] Failed to sync to DeepL:', error);
      setGlossarySyncStatus('Sync failed - using fallback');
      setDeeplTermCount(0);
      // Continue without DeepL glossary - translations will still work, just without glossary enforcement
    }
  }, [entries, setGlossaryAnalysisBatch]);

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
      console.log('[Glossary] Force resync complete, DeepL glossary ID:', glossaryId);
    } catch (error) {
      console.error('[Glossary] Force resync failed:', error);
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
        machineTranslatedIds: Array.from(machineTranslatedIds)
      });

      if (saved) {
        setLastAutoSave(Date.now());
        console.log('[Drafts] Auto-saved draft');
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
  const handleLanguageChange = useCallback((source: SourceLanguage | undefined, target: TargetLanguage) => {
    setTranslateSourceLang(source);
    setTranslateTargetLang(target);
  }, []);

  /**
   * Handle file upload with encoding detection
   */
  const handleFileUpload = useCallback(async (file: File | null) => {
    if (!file) return;

    setErrors([]);
    setWarnings([]);
    setEncodingInfo(null);
    setDragError(null);
    setIsFromDraft(false);

    // Validate file extension
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'po' && ext !== 'pot') {
      setErrors([{
        severity: 'error',
        code: 'INVALID_SYNTAX',
        message: `Invalid file type: .${ext}. Please upload a .po or .pot file.`
      }]);
      return;
    }

    try {
      // Read file as ArrayBuffer for encoding detection
      const buffer = await file.arrayBuffer();

      // Detect encoding and decode content
      const { encoding, confidence, method, content } = detectAndDecode(buffer);

      // Store encoding info for display
      setEncodingInfo({ encoding, confidence, method });

      // Log encoding detection result
      console.log(`[Encoding] Detected: ${encoding} (${confidence} confidence, via ${method})`);

      // Parse the decoded content
      const result = parsePOFileWithDiagnostics(content, file.name);

      // Add encoding warning if confidence is low
      if (confidence === 'low' || confidence === 'medium') {
        result.warnings.unshift({
          severity: 'warning',
          code: 'ENCODING_ERROR',
          message: `Encoding detected as ${encoding.toUpperCase()} with ${confidence} confidence. If characters appear incorrect, the file may use a different encoding.`
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

      // Log stats for debugging
      console.log('[PO Parser] Stats:', result.stats);

    } catch (err) {
      setErrors([{
        severity: 'error',
        code: 'INVALID_SYNTAX',
        message: err instanceof Error ? err.message : 'Failed to parse file'
      }]);
    }
  }, [loadFile]);

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
      charset: 'UTF-8' as const
    };

    loadFile(restoredFile);
    setIsFromDraft(true);
    setPendingDraft(null);

    console.log('[Drafts] Restored from draft');
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
    console.log('[Drafts] Discarded draft, using fresh file');
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
  const handleDrop = useCallback((e: DragEvent) => {
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

    if (ext !== 'po' && ext !== 'pot') {
      setDragError(`Invalid file type: .${ext}. Please drop a .po or .pot file.`);
      return;
    }

    handleFileUpload(file);
  }, [handleFileUpload]);

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
  const handleDownload = useCallback(() => {
    if (!filename || entries.length === 0) return;

    const poFile = {
      filename,
      header: header ?? {},
      entries,
      charset: 'UTF-8'
    };

    // Serialize with updated revision date
    const content = serializePOFile(poFile, {
      updateRevisionDate: true
    });

    const blob = new Blob([content], { type: 'text/x-gettext-translation;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show success notification
    setDownloadSuccess({
      filename,
      size: formatFileSize(blob.size)
    });

    // Auto-hide after 4 seconds
    setTimeout(() => setDownloadSuccess(null), 4000);

    // Clear draft state - file has been downloaded
    deleteDraft(filename);
    setIsFromDraft(false);
    setLastAutoSave(null);

    markAsSaved();
  }, [filename, header, entries, markAsSaved]);

  /**
   * Clear all state
   */
  const handleClear = useCallback(() => {
    // Delete the draft for current file before clearing
    if (filename) {
      deleteDraft(filename);
    }

    clearEditor();
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
      style={{ minHeight: '100vh', position: 'relative' }}>

      {/* Drag overlay */}
      <Transition
        mounted={isDragging}
        transition="fade"
        duration={150}
        timingFunction="ease">

        {(styles) =>
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
            pointerEvents: 'none'
          }}>

            <Paper
            p="xl"
            radius="md"
            shadow="lg"
            style={{ maxWidth: 340 }}>

              <Stack align="center" gap="md">
                <Box
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 'var(--mantine-radius-md)',
                  backgroundColor: 'var(--mantine-color-blue-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>

                  <FileUp size={32} color="var(--mantine-color-blue-filled)" />
                </Box>
                <Stack align="center" gap={4}>
                  <Title order={4}>Drop it like it's hot</Title>
                  <Text c="dimmed" size="sm" ta="center">
                    Release to load your .po file
                  </Text>
                </Stack>
              </Stack>
            </Paper>
          </Box>
        }
      </Transition>

      {/* Download success notification */}
      <Transition
        mounted={downloadSuccess !== null}
        transition="slide-left"
        duration={200}
        timingFunction="ease">

        {(styles) =>
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
            minWidth: 280
          }}>

            <Text size="sm">
              <strong data-ev-id="ev_e901455cf4">{downloadSuccess?.filename}</strong> ({downloadSuccess?.size})
            </Text>
          </Notification>
        }
      </Transition>

      <Container size="xl" py="xl">
        <Stack gap="lg">
          {/* Header */}
          <MotionDiv
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={gentleSpring}>

            <Group justify="space-between" align="flex-start">
              <div data-ev-id="ev_c00be328c4">
                <Group gap="xs" align="center">
                  <img src={appIcon} alt="GlossBoss" style={{ width: 28, height: 28, borderRadius: 6 }} />
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
                    accept=".po,.pot"
                    resetRef={fileInputRef as any}>

                    {(props) =>
                    <Button leftSection={<Upload size={16} />} {...props} ref={fileInputRef}>
                        Upload
                      </Button>
                    }
                  </FileButton>
                </motion.div>
                
                <AnimatePresence>
                  {filename &&
                  <MotionDiv
                    variants={slideUpVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit">

                      <Group gap="sm">
                        <Tooltip label={hasUnsavedChanges ? "You have unsaved changes" : "Downloads as UTF-8 encoded file"}>
                          <motion.div {...buttonStates}>
                            <Button
                            leftSection={<Download size={16} />}
                            variant="light"
                            onClick={handleDownload}
                            style={{ position: 'relative', overflow: 'visible' }}>

                              Download
                              <AnimatePresence>
                                {hasUnsavedChanges &&
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
                                  zIndex: 1
                                }} />

                              }
                              </AnimatePresence>
                            </Button>
                          </motion.div>
                        </Tooltip>
                        
                        <motion.div {...buttonStates}>
                          <Button
                          leftSection={<Trash2 size={16} />}
                          variant="subtle"
                          color="red"
                          onClick={handleClearClick}>

                            Clear
                          </Button>
                        </motion.div>
                      </Group>
                    </MotionDiv>
                  }
                </AnimatePresence>
                
                <ThemeToggle />

                <Tooltip label="Settings">
                  <motion.div {...buttonStates}>
                    <ActionIcon
                      variant="default"
                      size="lg"
                      onClick={() => setSettingsOpen(true)}>

                      <Settings size={18} />
                    </ActionIcon>
                  </motion.div>
                </Tooltip>
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
            variant="danger" />

          
          {/* Drag error display */}
          <AnimatePresence>
            {dragError &&
            <MotionDiv
              variants={slideUpVariants}
              initial="hidden"
              animate="visible"
              exit="exit">

                <Alert
                color="red"
                title="Upload failed"
                onClose={() => setDragError(null)}
                withCloseButton>
                    {dragError}
                  </Alert>
              </MotionDiv>
            }
          </AnimatePresence>
          
          {/* Error display */}
          {errors.length > 0 &&
          <Alert
            color="red"
            title="Failed to parse file"
            onClose={() => setErrors([])}
            withCloseButton>

              <List size="sm" spacing="xs">
                {errors.map((error, idx) =>
              <List.Item key={idx}>
                    {error.line && <Code mr={8}>Line {error.line}</Code>}
                    {error.message}
                  </List.Item>
              )}
              </List>
            </Alert>
          }
          
          {/* Warnings display */}
          {warnings.length > 0 && showWarnings &&
          <Alert
            color="yellow"
            title={
            <Group gap="xs">
                  <AlertTriangle size={16} />
                  <span data-ev-id="ev_76292818e0">{warnings.length} warning{warnings.length > 1 ? 's' : ''} during parsing</span>
                </Group>
            }
            onClose={() => setShowWarnings(false)}
            withCloseButton>

              <List size="sm" spacing="xs">
                {warnings.slice(0, 5).map((warning, idx) =>
              <List.Item key={idx}>
                    {warning.line && <Code mr={8}>Line {warning.line}</Code>}
                    {warning.message}
                  </List.Item>
              )}
                {warnings.length > 5 &&
              <List.Item>
                    <Text size="sm" c="dimmed">
                      ...and {warnings.length - 5} more warnings
                    </Text>
                  </List.Item>
              }
              </List>
            </Alert>
          }
          
          {/* Draft recovery banner */}
          {pendingDraft &&
          <Alert
            color="blue"
            title={
            <Group gap="xs">
                  <RotateCcw size={16} />
                  <span data-ev-id="ev_be4d010bf8">Unsaved draft found</span>
                </Group>
            }
            withCloseButton
            onClose={handleDiscardDraft}>

              <Stack gap="sm">
                <Text size="sm">
                  You have unsaved changes from {formatDraftAge(pendingDraft.draft.savedAt)}. 
                  Would you like to restore your previous work?
                </Text>
                <Text size="xs" c="dimmed">
                  {pendingDraft.draft.dirtyEntryIds.length} modified entries will be restored.
                </Text>
                <Group gap="sm">
                  <Button
                  size="xs"
                  leftSection={<RotateCcw size={14} />}
                  onClick={handleRestoreDraft}>

                    Restore draft
                  </Button>
                  <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  leftSection={<X size={14} />}
                  onClick={handleDiscardDraft}>

                    Discard and use fresh file
                  </Button>
                </Group>
              </Stack>
            </Alert>
          }
          
          {/* Draft status indicator */}
          {filename && (isFromDraft || lastAutoSave) &&
          <Group gap="xs">
              {isFromDraft &&
            <Badge color="orange" variant="light" size="sm">
                  Working from draft
                </Badge>
            }
              {lastAutoSave &&
            <Text size="xs" c="dimmed">
                  Auto-saved {formatDraftAge(lastAutoSave)}
                </Text>
            }
            </Group>
          }
          
          {/* Header editor (replaces old file info section) */}
          {filename && <HeaderEditor encodingInfo={encodingInfo} />}
          
          {/* Glossary status indicator (quick view) */}
          {filename && glossary &&
          <Group gap="xs">
              <Badge color="green" variant="light" size="sm" leftSection={<Check size={10} />}>
                Glossary: {glossary.entries.length} terms ({glossary.targetLocale})
              </Badge>
              {deeplGlossaryId &&
            <Badge color="blue" variant="light" size="sm">
                  DeepL synced
                </Badge>
            }
            </Group>
          }
          
          {/* Filter toolbar */}
          {filename && <FilterToolbar />}
          
          {/* Translate toolbar for DeepL integration */}
          {filename && <TranslateToolbar onLanguageChange={handleLanguageChange} deeplGlossaryId={glossaryEnforcementEnabled ? deeplGlossaryId : null} />}
          
          {/* Editor table or empty state */}
          {filename ?
          <MotionDiv
            variants={fadeScaleVariants}
            initial="hidden"
            animate="visible"
            key="editor">

              <EditorTable
              targetLang={translateTargetLang}
              sourceLang={translateSourceLang}
              glossary={glossary}
              deeplGlossaryId={glossaryEnforcementEnabled ? deeplGlossaryId : null}
              glossaryEnforcementEnabled={glossaryEnforcementEnabled}
              onEntrySelect={handleEntrySelect} />

            </MotionDiv> :

          <MotionDiv
            variants={fadeScaleVariants}
            initial="hidden"
            animate="visible"
            onClick={handleEmptyStateClick}
            style={{ cursor: 'pointer' }}>

          <Paper
            p={rem(60)}
            withBorder
            style={{
              borderStyle: 'dashed',
              borderWidth: 2,
              borderColor: 'var(--mantine-color-blue-4)',
            }}>

              <Stack align="center" gap="lg">
                <img data-ev-id="ev_1ff14ea799"
              src={appIcon}
              alt="GlossBoss"
              style={{
                width: 80,
                height: 80,
                borderRadius: 16
              }} />

                <Stack align="center" gap="xs">
                  <Title order={3}>Upload a PO file to start</Title>
                  <Text c="dimmed" ta="center" maw={400}>
                    Drag and drop your .po or .pot file here, or click to browse.
                    Your translations will be saved locally in your browser.
                  </Text>
                </Stack>
                <Group gap="xs">
                  <Badge variant="filled" color="blue">.po</Badge>
                  <Badge variant="filled" color="blue">.pot</Badge>
                </Group>
              </Stack>
            </Paper>
            </MotionDiv>
          }
        </Stack>
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
        selectedSourceText={selectedSourceText} />

    </Box>);

}