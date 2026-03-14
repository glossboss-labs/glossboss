/**
 * Dashboard — project list for authenticated users.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Title,
  Group,
  Button,
  Text,
  Center,
  Loader,
  Alert,
  Stack,
  TextInput,
  Select,
} from '@mantine/core';
import { Plus, AlertCircle, FolderOpen, Search } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useProjectsStore } from '@/stores/projects-store';
import { ProjectGrid } from '@/components/projects/ProjectGrid';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import type { ProjectWithLanguages } from '@/lib/projects/types';

type SortOption = 'updated' | 'name' | 'most-strings' | 'least-complete';

function sortProjects(projects: ProjectWithLanguages[], sort: SortOption): ProjectWithLanguages[] {
  const sorted = [...projects];
  switch (sort) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'most-strings':
      return sorted.sort((a, b) => b.stats_total - a.stats_total);
    case 'least-complete': {
      const pct = (p: ProjectWithLanguages) =>
        p.stats_total > 0 ? p.stats_translated / p.stats_total : 0;
      return sorted.sort((a, b) => pct(a) - pct(b));
    }
    case 'updated':
    default:
      return sorted.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
  }
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { projects, loading, error, fetchProjects, deleteProject } = useProjectsStore();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('updated');

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;
    return sortProjects(base, sort);
  }, [projects, search, sort]);

  const totalLanguages = useMemo(
    () => projects.reduce((sum, p) => sum + (p.project_languages?.length ?? 0), 0),
    [projects],
  );
  const totalStrings = useMemo(
    () => projects.reduce((sum, p) => sum + p.stats_total, 0),
    [projects],
  );

  const sortOptions = [
    { value: 'updated', label: t('Last updated') },
    { value: 'name', label: t('Name A–Z') },
    { value: 'most-strings', label: t('Most strings') },
    { value: 'least-complete', label: t('Least complete') },
  ];

  return (
    <Container size="lg" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={2}>{t('Projects')}</Title>
        <Button leftSection={<Plus size={16} />} onClick={() => setCreateModalOpen(true)}>
          {t('New project')}
        </Button>
      </Group>

      {loading && (
        <Center py={80}>
          <Loader size="lg" />
        </Center>
      )}

      {error && (
        <Alert icon={<AlertCircle size={16} />} color="red" variant="light" mb="md">
          {error}
        </Alert>
      )}

      {!loading && !error && projects.length === 0 && (
        <Center py={80}>
          <Stack align="center" gap="md">
            <FolderOpen size={48} style={{ opacity: 0.3 }} />
            <Text c="dimmed" size="lg">
              {t('No projects yet')}
            </Text>
            <Text c="dimmed" size="sm" maw={360} ta="center">
              {t('Create a cloud project from a PO file, a WordPress.org export, or a repository.')}
            </Text>
            <Button variant="light" onClick={() => setCreateModalOpen(true)}>
              {t('New project')}
            </Button>
          </Stack>
        </Center>
      )}

      {!loading && projects.length > 0 && (
        <>
          <Text size="sm" c="dimmed" mb="sm">
            {t('{{projects}} projects', { projects: projects.length })}
            {' · '}
            {t('{{languages}} languages', { languages: totalLanguages })}
            {' · '}
            {t('{{strings}} strings', { strings: totalStrings })}
          </Text>

          <Group mb="md" gap="sm">
            <TextInput
              placeholder={t('Search projects…')}
              leftSection={<Search size={14} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ flex: 1, maxWidth: 320 }}
            />
            <Select
              data={sortOptions}
              value={sort}
              onChange={(v) => setSort((v as SortOption) || 'updated')}
              w={180}
              size="sm"
              allowDeselect={false}
            />
          </Group>

          {filtered.length === 0 ? (
            <Center py={40}>
              <Text c="dimmed" size="sm">
                {t('No projects match your search')}
              </Text>
            </Center>
          ) : (
            <ProjectGrid projects={filtered} onDelete={deleteProject} />
          )}
        </>
      )}

      <CreateProjectModal opened={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </Container>
  );
}
