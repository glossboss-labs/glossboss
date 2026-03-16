/**
 * Dashboard — project list for authenticated users.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Title,
  Group,
  Button,
  Text,
  Center,
  Alert,
  Stack,
  TextInput,
  Select,
  ThemeIcon,
  Paper,
} from '@mantine/core';
import { motion } from 'motion/react';
import { Plus, AlertCircle, FolderOpen, Search, Building2 } from 'lucide-react';
import { sectionVariants, contentVariants, buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { trackEvent } from '@/lib/analytics';
import { useProjectsStore } from '@/stores/projects-store';
import { useAuthStore } from '@/stores/auth-store';
import { useOrganizationsStore } from '@/stores/organizations-store';
import { ProjectGrid } from '@/components/projects/ProjectGrid';
import { ProjectGridSkeleton } from '@/components/projects/ProjectGridSkeleton';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { CreateOrgModal } from '@/components/organizations/CreateOrgModal';
import { ConfirmModal } from '@/components/ui';
import { FreePlanBanner } from '@/components/billing/FreePlanBanner';
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
  const { user } = useAuthStore();
  const { organizations, loading: orgsLoading, fetchOrganizations } = useOrganizationsStore();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('updated');

  const confirmDeleteProject = confirmDeleteId
    ? projects.find((p) => p.id === confirmDeleteId)
    : null;

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteId) return;
    const projectToDelete = projects.find((p) => p.id === confirmDeleteId);
    setDeleting(true);
    try {
      await deleteProject(confirmDeleteId);
      trackEvent('project_deleted', {
        had_translations: (projectToDelete?.stats_translated ?? 0) > 0,
      });
      setConfirmDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    void fetchProjects();
    void fetchOrganizations();
  }, [fetchProjects, fetchOrganizations]);

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
    <>
      <FreePlanBanner />
      <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
        <Group justify="space-between" mb="xl" wrap="wrap">
          <Title order={2}>{t('Projects')}</Title>
          <motion.div {...buttonStates}>
            <Button leftSection={<Plus size={16} />} onClick={() => setCreateModalOpen(true)}>
              {t('New project')}
            </Button>
          </motion.div>
        </Group>

        {loading && <ProjectGridSkeleton />}

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
                <Text size="lg" c="dimmed">
                  {t('No projects yet')}
                </Text>
                <Text size="sm" maw={360} ta="center" c="dimmed">
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
            <Text size="sm" mb="sm" c="dimmed">
              {t('{{projects}} projects', { projects: projects.length })}
              {' · '}
              {t('{{languages}} languages', { languages: totalLanguages })}
              {' · '}
              {t('{{strings}} strings', { strings: totalStrings })}
            </Text>

            <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
              <Group mb="md" gap="sm" wrap="wrap">
                <TextInput
                  placeholder={t('Search projects…')}
                  leftSection={<Search size={14} />}
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                  style={{ flex: '1 1 200px', minWidth: 0 }}
                />
                <Select
                  data={sortOptions}
                  value={sort}
                  onChange={(v) => setSort((v as SortOption) || 'updated')}
                  style={{ flex: '0 1 auto' }}
                  size="sm"
                  allowDeselect={false}
                />
              </Group>
            </MotionDiv>

            {filtered.length === 0 ? (
              <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
                <Center py={40}>
                  <Text size="sm" c="dimmed">
                    {t('No projects match your search')}
                  </Text>
                </Center>
              </MotionDiv>
            ) : (
              <ProjectGrid projects={filtered} onDelete={setConfirmDeleteId} ownerId={user?.id} />
            )}
          </>
        )}
      </MotionDiv>

      {/* Organizations section */}
      <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
        <Group justify="space-between" mb="md" mt="xl" wrap="wrap">
          <Title order={3}>{t('Organizations')}</Title>
          <motion.div {...buttonStates}>
            <Button
              variant="light"
              leftSection={<Plus size={16} />}
              onClick={() => setCreateOrgModalOpen(true)}
            >
              {t('Create organization')}
            </Button>
          </motion.div>
        </Group>

        {!orgsLoading && organizations.length === 0 && (
          <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
            <Center py={40}>
              <Stack align="center" gap="sm">
                <ThemeIcon size="xl" variant="light" color="violet" radius="xl">
                  <Building2 size={24} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  {t('No organizations yet')}
                </Text>
              </Stack>
            </Center>
          </MotionDiv>
        )}

        {organizations.length > 0 && (
          <Stack gap="sm">
            {organizations.map((org) => (
              <MotionDiv key={org.id} variants={contentVariants} initial="hidden" animate="visible">
                <Paper
                  component={Link}
                  to={`/orgs/${org.slug}`}
                  withBorder
                  p="md"
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    transition: 'border-color 120ms ease, background-color 120ms ease',
                  }}
                  styles={{
                    root: {
                      '&:hover': {
                        borderColor: 'var(--gb-border-strong)',
                        backgroundColor: 'var(--gb-highlight-row)',
                      },
                    },
                  }}
                >
                  <Group justify="space-between" align="center">
                    <Group gap="sm">
                      <ThemeIcon variant="light" color="violet" size="md" radius="xl">
                        <Building2 size={14} />
                      </ThemeIcon>
                      <div>
                        <Text size="sm" fw={600}>
                          {org.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {org.slug}
                        </Text>
                      </div>
                    </Group>
                    {org.description && (
                      <Text size="xs" c="dimmed" truncate maw={300}>
                        {org.description}
                      </Text>
                    )}
                  </Group>
                </Paper>
              </MotionDiv>
            ))}
          </Stack>
        )}
      </MotionDiv>

      <CreateProjectModal opened={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      <CreateOrgModal opened={createOrgModalOpen} onClose={() => setCreateOrgModalOpen(false)} />

      <ConfirmModal
        opened={Boolean(confirmDeleteId)}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => void handleDeleteConfirmed()}
        title={t('Delete project')}
        message={t(
          'Are you sure you want to delete "{{name}}"? All languages and entries will be permanently removed.',
          { name: confirmDeleteProject?.name ?? '' },
        )}
        confirmLabel={t('Delete project')}
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
