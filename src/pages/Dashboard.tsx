/**
 * Dashboard — project list for authenticated users.
 */

import { useEffect, useState } from 'react';
import { Container, Title, Group, Button, Text, Center, Loader, Alert, Stack } from '@mantine/core';
import { Plus, AlertCircle, FolderOpen } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useProjectsStore } from '@/stores/projects-store';
import { ProjectGrid } from '@/components/projects/ProjectGrid';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';

export default function Dashboard() {
  const { t } = useTranslation();
  const { projects, loading, error, fetchProjects, deleteProject } = useProjectsStore();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

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
        <ProjectGrid projects={projects} onDelete={deleteProject} />
      )}

      <CreateProjectModal opened={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </Container>
  );
}
