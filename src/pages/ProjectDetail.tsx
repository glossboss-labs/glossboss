/**
 * ProjectDetail — project language list page.
 *
 * Shows a project's languages with per-language progress,
 * and provides actions to add or remove languages.
 */

import { useCallback, useEffect, useState } from 'react';
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
} from '@mantine/core';
import { ArrowLeft, AlertCircle, Plus, MoreVertical, Trash2, Languages } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { getProject, getProjectLanguages } from '@/lib/projects/api';
import type { ProjectRow, ProjectLanguageRow } from '@/lib/projects/types';
import { useProjectsStore } from '@/stores/projects-store';
import { AddLanguageModal } from '@/components/projects/AddLanguageModal';

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

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
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
              {project.wp_slug && (
                <Badge variant="light" size="sm" color="grape" mt={4}>
                  {project.wp_project_type}: {project.wp_slug}
                </Badge>
              )}
            </div>
          </Group>
          <Button leftSection={<Plus size={16} />} onClick={() => setAddModalOpen(true)}>
            {t('Add language')}
          </Button>
        </Group>

        {languages.length === 0 && (
          <Center py={40}>
            <Stack align="center" gap="sm">
              <Languages size={32} style={{ opacity: 0.3 }} />
              <Text c="dimmed">{t('No languages yet')}</Text>
            </Stack>
          </Center>
        )}

        <Stack gap="sm">
          {languages.map((lang) => {
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
                    </Group>
                    <Progress.Root size="sm">
                      <Progress.Section value={pct} color="blue" />
                      <Progress.Section value={fuzzyPct} color="yellow" />
                    </Progress.Root>
                    <Group gap={8}>
                      <Badge variant="light" size="xs" color="blue">
                        {lang.stats_translated}/{lang.stats_total}
                      </Badge>
                      {lang.stats_fuzzy > 0 && (
                        <Badge variant="light" size="xs" color="yellow">
                          {lang.stats_fuzzy} {t('fuzzy')}
                        </Badge>
                      )}
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
