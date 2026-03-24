/**
 * ProjectEditor — cloud project editing page, scoped to a single language.
 *
 * Loads project data from Supabase into the editor store, then renders
 * the SAME editor UI as the local editor (Index page) via useIndexPageController.
 * This guarantees 100% feature parity — same header, same workspace, same
 * dialogs, same settings. The only difference is the storage adapter.
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Box, Container, Stack, Group, Text, Button, Center, Loader, Alert } from '@mantine/core';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AnimatedStateSwitch } from '@/components/ui';
import { useTranslation } from '@/lib/app-language';
import { EditorHeader, EditorWorkspace, EmptyState, PresenceAvatars } from '@/components/editor';
import { useRealtimeChannel } from '@/hooks/use-realtime-channel';
import { useIndexPageController } from './index/useIndexPageController';
import { IndexPageBanners } from './index/IndexPageBanners';
import { IndexPageDialogs } from './index/IndexPageDialogs';
import { IndexPageNotifications } from './index/IndexPageNotifications';
import { useEditorStore } from '@/stores/editor-store';
import type { MachineTranslationMeta } from '@/stores/editor-store';
import { useProjectEditorPage } from '@/lib/projects/queries';
import {
  dbEntryToPOEntry,
  dbEntryToMTMeta,
  dbEntryToReviewState,
  dbLanguageToHeader,
} from '@/lib/projects/conversions';
import type { ProjectRow, ProjectLanguageRow } from '@/lib/projects/types';
import type { POFile } from '@/lib/po/types';
import { SupabaseStorageAdapter } from '@/lib/cloud/supabase-adapter';
import { LocalStorageAdapter } from '@/lib/cloud/local-adapter';
import { setStorageAdapter } from '@/lib/cloud/adapter';
import { useRepoSyncStore } from '@/stores/repo-sync-store';
import { useProjectRole } from '@/hooks/use-project-role';
import { useRepoDbSync } from '@/hooks/use-repo-db-sync';
import { loadGlossaryForLanguage } from '@/lib/glossary/loader';
import { TranslationProviderOverride } from '@/hooks/use-translation-provider';
import { getOrgSettings } from '@/lib/organizations/api';
import type { OrgSettingsRow } from '@/lib/organizations/types';
import type { ReviewEntryState } from '@/lib/review';
import { recordRecentProject } from '@/hooks/use-recent-projects';

export default function ProjectEditor() {
  const { id, languageId } = useParams<{ id: string; languageId: string }>();
  const { t } = useTranslation();
  const adapterRef = useRef<SupabaseStorageAdapter | null>(null);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const queryKey = id && languageId ? `${id}:${languageId}` : null;

  const loadFile = useEditorStore((s) => s.loadFile);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const restoreReviewEntries = useEditorStore((s) => s.restoreReviewEntries);
  const { data, isLoading, error: queryError } = useProjectEditorPage(id, languageId);
  const project = data?.project ?? null;
  const language = data?.language ?? null;

  useEffect(() => {
    setHydratedKey(null);
  }, [queryKey]);

  // Load project + language from query cache into the editor store
  useEffect(() => {
    if (!id || !languageId || !project || !language) return;

    let cancelled = false;

    const dbEntries = data.entries;
    recordRecentProject(project.id, project.name, `/projects/${id}/languages/${languageId}`);

    const poEntries = dbEntries.map((row, i) => dbEntryToPOEntry(row, i));
    const poHeader = dbLanguageToHeader(language);
    const poFile: POFile = {
      filename: language.source_filename ?? `${project.name}-${language.locale}.po`,
      header: poHeader ?? {},
      entries: poEntries,
      charset: 'UTF-8',
    };

    const adapter = new SupabaseStorageAdapter(id, languageId);
    adapterRef.current = adapter;
    setStorageAdapter(adapter);

    loadFile(poFile, project.source_format as import('@/stores/editor-store').FileFormat);
    setProjectName(project.name);

    if (!poFile.header.language && language.locale) {
      useEditorStore.setState((state) => ({
        header: { ...state.header, language: language.locale },
      }));
    }

    const mtMeta = new Map<string, MachineTranslationMeta>();
    const mtIds = new Set<string>();
    for (let i = 0; i < dbEntries.length; i++) {
      const meta = dbEntryToMTMeta(dbEntries[i]!);
      if (meta) {
        mtMeta.set(poEntries[i]!.id, meta);
        mtIds.add(poEntries[i]!.id);
      }
    }

    const reviewMap = new Map<string, ReviewEntryState>();
    for (let i = 0; i < dbEntries.length; i++) {
      const review = dbEntryToReviewState(dbEntries[i]!);
      if (review.status !== 'draft' || review.comments.length > 0) {
        reviewMap.set(poEntries[i]!.id, review);
      }
    }

    useEditorStore.setState({
      machineTranslationMeta: mtMeta,
      machineTranslatedIds: mtIds,
    });
    restoreReviewEntries(reviewMap);

    if (language.repo_provider && language.repo_owner && language.repo_name) {
      useRepoSyncStore.getState().setConnection({
        provider: language.repo_provider,
        owner: language.repo_owner,
        repo: language.repo_name,
        branch: language.repo_branch ?? language.repo_default_branch ?? 'main',
        filePath: language.repo_file_path ?? '',
        baseSha: '',
        defaultBranch: language.repo_default_branch ?? 'main',
      });
    } else {
      useRepoSyncStore.getState().clearConnection();
    }

    if (!cancelled) {
      setHydratedKey(queryKey);
    }

    return () => {
      cancelled = true;
      if (adapterRef.current) {
        void adapterRef.current.flush();
        adapterRef.current = null;
      }
      setStorageAdapter(new LocalStorageAdapter());
      useRepoSyncStore.getState().clearConnection();
    };
  }, [
    data,
    id,
    language,
    languageId,
    loadFile,
    project,
    queryKey,
    restoreReviewEntries,
    setProjectName,
  ]);

  const error = queryError ? ((queryError as Error).message ?? t('Failed to load project')) : null;
  const loading = isLoading || !project || !language || hydratedKey !== queryKey;
  const stateKey = loading ? 'loading' : error ? 'error' : 'editor';

  return (
    <AnimatedStateSwitch stateKey={stateKey}>
      {loading ? (
        <Center py={80}>
          <Loader size="lg" />
        </Center>
      ) : error || !project || !language ? (
        <Container size="xl" py="xl">
          <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
            {error ?? t('Project not found')}
          </Alert>
          <Button component={Link} to="/dashboard" variant="light" mt="md">
            {t('Back to dashboard')}
          </Button>
        </Container>
      ) : (
        <ProjectEditorLoaded project={project} language={language} />
      )}
    </AnimatedStateSwitch>
  );
}

/**
 * Inner component rendered after data is loaded into the editor store.
 * Uses useIndexPageController() — the EXACT same hook as the local editor —
 * so all features (File menu, repo sync, settings, feedback, etc.) work.
 */
