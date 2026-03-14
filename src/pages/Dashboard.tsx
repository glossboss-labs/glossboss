/**
 * Dashboard — project list for authenticated users.
 */

import { useEffect } from 'react';
import { Link } from 'react-router';
import { Container, Title, Group, Button, Text, Center, Loader, Alert, Stack } from '@mantine/core';
import { Plus, AlertCircle, FolderOpen } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useProjectsStore } from '@/stores/projects-store';
import { ProjectGrid } from '@/components/projects/ProjectGrid';

export default function Dashboard() {
  const { t } = useTranslation();
  const { projects, loading, error, fetchProjects, deleteProject } = useProjectsStore();

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  return (
    <Container size="lg" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={2}>{t('Projects')}</Title>
        <Button component={Link} to="/" leftSection={<Plus size={16} />}>
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
              {t(
                'Open a PO file in the editor and save it to the cloud to create your first project.',
              )}
            </Text>
            <Button component={Link} to="/" variant="light">
              {t('Open editor')}
            </Button>
          </Stack>
        </Center>
      )}

      {!loading && projects.length > 0 && (
        <ProjectGrid projects={projects} onDelete={deleteProject} />
      )}
    </Container>
  );
}
