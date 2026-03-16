/**
 * ProjectGridSkeleton — content-shaped loading placeholder for the project grid.
 *
 * Shows skeleton cards that match the ProjectCard shape, so the layout
 * doesn't shift when real data loads (Vercel-style skeleton loading).
 */

import { SimpleGrid, Paper, Stack, Group, Skeleton } from '@mantine/core';

interface ProjectGridSkeletonProps {
  count?: number;
}

export function ProjectGridSkeleton({ count = 6 }: ProjectGridSkeletonProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3, xl: 4 }} spacing="md">
      {Array.from({ length: count }, (_, i) => (
        <Paper key={i} withBorder p="md">
          <Stack gap="sm">
            <Group justify="space-between">
              <Skeleton height={16} width="60%" radius="sm" />
              <Skeleton height={16} width={16} radius="xl" />
            </Group>
            <Skeleton height={8} width="100%" radius="xl" />
            <Group gap="xs">
              <Skeleton height={18} width={60} radius="sm" />
              <Skeleton height={18} width={50} radius="sm" />
              <Skeleton height={18} width={70} radius="sm" />
            </Group>
            <Group justify="space-between">
              <Skeleton height={12} width="40%" radius="sm" />
              <Skeleton height={12} width="20%" radius="sm" />
            </Group>
          </Stack>
        </Paper>
      ))}
    </SimpleGrid>
  );
}
