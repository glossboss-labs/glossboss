/**
 * ProjectEditor — cloud project editing page, scoped to a single language.
 *
 * Loads a project language from Supabase via the SupabaseStorageAdapter,
 * then renders the EditorWorkspace for translation editing.
 * Changes are automatically synced back to the cloud.
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
  Menu,
  FileButton,
  Tooltip,
} from '@mantine/core';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  AlertCircle,
  Download,
  Upload,
  FileUp,
  ChevronDown,
  Archive,
  Cloud,
  CloudOff,
  Check,
} from 'lucide-react';
import { sectionVariants, fadeVariants, buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { AppHeader } from '@/components/AppHeader';
import { SettingsModal } from '@/components/SettingsModal';
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
import { serializePOFile } from '@/lib/po';
import { serializeToI18next } from '@/lib/i18next';
import { parseUploadedFile } from '@/lib/po/parse-file';
import { mergePotIntoPo } from '@/lib/po/merge';
import type { SourceLanguage, TargetLanguage } from '@/lib/deepl/types';
import type { MachineTranslationMeta } from '@/stores/editor-store';
import type { ReviewEntryState } from '@/lib/review';
import type { WordPressProjectType } from '@/lib/wp-source/references';

type SyncState = 'idle' | 'saving' | 'saved' | 'error';

export default function ProjectEditor() {
  const { id, languageId } = useParams<{ id: string; languageId: string }>();
  const { t } = useTranslation();
  const adapterRef = useRef<SupabaseStorageAdapter | null>(null);
  const fileResetRef = useRef<(() => void) | null>(null);
  const potResetRef = useRef<(() => void) | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [language, setLanguage] = useState<ProjectLanguageRow | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('edit');
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [settingsTab, setSettingsTab] = useState<string | null>(null);

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

        // Convert DB rows to editor state
        const poEntries = dbEntries.map((row, i) => dbEntryToPOEntry(row, i));
        const poHeader = dbLanguageToHeader(lang);
        const poFile: POFile = {
          filename: lang.source_filename ?? `${proj.name}-${lang.locale}.po`,
          header: poHeader ?? {},
          entries: poEntries,
          charset: 'UTF-8',
        };

        // Switch to cloud adapter before loading data
        const adapter = new SupabaseStorageAdapter(id!, languageId!);
        adapterRef.current = adapter;
        setStorageAdapter(adapter);

        // Load file into editor store
        loadFile(poFile, proj.source_format === 'i18next' ? 'i18next' : undefined);

        // Restore MT metadata
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

        // Restore review entries
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
      // Flush pending sync and restore local adapter
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

  // Placeholder callbacks — wired up in a future iteration
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

  const performDownload = useCallback(
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
    performDownload(sourceFormat);
  }, [performDownload, sourceFormat]);

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
      <Container size="lg" py="xl">
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
      <AppHeader
        actions={
          <>
            <motion.div {...buttonStates}>
              <FileButton
                onChange={(f) => void handleFileUpload(f)}
                accept=".po,.pot,.json"
                resetRef={fileResetRef}
              >
                {(props) => (
                  <Button size="sm" leftSection={<Upload size={16} />} {...props}>
                    {t('Upload')}
                  </Button>
                )}
              </FileButton>
            </motion.div>

            {filename && (
              <>
                <Group gap={0}>
                  <motion.div {...buttonStates}>
                    <Button
                      size="sm"
                      variant="light"
                      leftSection={<Download size={16} />}
                      onClick={handleDownload}
                      style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                    >
                      {t('Download')}
                    </Button>
                  </motion.div>
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <Button
                        size="sm"
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
                      <Menu.Item onClick={() => performDownload('po')}>
                        {t('PO file (.po)')}
                      </Menu.Item>
                      <Menu.Item onClick={() => performDownload('i18next')}>
                        {t('i18next JSON (.json)')}
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<Archive size={14} />}
                        onClick={() => setSettingsTab('transfer')}
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
                    <FileButton
                      onChange={(f) => void handlePotUpload(f)}
                      accept=".pot"
                      resetRef={potResetRef}
                    >
                      {(props) => (
                        <Button
                          size="sm"
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
              </>
            )}

            {syncIndicator}
          </>
        }
      />
      <motion.div variants={sectionVariants} initial="hidden" animate="visible">
        <Stack gap="lg">
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
      </motion.div>

      <SettingsModal
        opened={settingsTab !== null}
        onClose={() => setSettingsTab(null)}
        initialTab={settingsTab ?? undefined}
      />
    </Container>
  );
}
