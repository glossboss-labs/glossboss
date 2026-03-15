/**
 * ProjectEditor — cloud project editing page, scoped to a single language.
 *
 * Loads a project language from Supabase via the SupabaseStorageAdapter,
 * then renders the EditorWorkspace for translation editing.
 * Changes are automatically synced back to the cloud.
 *
 * Uses EditorHeader directly (same as the local editor) to ensure full
 * feature parity — File menu, Push, repo sync, settings, feedback, etc.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router';
import {
  Container,
  Stack,
  Group,
  Title,
  Text,
  Button,
  Center,
  Loader,
  Alert,
  Tooltip,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { motion } from 'motion/react';
import { ArrowLeft, AlertCircle, Cloud, CloudOff, Check } from 'lucide-react';
import { fadeVariants } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { EditorHeader } from '@/components/editor/EditorHeader';
import { SettingsModal } from '@/components/SettingsModal';
import { FeedbackModal } from '@/components/feedback';
import { RepoSyncModal } from '@/components/repo-sync/RepoSyncModal';
import { useEditorStore } from '@/stores/editor-store';
import type { FileFormat } from '@/stores/editor-store';
import { getProject, getProjectLanguage, getProjectEntries } from '@/lib/projects/api';
import {
  dbEntryToPOEntry,
  dbEntryToMTMeta,
  dbEntryToReviewState,
  dbLanguageToHeader,
} from '@/lib/projects/conversions';
import type { ProjectRow, ProjectLanguageRow } from '@/lib/projects/types';
import type { POFile } from '@/lib/po/types';
import type { WorkspaceMode } from '@/components/editor/EditorWorkspace';
import { EditorWorkspace } from '@/components/editor/EditorWorkspace';
import { SupabaseStorageAdapter } from '@/lib/cloud/supabase-adapter';
import { LocalStorageAdapter } from '@/lib/cloud/local-adapter';
import { setStorageAdapter } from '@/lib/cloud/adapter';
import { parseUploadedFile } from '@/lib/po/parse-file';
import { mergePotIntoPo } from '@/lib/po/merge';
import { serializePOFile } from '@/lib/po';
import { serializeToI18next } from '@/lib/i18next';
import { parseFileContent } from '@/lib/po/parse-file';
import type { SourceLanguage, TargetLanguage } from '@/lib/deepl/types';
import type { MachineTranslationMeta } from '@/stores/editor-store';
import type { ReviewEntryState } from '@/lib/review';
import type { WordPressProjectType } from '@/lib/wp-source/references';
import type { RepoConnection } from '@/lib/repo-sync/types';

type SyncState = 'idle' | 'saving' | 'saved' | 'error';

export default function ProjectEditor() {
  const { id, languageId } = useParams<{ id: string; languageId: string }>();
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const { toggleColorScheme } = useMantineColorScheme();
  const adapterRef = useRef<SupabaseStorageAdapter | null>(null);
  const fileInputRef = useRef<HTMLButtonElement | null>(null);
  const fileResetRef = useRef<(() => void) | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [language, setLanguage] = useState<ProjectLanguageRow | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('edit');
  const [syncState, setSyncState] = useState<SyncState>('idle');

  // Modal state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string | undefined>();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [repoSyncOpen, setRepoSyncOpen] = useState(false);

  // Repo connection from language metadata
  const repoConnection: RepoConnection | null =
    language?.repo_provider && language?.repo_owner && language?.repo_name
      ? {
          provider: language.repo_provider,
          owner: language.repo_owner,
          repo: language.repo_name,
          branch: language.repo_branch ?? language.repo_default_branch ?? 'main',
          filePath: language.repo_file_path ?? '',
        }
      : null;

  const loadFile = useEditorStore((s) => s.loadFile);
  const filename = useEditorStore((s) => s.filename);
  const sourceFormat = useEditorStore((s) => s.sourceFormat);
  const header = useEditorStore((s) => s.header);
  const entries = useEditorStore((s) => s.entries);
  const mergeEntries = useEditorStore((s) => s.mergeEntries);
  const hasUnsavedChanges = useEditorStore((s) => s.hasUnsavedChanges);
  const restoreReviewEntries = useEditorStore((s) => s.restoreReviewEntries);

  // Load project + language from Supabase
  useEffect(() => {
    if (!id || !languageId) return;

    let cancelled = false;

    async function load() {
      try {
        const [proj, lang, dbEntries] = await Promise.all([
          getProject(id!),
          getProjectLanguage(languageId!),
          getProjectEntries(languageId!),
        ]);

        if (cancelled) return;

        if (!proj) {
          setError(t('Project not found'));
          setLoading(false);
          return;
        }

        if (!lang) {
          setError(t('Language not found'));
          setLoading(false);
          return;
        }

        setProject(proj);
        setLanguage(lang);

        const poEntries = dbEntries.map((row, i) => dbEntryToPOEntry(row, i));
        const poHeader = dbLanguageToHeader(lang);
        const poFile: POFile = {
          filename: lang.source_filename ?? `${proj.name}-${lang.locale}.po`,
          header: poHeader ?? {},
          entries: poEntries,
          charset: 'UTF-8',
        };

        const adapter = new SupabaseStorageAdapter(id!, languageId!);
        adapterRef.current = adapter;
        setStorageAdapter(adapter);

        loadFile(poFile, proj.source_format === 'i18next' ? 'i18next' : undefined);

        const mtMeta = new Map<string, MachineTranslationMeta>();
        const mtIds = new Set<string>();
        for (let i = 0; i < dbEntries.length; i++) {
          const meta = dbEntryToMTMeta(dbEntries[i]);
          if (meta) {
            mtMeta.set(poEntries[i].id, meta);
            mtIds.add(poEntries[i].id);
          }
        }
        if (mtMeta.size > 0) {
          useEditorStore.setState({
            machineTranslationMeta: mtMeta,
            machineTranslatedIds: mtIds,
          });
        }

        const reviewMap = new Map<string, ReviewEntryState>();
        for (let i = 0; i < dbEntries.length; i++) {
          const review = dbEntryToReviewState(dbEntries[i]);
          if (review.status !== 'draft' || review.comments.length > 0) {
            reviewMap.set(poEntries[i].id, review);
          }
        }
        if (reviewMap.size > 0) {
          restoreReviewEntries(reviewMap);
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('Failed to load project'));
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (adapterRef.current) {
        void adapterRef.current.flush();
        adapterRef.current = null;
      }
      setStorageAdapter(new LocalStorageAdapter());
    };
  }, [id, languageId, loadFile, restoreReviewEntries, t]);

  // Poll adapter sync state
  useEffect(() => {
    const savedTimer = { current: null as ReturnType<typeof setTimeout> | null };

    const interval = setInterval(() => {
      const adapter = adapterRef.current;
      if (!adapter) return;

      if (adapter.syncing) {
        setSyncState('saving');
      } else if (adapter.pending || hasUnsavedChanges) {
        setSyncState('saving');
      } else if (syncState === 'saving') {
        setSyncState('saved');
        savedTimer.current = setTimeout(() => setSyncState('idle'), 2000);
      }
    }, 500);

    return () => {
      clearInterval(interval);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [hasUnsavedChanges, syncState]);

  // Placeholder callbacks
  const noop = useCallback(() => {}, []);
  const handleLanguageChange = noop as unknown as (
    source: SourceLanguage | undefined,
    target: TargetLanguage,
  ) => void;
  const handleEntrySelect = noop as unknown as (sourceText: string) => void;

  // ── File operations ────────────────────────────────────────

  const handleFileUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const outcome = await parseUploadedFile(file);
      if (!outcome.ok) {
        setError(outcome.errors[0]?.message ?? t('Failed to parse file'));
        return;
      }
      loadFile(outcome.result.file, outcome.result.format === 'i18next' ? 'i18next' : undefined);
    },
    [loadFile, t],
  );

  const handleDownloadAs = useCallback(
    (format: FileFormat) => {
      if (!filename || !entries.length) return;

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
          { filename, header: header ?? {}, entries, charset: 'UTF-8' },
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
    },
    [entries, filename, header],
  );

  const handleDownload = useCallback(() => {
    handleDownloadAs(sourceFormat);
  }, [handleDownloadAs, sourceFormat]);

  const handlePotUpload = useCallback(
    async (file: File | null) => {
      if (!file || entries.length === 0) return;
      const outcome = await parseUploadedFile(file);
      if (!outcome.ok) {
        setError(outcome.errors[0]?.message ?? t('Failed to parse POT file'));
        return;
      }
      const mergeResult = mergePotIntoPo(entries, outcome.result.file.entries);
      mergeEntries(mergeResult.entries);
    },
    [entries, mergeEntries, t],
  );

  const handleRepoFileLoaded = useCallback(
    (content: string, repoFilename: string) => {
      setRepoSyncOpen(false);
      const outcome = parseFileContent(content, repoFilename);
      if (!outcome.ok) {
        setError(outcome.errors[0]?.message ?? t('Failed to parse file'));
        return;
      }
      loadFile(outcome.result.file, outcome.result.format === 'i18next' ? 'i18next' : undefined);
    },
    [loadFile, t],
  );

  const handleOpenSettings = useCallback((tab?: string) => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <motion.div variants={fadeVariants} initial="hidden" animate="visible">
        <Center py={80}>
          <Loader size="lg" />
        </Center>
      </motion.div>
    );
  }

  if (error || !project || !language) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
          {error ?? t('Project not found')}
        </Alert>
        <Button component={Link} to="/dashboard" variant="light" mt="md">
          {t('Back to dashboard')}
        </Button>
      </Container>
    );
  }

  const syncIndicator =
    syncState === 'saving' ? (
      <Tooltip label={t('Syncing to cloud…')}>
        <Group gap={4} style={{ color: 'var(--mantine-color-blue-5)' }}>
          <Cloud size={14} className="icon-spin" />
          <Text size="xs" fw={500}>
            {t('Saving…')}
          </Text>
        </Group>
      </Tooltip>
    ) : syncState === 'saved' ? (
      <Tooltip label={t('All changes saved')}>
        <Group gap={4} style={{ color: 'var(--mantine-color-teal-6)' }}>
          <Check size={14} />
          <Text size="xs" fw={500}>
            {t('Saved')}
          </Text>
        </Group>
      </Tooltip>
    ) : syncState === 'error' ? (
      <Tooltip label={t('Sync error — retrying')}>
        <Group gap={4} style={{ color: 'var(--mantine-color-red-6)' }}>
          <CloudOff size={14} />
          <Text size="xs" fw={500}>
            {t('Error')}
          </Text>
        </Group>
      </Tooltip>
    ) : null;

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* EditorHeader — same component as the local editor */}
        <EditorHeader
          onFileUpload={handleFileUpload}
          fileInputRef={fileInputRef}
          fileResetRef={fileResetRef}
          filename={filename}
          hasUnsavedChanges={hasUnsavedChanges}
          sourceFormat={sourceFormat}
          onDownload={handleDownload}
          onDownloadAs={handleDownloadAs}
          onPotUpload={handlePotUpload}
          repoConnection={repoConnection}
          onPushToRepo={() => setRepoSyncOpen(true)}
          isMobile={isMobile}
          onOpenFeedback={() => setFeedbackOpen(true)}
          onToggleColorScheme={toggleColorScheme}
          onOpenSettings={handleOpenSettings}
          onLoadFromUrl={noop}
          onOpenWordPressProject={noop}
          onRefreshWordPress={
            project.wp_project_type && project.wp_slug && filename ? noop : undefined
          }
          onOpenRepoSync={() => setRepoSyncOpen(true)}
          onClearClick={noop}
        />

        {/* Sync indicator */}
        {syncIndicator && <div style={{ marginTop: -8 }}>{syncIndicator}</div>}

        {/* Breadcrumb */}
        <Group gap={6} align="center">
          <Text
            component={Link}
            to={`/projects/${project.id}`}
            size="sm"
            style={{
              color: 'var(--gb-text-secondary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ArrowLeft size={14} />
            {project.name}
          </Text>
        </Group>

        {/* Title */}
        <div style={{ marginTop: -8 }}>
          <Title order={3}>
            {project.name} · {language.locale}
          </Title>
          {language.source_filename && (
            <Text size="xs" mt={4} style={{ color: 'var(--gb-text-tertiary)' }}>
              {language.source_filename}
            </Text>
          )}
        </div>

        {/* Editor workspace */}
        <EditorWorkspace
          workspaceMode={workspaceMode}
          onWorkspaceModeChange={setWorkspaceMode}
          encodingInfo={null}
          currentProjectType={project.wp_project_type as WordPressProjectType | null}
          currentProjectSlug={project.wp_slug ?? null}
          currentProjectRelease={null}
          onLanguageChange={handleLanguageChange}
          deeplGlossaryId={null}
          glossary={null}
          glossaryEnforcementEnabled={false}
          translateEnabled={false}
          glossarySyncStatus={null}
          speechEnabled={false}
          onEntrySelect={handleEntrySelect}
        />
      </Stack>

      {/* Modals */}
      <SettingsModal
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialTab={settingsTab}
        projectId={id}
      />
      <FeedbackModal opened={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <RepoSyncModal
        opened={repoSyncOpen}
        onClose={() => setRepoSyncOpen(false)}
        onFileLoaded={handleRepoFileLoaded}
        serializedContent={
          filename && entries.length > 0
            ? serializePOFile(
                { filename, header: header ?? {}, entries, charset: 'UTF-8' },
                { updateRevisionDate: true },
              )
            : null
        }
        initialTab={repoConnection ? 'push' : 'browse'}
      />
    </Container>
  );
}
