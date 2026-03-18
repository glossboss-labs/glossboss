/**
 * Roadmap — public page showing planned, in-progress, and completed features.
 */

import { useMemo, useState } from 'react';
import {
  Title,
  Group,
  Text,
  Center,
  Loader,
  Alert,
  Stack,
  TextInput,
  SegmentedControl,
  ThemeIcon,
  Paper,
  Badge,
  Progress,
  Anchor,
  Button,
} from '@mantine/core';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Search,
  ExternalLink,
  ThumbsUp,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  Circle,
} from 'lucide-react';
import {
  sectionVariants,
  contentVariants,
  fadeVariants,
  staggerContainerVariants,
} from '@/lib/motion';
import { useTranslation, msgid } from '@/lib/app-language';
import { formatRelative } from '@/lib/utils/date';
import { useRoadmapItems } from '@/lib/roadmap/queries';
import { FeedbackModal } from '@/components/feedback';
import { deriveStatus, type RoadmapIssue, type RoadmapStatus } from '@/lib/roadmap/types';
import { createFuseSearch, fuzzyFilter } from '@/lib/utils/fuzzy-search';

const MotionDiv = motion.div;

const STATUS_LABELS: Record<RoadmapStatus, string> = {
  all: msgid('All'),
  planned: msgid('Planned'),
  'in-progress': msgid('In progress'),
  done: msgid('Done'),
};

const STATUS_COLORS: Record<'planned' | 'in-progress' | 'done', string> = {
  planned: 'gray',
  'in-progress': 'blue',
  done: 'teal',
};

const STATUS_ICONS: Record<'planned' | 'in-progress' | 'done', typeof Circle> = {
  planned: Circle,
  'in-progress': Clock,
  done: CheckCircle2,
};

function extractPhaseLabel(labels: RoadmapIssue['labels']): string | null {
  const phase = labels.find((l) => l.name.startsWith('phase:'));
  return phase ? phase.name : null;
}

