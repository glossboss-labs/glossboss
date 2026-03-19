/**
 * ProjectSettings — dedicated settings page for a cloud project.
 *
 * Route: /projects/:id/settings
 * Tabs: General, Repository, Languages, Members, Danger Zone
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router';
import {
  Box,
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  ExternalLink,
  Bell,
  BookOpen,
  Key,
} from 'lucide-react';
import { staggerPageVariants, fadeVariants, buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import {
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
import { ProjectMembersTab } from '@/components/projects/ProjectMembersTab';
import { ProjectInvitesTab } from '@/components/projects/ProjectInvitesTab';
import { ProjectNotificationsTab } from '@/components/projects/ProjectNotificationsTab';
import { AddLanguageModal } from '@/components/projects/AddLanguageModal';
import { ProjectGlossaryTab } from '@/components/projects/ProjectGlossaryTab';
import { ProjectTranslationTab } from '@/components/projects/ProjectTranslationTab';
import { ConfirmModal, AnimatedStateSwitch, AnimatedTabPanel } from '@/components/ui';
import { getOrgSettings } from '@/lib/organizations/api';
import type { OrgSettingsRow } from '@/lib/organizations/types';
import {
  projectKeys,
  useDeleteLanguage,
  useProject,
  useProjectLanguages,
  useProjectSettingsPage,
} from '@/lib/projects/queries';

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
  const deleteLanguageMutation = useDeleteLanguage();
  const queryClient = useQueryClient();
  const {
    data: baseProject = null,
    isLoading: projectLoading,
    error: projectError,
  } = useProject(id);
  const { data: baseLanguages = [], isLoading: languagesLoading } = useProjectLanguages(id);
  const {
    data: settingsData,
    isLoading: pageLoading,
    error: pageError,
  } = useProjectSettingsPage(id);

  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [languages, setLanguages] = useState<ProjectLanguageRow[]>([]);
  const [members, setMembers] = useState<ProjectMemberWithProfile[]>([]);
  const [invites, setInvites] = useState<ProjectInviteRow[]>([]);

  // Edit state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editVisibility, setEditVisibility] = useState('private');
  const [editPublicRole, setEditPublicRole] = useState('viewer');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [addLanguageOpen, setAddLanguageOpen] = useState(false);

  const myMembership = useMemo(
    () => (user ? members.find((m) => m.user_id === user.id) : undefined),
    [user, members],
  );

  useEffect(() => {
    if (!baseProject) return;

    setProject(baseProject);
    setEditName(baseProject.name);
    setEditDescription(baseProject.description);
    setEditWebsite(baseProject.website ?? '');
    setEditVisibility(baseProject.visibility);
    setEditPublicRole(baseProject.public_role);
  }, [baseProject]);

  useEffect(() => {
    setLanguages(baseLanguages);
  }, [baseLanguages]);

  useEffect(() => {
    if (!settingsData) return;

    setMembers(settingsData.members);
    setInvites(settingsData.invites);

    if (settingsData.project) {
      setProject(settingsData.project);
      setEditName(settingsData.project.name);
      setEditDescription(settingsData.project.description);
      setEditWebsite(settingsData.project.website ?? '');
      setEditVisibility(settingsData.project.visibility);
      setEditPublicRole(settingsData.project.public_role);
    }
    if (settingsData.languages.length > 0) {
      setLanguages(settingsData.languages);
    }
  }, [settingsData]);

  const { data: orgSettings = null } = useQuery<OrgSettingsRow | null>({
    queryKey: project?.organization_id
      ? ['organizations', project.organization_id, 'settings']
      : ['organizations', 'settings', 'none'],
    queryFn: () => getOrgSettings(project!.organization_id!),
    enabled: Boolean(project?.organization_id),
    staleTime: 60_000,
  });

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
        website: editWebsite.trim(),
        visibility: editVisibility as 'private' | 'public' | 'unlisted',
        public_role: editPublicRole as 'viewer' | 'translator' | 'reviewer',
      });
      setProject(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to save project'));
    } finally {
      setSaving(false);
    }
  }, [project, editName, editDescription, editWebsite, editVisibility, editPublicRole, t]);

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
      if (!id) return;
      try {
        await deleteLanguageMutation.mutateAsync({ languageId, projectId: id });
        setLanguages((prev) => prev.filter((l) => l.id !== languageId));
      } catch (err) {
        setError(err instanceof Error ? err.message : t('Failed to delete language'));
      }
    },
    [deleteLanguageMutation, id, t],
  );

  const queryErrorMessage =
    projectError || pageError
      ? (((projectError ?? pageError) as Error).message ?? t('Failed to load project'))
      : null;
  const loading = (projectLoading || languagesLoading || pageLoading) && !project;

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

  const handleLanguageUpdated = useCallback((updated: ProjectLanguageRow) => {
    setLanguages((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }, []);

  const stateKey = loading
    ? 'loading'
    : (error ?? queryErrorMessage) && !project
      ? 'error'
      : project
        ? 'data'
        : 'empty';

  return (
    <Box maw={960}>
      <AnimatedStateSwitch stateKey={stateKey}>
        {loading ? (
          <Center py={80}>
            <Loader size="lg" />
          </Center>
        ) : (error ?? queryErrorMessage) && !project ? (
          <>
            <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
              {error ?? queryErrorMessage}
            </Alert>
            <Button component={Link} to="/dashboard" variant="light" mt="md">
              {t('Back to dashboard')}
            </Button>
          </>
        ) : !project ? null : (
          <MotionDiv variants={staggerPageVariants} initial="hidden" animate="visible">
            <Stack gap="lg">
              {project.visibility === 'public' && !myMembership && (
                <MotionDiv variants={fadeVariants}>
                  <Alert color="blue" variant="light">
                    <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                      <Text size="sm">
                        {t(
                          'You are viewing public project settings in read-only mode. Join the project to make changes.',
                        )}
                      </Text>
                      <Button
                        component={Link}
                        to={`/projects/${project.id}`}
                        size="xs"
                        variant="light"
                      >
                        {t('Back to project')}
                      </Button>
                    </Group>
                  </Alert>
                </MotionDiv>
              )}

              {/* Breadcrumb */}
              <MotionDiv variants={fadeVariants}>
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
              </MotionDiv>

              <MotionDiv variants={fadeVariants}>
                <Group gap="sm" align="center">
                  <Settings size={20} c="dimmed" />
                  <Title order={3}>{t('Project settings')}</Title>
                </Group>
              </MotionDiv>

              {error && (
                <MotionDiv variants={fadeVariants}>
                  <Alert
                    icon={<AlertCircle size={16} />}
                    color="red"
                    variant="light"
                    withCloseButton
                    onClose={() => setError(null)}
                  >
                    {error}
                  </Alert>
                </MotionDiv>
              )}

              <MotionDiv variants={fadeVariants}>
                <Box
                  style={
                    isMobile ? undefined : { display: 'flex', gap: 'var(--mantine-spacing-xl)' }
                  }
                >
                  <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    orientation={isMobile ? 'horizontal' : 'vertical'}
                    variant="pills"
                    classNames={{ tab: 'gb-tab-left-align' }}
                    styles={{
                      list: isMobile
                        ? { overflowX: 'auto', flexWrap: 'nowrap' }
                        : { minWidth: 180, flexShrink: 0 },
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
                      <Tabs.Tab value="translation" leftSection={<Key size={14} />}>
                        {t('Translation')}
                      </Tabs.Tab>
                      <Tabs.Tab value="glossary" leftSection={<BookOpen size={14} />}>
                        {t('Glossary')}
                      </Tabs.Tab>
                      <Tabs.Tab value="members" leftSection={<Users size={14} />}>
                        {t('Members')} ({members.length})
                      </Tabs.Tab>
                      <Tabs.Tab value="notifications" leftSection={<Bell size={14} />}>
                        {t('Notifications')}
                      </Tabs.Tab>
                      <Tabs.Tab value="danger" leftSection={<Trash2 size={14} />} color="red">
                        {t('Danger zone')}
                      </Tabs.Tab>
                    </Tabs.List>
                  </Tabs>

                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <AnimatedTabPanel tabKey={activeTab}>
                      <Box pt={isMobile ? 'md' : undefined}>
                        {/* General tab */}
                        {activeTab === 'general' && (
                          <Stack gap="lg">
                            <Text size="sm" c="dimmed">
                              {t(
                                'Basic information about your project. The visibility setting controls who can see and contribute.',
                              )}
                            </Text>
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
                                  <TextInput
                                    label={t('Website')}
                                    placeholder="https://example.com"
                                    value={editWebsite}
                                    onChange={(e) => setEditWebsite(e.currentTarget.value)}
                                    leftSection={<ExternalLink size={14} />}
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
                                  {editVisibility === 'public' && (
                                    <Select
                                      label={t('Public permissions')}
                                      description={t(
                                        'Role assigned to non-members who visit this public project.',
                                      )}
                                      data={[
                                        { value: 'viewer', label: t('Viewer — read-only') },
                                        {
                                          value: 'translator',
                                          label: t('Translator — can translate'),
                                        },
                                        {
                                          value: 'reviewer',
                                          label: t('Reviewer — can translate and review'),
                                        },
                                      ]}
                                      value={editPublicRole}
                                      onChange={(v) => setEditPublicRole(v || 'viewer')}
                                      w={300}
                                      allowDeselect={false}
                                    />
                                  )}
                                  {project.wp_slug && (
                                    <Group gap="xs">
                                      <Text size="sm" c="dimmed">
                                        {t('WordPress')}: {project.wp_project_type} /{' '}
                                        {project.wp_slug}
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
                                <Stack gap="md">
                                  <Group gap="xl" wrap="wrap">
                                    <div>
                                      <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>
                                        {t('Name')}
                                      </Text>
                                      <Text size="sm">{project.name}</Text>
                                    </div>
                                    <div>
                                      <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>
                                        {t('Visibility')}
                                      </Text>
                                      <Badge variant="light" size="sm">
                                        {project.visibility}
                                      </Badge>
                                    </div>
                                    <div>
                                      <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>
                                        {t('Format')}
                                      </Text>
                                      <Badge variant="light" size="sm" color="gray">
                                        {project.source_format}
                                      </Badge>
                                    </div>
                                  </Group>
                                  {project.description && (
                                    <div>
                                      <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>
                                        {t('Description')}
                                      </Text>
                                      <Text size="sm">{project.description}</Text>
                                    </div>
                                  )}
                                  {project.website && (
                                    <div>
                                      <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>
                                        {t('Website')}
                                      </Text>
                                      <Text
                                        component="a"
                                        href={
                                          project.website.startsWith('http')
                                            ? project.website
                                            : `https://${project.website}`
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        size="sm"
                                        style={{
                                          color: 'var(--mantine-color-blue-6)',
                                          textDecoration: 'none',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                        }}
                                      >
                                        <ExternalLink size={12} />
                                        {project.website.replace(/^https?:\/\//, '')}
                                      </Text>
                                    </div>
                                  )}
                                  {project.wp_slug && (
                                    <div>
                                      <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>
                                        {t('WordPress')}
                                      </Text>
                                      <Text size="sm">
                                        {project.wp_project_type} / {project.wp_slug}
                                      </Text>
                                    </div>
                                  )}
                                </Stack>
                              )}
                            </Paper>
                          </Stack>
                        )}

                        {/* Repository tab */}
                        {activeTab === 'repository' && (
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
                                const hasRepo =
                                  lang.repo_provider && lang.repo_owner && lang.repo_name;
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
                                              {lang.repo_provider === 'github'
                                                ? 'GitHub'
                                                : 'GitLab'}
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
                                            <Tooltip
                                              label={t(
                                                'Open the editor to connect this language to a repository via Push settings.',
                                              )}
                                            >
                                              <Button
                                                component={Link}
                                                to={`/projects/${project.id}/languages/${lang.id}`}
                                                variant="light"
                                                size="xs"
                                                leftSection={<GitBranch size={12} />}
                                              >
                                                {t('Link repository')}
                                              </Button>
                                            </Tooltip>
                                          )}
                                        </Group>
                                      )}
                                    </Group>
                                  </Paper>
                                );
                              })
                            )}
                          </Stack>
                        )}

                        {/* Languages tab */}
                        {activeTab === 'languages' && (
                          <Stack gap="md">
                            <Text size="sm" c="dimmed">
                              {t(
                                'Each language is a translation target. Add languages here, then open them in the editor to translate.',
                              )}
                            </Text>
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
                                    {t(
                                      'No languages yet. Add your first language to start translating this project.',
                                    )}
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
                        )}

                        {/* Translation tab */}
                        {activeTab === 'translation' && (
                          <ProjectTranslationTab
                            languages={languages}
                            projectId={project.id}
                            orgId={project.organization_id}
                            orgSettings={orgSettings}
                            isManager={isManager}
                            onLanguageUpdated={handleLanguageUpdated}
                          />
                        )}

                        {/* Glossary tab */}
                        {activeTab === 'glossary' && (
                          <ProjectGlossaryTab
                            languages={languages}
                            isManager={isManager}
                            onLanguageUpdated={handleLanguageUpdated}
                          />
                        )}

                        {/* Members tab */}
                        {activeTab === 'members' && (
                          <Stack gap="lg">
                            <Text size="sm" c="dimmed">
                              {t(
                                'Manage who has access. Roles: Admin (full control), Manager (settings + invites), Translator (translate), Reviewer (translate + approve), Viewer (read-only).',
                              )}
                            </Text>
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
                        )}

                        {/* Notifications tab */}
                        {activeTab === 'notifications' && (
                          <ProjectNotificationsTab projectId={project.id} />
                        )}

                        {/* Danger zone tab */}
                        {activeTab === 'danger' && (
                          <Stack gap="md">
                            {isAdmin && (
                              <Paper
                                withBorder
                                p="md"
                                style={{ borderColor: 'var(--mantine-color-red-4)' }}
                              >
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

                            <Paper
                              withBorder
                              p="md"
                              style={{ borderColor: 'var(--mantine-color-orange-4)' }}
                            >
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
                        )}
                      </Box>
                    </AnimatedTabPanel>
                  </Box>
                </Box>
              </MotionDiv>
            </Stack>
          </MotionDiv>
        )}
      </AnimatedStateSwitch>

      {project && (
        <>
          <AddLanguageModal
            opened={addLanguageOpen}
            onClose={() => setAddLanguageOpen(false)}
            projectId={project.id}
            existingLanguages={languages}
            wpProjectType={project.wp_project_type}
            wpSlug={project.wp_slug}
            onLanguageAdded={() => {
              setAddLanguageOpen(false);
              void queryClient.invalidateQueries({
                queryKey: projectKeys.settingsPage(project.id),
              });
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
        </>
      )}
    </Box>
  );
}
