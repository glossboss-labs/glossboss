/**
 * ProjectDetail — project overview page with Languages, Members, Invites, and Settings tabs.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
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
  Lock,
  Globe,
  EyeOff,
  Search,
  GitBranch,
  Users,
  Mail,
  Settings,
} from 'lucide-react';
import {
  sectionVariants,
  contentVariants,
  staggerContainerVariants,
  badgeVariants,
  buttonStates,
  fadeVariants,
} from '@/lib/motion';
import { useTranslation, msgid } from '@/lib/app-language';
import {
  getProject,
  getProjectLanguages,
  listProjectMembers,
  listProjectInvites,
  removeProjectMember,
} from '@/lib/projects/api';
import type {
  ProjectRow,
  ProjectLanguageRow,
  ProjectMemberWithProfile,
  ProjectInviteRow,
} from '@/lib/projects/types';
import { useProjectsStore } from '@/stores/projects-store';
import { useAuth } from '@/hooks/use-auth';
import { AppHeader } from '@/components/AppHeader';
import { AddLanguageModal } from '@/components/projects/AddLanguageModal';
import { ProjectMembersTab } from '@/components/projects/ProjectMembersTab';
import { ProjectInvitesTab } from '@/components/projects/ProjectInvitesTab';
import { ConfirmModal } from '@/components/ui';

const MotionDiv = motion.div;
const MotionSpan = motion.span;

type LangSortOption = 'locale' | 'most-complete' | 'least-complete' | 'most-strings' | 'updated';

const VISIBILITY_ICON = {
  private: Lock,
  public: Globe,
  unlisted: EyeOff,
} as const;

const VISIBILITY_LABEL: Record<string, string> = {
  private: msgid('Private'),
  public: msgid('Public'),
  unlisted: msgid('Unlisted'),
};

function sortLanguages(
  languages: ProjectLanguageRow[],
  sort: LangSortOption,
): ProjectLanguageRow[] {
  const sorted = [...languages];
  switch (sort) {
    case 'locale':
      return sorted.sort((a, b) => a.locale.localeCompare(b.locale));
    case 'most-complete': {
      const pct = (l: ProjectLanguageRow) =>
        l.stats_total > 0 ? l.stats_translated / l.stats_total : 0;
      return sorted.sort((a, b) => pct(b) - pct(a));
    }
    case 'least-complete': {
      const pct = (l: ProjectLanguageRow) =>
        l.stats_total > 0 ? l.stats_translated / l.stats_total : 0;
      return sorted.sort((a, b) => pct(a) - pct(b));
    }
    case 'most-strings':
      return sorted.sort((a, b) => b.stats_total - a.stats_total);
    case 'updated':
      return sorted.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    default:
      return sorted;
  }
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const deleteLanguage = useProjectsStore((s) => s.deleteLanguage);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [languages, setLanguages] = useState<ProjectLanguageRow[]>([]);
  const [members, setMembers] = useState<ProjectMemberWithProfile[]>([]);
  const [invites, setInvites] = useState<ProjectInviteRow[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<LangSortOption>('locale');
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Derive role info
  const myMembership = useMemo(
    () => (user ? members.find((m) => m.user_id === user.id) : undefined),
    [user, members],
  );
  const isAdmin = myMembership?.role === 'admin';
  const canManage = myMembership?.role === 'admin' || myMembership?.role === 'maintainer';
  const isMember = Boolean(myMembership);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const [proj, langs] = await Promise.all([getProject(id!), getProjectLanguages(id!)]);
        if (cancelled) return;
        if (!proj) {
          setError(t('Project not found'));
          setLoading(false);
          return;
        }

        // Members/invites only loadable by project members
        let mems: ProjectMemberWithProfile[] = [];
        let invs: ProjectInviteRow[] = [];
        try {
          mems = await listProjectMembers(id!);
          invs = await listProjectInvites(id!).catch(() => [] as ProjectInviteRow[]);
        } catch {
          // Non-members may not be able to list invites; that's fine
        }

        if (cancelled) return;
        setProject(proj);
        setLanguages(langs);
        setMembers(mems);
        setInvites(invs);
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

  const handleLanguageAdded = useCallback(() => {
    setAddModalOpen(false);
    setRefreshKey((k) => k + 1);
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
    { value: 'locale', label: t('Locale A–Z') },
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
      <Container size="xl" py="xl">
        <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
          <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
            {error ?? t('Project not found')}
          </Alert>
          <Button component={Link} to="/dashboard" variant="light" mt="md">
            {t('Back to dashboard')}
          </Button>
        </MotionDiv>
      </Container>
    );
  }

  const VisIcon = VISIBILITY_ICON[project.visibility] ?? Globe;

  return (
    <Container size="xl" py="xl">
      <AppHeader />
      <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
        <Stack gap="lg">
          {/* Breadcrumb */}
          <Group justify="space-between" align="center">
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
              {canManage && (
                <motion.div {...buttonStates}>
                  <Button leftSection={<Plus size={16} />} onClick={() => setAddModalOpen(true)}>
                    {t('Add language')}
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
            <Group gap={6} mt={4} align="center">
              <VisIcon size={12} style={{ color: 'var(--gb-text-tertiary)' }} />
              <Text size="xs" style={{ color: 'var(--gb-text-tertiary)' }}>
                {t(VISIBILITY_LABEL[project.visibility] ?? 'Public')}
                {' · '}
                {project.source_format}
                {project.source_language && (
                  <>
                    {' · '}
                    {t('Source: {{lang}}', { lang: project.source_language })}
                  </>
                )}
                {project.wp_slug && (
                  <>
                    {' · '}
                    {project.wp_project_type}: {project.wp_slug}
                  </>
                )}
                {' · '}
                {t('Created {{date}}', {
                  date: new Date(project.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  }),
                })}
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
                  {t('to save projects to the cloud and collaborate with your team.')}
                </Text>
                <Button component={Link} to="/signup" variant="light" size="xs">
                  {t('Create an account')}
                </Button>
              </Group>
            </Alert>
          )}

          {/* Tabs */}
          <Tabs defaultValue="languages">
            <Tabs.List>
              <Tabs.Tab value="languages" leftSection={<Languages size={14} />}>
                {t('Languages')} ({languages.length})
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
                {languages.length > 0 && (
                  <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
                    <Paper withBorder p="md">
                      <Group justify="space-between" align="center" mb={8}>
                        <Text size="sm" style={{ color: 'var(--gb-text-secondary)' }}>
                          {t('{{count}} languages', { count: languages.length })}
                          {' · '}
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

                {languages.length > 0 && (
                  <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
                    <Group gap="sm">
                      <TextInput
                        placeholder={t('Search languages…')}
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
                        <Text style={{ color: 'var(--gb-text-secondary)' }}>
                          {t('No languages yet')}
                        </Text>
                      </Stack>
                    </Center>
                  </MotionDiv>
                )}

                {languages.length > 0 && filtered.length === 0 && (
                  <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
                    <Center py={40}>
                      <Text size="sm" style={{ color: 'var(--gb-text-secondary)' }}>
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
                                <Group gap="sm">
                                  <Text fw={600} size="sm">
                                    {lang.locale}
                                  </Text>
                                  {lang.source_filename && (
                                    <Text
                                      size="xs"
                                      truncate
                                      style={{ color: 'var(--gb-text-secondary)' }}
                                    >
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
                                <Group gap={8} justify="space-between">
                                  <Group gap={8}>
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
                                  <Text size="xs" style={{ color: 'var(--gb-text-secondary)' }}>
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
    </Container>
  );
}