function RoadmapCard({ issue }: { issue: RoadmapIssue }) {
  const { t } = useTranslation();
  const status = deriveStatus(issue);
  const StatusIcon = STATUS_ICONS[status];
  const phaseLabel = extractPhaseLabel(issue.labels);
  const progressPct =
    issue.tasksTotal > 0 ? Math.round((issue.tasksDone / issue.tasksTotal) * 100) : 0;

  return (
    <Paper
      withBorder
      p="lg"
      style={{
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
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="sm" align="flex-start" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <StatusIcon
              size={18}
              style={{
                color: `var(--mantine-color-${STATUS_COLORS[status]}-6)`,
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
              <Text fw={600} size="md">
                {issue.title}
              </Text>
              {issue.goal && (
                <Text size="sm" c="dimmed" lineClamp={2}>
                  {issue.goal}
                </Text>
              )}
            </Stack>
          </Group>

          <Badge variant="light" color={STATUS_COLORS[status]} size="sm">
            {t(STATUS_LABELS[status])}
          </Badge>
        </Group>

        {issue.tasksTotal > 0 && (
          <Group gap={8} align="center">
            <Progress.Root size="sm" style={{ flex: 1 }}>
              <Progress.Section value={progressPct} color={STATUS_COLORS[status]} />
            </Progress.Root>
            <Text
              size="xs"
              fw={600}
              c={progressPct === 100 ? 'teal' : undefined}
              style={{ minWidth: 60, textAlign: 'right' }}
              className="gb-tabular-nums"
            >
              {issue.tasksDone}/{issue.tasksTotal} {t('tasks')}
            </Text>
          </Group>
        )}

        <Group justify="space-between" wrap="wrap">
          <Group gap={6}>
            {phaseLabel && (
              <Badge variant="light" size="xs" color="grape">
                {phaseLabel}
              </Badge>
            )}
            {issue.reactions > 0 && (
              <Badge variant="light" size="xs" color="yellow" leftSection={<ThumbsUp size={10} />}>
                {issue.reactions}
              </Badge>
            )}
          </Group>

          <Group gap="sm">
            <Text size="xs" c="dimmed">
              {formatRelative(issue.updatedAt)}
            </Text>
            {issue.url && (
              <Anchor
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                size="xs"
                c="dimmed"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={12} />
                {t('Discuss')}
              </Anchor>
            )}
          </Group>
        </Group>
      </Stack>
    </Paper>
  );
}

export default function Roadmap() {
  const { t } = useTranslation();
  const { data: issues = [], isLoading: loading, error: queryError } = useRoadmapItems();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RoadmapStatus>('all');
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const error = queryError
    ? (() => {
        const msg = (queryError as Error).message ?? '';
        return msg.includes('Not Found') || msg.includes('SERVER_MISCONFIGURED')
          ? t('The roadmap is temporarily unavailable. Please try again later.')
          : msg || t('Failed to load roadmap');
      })()
    : null;

  const roadmapFuse = useMemo(() => createFuseSearch(issues, ['title', 'goal']), [issues]);

  const filtered = useMemo(() => {
    let result = issues;

    if (statusFilter !== 'all') {
      result = result.filter((issue) => deriveStatus(issue) === statusFilter);
    }

    result = fuzzyFilter(roadmapFuse, result, search, ['title', 'goal']);

    // Sort: in-progress first, then planned, then done; within each group by issue number
    const statusOrder: Record<string, number> = { 'in-progress': 0, planned: 1, done: 2 };
    return result.sort((a, b) => {
      const sa = statusOrder[deriveStatus(a)] ?? 1;
      const sb = statusOrder[deriveStatus(b)] ?? 1;
      if (sa !== sb) return sa - sb;
      return a.number - b.number;
    });
  }, [roadmapFuse, issues, search, statusFilter]);

  const counts = useMemo(() => {
    const c = { planned: 0, 'in-progress': 0, done: 0 };
    for (const issue of issues) {
      c[deriveStatus(issue)]++;
    }
    return c;
  }, [issues]);

  const segmentData = (Object.keys(STATUS_LABELS) as RoadmapStatus[]).map((key) => ({
    value: key,
    label:
      key === 'all'
        ? `${t(STATUS_LABELS[key])} (${issues.length})`
        : `${t(STATUS_LABELS[key])} (${counts[key]})`,
  }));

  return (
    <>
      <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
        <Group justify="space-between" mb="xl">
          <div>
            <Title order={2}>{t('Roadmap')}</Title>
            <Text size="sm" mt={4} c="dimmed">
              {t('Planned features and improvements')}
            </Text>
          </div>
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

        {!loading && !error && issues.length === 0 && (
          <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
            <Center py={60}>
              <Stack align="center" gap="lg" maw={420}>
                <ThemeIcon size={64} variant="light" color="blue" radius="xl">
                  <Sparkles size={32} />
                </ThemeIcon>
                <Stack align="center" gap={4}>
                  <Title order={3}>{t('Big things are coming')}</Title>
                  <Text size="sm" c="dimmed" ta="center">
                    {t(
                      "We're cooking up new features. Want to help shape what comes next? Tell us what you need.",
                    )}
                  </Text>
                </Stack>
                <Button
                  variant="light"
                  leftSection={<MessageSquare size={16} />}
                  onClick={() => setFeedbackOpen(true)}
                >
                  {t('Share feedback')}
                </Button>
              </Stack>
            </Center>
          </MotionDiv>
        )}

        {!loading && issues.length > 0 && (
          <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
            <Stack gap="md">
              <Stack gap="sm">
                <SegmentedControl
                  value={statusFilter}
                  onChange={(v) => setStatusFilter(v as RoadmapStatus)}
                  data={segmentData}
                  size="xs"
                  fullWidth
                />
                <TextInput
                  placeholder={t('Search roadmap…')}
                  leftSection={<Search size={14} />}
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                  size="sm"
                />
              </Stack>

              {filtered.length === 0 ? (
                <Center py={40}>
                  <Text size="sm" c="dimmed">
                    {t('No roadmap items match your search')}
                  </Text>
                </Center>
              ) : (
                <MotionDiv variants={staggerContainerVariants} initial="hidden" animate="visible">
                  <Stack gap="sm">
                    {filtered.map((issue) => (
                      <MotionDiv key={issue.url || issue.number} variants={contentVariants}>
                        <RoadmapCard issue={issue} />
                      </MotionDiv>
                    ))}
                  </Stack>
                </MotionDiv>
              )}

              <Paper withBorder p="md" mt="sm">
                <Group justify="space-between" align="center" wrap="wrap">
                  <Text size="sm" c="dimmed">
                    {t('Missing something? Let us know what you need.')}
                  </Text>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<MessageSquare size={14} />}
                    onClick={() => setFeedbackOpen(true)}
                  >
                    {t('Share feedback')}
                  </Button>
                </Group>
              </Paper>
            </Stack>
          </MotionDiv>
        )}
      </MotionDiv>

      <FeedbackModal opened={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
