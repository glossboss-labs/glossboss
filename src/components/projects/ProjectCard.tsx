/**
 * ProjectCard — displays a single project with translation stats.
 */

import { Link } from 'react-router';
import {
  Paper,
  Text,
  Group,
  Progress,
  Badge,
  Stack,
  ActionIcon,
  Menu,
  Tooltip,
} from '@mantine/core';
import { motion, AnimatePresence } from 'motion/react';
import { MoreVertical, Trash2, Settings, Languages, Globe } from 'lucide-react';
import { badgeVariants } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { VISIBILITY_ICON, VISIBILITY_LABEL } from '@/lib/constants/visibility';
import { formatRelative } from '@/lib/utils/date';
import type { ProjectWithLanguages } from '@/lib/projects/types';
import { CountryFlag } from '@/components/ui';

const MotionSpan = motion.span;

interface ProjectCardProps {
  project: ProjectWithLanguages;
  onDelete?: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const { t } = useTranslation();
  const { stats_total, stats_translated, stats_fuzzy, stats_untranslated } = project;
  const pct = stats_total > 0 ? Math.round((stats_translated / stats_total) * 100) : 0;
  const fuzzyPct = stats_total > 0 ? Math.round((stats_fuzzy / stats_total) * 100) : 0;

  const timeAgo = formatRelative(project.updated_at);
  const languages = project.project_languages ?? [];
  const VisIcon = VISIBILITY_ICON[project.visibility] ?? Globe;

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
        transition: 'border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease',
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
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Text fw={600} size="md" truncate>
            {project.name}
          </Text>
          <Group gap={6}>
            {languages.length > 0 && (
              <Group gap={4}>
                {languages.length <= 5 ? (
                  <Group gap={4}>
                    {languages.map((l) => (
                      <CountryFlag key={l.locale} code={l.locale} size="xs" />
                    ))}
                  </Group>
                ) : (
                  <Languages size={12} style={{ opacity: 0.5 }} />
                )}
                <Text size="xs" style={{ color: 'var(--gb-text-secondary)' }}>
                  {languages.length === 1
                    ? t('1 language')
                    : t('{{count}} languages', { count: languages.length })}
                </Text>
              </Group>
            )}
            <Badge variant="light" size="xs" color="gray">
              {project.source_format}
            </Badge>
            {project.wp_slug && (
              <Badge variant="light" size="xs" color="grape">
                WP
              </Badge>
            )}
          </Group>
        </Stack>

        <Group gap={4} wrap="nowrap">
          <Tooltip label={t(VISIBILITY_LABEL[project.visibility] ?? 'Public')}>
            <span style={{ display: 'inline-flex' }}>
              <VisIcon size={14} style={{ opacity: 0.4 }} />
            </span>
          </Tooltip>
          {onDelete && (
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
                  component={Link}
                  to={`/projects/${project.id}/settings`}
                  leftSection={<Settings size={14} />}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  {t('Settings')}
                </Menu.Item>
                <Menu.Divider />
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
          )}
        </Group>
      </Group>

      <Stack gap={6} mt="md">
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

        <Group justify="space-between">
          <Group gap={8}>
            <Badge variant="light" size="xs" color="blue">
              {stats_translated} {t('translated')}
            </Badge>
            <AnimatePresence>
              {stats_fuzzy > 0 && (
                <MotionSpan
                  key="fuzzy"
                  variants={badgeVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Badge variant="light" size="xs" color="yellow">
                    {stats_fuzzy} {t('fuzzy')}
                  </Badge>
                </MotionSpan>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {stats_untranslated > 0 && (
                <MotionSpan
                  key="untranslated"
                  variants={badgeVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Badge variant="light" size="xs" color="gray">
                    {stats_untranslated} {t('untranslated')}
                  </Badge>
                </MotionSpan>
              )}
            </AnimatePresence>
          </Group>
          <Text size="xs" style={{ color: 'var(--gb-text-secondary)' }}>
            {timeAgo}
          </Text>
        </Group>
      </Stack>
    </Paper>
  );
}
