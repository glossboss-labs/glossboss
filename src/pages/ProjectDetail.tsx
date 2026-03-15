/**
 * ProjectDetail — project language list page.
 *
 * Shows a project's languages with per-language progress,
 * and provides actions to add or remove languages.
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
  Textarea,
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
import { getProject, getProjectLanguages, updateProject, deleteProject } from '@/lib/projects/api';
import type { ProjectRow, ProjectLanguageRow } from '@/lib/projects/types';
import { useProjectsStore } from '@/stores/projects-store';
import { AppHeader } from '@/components/AppHeader';
import { AddLanguageModal } from '@/components/projects/AddLanguageModal';
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
  const navigate = useNavigate();
  const deleteLanguage = useProjectsStore((s) => s.deleteLanguage);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [languages, setLanguages] = useState<ProjectLanguageRow[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<LangSortOption>('locale');

  // Settings tab state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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
        setProject(proj);
        setLanguages(langs);
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

  const handleSaveProject = useCallback(async () => {
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

  const handleDeleteProject = useCallback(async () => {
    if (!project) return;
    setActionLoading(true);
    try {
      await deleteProject(project.id);
      setConfirmDeleteOpen(false);
      void navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to delete project'));
      setActionLoading(false);
    }
  }, [project, navigate, t]);

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
              to="/dashboard"
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
              {t('Projects')}
            </Text>
            <motion.div {...buttonStates}>
              <Button leftSection={<Plus size={16} />} onClick={() => setAddModalOpen(true)}>
                {t('Add language')}
              </Button>
            </motion.div>
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

          <Tabs defaultValue="languages">
            <Tabs.List>
              <Tabs.Tab value="languages" leftSection={<Languages size={14} />}>
                {t('Languages')} ({languages.length})
              </Tabs.Tab>
              <Tabs.Tab value="settings" leftSection={<Settings size={14} />}>
                {t('Settings')}
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="languages" pt="md">
              <Stack gap="lg">
                {/* Aggregate stats */}
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

                {/* Search and sort */}
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
                            component={Link}
                            to={`/projects/${project.id}/languages/${lang.id}`}
                            withBorder
                            p="md"
                            style={{
                              textDecoration: 'none',
                              color: 'inherit',
                              cursor: 'pointer',
                              transition:
                                'border-color 120ms ease, background-color 120ms ease, box-shadow 120ms ease',
                            }}
                            styles={{
                              root: {
                                '&:hover': {
                                  borderColor: 'var(--mantine-color-blue-5)',
                                  backgroundColor: 'var(--gb-highlight-row)',
                                  boxShadow: 'var(--gb-shadow-tooltip)',
                                },
                              },
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
                            </Group>
                          </Paper>
                        </MotionDiv>
                      );
                    })}
                  </Stack>
                </MotionDiv>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="settings" pt="md">
              <Stack gap="lg">
                {/* Edit project details */}
                <Paper withBorder p="md">
                  <Text size="sm" fw={500} mb="sm">
                    {t('Project details')}
                  </Text>
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
                    <div>
                      <motion.div {...buttonStates}>
                        <Button
                          onClick={() => void handleSaveProject()}
                          loading={saving}
                          disabled={!editName.trim()}
                        >
                          {t('Save changes')}
                        </Button>
                      </motion.div>
                    </div>
                  </Stack>
                </Paper>

                {/* Danger zone */}
                <Paper withBorder p="md" style={{ borderColor: 'var(--mantine-color-red-4)' }}>
                  <Text size="sm" fw={500} mb="sm" c="red">
                    {t('Danger zone')}
                  </Text>
                  <Group justify="space-between" align="center">
                    <div>
                      <Text size="sm">{t('Delete this project')}</Text>
                      <Text size="xs" style={{ color: 'var(--gb-text-secondary)' }}>
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
              </Stack>
            </Tabs.Panel>
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
        opened={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => void handleDeleteProject()}
        title={t('Delete project')}
        message={t(
          'Are you sure you want to delete "{{name}}"? All languages and entries will be permanently removed.',
          { name: project.name },
        )}
        confirmLabel={t('Delete project')}
        variant="danger"
        loading={actionLoading}
      />
    </Container>
  );
}
