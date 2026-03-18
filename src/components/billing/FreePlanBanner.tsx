/**
 * FreePlanBanner — persistent dashboard card for free-tier users.
 *
 * Shows plan limits, current usage, and a prominent upgrade CTA.
 * Only renders for authenticated users on the free plan.
 */

import { Link } from 'react-router';
import { Paper, Group, Stack, Text, Button, Progress, Badge, ThemeIcon } from '@mantine/core';
import { Zap, Crown } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useSubscription } from '@/hooks/use-subscription';
import { useProjects } from '@/lib/projects/queries';
import { formatLimit, PLAN_LIMITS } from '@/lib/billing/limits';

export function FreePlanBanner() {
  const { t } = useTranslation();
  const { plan, loading } = useSubscription();
  const { data: projects = [] } = useProjects();

  if (loading || plan !== 'free') return null;

  const limits = PLAN_LIMITS.free;
  const projectCount = projects.filter((p) => !p.organization_id).length;
  const stringCount = projects
    .filter((p) => !p.organization_id)
    .reduce((sum, p) => sum + (p.stats_total ?? 0), 0);

  const projectPct = Math.min(100, (projectCount / limits.projects) * 100);
  const stringPct = Math.min(100, (stringCount / limits.strings) * 100);

  return (
    <Paper
      withBorder
      p="md"
      mb="lg"
      style={{
        borderColor: 'var(--mantine-color-blue-4)',
        borderWidth: 1,
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Stack gap="sm" style={{ flex: 1, minWidth: 240 }}>
          <Group gap="xs">
            <ThemeIcon variant="light" color="blue" size="sm" radius="xl">
              <Zap size={14} />
            </ThemeIcon>
            <Text size="sm" fw={600}>
              {t('Free plan')}
            </Text>
            <Badge variant="outline" color="dimmed" size="xs">
              {formatLimit(limits.projects)} {t('project')} &middot; {formatLimit(limits.strings)}{' '}
              {t('strings')} &middot; {formatLimit(limits.members)} {t('member')}
            </Badge>
            <Text size="xs" c="dimmed">
              {t('For your own projects — collaborating on others is always free')}
            </Text>
          </Group>

          <Group gap="lg" grow style={{ maxWidth: 400 }}>
            <Stack gap={2}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {t('Projects')}
                </Text>
                <Text size="xs" fw={500} c={projectPct >= 100 ? 'red' : undefined}>
                  {projectCount}/{limits.projects}
                </Text>
              </Group>
              <Progress
                value={projectPct}
                size="xs"
                color={projectPct >= 100 ? 'red' : projectPct > 80 ? 'yellow' : 'blue'}
              />
            </Stack>
            <Stack gap={2}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {t('Strings')}
                </Text>
                <Text size="xs" fw={500} c={stringPct >= 100 ? 'red' : undefined}>
                  {stringCount.toLocaleString()}/{formatLimit(limits.strings)}
                </Text>
              </Group>
              <Progress
                value={stringPct}
                size="xs"
                color={stringPct >= 100 ? 'red' : stringPct > 80 ? 'yellow' : 'blue'}
              />
            </Stack>
          </Group>
        </Stack>

        <Button
          component={Link}
          to="/settings?tab=billing"
          variant="light"
          color="blue"
          leftSection={<Crown size={14} />}
          size="sm"
        >
          {t('View plans')}
        </Button>
      </Group>
    </Paper>
  );
}
