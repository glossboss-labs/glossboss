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
import { motion } from 'motion/react';
import { fadeVariants } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { EditorHeader, EditorWorkspace, EmptyState, PresenceAvatars } from '@/components/editor';
import { useRealtimeChannel } from '@/hooks/use-realtime-channel';
import { useIndexPageController } from './index/useIndexPageController';
import { IndexPageBanners } from './index/IndexPageBanners';
import { IndexPageDialogs } from './index/IndexPageDialogs';
import { IndexPageNotifications } from './index/IndexPageNotifications';
import { useEditorStore } from '@/stores/editor-store';
import type { MachineTranslationMeta } from '@/stores/editor-store';
import { getProject, getProjectLanguage, getProjectEntries } from '@/lib/projects/api';
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [language, setLanguage] = useState<ProjectLanguageRow | null>(null);

  const loadFile = useEditorStore((s) => s.loadFile);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const restoreReviewEntries = useEditorStore((s) => s.restoreReviewEntries);

  // Load project + language from Supabase into the editor store
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
        recordRecentProject(proj.id, proj.name);

        const poEntries = dbEntries.map((row, i) => dbEntryToPOEntry(row, i));
        const poHeader = dbLanguageToHeader(lang);
        const poFile: POFile = {
          filename: lang.source_filename ?? `${proj.name}-${lang.locale}.po`,
          header: poHeader ?? {},
          entries: poEntries,
          charset: 'UTF-8',
        };

        // Switch to cloud adapter
        const adapter = new SupabaseStorageAdapter(id!, languageId!);
        adapterRef.current = adapter;
        setStorageAdapter(adapter);

        // Load into editor store — same store the Index page uses
        loadFile(poFile, proj.source_format === 'i18next' ? 'i18next' : undefined);

        // Override project name with the actual cloud project name
        setProjectName(proj.name);

        // Ensure the header has a language field for TM scoping
        if (!poFile.header.language && lang.locale) {
          useEditorStore.setState((state) => ({
            header: { ...state.header, language: lang.locale },
          }));
        }

        // Restore MT metadata
        const mtMeta = new Map<string, MachineTranslationMeta>();
        const mtIds = new Set<string>();
        for (let i = 0; i < dbEntries.length; i++) {
          const meta = dbEntryToMTMeta(dbEntries[i]!);
          if (meta) {
            mtMeta.set(poEntries[i]!.id, meta);
            mtIds.add(poEntries[i]!.id);
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
          const review = dbEntryToReviewState(dbEntries[i]!);
          if (review.status !== 'draft' || review.comments.length > 0) {
            reviewMap.set(poEntries[i]!.id, review);
          }
        }
        if (reviewMap.size > 0) {
          restoreReviewEntries(reviewMap);
        }

        // Initialize repo sync store from DB language record
        if (lang.repo_provider && lang.repo_owner && lang.repo_name) {
          useRepoSyncStore.getState().setConnection({
            provider: lang.repo_provider,
            owner: lang.repo_owner,
            repo: lang.repo_name,
            branch: lang.repo_branch ?? lang.repo_default_branch ?? 'main',
            filePath: lang.repo_file_path ?? '',
            baseSha: '',
            defaultBranch: lang.repo_default_branch ?? 'main',
          });
        } else {
          useRepoSyncStore.getState().clearConnection();
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
      useRepoSyncStore.getState().clearConnection();
    };
  }, [id, languageId, loadFile, setProjectName, restoreReviewEntries, t]);

  // Loading state
  if (loading) {
    return (
      <motion.div variants={fadeVariants} initial="hidden" animate="visible">
        <Center py={80}>
          <Loader size="lg" />
        </Center>
      </motion.div>
    );
  }

  // Error state
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

  // Data loaded — render the full editor using the same controller as Index
  return <ProjectEditorLoaded project={project} language={language} />;
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
  const [orgSettings, setOrgSettings] = useState<OrgSettingsRow | null>(null);
  useEffect(() => {
    if (!project.organization_id) return;
    let cancelled = false;
    getOrgSettings(project.organization_id).then((settings) => {
      if (!cancelled) setOrgSettings(settings);
    });
    return () => {
      cancelled = true;
    };
  }, [project.organization_id]);

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
