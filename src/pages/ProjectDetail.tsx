/**
 * ProjectDetail — project overview page with Languages, Members, Invites, and Settings tabs.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router';
import {
  Stack,
  Group,
  Title,
  Text,
  Button,
  Center,
  Loader,
  Alert,
  Paper,
  Progress,
  Badge,
  ActionIcon,
  Menu,
  TextInput,
  Select,
  Tooltip,
  ThemeIcon,
  Tabs,
} from '@mantine/core';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  AlertCircle,
  Plus,
  MoreVertical,
  Trash2,
  Languages,
  Globe,
  Search,
  GitBranch,
  Users,
  UserPlus,
  Mail,
  Settings,
  ExternalLink,
} from 'lucide-react';
import {
  sectionVariants,
  contentVariants,
  staggerContainerVariants,
  badgeVariants,
  buttonStates,
  fadeVariants,
} from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { VISIBILITY_ICON, VISIBILITY_LABEL } from '@/lib/constants/visibility';
import { formatRelative } from '@/lib/utils/date';
import { sortLanguages, type LangSortOption } from '@/lib/utils/sorting';
import { useQueryClient } from '@tanstack/react-query';
import { removeProjectMember, joinPublicProject } from '@/lib/projects/api';
import type { ProjectMemberWithProfile, ProjectInviteRow } from '@/lib/projects/types';
import {
  projectKeys,
  useProject,
  useProjectLanguages,
  useProjectMembers,
  useProjectInvites,
  useDeleteLanguage,
} from '@/lib/projects/queries';
import { useAuth } from '@/hooks/use-auth';
import { recordRecentProject } from '@/hooks/use-recent-projects';
import { AddLanguageModal } from '@/components/projects/AddLanguageModal';
import { ProjectMembersTab } from '@/components/projects/ProjectMembersTab';
import { ProjectInvitesTab } from '@/components/projects/ProjectInvitesTab';
import { ConfirmModal, CountryFlag } from '@/components/ui';

const MotionDiv = motion.div;
const MotionSpan = motion.span;

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const deleteLanguageMutation = useDeleteLanguage();
  const queryClient = useQueryClient();

  // TanStack Query for project data
  const { data: project = null, isLoading: projectLoading, error: projectError } = useProject(id);
  const { data: languages = [], isLoading: languagesLoading } = useProjectLanguages(id);
  const { data: fetchedMembers = [] } = useProjectMembers(id);
  const { data: fetchedInvites = [] } = useProjectInvites(id);

  // Record recent project visit
  useEffect(() => {
    if (project?.id && project.name)
      recordRecentProject(project.id, project.name, location.pathname);
  }, [project?.id, project?.name, location.pathname]);

  // Local state for optimistic updates from child tabs
  const [members, setMembers] = useState<ProjectMemberWithProfile[]>([]);
  const [invites, setInvites] = useState<ProjectInviteRow[]>([]);

  // Sync fetched data to local state for child tab mutations
  useEffect(() => {
    if (fetchedMembers.length > 0 || !projectLoading) setMembers(fetchedMembers);
  }, [fetchedMembers, projectLoading]);

  useEffect(() => {
    if (fetchedInvites.length > 0 || !projectLoading) setInvites(fetchedInvites);
  }, [fetchedInvites, projectLoading]);

  const loading = projectLoading || languagesLoading;
  const queryErrorMessage = projectError
    ? ((projectError as Error).message ?? t('Failed to load project'))
    : null;
  const [localError, setError] = useState<string | null>(null);
  const error = localError || queryErrorMessage;

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<LangSortOption>('locale');
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);

  // Derive role info
  const myMembership = useMemo(
    () => (user ? members.find((m) => m.user_id === user.id) : undefined),
    [user, members],
  );
  const isAdmin = myMembership?.role === 'admin';
  const canManage = myMembership?.role === 'admin' || myMembership?.role === 'maintainer';
  const isMember = Boolean(myMembership);

  const handleDeleteLanguage = useCallback(
    async (languageId: string) => {
      if (!id) return;
      try {
        await deleteLanguageMutation.mutateAsync({ languageId, projectId: id });
      } catch (err) {
        setError(err instanceof Error ? err.message : t('Failed to delete language'));
      }
    },
    [deleteLanguageMutation, id, t],
  );

  const handleLanguageAdded = useCallback(() => {
    setAddModalOpen(false);
    // TanStack Query will auto-refetch via invalidation from useAddLanguage mutation
  }, []);

  const handleLeaveProject = useCallback(async () => {
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

  const handleJoinProject = useCallback(async () => {
    if (!user || !id) return;
    setJoinLoading(true);
    try {
      await joinPublicProject(id, user.id, project?.public_role ?? 'viewer');
      void queryClient.invalidateQueries({ queryKey: projectKeys.members(id) });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to join project'));
    } finally {
      setJoinLoading(false);
    }
  }, [user, id, project?.public_role, t, queryClient]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = q
      ? languages.filter(
          (l) =>
            l.locale.toLowerCase().includes(q) ||
            (l.wp_locale && l.wp_locale.toLowerCase().includes(q)),
        )
      : languages;
    return sortLanguages(base, sort);
  }, [languages, search, sort]);

  const aggTotal = useMemo(() => languages.reduce((s, l) => s + l.stats_total, 0), [languages]);
  const aggTranslated = useMemo(
    () => languages.reduce((s, l) => s + l.stats_translated, 0),
    [languages],
  );
  const aggFuzzy = useMemo(() => languages.reduce((s, l) => s + l.stats_fuzzy, 0), [languages]);
  const aggPct = aggTotal > 0 ? Math.round((aggTranslated / aggTotal) * 100) : 0;
  const aggFuzzyPct = aggTotal > 0 ? Math.round((aggFuzzy / aggTotal) * 100) : 0;

  const sortOptions = [
    { value: 'locale', label: t('Locale A\u2013Z') },
    { value: 'most-complete', label: t('Most complete') },
    { value: 'least-complete', label: t('Least complete') },
    { value: 'most-strings', label: t('Most strings') },
    { value: 'updated', label: t('Last updated') },
  ];

  if (loading) {
    return (
      <MotionDiv variants={fadeVariants} initial="hidden" animate="visible">
        <Center py={80}>
          <Loader size="lg" />
        </Center>
      </MotionDiv>
    );
  }

  if (error || !project) {
    return (
      <>
        <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
          <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
            {error ?? t('Project not found')}
          </Alert>
          <Button
            component={Link}
            to={isAuthenticated ? '/dashboard' : '/explore'}
            variant="light"
            mt="md"
          >
            {isAuthenticated ? t('Back to dashboard') : t('Back to projects')}
          </Button>
        </MotionDiv>
      </>
    );
  }

  const VisIcon = VISIBILITY_ICON[project.visibility] ?? Globe;

  return (
    <>
      <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
        <Stack gap="lg">
          {/* Breadcrumb */}
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <Text
              component={Link}
              to={isMember ? '/dashboard' : '/explore'}
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
              {isMember ? t('Projects') : t('Explore')}
            </Text>
            <Group gap="sm">
              {isAuthenticated && !isMember && project.visibility === 'public' && (
                <motion.div {...buttonStates}>
                  <Button
                    leftSection={<UserPlus size={16} />}
                    onClick={() => void handleJoinProject()}
                    loading={joinLoading}
                  >
                    {t('Join as {{role}}', { role: project.public_role })}
                  </Button>
                </motion.div>
              )}
              {isMember && (
                <motion.div {...buttonStates}>
                  <Button
                    component={Link}
                    to={`/projects/${id}/settings`}
                    variant="subtle"
                    leftSection={<Settings size={14} />}
                  >
                    {t('Settings')}
                  </Button>
                </motion.div>
              )}
            </Group>
          </Group>

          {/* Title + metadata */}
          <div>
            <Title order={3}>{project.name}</Title>
            {project.description && (
              <Text size="sm" mt={4} c="dimmed">
                {project.description}
              </Text>
            )}
            {project.website && (
              <Text
                component="a"
                href={
                  project.website.startsWith('http')
                    ? project.website
                    : `https://${project.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                size="xs"
                mt={2}
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
            )}
            <Group gap={6} mt={4} align="center">
              <VisIcon size={12} c="dimmed" />
              <Text size="xs" c="dimmed">
                {t(VISIBILITY_LABEL[project.visibility] ?? 'Public')}
                {' \u00b7 '}
                {project.source_format.toUpperCase()}
                {project.source_language &&
                  project.target_language &&
                  project.source_language !== project.target_language && (
                    <>
                      {' \u00b7 '}
                      <CountryFlag code={project.source_language} size="xs" />{' '}
                      {project.source_language} \u2192{' '}
                      <CountryFlag code={project.target_language} size="xs" />{' '}
                      {project.target_language}
                    </>
                  )}
                {project.wp_slug && (
                  <>
                    {' \u00b7 '}
                    {t('{{type}} / {{slug}}', {
                      type: project.wp_project_type,
                      slug: project.wp_slug,
                    })}
                  </>
                )}
              </Text>
            </Group>
          </div>

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

          {/* Sign-in prompt for anonymous viewers */}
          {!isAuthenticated && project.visibility !== 'private' && (
            <Alert variant="light" color="blue">
              <Group justify="space-between" align="center">
                <Text size="sm">
                  <Link
                    to="/signup"
                    style={{
                      color: 'var(--mantine-color-blue-6)',
                      textDecoration: 'none',
                    }}
                  >
                    {t('Sign up')}
                  </Link>{' '}
                  {t(
                    "to save projects to the cloud and collaborate with your team. Collaborators work under the project owner's plan \u2014 no subscription needed to contribute.",
                  )}
                </Text>
              </Group>
            </Alert>
          )}

          {/* Tabs */}
          <Tabs defaultValue="languages">
            <Tabs.List>
              <Tabs.Tab value="languages" leftSection={<Languages size={14} />}>
                {languages.length === 1
                  ? t('1 language')
                  : t('{{count}} languages', { count: languages.length })}
              </Tabs.Tab>
              {isMember && (
                <Tabs.Tab value="members" leftSection={<Users size={14} />}>
                  {t('Members')} ({members.length})
                </Tabs.Tab>
              )}
              {isAdmin && (
                <Tabs.Tab value="invites" leftSection={<Mail size={14} />}>
                  {t('Invites')} ({invites.length})
                </Tabs.Tab>
              )}
            </Tabs.List>

            {/* Languages tab */}
            <Tabs.Panel value="languages" pt="md">
              <Stack gap="lg">
                {canManage && (
                  <Group justify="flex-end">
                    <motion.div {...buttonStates}>
                      <Button
                        variant="light"
                        leftSection={<Plus size={16} />}
                        onClick={() => setAddModalOpen(true)}
                      >
                        {t('Add language')}
                      </Button>
                    </motion.div>
                  </Group>
                )}

                {languages.length > 1 && (
                  <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
                    <Paper withBorder p="md">
                      <Group justify="space-between" align="center" mb={8}>
                        <Text size="sm" c="dimmed">
                          {t('{{count}} languages', { count: languages.length })}
                          {' \u00b7 '}
                          {t('{{strings}} total strings', { strings: aggTotal })}
                        </Text>
                        <Text size="sm" fw={600} c={aggPct === 100 ? 'teal' : undefined}>
                          {aggPct}% {t('complete')}
                        </Text>
                      </Group>
                      <Progress.Root size="md">
                        <Progress.Section value={aggPct} color="blue" />
                        <Progress.Section value={aggFuzzyPct} color="yellow" />
                      </Progress.Root>
                    </Paper>
                  </MotionDiv>
                )}

                {languages.length >= 3 && (
                  <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
                    <Group gap="sm">
                      <TextInput
                        placeholder={t('Search languages\u2026')}
                        leftSection={<Search size={14} />}
                        value={search}
                        onChange={(e) => setSearch(e.currentTarget.value)}
                        style={{ flex: 1, maxWidth: 280 }}
                      />
                      <Select
                        data={sortOptions}
                        value={sort}
                        onChange={(v) => setSort((v as LangSortOption) || 'locale')}
                        w={180}
                        size="sm"
                        allowDeselect={false}
                      />
                    </Group>
                  </MotionDiv>
                )}

                {languages.length === 0 && (
                  <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
                    <Center py={40}>
                      <Stack align="center" gap="sm">
                        <ThemeIcon size="xl" variant="light" color="blue" radius="xl">
                          <Languages size={20} />
                        </ThemeIcon>
                        <Text c="dimmed">{t('No languages yet')}</Text>
                      </Stack>
                    </Center>
                  </MotionDiv>
                )}

                {languages.length > 0 && filtered.length === 0 && (
                  <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
                    <Center py={40}>
                      <Text size="sm" c="dimmed">
                        {t('No languages match your search')}
                      </Text>
                    </Center>
                  </MotionDiv>
                )}

                <MotionDiv variants={staggerContainerVariants} initial="hidden" animate="visible">
                  <Stack gap="sm">
                    {filtered.map((lang) => {
                      const pct =
                        lang.stats_total > 0
                          ? Math.round((lang.stats_translated / lang.stats_total) * 100)
                          : 0;
                      const fuzzyPct =
                        lang.stats_total > 0
                          ? Math.round((lang.stats_fuzzy / lang.stats_total) * 100)
                          : 0;

                      return (
                        <MotionDiv key={lang.id} variants={contentVariants}>
                          <Paper
                            {...(isMember
                              ? {
                                  component: Link,
                                  to: `/projects/${project.id}/languages/${lang.id}`,
                                }
                              : {})}
                            withBorder
                            p="md"
                            style={{
                              textDecoration: 'none',
                              color: 'inherit',
                              cursor: isMember ? 'pointer' : 'default',
                              transition:
                                'border-color 120ms ease, background-color 120ms ease, box-shadow 120ms ease',
                            }}
                            styles={{
                              root: isMember
                                ? {
                                    '&:hover': {
                                      borderColor: 'var(--mantine-color-blue-5)',
                                      backgroundColor: 'var(--gb-highlight-row)',
                                      boxShadow: 'var(--gb-shadow-tooltip)',
                                    },
                                  }
                                : {},
                            }}
                          >
                            <Group justify="space-between" align="center" wrap="nowrap">
                              <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                                <Group gap="sm" wrap="wrap">
                                  <Group gap={6} wrap="nowrap">
                                    <CountryFlag code={lang.locale} />
                                    <Text fw={600} size="sm">
                                      {lang.locale}
                                    </Text>
                                  </Group>
                                  {lang.source_filename && (
                                    <Text size="xs" truncate c="dimmed">
                                      {lang.source_filename}
                                    </Text>
                                  )}
                                  {lang.wp_locale && (
                                    <Badge variant="light" size="xs" color="grape">
                                      {lang.wp_locale}
                                    </Badge>
                                  )}
                                  {lang.repo_provider && lang.repo_owner && lang.repo_name && (
                                    <Tooltip
                                      label={`${lang.repo_owner}/${lang.repo_name}${lang.repo_branch ? ` @ ${lang.repo_branch}` : ''}`}
                                    >
                                      <Badge
                                        variant="light"
                                        size="xs"
                                        color="dark"
                                        leftSection={<GitBranch size={10} />}
                                      >
                                        {lang.repo_provider === 'github' ? 'GitHub' : 'GitLab'}
                                      </Badge>
                                    </Tooltip>
                                  )}
                                </Group>
                                <Group gap={8} align="center">
                                  <Progress.Root size="sm" style={{ flex: 1 }}>
                                    <Progress.Section value={pct} color="blue" />
                                    <Progress.Section value={fuzzyPct} color="yellow" />
                                  </Progress.Root>
                                  <Text
                                    size="sm"
                                    fw={600}
                                    c={pct === 100 ? 'teal' : undefined}
                                    style={{ minWidth: 36, textAlign: 'right' }}
                                  >
                                    {pct}%
                                  </Text>
                                </Group>
                                <Group gap={8} justify="space-between" wrap="wrap">
                                  <Group gap={8} wrap="wrap">
                                    <Badge variant="light" size="xs" color="blue">
                                      {lang.stats_translated} {t('translated')}
                                    </Badge>
                                    <AnimatePresence>
                                      {lang.stats_fuzzy > 0 && (
                                        <MotionSpan
                                          key="fuzzy"
                                          variants={badgeVariants}
                                          initial="hidden"
                                          animate="visible"
                                          exit="exit"
                                        >
                                          <Badge variant="light" size="xs" color="yellow">
                                            {lang.stats_fuzzy} {t('fuzzy')}
                                          </Badge>
                                        </MotionSpan>
                                      )}
                                    </AnimatePresence>
                                    <AnimatePresence>
                                      {lang.stats_untranslated > 0 && (
                                        <MotionSpan
                                          key="untranslated"
                                          variants={badgeVariants}
                                          initial="hidden"
                                          animate="visible"
                                          exit="exit"
                                        >
                                          <Badge variant="light" size="xs" color="gray">
                                            {lang.stats_untranslated} {t('untranslated')}
                                          </Badge>
                                        </MotionSpan>
                                      )}
                                    </AnimatePresence>
                                  </Group>
                                  <Text size="xs" c="dimmed">
                                    {formatRelative(lang.updated_at)}
                                  </Text>
                                </Group>
                              </Stack>

                              {canManage && (
                                <Menu position="bottom-end" withinPortal>
                                  <Menu.Target>
                                    <ActionIcon
                                      variant="subtle"
                                      size="sm"
                                      color="gray"
                                      onClick={(e) => e.preventDefault()}
                                    >
                                      <MoreVertical size={14} />
                                    </ActionIcon>
                                  </Menu.Target>
                                  <Menu.Dropdown>
                                    <Menu.Item
                                      color="red"
                                      leftSection={<Trash2 size={14} />}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        void handleDeleteLanguage(lang.id);
                                      }}
                                    >
                                      {t('Delete')}
                                    </Menu.Item>
                                  </Menu.Dropdown>
                                </Menu>
                              )}
                            </Group>
                          </Paper>
                        </MotionDiv>
                      );
                    })}
                  </Stack>
                </MotionDiv>
              </Stack>
            </Tabs.Panel>

            {/* Members tab (members only) */}
            {isMember && (
              <Tabs.Panel value="members" pt="md">
                <ProjectMembersTab
                  projectId={project.id}
                  members={members}
                  isAdmin={isAdmin ?? false}
                  currentUserId={user?.id}
                  onMembersChange={setMembers}
                  onInviteCreated={(inv) => setInvites((prev) => [inv, ...prev])}
                  onLeave={() => setConfirmLeaveOpen(true)}
                  onError={setError}
                />
              </Tabs.Panel>
            )}

            {/* Invites tab (admin-only) */}
            {isAdmin && (
              <Tabs.Panel value="invites" pt="md">
                <ProjectInvitesTab
                  projectId={project.id}
                  invites={invites}
                  onInvitesChange={setInvites}
                  onError={setError}
                />
              </Tabs.Panel>
            )}
          </Tabs>
        </Stack>
      </MotionDiv>

      <AddLanguageModal
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        projectId={project.id}
        existingLanguages={languages}
        wpProjectType={project.wp_project_type}
        wpSlug={project.wp_slug}
        onLanguageAdded={handleLanguageAdded}
      />

      <ConfirmModal
        opened={confirmLeaveOpen}
        onClose={() => setConfirmLeaveOpen(false)}
        onConfirm={() => void handleLeaveProject()}
        title={t('Leave project')}
        message={t('Are you sure you want to leave "{{name}}"?', { name: project.name })}
        confirmLabel={t('Leave project')}
        variant="warning"
        loading={leaveLoading}
      />
    </>
  );
}
