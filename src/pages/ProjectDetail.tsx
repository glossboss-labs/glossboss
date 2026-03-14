/**
 * ProjectDetail — project language list page.
 *
 * Shows a project's languages with per-language progress,
 * and provides actions to add or remove languages.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Paper,
  Progress,
  Badge,
  ActionIcon,
  Menu,
  TextInput,
  Select,
  Tooltip,
} from '@mantine/core';
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
} from 'lucide-react';
import { useTranslation, msgid } from '@/lib/app-language';
import { getProject, getProjectLanguages } from '@/lib/projects/api';
import type { ProjectRow, ProjectLanguageRow } from '@/lib/projects/types';
import { useProjectsStore } from '@/stores/projects-store';
import { AddLanguageModal } from '@/components/projects/AddLanguageModal';

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
  const deleteLanguage = useProjectsStore((s) => s.deleteLanguage);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [languages, setLanguages] = useState<ProjectLanguageRow[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<LangSortOption>('locale');

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
      <Center py={80}>
        <Loader size="lg" />
      </Center>
    );
  }

  if (error || !project) {
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

  const VisIcon = VISIBILITY_ICON[project.visibility] ?? Globe;

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <Button
              component={Link}
              to="/dashboard"
              variant="subtle"
              leftSection={<ArrowLeft size={16} />}
              size="compact-md"
            >
              {t('Projects')}
            </Button>
            <div>
              <Title order={3}>{project.name}</Title>
              <Group gap={6} mt={4}>
                <Tooltip label={t(VISIBILITY_LABEL[project.visibility] ?? 'Public')}>
                  <Badge variant="light" size="sm" color="gray" leftSection={<VisIcon size={10} />}>
                    {t(VISIBILITY_LABEL[project.visibility] ?? 'Public')}
                  </Badge>
                </Tooltip>
                <Badge variant="light" size="sm" color="gray">
                  {project.source_format}
                </Badge>
                {project.source_language && (
                  <Badge variant="light" size="sm" color="blue">
                    {t('Source: {{lang}}', { lang: project.source_language })}
                  </Badge>
                )}
                {project.wp_slug && (
                  <Badge variant="light" size="sm" color="grape">
                    {project.wp_project_type}: {project.wp_slug}
                  </Badge>
                )}
                <Text size="xs" c="dimmed">
                  {t('Created {{date}}', {
                    date: new Date(project.created_at).toLocaleDateString(),
                  })}
                </Text>
              </Group>
            </div>
          </Group>
          <Button leftSection={<Plus size={16} />} onClick={() => setAddModalOpen(true)}>
            {t('Add language')}
          </Button>
        </Group>

        {/* Aggregate stats */}
        {languages.length > 0 && (
          <Paper withBorder p="md">
            <Group justify="space-between" align="center" mb={8}>
              <Text size="sm" c="dimmed">
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
        )}

        {/* Search and sort */}
        {languages.length > 0 && (
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
        )}

        {languages.length === 0 && (
          <Center py={40}>
            <Stack align="center" gap="sm">
              <Languages size={32} style={{ opacity: 0.3 }} />
              <Text c="dimmed">{t('No languages yet')}</Text>
            </Stack>
          </Center>
        )}

        {languages.length > 0 && filtered.length === 0 && (
          <Center py={40}>
            <Text c="dimmed" size="sm">
              {t('No languages match your search')}
            </Text>
          </Center>
        )}

        <Stack gap="sm">
          {filtered.map((lang) => {
            const pct =
              lang.stats_total > 0
                ? Math.round((lang.stats_translated / lang.stats_total) * 100)
                : 0;
            const fuzzyPct =
              lang.stats_total > 0 ? Math.round((lang.stats_fuzzy / lang.stats_total) * 100) : 0;

            return (
              <Paper
                key={lang.id}
                component={Link}
                to={`/projects/${project.id}/languages/${lang.id}`}
                withBorder
                p="md"
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  transition: 'border-color 120ms ease',
                }}
                styles={{
                  root: {
                    '&:hover': {
                      borderColor: 'var(--mantine-color-blue-5)',
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
                        <Text size="xs" c="dimmed" truncate>
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
                        {lang.stats_fuzzy > 0 && (
                          <Badge variant="light" size="xs" color="yellow">
                            {lang.stats_fuzzy} {t('fuzzy')}
                          </Badge>
                        )}
                        {lang.stats_untranslated > 0 && (
                          <Badge variant="light" size="xs" color="gray">
                            {lang.stats_untranslated} {t('untranslated')}
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed">
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
            );
          })}
        </Stack>
      </Stack>

      <AddLanguageModal
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        projectId={project.id}
        existingLanguages={languages}
        wpProjectType={project.wp_project_type}
        wpSlug={project.wp_slug}
        onLanguageAdded={handleLanguageAdded}
      />
    </Container>
  );
}
