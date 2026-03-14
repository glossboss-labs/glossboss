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
  ThemeIcon,
} from '@mantine/core';
import { motion } from 'motion/react';
import { Plus, AlertCircle, FolderOpen, Search } from 'lucide-react';
import { sectionVariants, contentVariants, fadeVariants, buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { useProjectsStore } from '@/stores/projects-store';
import { ProjectGrid } from '@/components/projects/ProjectGrid';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import type { ProjectWithLanguages } from '@/lib/projects/types';

const MotionDiv = motion.div;

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
      <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
        <Group justify="space-between" mb="xl">
          <Title order={2}>{t('Projects')}</Title>
          <motion.div {...buttonStates}>
            <Button leftSection={<Plus size={16} />} onClick={() => setCreateModalOpen(true)}>
              {t('New project')}
            </Button>
          </motion.div>
        </Group>

        {loading && (
          <MotionDiv variants={fadeVariants} initial="hidden" animate="visible">
            <Center py={80}>
              <Loader size="lg" />
            </Center>
          </MotionDiv>
        )}

        {error && (
          <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
            <Alert icon={<AlertCircle size={16} />} color="red" variant="light" mb="md">
              {error}
            </Alert>
          </MotionDiv>
        )}

        {!loading && !error && projects.length === 0 && (
          <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
            <Center py={80}>
              <Stack align="center" gap="md">
                <ThemeIcon size="xl" variant="light" color="blue" radius="xl">
                  <FolderOpen size={24} />
                </ThemeIcon>
                <Text size="lg" style={{ color: 'var(--gb-text-secondary)' }}>
                  {t('No projects yet')}
                </Text>
                <Text size="sm" maw={360} ta="center" style={{ color: 'var(--gb-text-tertiary)' }}>
                  {t(
                    'Create a cloud project from a PO file, a WordPress.org export, or a repository.',
                  )}
                </Text>
                <motion.div {...buttonStates}>
                  <Button variant="light" onClick={() => setCreateModalOpen(true)}>
                    {t('New project')}
                  </Button>
                </motion.div>
              </Stack>
            </Center>
          </MotionDiv>
        )}

        {!loading && projects.length > 0 && (
          <>
            <Text size="sm" mb="sm" style={{ color: 'var(--gb-text-secondary)' }}>
              {t('{{projects}} projects', { projects: projects.length })}
              {' · '}
              {t('{{languages}} languages', { languages: totalLanguages })}
              {' · '}
              {t('{{strings}} strings', { strings: totalStrings })}
            </Text>

            <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
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
            </MotionDiv>

            {filtered.length === 0 ? (
              <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
                <Center py={40}>
                  <Text size="sm" style={{ color: 'var(--gb-text-secondary)' }}>
                    {t('No projects match your search')}
                  </Text>
                </Center>
              </MotionDiv>
            ) : (
              <ProjectGrid projects={filtered} onDelete={deleteProject} />
            )}
          </>
        )}
      </MotionDiv>

      <CreateProjectModal opened={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </Container>
  );
}
