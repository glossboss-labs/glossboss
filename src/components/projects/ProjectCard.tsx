/**
 * ProjectCard — displays a single project with translation stats.
 */

import { Link } from 'react-router';
import { Paper, Text, Group, Progress, Badge, Stack, ActionIcon, Menu } from '@mantine/core';
import { MoreVertical, Trash2, Languages } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import type { ProjectRow } from '@/lib/projects/types';

interface ProjectCardProps {
  project: ProjectRow;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const { t } = useTranslation();
  const { stats_total, stats_translated, stats_fuzzy } = project;
  const pct = stats_total > 0 ? Math.round((stats_translated / stats_total) * 100) : 0;
  const fuzzyPct = stats_total > 0 ? Math.round((stats_fuzzy / stats_total) * 100) : 0;

  const timeAgo = formatRelative(project.updated_at);

  return (
    <Paper
      component={Link}
      to={`/projects/${project.id}`}
      withBorder
      p="lg"
      style={{
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
      }}
      styles={{
        root: {
          '&:hover': {
            borderColor: 'var(--mantine-color-blue-5)',
            boxShadow: 'var(--gb-shadow-tooltip)',
          },
        },
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Text fw={600} size="md" truncate>
            {project.name}
          </Text>
          {project.target_language && (
            <Group gap={4}>
              <Languages size={12} style={{ opacity: 0.5 }} />
              <Text size="xs" c="dimmed">
                {project.target_language}
              </Text>
            </Group>
          )}
        </Stack>

        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" size="sm" color="gray" onClick={(e) => e.preventDefault()}>
              <MoreVertical size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              color="red"
              leftSection={<Trash2 size={14} />}
              onClick={(e) => {
                e.preventDefault();
                onDelete(project.id);
              }}
            >
              {t('Delete')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Stack gap={6} mt="md">
        <Progress.Root size="sm">
          <Progress.Section value={pct} color="blue" />
          <Progress.Section value={fuzzyPct} color="yellow" />
        </Progress.Root>

        <Group justify="space-between">
          <Group gap={8}>
            <Badge variant="light" size="xs" color="blue">
              {stats_translated}/{stats_total}
            </Badge>
            {stats_fuzzy > 0 && (
              <Badge variant="light" size="xs" color="yellow">
                {stats_fuzzy} {t('fuzzy')}
              </Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            {timeAgo}
          </Text>
        </Group>
      </Stack>
    </Paper>
  );
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
