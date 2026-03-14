/**
 * ProjectEditor — cloud project editing page, scoped to a single language.
 *
 * Loads a project language from Supabase via the SupabaseStorageAdapter,
 * then renders the EditorWorkspace for translation editing.
 * Changes are automatically synced back to the cloud.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Container, Stack, Group, Title, Text, Button, Center, Loader, Alert } from '@mantine/core';
import { ArrowLeft, AlertCircle, Download } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useEditorStore } from '@/stores/editor-store';
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
import type { SourceLanguage, TargetLanguage } from '@/lib/deepl/types';
import type { MachineTranslationMeta } from '@/stores/editor-store';
import type { ReviewEntryState } from '@/lib/review';
import type { WordPressProjectType } from '@/lib/wp-source/references';

export default function ProjectEditor() {
  const { id, languageId } = useParams<{ id: string; languageId: string }>();
  const { t } = useTranslation();
  const adapterRef = useRef<SupabaseStorageAdapter | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [language, setLanguage] = useState<ProjectLanguageRow | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('edit');

  const loadFile = useEditorStore((s) => s.loadFile);
  const filename = useEditorStore((s) => s.filename);
  const header = useEditorStore((s) => s.header);
  const entries = useEditorStore((s) => s.entries);
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

  // Placeholder callbacks — wired up in a future iteration
  const noop = useCallback(() => {}, []);
  const handleLanguageChange = noop as unknown as (
    source: SourceLanguage | undefined,
    target: TargetLanguage,
  ) => void;
  const handleEntrySelect = noop as unknown as (sourceText: string) => void;

  const handleDownload = useCallback(() => {
    if (!filename || !entries.length) return;

    const content = serializePOFile(
      { filename, header: header ?? {}, entries, charset: 'UTF-8' },
      { updateRevisionDate: true },
    );
    const blob = new Blob([content], { type: 'text/x-gettext-translation;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [entries, filename, header]);

  if (loading) {
    return (
      <Center py={80}>
        <Loader size="lg" />
      </Center>
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

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Project header */}
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <Button
              component={Link}
              to={`/projects/${project.id}`}
              variant="subtle"
              leftSection={<ArrowLeft size={16} />}
              size="compact-md"
            >
              {project.name}
            </Button>
            <div>
              <Title order={3}>{language.locale}</Title>
              <Group gap="xs" mt={4}>
                <Text size="xs" c="dimmed">
                  {language.source_filename}
                </Text>
              </Group>
            </div>
          </Group>

          <Button
            variant="light"
            leftSection={<Download size={16} />}
            onClick={handleDownload}
            disabled={!filename}
          >
            {t('Download')}
          </Button>
        </Group>

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
    </Container>
  );
}
