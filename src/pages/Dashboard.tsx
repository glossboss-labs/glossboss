/**
 * Dashboard — project list for authenticated users.
 */

import { memo, useCallback, useMemo, useState } from 'react';
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
import {
  staggerPageVariants,
  staggerContainerVariants,
  contentVariants,
  fadeVariants,
  buttonStates,
} from '@/lib/motion';
import { AnimatedStateSwitch } from '@/components/ui';
import { useTranslation } from '@/lib/app-language';
import { sortProjects, type ProjectSortOption } from '@/lib/utils/sorting';
import { trackEvent } from '@/lib/analytics';
import { useProjects, useDeleteProject } from '@/lib/projects/queries';
import { useAuthStore } from '@/stores/auth-store';
import { useOrganizations } from '@/lib/organizations/queries';
import type { OrganizationRow } from '@/lib/organizations/types';
import { ProjectGrid } from '@/components/projects/ProjectGrid';
import { ProjectGridSkeleton } from '@/components/projects/ProjectGridSkeleton';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { CreateOrgModal } from '@/components/organizations/CreateOrgModal';
import { ConfirmModal } from '@/components/ui';
import { FreePlanBanner } from '@/components/billing/FreePlanBanner';
import { createFuseSearch, fuzzyFilter } from '@/lib/utils/fuzzy-search';

const MotionDiv = motion.div;

type SortOption = ProjectSortOption;

/** Memoized organization list item to avoid re-renders when sibling items change. */
const OrgCard = memo(function OrgCard({ org }: { org: OrganizationRow }) {
  return (
    <MotionDiv variants={contentVariants}>
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
  );
});

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: projects = [], isLoading: loading, error: projectsError } = useProjects();
  const deleteProjectMutation = useDeleteProject();
  const { user } = useAuthStore();
  const { data: organizations = [], isLoading: orgsLoading } = useOrganizations();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('updated');

  const error = projectsError ? (projectsError as Error).message : null;

  const confirmDeleteProject = confirmDeleteId
    ? projects.find((p) => p.id === confirmDeleteId)
    : null;

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteId) return;
    const projectToDelete = projects.find((p) => p.id === confirmDeleteId);
    try {
      await deleteProjectMutation.mutateAsync(confirmDeleteId);
      trackEvent('project_deleted', {
        had_translations: (projectToDelete?.stats_translated ?? 0) > 0,
      });
      setConfirmDeleteId(null);
    } catch {
      // Error handled by TanStack Query
    }
  };

  const fuse = useMemo(() => createFuseSearch(projects, ['name']), [projects]);
  const filtered = useMemo(
    () => sortProjects(fuzzyFilter(fuse, projects, search, ['name']), sort),
    [fuse, projects, search, sort],
  );

  const totalLanguages = projects.reduce((sum, p) => sum + (p.project_languages?.length ?? 0), 0);
  const totalStrings = projects.reduce((sum, p) => sum + p.stats_total, 0);

  const handleSortChange = useCallback(
    (v: string | null) => setSort((v as SortOption) || 'updated'),
    [],
  );

  const sortOptions = [
    { value: 'updated', label: t('Last updated') },
    { value: 'name', label: t('Name A–Z') },
    { value: 'most-strings', label: t('Most strings') },
    { value: 'least-complete', label: t('Least complete') },
  ];

  const projectStateKey = loading
    ? 'loading'
    : error
      ? 'error'
      : projects.length === 0
        ? 'empty'
        : 'data';
  const orgStateKey = orgsLoading ? 'loading' : organizations.length === 0 ? 'empty' : 'data';

  return (
    <>
      <FreePlanBanner />
      <MotionDiv variants={staggerPageVariants} initial="hidden" animate="visible">
        {/* Projects header */}
        <MotionDiv variants={fadeVariants}>
          <Group justify="space-between" mb="xl" wrap="wrap">
            <Title order={2}>{t('Projects')}</Title>
            <motion.div {...buttonStates}>
              <Button leftSection={<Plus size={16} />} onClick={() => setCreateModalOpen(true)}>
                {t('New project')}
              </Button>
            </motion.div>
          </Group>
        </MotionDiv>

        {/* Projects content — animated state transitions */}
        <MotionDiv variants={fadeVariants}>
          <AnimatedStateSwitch stateKey={projectStateKey}>
            {loading && <ProjectGridSkeleton />}

            {error && (
              <Alert icon={<AlertCircle size={16} />} color="red" variant="light" mb="md">
                {error}
              </Alert>
            )}

            {!loading && !error && projects.length === 0 && (
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
                    onChange={handleSortChange}
                    style={{ flex: '0 1 auto' }}
                    size="sm"
                    allowDeselect={false}
                  />
                </Group>

                {filtered.length === 0 ? (
                  <Center py={40}>
                    <Text size="sm" c="dimmed">
                      {t('No projects match your search')}
                    </Text>
                  </Center>
                ) : (
                  <ProjectGrid
                    projects={filtered}
                    onDelete={setConfirmDeleteId}
                    ownerId={user?.id}
                  />
                )}
              </>
            )}
          </AnimatedStateSwitch>
        </MotionDiv>

        {/* Organizations header */}
        <MotionDiv variants={fadeVariants}>
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
        </MotionDiv>

        {/* Organizations content */}
        <MotionDiv variants={fadeVariants}>
          <AnimatedStateSwitch stateKey={orgStateKey}>
            {orgsLoading && null}

            {!orgsLoading && organizations.length === 0 && (
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
            )}

            {organizations.length > 0 && (
              <MotionDiv variants={staggerContainerVariants} initial="hidden" animate="visible">
                <Stack gap="sm">
                  {organizations.map((org) => (
                    <OrgCard key={org.id} org={org} />
                  ))}
                </Stack>
              </MotionDiv>
            )}
          </AnimatedStateSwitch>
        </MotionDiv>
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
        loading={deleteProjectMutation.isPending}
      />
    </>
  );
}
