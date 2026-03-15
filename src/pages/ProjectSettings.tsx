/**
 * ProjectSettings — dedicated settings page for a cloud project.
 *
 * Route: /projects/:id/settings
 * Tabs: General, Repository, Languages, Members, Danger Zone
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router';
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
  Paper,
  Badge,
  ActionIcon,
  Menu,
  TextInput,
  Textarea,
  Select,
  Tooltip,
  Tabs,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  AlertCircle,
  Settings,
  GitBranch,
  Languages,
  Users,
  Trash2,
  LogOut,
  Unlink,
  Plus,
} from 'lucide-react';
import { sectionVariants, fadeVariants, buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import {
  getProject,
  getProjectLanguages,
  listProjectMembers,
  listProjectInvites,
  updateProject,
  deleteProject,
  removeProjectMember,
  updateProjectLanguage,
} from '@/lib/projects/api';
import type {
  ProjectRow,
  ProjectLanguageRow,
  ProjectMemberWithProfile,
  ProjectInviteRow,
} from '@/lib/projects/types';
import { useProjectRole } from '@/hooks/use-project-role';
import { useAuth } from '@/hooks/use-auth';
import { AppHeader } from '@/components/AppHeader';
import { ProjectMembersTab } from '@/components/projects/ProjectMembersTab';
import { ProjectInvitesTab } from '@/components/projects/ProjectInvitesTab';
import { AddLanguageModal } from '@/components/projects/AddLanguageModal';
import { ConfirmModal } from '@/components/ui';
import { useProjectsStore } from '@/stores/projects-store';

const MotionDiv = motion.div;

export default function ProjectSettings() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'general';
  const { isAdmin, isManager } = useProjectRole(id);
  const deleteLanguage = useProjectsStore((s) => s.deleteLanguage);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [languages, setLanguages] = useState<ProjectLanguageRow[]>([]);
  const [members, setMembers] = useState<ProjectMemberWithProfile[]>([]);
  const [invites, setInvites] = useState<ProjectInviteRow[]>([]);

  // Edit state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState('private');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [addLanguageOpen, setAddLanguageOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const myMembership = useMemo(
    () => (user ? members.find((m) => m.user_id === user.id) : undefined),
    [user, members],
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const [proj, langs, mems, invs] = await Promise.all([
          getProject(id!),
          getProjectLanguages(id!),
          listProjectMembers(id!),
          listProjectInvites(id!).catch(() => [] as ProjectInviteRow[]),
        ]);
        if (cancelled) return;
        if (!proj) {
          setError(t('Project not found'));
          setLoading(false);
          return;
        }
        setProject(proj);
        setLanguages(langs);
        setMembers(mems);
        setInvites(invs);
        setEditName(proj.name);
        setEditDescription(proj.description);
        setEditVisibility(proj.visibility);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t('Failed to load project'));
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, t, refreshKey]);

  const handleTabChange = (tab: string | null) => {
    if (tab) setSearchParams({ tab }, { replace: true });
  };

  const handleSave = useCallback(async () => {
    if (!project || !editName.trim()) return;
    setSaving(true);
    try {
      const updated = await updateProject(project.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        visibility: editVisibility as 'private' | 'public' | 'unlisted',
      });
      setProject(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to save project'));
    } finally {
      setSaving(false);
    }
  }, [project, editName, editDescription, editVisibility, t]);

  const handleDelete = useCallback(async () => {
    if (!project) return;
    setDeleting(true);
    try {
      await deleteProject(project.id);
      setConfirmDeleteOpen(false);
      void navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to delete project'));
      setDeleting(false);
    }
  }, [project, navigate, t]);

  const handleLeave = useCallback(async () => {
    if (!myMembership) return;
    setLeaveLoading(true);
    try {
      await removeProjectMember(myMembership.id);
      setConfirmLeaveOpen(false);
      void navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to leave project'));
      setLeaveLoading(false);
    }
  }, [myMembership, navigate, t]);

  const handleDeleteLanguage = useCallback(
    async (languageId: string) => {
      try {
        await deleteLanguage(languageId);
        setLanguages((prev) => prev.filter((l) => l.id !== languageId));
      } catch (err) {
        setError(err instanceof Error ? err.message : t('Failed to delete language'));
      }
    },
    [deleteLanguage, t],
  );

  const handleUnlinkRepo = useCallback(
    async (languageId: string) => {
      try {
        await updateProjectLanguage(languageId, {
          repo_provider: null,
          repo_owner: null,
          repo_name: null,
          repo_branch: null,
          repo_file_path: null,
          repo_default_branch: null,
        });
        setLanguages((prev) =>
          prev.map((l) =>
            l.id === languageId
              ? {
                  ...l,
                  repo_provider: null,
                  repo_owner: null,
                  repo_name: null,
                  repo_branch: null,
                  repo_file_path: null,
                  repo_default_branch: null,
                }
              : l,
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : t('Failed to unlink repository'));
      }
    },
    [t],
  );

  if (loading) {
    return (
      <MotionDiv variants={fadeVariants} initial="hidden" animate="visible">
        <Center py={80}>
          <Loader size="lg" />
        </Center>
      </MotionDiv>
    );
  }

  if (error && !project) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
          {error}
        </Alert>
        <Button component={Link} to="/dashboard" variant="light" mt="md">
          {t('Back to dashboard')}
        </Button>
      </Container>
    );
  }

  if (!project) return null;

  return (
    <Container size="lg" py="xl">
      <AppHeader />
      <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
        <Stack gap="lg">
          {/* Breadcrumb */}
          <Group gap={6}>
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

          <Group gap="sm" align="center">
            <Settings size={20} style={{ color: 'var(--gb-text-secondary)' }} />
            <Title order={3}>{t('Project settings')}</Title>
          </Group>

          {error && (
            <Alert
              icon={<AlertCircle size={16} />}
              color="red"
              variant="light"
              withCloseButton
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            orientation={isMobile ? 'horizontal' : 'vertical'}
            variant="pills"
            styles={{
              root: isMobile ? undefined : { display: 'flex', gap: 'var(--mantine-spacing-xl)' },
              list: isMobile
                ? { overflowX: 'auto', flexWrap: 'nowrap' }
                : { minWidth: 180, flexShrink: 0 },
              tab: { justifyContent: 'flex-start' },
              panel: { flex: 1, minWidth: 0 },
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="general" leftSection={<Settings size={14} />}>
                {t('General')}
              </Tabs.Tab>
              <Tabs.Tab value="repository" leftSection={<GitBranch size={14} />}>
                {t('Repository')}
              </Tabs.Tab>
              <Tabs.Tab value="languages" leftSection={<Languages size={14} />}>
                {t('Languages')} ({languages.length})
              </Tabs.Tab>
              <Tabs.Tab value="members" leftSection={<Users size={14} />}>
                {t('Members')} ({members.length})
              </Tabs.Tab>
              <Tabs.Tab value="danger" leftSection={<Trash2 size={14} />} color="red">
                {t('Danger zone')}
              </Tabs.Tab>
            </Tabs.List>

            {/* General tab */}
            <Tabs.Panel value="general" pt={isMobile ? 'md' : undefined}>
              <Stack gap="lg">
                <Paper withBorder p="md">
                  <Text size="sm" fw={500} mb="sm">
                    {t('Project details')}
                  </Text>
                  {isManager ? (
                    <Stack gap="sm">
                      <TextInput
                        label={t('Project name')}
                        value={editName}
                        onChange={(e) => setEditName(e.currentTarget.value)}
                        maw={400}
                      />
                      <Textarea
                        label={t('Description')}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.currentTarget.value)}
                        autosize
                        minRows={2}
                        maxRows={4}
                        maw={400}
                      />
                      <Select
                        label={t('Visibility')}
                        data={[
                          { value: 'private', label: t('Private') },
                          { value: 'public', label: t('Public') },
                          { value: 'unlisted', label: t('Unlisted') },
                        ]}
                        value={editVisibility}
                        onChange={(v) => setEditVisibility(v || 'private')}
                        w={200}
                        allowDeselect={false}
                      />
                      {project.wp_slug && (
                        <Group gap="xs">
                          <Text size="sm" c="dimmed">
                            {t('WordPress')}: {project.wp_project_type} / {project.wp_slug}
                          </Text>
                        </Group>
                      )}
                      <div>
                        <motion.div {...buttonStates}>
                          <Button
                            onClick={() => void handleSave()}
                            loading={saving}
                            disabled={!editName.trim()}
                          >
                            {t('Save changes')}
                          </Button>
                        </motion.div>
                      </div>
                    </Stack>
                  ) : (
                    <Stack gap="xs">
                      <Text size="sm">
                        <strong>{t('Name')}:</strong> {project.name}
                      </Text>
                      <Text size="sm">
                        <strong>{t('Description')}:</strong> {project.description || '—'}
                      </Text>
                      <Text size="sm">
                        <strong>{t('Visibility')}:</strong> {project.visibility}
                      </Text>
                      <Text size="sm">
                        <strong>{t('Format')}:</strong> {project.source_format}
                      </Text>
                    </Stack>
                  )}
                </Paper>
              </Stack>
            </Tabs.Panel>

            {/* Repository tab */}
            <Tabs.Panel value="repository" pt={isMobile ? 'md' : undefined}>
              <Stack gap="md">
                <Text size="sm" c="dimmed">
                  {t(
                    'Repository connections are per-language. Each language can be linked to a file in a GitHub or GitLab repository.',
                  )}
                </Text>
                {languages.length === 0 ? (
                  <Paper withBorder p="md">
                    <Center py={20}>
                      <Text size="sm" c="dimmed">
                        {t('No languages in this project yet.')}
                      </Text>
                    </Center>
                  </Paper>
                ) : (
                  languages.map((lang) => {
                    const hasRepo = lang.repo_provider && lang.repo_owner && lang.repo_name;
                    return (
                      <Paper key={lang.id} withBorder p="md">
                        <Group justify="space-between" align="center" wrap="nowrap">
                          <Stack gap={4}>
                            <Group gap="sm">
                              <Text size="sm" fw={600}>
                                {lang.locale}
                              </Text>
                              {lang.source_filename && (
                                <Text size="xs" c="dimmed" truncate>
                                  {lang.source_filename}
                                </Text>
                              )}
                            </Group>
                            {hasRepo ? (
                              <Group gap="xs">
                                <Badge
                                  variant="light"
                                  size="sm"
                                  color="dark"
                                  leftSection={<GitBranch size={10} />}
                                >
                                  {lang.repo_provider === 'github' ? 'GitHub' : 'GitLab'}
                                </Badge>
                                <Text size="xs" c="dimmed">
                                  {lang.repo_owner}/{lang.repo_name}
                                  {lang.repo_branch ? ` @ ${lang.repo_branch}` : ''}
                                </Text>
                                {lang.repo_file_path && (
                                  <Text size="xs" c="dimmed">
                                    — {lang.repo_file_path}
                                  </Text>
                                )}
                              </Group>
                            ) : (
                              <Text size="xs" c="dimmed">
                                {t('No repository linked')}
                              </Text>
                            )}
                          </Stack>
                          {isManager && (
                            <Group gap="xs">
                              {hasRepo ? (
                                <Tooltip label={t('Unlink repository')}>
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    size="sm"
                                    onClick={() => void handleUnlinkRepo(lang.id)}
                                  >
                                    <Unlink size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              ) : (
                                <Button
                                  component={Link}
                                  to={`/projects/${project.id}/languages/${lang.id}`}
                                  variant="light"
                                  size="xs"
                                  leftSection={<GitBranch size={12} />}
                                >
                                  {t('Link repository')}
                                </Button>
                              )}
                            </Group>
                          )}
                        </Group>
                      </Paper>
                    );
                  })
                )}
              </Stack>
            </Tabs.Panel>

            {/* Languages tab */}
            <Tabs.Panel value="languages" pt={isMobile ? 'md' : undefined}>
              <Stack gap="md">
                {isManager && (
                  <Group justify="flex-end">
                    <motion.div {...buttonStates}>
                      <Button
                        leftSection={<Plus size={16} />}
                        onClick={() => setAddLanguageOpen(true)}
                      >
                        {t('Add language')}
                      </Button>
                    </motion.div>
                  </Group>
                )}
                {languages.length === 0 ? (
                  <Paper withBorder p="md">
                    <Center py={20}>
                      <Text size="sm" c="dimmed">
                        {t('No languages yet')}
                      </Text>
                    </Center>
                  </Paper>
                ) : (
                  languages.map((lang) => (
                    <Paper key={lang.id} withBorder p="sm">
                      <Group justify="space-between" align="center" wrap="nowrap">
                        <Stack gap={2}>
                          <Group gap="sm">
                            <Text size="sm" fw={600}>
                              {lang.locale}
                            </Text>
                            {lang.source_filename && (
                              <Text size="xs" c="dimmed" truncate>
                                {lang.source_filename}
                              </Text>
                            )}
                          </Group>
                          <Text size="xs" c="dimmed">
                            {lang.stats_total} {t('strings')} · {lang.stats_translated}{' '}
                            {t('translated')}
                          </Text>
                        </Stack>
                        {isManager && (
                          <Menu position="bottom-end" withinPortal>
                            <Menu.Target>
                              <ActionIcon variant="subtle" size="sm" color="gray">
                                <Trash2 size={14} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                color="red"
                                leftSection={<Trash2 size={14} />}
                                onClick={() => void handleDeleteLanguage(lang.id)}
                              >
                                {t('Delete language')}
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        )}
                      </Group>
                    </Paper>
                  ))
                )}
              </Stack>
            </Tabs.Panel>

            {/* Members tab */}
            <Tabs.Panel value="members" pt={isMobile ? 'md' : undefined}>
              <Stack gap="lg">
                <ProjectMembersTab
                  projectId={project.id}
                  members={members}
                  isAdmin={isAdmin}
                  currentUserId={user?.id}
                  onMembersChange={setMembers}
                  onInviteCreated={(inv) => setInvites((prev) => [inv, ...prev])}
                  onLeave={() => setConfirmLeaveOpen(true)}
                  onError={setError}
                />
                {isAdmin && invites.length > 0 && (
                  <ProjectInvitesTab
                    projectId={project.id}
                    invites={invites}
                    onInvitesChange={setInvites}
                    onError={setError}
                  />
                )}
              </Stack>
            </Tabs.Panel>

            {/* Danger zone tab */}
            <Tabs.Panel value="danger" pt={isMobile ? 'md' : undefined}>
              <Stack gap="md">
                {isAdmin && (
                  <Paper withBorder p="md" style={{ borderColor: 'var(--mantine-color-red-4)' }}>
                    <Group justify="space-between" align="center">
                      <div>
                        <Text size="sm" fw={500}>
                          {t('Delete this project')}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t(
                            'Permanently delete this project, all languages, and all entries. This cannot be undone.',
                          )}
                        </Text>
                      </div>
                      <motion.div {...buttonStates}>
                        <Button
                          color="red"
                          variant="outline"
                          leftSection={<Trash2 size={14} />}
                          onClick={() => setConfirmDeleteOpen(true)}
                        >
                          {t('Delete project')}
                        </Button>
                      </motion.div>
                    </Group>
                  </Paper>
                )}

                <Paper withBorder p="md" style={{ borderColor: 'var(--mantine-color-orange-4)' }}>
                  <Group justify="space-between" align="center">
                    <div>
                      <Text size="sm" fw={500}>
                        {t('Leave this project')}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t('Remove yourself from this project.')}
                      </Text>
                    </div>
                    <motion.div {...buttonStates}>
                      <Button
                        color="orange"
                        variant="outline"
                        leftSection={<LogOut size={14} />}
                        onClick={() => setConfirmLeaveOpen(true)}
                      >
                        {t('Leave project')}
                      </Button>
                    </motion.div>
                  </Group>
                </Paper>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </MotionDiv>

      <AddLanguageModal
        opened={addLanguageOpen}
        onClose={() => setAddLanguageOpen(false)}
        projectId={project.id}
        existingLanguages={languages}
        wpProjectType={project.wp_project_type}
        wpSlug={project.wp_slug}
        onLanguageAdded={() => {
          setAddLanguageOpen(false);
          setRefreshKey((k) => k + 1);
        }}
      />

      <ConfirmModal
        opened={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        title={t('Delete project')}
        message={t(
          'Are you sure you want to delete "{{name}}"? All languages and entries will be permanently removed.',
          { name: project.name },
        )}
        confirmLabel={t('Delete project')}
        variant="danger"
        loading={deleting}
      />

      <ConfirmModal
        opened={confirmLeaveOpen}
        onClose={() => setConfirmLeaveOpen(false)}
        onConfirm={() => void handleLeave()}
        title={t('Leave project')}
        message={t('Are you sure you want to leave "{{name}}"?', { name: project.name })}
        confirmLabel={t('Leave project')}
        variant="warning"
        loading={leaveLoading}
      />
    </Container>
  );
}
