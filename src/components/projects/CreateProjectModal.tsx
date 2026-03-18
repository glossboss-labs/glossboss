/**
 * CreateProjectModal — create a cloud project from a PO/JSON file,
 * a WordPress.org translation export, or a repository file.
 *
 * Step 1: Choose source and import the file.
 * Step 2: Configure project metadata, then create.
 *
 * Reuses WordPressProjectModal and RepoSyncModal for their import flows.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Stepper,
  Stack,
  TextInput,
  Select,
  Button,
  Group,
  Paper,
  Text,
  Badge,
  FileButton,
  Alert,
} from '@mantine/core';
import { Upload, Globe, GitBranch, AlertCircle, FolderPlus, Zap } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { msgid } from '@/lib/app-language';
import { trackEvent } from '@/lib/analytics';
import type { POFile } from '@/lib/po/types';
import type { FileFormat } from '@/stores/editor-store';
import { parseUploadedFile, parseFileContent } from '@/lib/po/parse-file';
import { fetchWordPressTranslationFile } from '@/lib/wp-source';
import type { WordPressProjectOpenRequest } from '@/components/editor/WordPressProjectModal';
import { WordPressProjectModal } from '@/components/editor/WordPressProjectModal';
import { RepoSyncModal } from '@/components/repo-sync/RepoSyncModal';
import { useProjects, useCreateProject } from '@/lib/projects/queries';
import { useOrganizations } from '@/lib/organizations/queries';
import { useAuth } from '@/hooks/use-auth';
import { useSubscription } from '@/hooks/use-subscription';
import { isAtLimit, getRemainingCapacity, formatLimit, PLAN_LIMITS } from '@/lib/billing/limits';
import { useNavigate, Link } from 'react-router';
import { detectLimitError, getLimitErrorMessage } from '@/lib/billing/errors';
import { getOrgSubscription } from '@/lib/billing/api';
import type { PlanTier } from '@/lib/billing/types';
import type { WordPressProjectType } from '@/lib/wp-source/references';
import { CountryFlag } from '@/components/ui';

const VISIBILITY_OPTIONS = [
  { value: 'private', label: msgid('Private') },
  { value: 'public', label: msgid('Public') },
  { value: 'unlisted', label: msgid('Unlisted') },
];

interface CreateProjectModalProps {
  opened: boolean;
  onClose: () => void;
}

interface ImportedFile {
  file: POFile;
  format: FileFormat;
  originalFilename: string;
  wpProjectType?: WordPressProjectType;
  wpSlug?: string;
  wpTrack?: 'stable' | 'dev';
  wpLocale?: string;
}

export function CreateProjectModal({ opened, onClose }: CreateProjectModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const createProjectMutation = useCreateProject();
  const { data: projects = [] } = useProjects();
  const { data: organizations = [] } = useOrganizations();
  const { plan } = useSubscription();
  const fileResetRef = useRef<(() => void) | null>(null);

  // Eagerly check project limit so we can warn on step 0
  const personalProjectCount = projects.filter((p) => !p.organization_id).length;
  const atProjectLimit = isAtLimit(plan, 'projects', personalProjectCount);

  // Stepper
  const [step, setStep] = useState(0);

  // Step 1: import state
  const [importedFile, setImportedFile] = useState<ImportedFile | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [wpModalOpen, setWpModalOpen] = useState(false);
  const [repoModalOpen, setRepoModalOpen] = useState(false);

  // Step 2: project config
  const [projectName, setProjectName] = useState('');
  const [visibility, setVisibility] = useState<string>('private');
  const [sourceFormat, setSourceFormat] = useState<string>('po');
  const [sourceLanguage, setSourceLanguage] = useState('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isLimitError, setIsLimitError] = useState(false);

  // Fetch org subscription when an org is selected
  const [orgPlan, setOrgPlan] = useState<PlanTier | null>(null);
  useEffect(() => {
    if (!organizationId) {
      setOrgPlan(null);
      return;
    }
    let cancelled = false;
    getOrgSubscription(organizationId).then((sub) => {
      if (!cancelled) setOrgPlan(sub?.plan ?? 'free');
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const resetState = useCallback(() => {
    setStep(0);
    setImportedFile(null);
    setImportError(null);
    setImporting(false);
    setWpModalOpen(false);
    setRepoModalOpen(false);
    setProjectName('');
    setVisibility('private');
    setSourceFormat('po');
    setSourceLanguage('');
    setOrganizationId(null);
    setOrgPlan(null);
    setCreating(false);
    setCreateError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  // Move to step 2 with an imported file
  const advanceWithFile = useCallback(
    (imported: ImportedFile) => {
      setImportedFile(imported);
      setImportError(null);

      // Auto-fill project name from filename (strip extension)
      const baseName = imported.originalFilename.replace(/\.(po|pot|json)$/i, '');
      setProjectName(baseName || t('New project'));

      setStep(1);
    },
    [t],
  );

  // ── Source: File upload ────────────────────────────────────

  const handleFileUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setImporting(true);
      setImportError(null);

      const outcome = await parseUploadedFile(file);

      if (!outcome.ok) {
        setImportError(outcome.errors[0]?.message ?? t('Failed to parse file'));
        setImporting(false);
        return;
      }

      advanceWithFile({
        file: outcome.result.file,
        format: outcome.result.format,
        originalFilename: file.name,
      });
      setImporting(false);
    },
    [advanceWithFile, t],
  );

  // ── Source: WordPress.org ──────────────────────────────────

  const handleWordPressProject = useCallback(
    async (request: WordPressProjectOpenRequest) => {
      setWpModalOpen(false);
      setImporting(true);
      setImportError(null);

      try {
        const text = await fetchWordPressTranslationFile({
          projectType: request.projectType,
          slug: request.slug,
          locale: request.locale,
          track: request.track,
        });
        const wpFilename = `${request.slug}-${request.locale.replaceAll('-', '_')}.po`;
        const outcome = parseFileContent(text, wpFilename);

        if (!outcome.ok) {
          setImportError(outcome.errors[0]?.message ?? t('Failed to parse file'));
          setImporting(false);
          return;
        }

        advanceWithFile({
          file: outcome.result.file,
          format: outcome.result.format,
          originalFilename: wpFilename,
          wpProjectType: request.projectType,
          wpSlug: request.slug,
          wpTrack: request.track,
          wpLocale: request.locale,
        });
      } catch (err) {
        setImportError(err instanceof Error ? err.message : t('Failed to fetch WordPress file'));
      } finally {
        setImporting(false);
      }
    },
    [advanceWithFile, t],
  );

  // ── Source: Repository ─────────────────────────────────────

  const handleRepoFileLoaded = useCallback(
    (content: string, repoFilename: string) => {
      setRepoModalOpen(false);
      setImportError(null);

      const outcome = parseFileContent(content, repoFilename);

      if (!outcome.ok) {
        setImportError(outcome.errors[0]?.message ?? t('Failed to parse file'));
        return;
      }

      advanceWithFile({
        file: outcome.result.file,
        format: outcome.result.format,
        originalFilename: repoFilename,
      });
    },
    [advanceWithFile, t],
  );

  // ── Empty project (skip import) ──────────────────────────

  const handleEmptyProject = useCallback(() => {
    setImportedFile(null);
    setImportError(null);
    setProjectName(t('New project'));
    setStep(1);
  }, [t]);

  // ── Create project ────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!user) return;
    setCreating(true);
    setCreateError(null);

    try {
      if (importedFile) {
        const { file, format } = importedFile;
        const header = file.header;
        const locale = header.language ?? 'unknown';

        const { project } = await createProjectMutation.mutateAsync({
          insert: {
            owner_id: user.id,
            organization_id: organizationId,
            name: projectName.trim() || importedFile.originalFilename,
            description: '',
            visibility: visibility as 'private' | 'public' | 'unlisted',
            source_language: header.language ?? null,
            target_language: header.language ?? null,
            source_format: format === 'i18next' ? 'i18next' : 'po',
            source_filename: importedFile.originalFilename,
            po_header: header as Record<string, string>,
            wp_project_type: importedFile.wpProjectType ?? null,
            wp_slug: importedFile.wpSlug ?? null,
            wp_track: importedFile.wpTrack ?? null,
          },
          languageInsert: {
            project_id: '', // will be set by mutation
            locale,
            source_filename: importedFile.originalFilename,
            po_header: header as Record<string, string>,
            wp_locale: importedFile.wpLocale ?? null,
            repo_provider: null,
            repo_owner: null,
            repo_name: null,
            repo_branch: null,
            repo_file_path: null,
            repo_default_branch: null,
          },
          entries: file.entries,
        });

        trackEvent('project_created', {
          source_language: header.language ?? 'unknown',
          target_languages_count: 1,
        });

        handleClose();
        void navigate(`/projects/${project.id}`);
      } else {
        // Empty project — no language or entries
        const { project } = await createProjectMutation.mutateAsync({
          insert: {
            owner_id: user.id,
            organization_id: organizationId,
            name: projectName.trim() || t('New project'),
            description: '',
            visibility: visibility as 'private' | 'public' | 'unlisted',
            source_language: sourceLanguage || null,
            target_language: null,
            source_format: sourceFormat as 'po' | 'i18next',
            source_filename: null,
            po_header: null,
            wp_project_type: null,
            wp_slug: null,
            wp_track: null,
          },
        });

        trackEvent('project_created', {
          source_language: sourceLanguage || 'unknown',
          target_languages_count: 0,
        });

        handleClose();
        void navigate(`/projects/${project.id}`);
      }
    } catch (err) {
      const limitResource = detectLimitError(err);
      const message = limitResource
        ? t(getLimitErrorMessage(limitResource))
        : err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : t('Failed to create project');
      setCreateError(message);
      setIsLimitError(limitResource !== null);
      setCreating(false);
    }
  }, [
    createProjectMutation,
    handleClose,
    importedFile,
    navigate,
    organizationId,
    projectName,
    sourceFormat,
    sourceLanguage,
    t,
    user,
    visibility,
  ]);

  // Derived
  const targetLanguage = importedFile?.file.header.language ?? null;
  const entryCount = importedFile?.file.entries.length ?? 0;

  // Proactive string-limit check — uses org plan when an org is selected
  const effectivePlan: PlanTier | null = organizationId ? orgPlan : plan;
  const currentStringCount = projects
    .filter((p) => (organizationId ? p.organization_id === organizationId : !p.organization_id))
    .reduce((sum, p) => sum + p.stats_total, 0);
  const stringLimit = effectivePlan ? PLAN_LIMITS[effectivePlan].strings : Infinity;
  const remainingStrings = effectivePlan
    ? getRemainingCapacity(effectivePlan, 'strings', currentStringCount)
    : Infinity;
  const exceedsStringLimit =
    entryCount > 0 && remainingStrings !== Infinity && entryCount > remainingStrings;

  return (
    <>
      <Modal
        opened={opened && !wpModalOpen && !repoModalOpen}
        onClose={handleClose}
        title={t('New project')}
        size="lg"
      >
        <Stepper active={step} size="sm" mb="lg">
          <Stepper.Step label={t('Import')} />
          <Stepper.Step label={t('Configure')} />
        </Stepper>

        {step === 0 && (
          <Stack gap="md">
            {atProjectLimit && (
              <Alert icon={<Zap size={16} />} color="yellow" variant="light">
                <Stack gap="xs">
                  <Text size="sm">
                    {t(
                      'You have reached the project limit on your current plan. Upgrade to create more projects.',
                    )}
                  </Text>
                  <Button
                    component={Link}
                    to="/settings?tab=billing"
                    size="xs"
                    variant="filled"
                    color="blue"
                    leftSection={<Zap size={14} />}
                    onClick={handleClose}
                  >
                    {t('View plans')}
                  </Button>
                </Stack>
              </Alert>
            )}

            <Text size="sm" c="dimmed">
              {t('Choose a source to create your cloud project from.')}
            </Text>

            {importError && (
              <Alert
                icon={<AlertCircle size={16} />}
                color="red"
                variant="light"
                onClose={() => setImportError(null)}
                withCloseButton
              >
                {importError}
              </Alert>
            )}

            {/* File upload */}
            <Paper withBorder p="md">
              <Group justify="space-between" align="center">
                <Group gap="sm">
                  <Upload size={20} />
                  <div>
                    <Text size="sm" fw={500}>
                      {t('Upload a file')}
                    </Text>
                    <Group gap={4} mt={2}>
                      <Badge variant="light" size="xs" color="blue">
                        .po
                      </Badge>
                      <Badge variant="light" size="xs" color="blue">
                        .pot
                      </Badge>
                      <Badge variant="light" size="xs" color="blue">
                        .json
                      </Badge>
                    </Group>
                  </div>
                </Group>
                <FileButton
                  onChange={(f) => void handleFileUpload(f)}
                  accept=".po,.pot,.json"
                  resetRef={fileResetRef}
                >
                  {(props) => (
                    <Button size="sm" loading={importing} {...props}>
                      {t('Browse')}
                    </Button>
                  )}
                </FileButton>
              </Group>
            </Paper>

            {/* WordPress */}
            <Paper withBorder p="md">
              <Group justify="space-between" align="center">
                <Group gap="sm">
                  <Globe size={20} />
                  <div>
                    <Text size="sm" fw={500}>
                      {t('Open from WordPress.org')}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t('Import a translation export by project slug')}
                    </Text>
                  </div>
                </Group>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setWpModalOpen(true)}
                  loading={importing}
                >
                  {t('Select')}
                </Button>
              </Group>
            </Paper>

            {/* Repository */}
            <Paper withBorder p="md">
              <Group justify="space-between" align="center">
                <Group gap="sm">
                  <GitBranch size={20} />
                  <div>
                    <Text size="sm" fw={500}>
                      {t('Open from repository')}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t('Browse a GitHub or GitLab repository')}
                    </Text>
                  </div>
                </Group>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setRepoModalOpen(true)}
                  loading={importing}
                >
                  {t('Select')}
                </Button>
              </Group>
            </Paper>

            {/* Empty project */}
            <Paper withBorder p="md">
              <Group justify="space-between" align="center">
                <Group gap="sm">
                  <FolderPlus size={20} />
                  <div>
                    <Text size="sm" fw={500}>
                      {t('Empty project')}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t('Set up a project and add languages later')}
                    </Text>
                  </div>
                </Group>
                <Button size="sm" variant="default" onClick={handleEmptyProject}>
                  {t('Create')}
                </Button>
              </Group>
            </Paper>
          </Stack>
        )}

        {step === 1 && (
          <Stack gap="md">
            {createError && (
              <Alert
                icon={isLimitError ? <Zap size={16} /> : <AlertCircle size={16} />}
                color={isLimitError ? 'yellow' : 'red'}
                variant="light"
              >
                <Stack gap="xs">
                  <Text size="sm">{createError}</Text>
                  {isLimitError && (
                    <Button
                      component={Link}
                      to="/settings?tab=billing"
                      size="xs"
                      variant="filled"
                      color="blue"
                      leftSection={<Zap size={14} />}
                      onClick={handleClose}
                    >
                      {t('View plans')}
                    </Button>
                  )}
                </Stack>
              </Alert>
            )}

            {exceedsStringLimit && (
              <Alert icon={<Zap size={16} />} color="yellow" variant="light">
                <Stack gap="xs">
                  <Text size="sm">
                    {remainingStrings === 0
                      ? t(
                          'This file has {{count}} strings, but you have reached your plan limit of {{limit}} strings. Upgrade to import this file.',
                          {
                            count: entryCount.toLocaleString(),
                            limit: formatLimit(stringLimit),
                          },
                        )
                      : t(
                          'This file has {{count}} strings, but you can only add {{remaining}} more on your current plan ({{limit}} total). Upgrade to import this file.',
                          {
                            count: entryCount.toLocaleString(),
                            remaining: remainingStrings.toLocaleString(),
                            limit: formatLimit(stringLimit),
                          },
                        )}
                  </Text>
                  <Button
                    component={Link}
                    to="/settings?tab=billing"
                    size="xs"
                    variant="filled"
                    color="blue"
                    leftSection={<Zap size={14} />}
                    onClick={handleClose}
                  >
                    {t('View plans')}
                  </Button>
                </Stack>
              </Alert>
            )}

            <TextInput
              label={t('Project name')}
              value={projectName}
              onChange={(e) => setProjectName(e.currentTarget.value)}
              required
            />

            <Select
              label={t('Visibility')}
              data={VISIBILITY_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
              value={visibility}
              onChange={(v) => setVisibility(v ?? 'private')}
            />

            {organizations.length > 0 && (
              <Select
                label={t('Organization')}
                placeholder={t('Personal project')}
                data={organizations.map((o) => ({ value: o.id, label: o.name }))}
                value={organizationId}
                onChange={setOrganizationId}
                clearable
              />
            )}

            {!importedFile && (
              <>
                <Select
                  label={t('Source format')}
                  data={[
                    { value: 'po', label: 'PO (gettext)' },
                    { value: 'i18next', label: 'i18next JSON' },
                  ]}
                  value={sourceFormat}
                  onChange={(v) => setSourceFormat(v ?? 'po')}
                />
                <TextInput
                  label={t('Source language')}
                  placeholder="en"
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.currentTarget.value)}
                />
              </>
            )}

            {importedFile && (
              <Group gap="sm">
                {targetLanguage && (
                  <Badge
                    variant="light"
                    color="blue"
                    leftSection={<CountryFlag code={targetLanguage} size="xs" />}
                  >
                    {t('Target: {{language}}', { language: targetLanguage })}
                  </Badge>
                )}
                <Badge variant="light">{t('{{count}} total entries', { count: entryCount })}</Badge>
                <Badge variant="light" color="gray">
                  {importedFile.originalFilename}
                </Badge>
              </Group>
            )}

            <Group justify="space-between" mt="md">
              <Button variant="default" onClick={() => setStep(0)}>
                {t('Back')}
              </Button>
              <Button
                leftSection={<FolderPlus size={16} />}
                loading={creating}
                onClick={() => void handleCreate()}
                disabled={!projectName.trim() || exceedsStringLimit}
              >
                {t('Create project')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Sub-modals for WordPress and repository import */}
      <WordPressProjectModal
        opened={wpModalOpen}
        onClose={() => setWpModalOpen(false)}
        onOpenProject={handleWordPressProject}
      />

      <RepoSyncModal
        opened={repoModalOpen}
        onClose={() => setRepoModalOpen(false)}
        onFileLoaded={handleRepoFileLoaded}
        serializedContent={null}
        initialTab="browse"
      />
    </>
  );
}