function ProjectEditorLoaded({
  project,
  language,
}: {
  project: ProjectRow;
  language: ProjectLanguageRow;
}) {
  // Connect to realtime channel for this project-language
  const { broadcastEntryUpdate, broadcastLock, broadcastUnlock, broadcastReviewEvent } =
    useRealtimeChannel(project.id, language.id);

  // Role-based permissions
  const { isManager, isContributor } = useProjectRole(project.id);

  // Sync repo connection changes back to the database
  useRepoDbSync(language.id);

  // Load org settings for the cascade (org → project → user)
  const { data: orgSettings = null } = useQuery<OrgSettingsRow | null>({
    queryKey: project.organization_id
      ? ['organizations', project.organization_id, 'settings']
      : ['organizations', 'settings', 'none'],
    queryFn: () => getOrgSettings(project.organization_id!),
    enabled: Boolean(project.organization_id),
    staleTime: 60_000,
  });

  const {
    containerWidth,
    headerProps,
    workspaceProps,
    emptyStateProps,
    notificationsProps,
    bannersProps,
    dialogsProps,
    loadGlossaryForLocale,
  } = useIndexPageController({ readOnly: !isContributor });

  // Keep a stable ref so the effect only re-runs when glossary config changes,
  // not every time the callback identity shifts (it depends on `entries`).
  const loadGlossaryRef = useRef(loadGlossaryForLocale);
  useEffect(() => {
    loadGlossaryRef.current = loadGlossaryForLocale;
  });

  // Auto-load glossary based on the DB-configured source.
  // Only loads when glossary_source is set (null = no glossary).
  useEffect(() => {
    if (!language.glossary_source) return;

    let cancelled = false;

    loadGlossaryForLanguage(language).then((result) => {
      if (!cancelled && result.glossary) {
        void loadGlossaryRef.current(result.glossary);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when glossary config fields change, not the full language object
  }, [
    language.glossary_source,
    language.glossary_url,
    language.glossary_repo_file_path,
    language.locale,
  ]);

  return (
    <TranslationProviderOverride
      provider={language.translation_provider}
      orgDefaultProvider={orgSettings?.default_translation_provider ?? null}
      orgEnforced={orgSettings?.enforce_translation_provider ?? false}
    >
      <Box style={{ minHeight: '100vh', position: 'relative' }}>
        <IndexPageNotifications {...notificationsProps} />

        <Box component="main">
          <Container
            size={containerWidth === '100%' ? undefined : containerWidth}
            fluid={containerWidth === '100%'}
            py="xl"
          >
            <Stack gap="lg">
              <EditorHeader
                {...headerProps}
                projectId={project.id}
                onOpenRepoSync={isManager ? headerProps.onOpenRepoSync : undefined}
                onPushToRepo={isManager ? headerProps.onPushToRepo : undefined}
              />

              {/* Cloud project breadcrumb + presence */}
              <Group gap={6} align="center" justify="space-between" style={{ marginTop: -8 }}>
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
                  <Text size="xs" style={{ color: 'var(--gb-text-tertiary)' }}>
                    · {language.locale}
                  </Text>
                </Group>
                <PresenceAvatars />
              </Group>

              <IndexPageBanners {...bannersProps} />
              {workspaceProps ? (
                <EditorWorkspace
                  {...workspaceProps}
                  broadcastEntryUpdate={broadcastEntryUpdate}
                  broadcastLock={broadcastLock}
                  broadcastUnlock={broadcastUnlock}
                  broadcastReviewEvent={broadcastReviewEvent}
                />
              ) : (
                <EmptyState {...emptyStateProps} />
              )}
            </Stack>
          </Container>
        </Box>

        <IndexPageDialogs {...dialogsProps} />
      </Box>
    </TranslationProviderOverride>
  );
}
