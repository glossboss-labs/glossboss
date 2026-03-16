/**
 * WelcomeModal — shown once after a user's first sign-in.
 *
 * Displays free plan limits and what Pro unlocks, then dismisses permanently
 * via localStorage so it never shows again.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  List,
  Divider,
  Badge,
  ThemeIcon,
  Paper,
  Title,
} from '@mantine/core';
import { Check, Crown, Zap, Sparkles } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useAuth } from '@/hooks/use-auth';
import { useSubscription } from '@/hooks/use-subscription';
import { formatLimit, PLAN_LIMITS } from '@/lib/billing/limits';

const STORAGE_KEY = 'gb-welcome-shown';

function getWelcomeShown() {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function WelcomeModal() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { plan, loading } = useSubscription();
  const [dismissed, setDismissed] = useState(getWelcomeShown);

  const shouldOpen = Boolean(user) && !loading && plan === 'free' && !dismissed;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  const freeLimits = PLAN_LIMITS.free;
  const proLimits = PLAN_LIMITS.pro;

  return (
    <Modal
      opened={shouldOpen}
      onClose={handleDismiss}
      title={
        <Group gap="xs">
          <Sparkles size={20} color="var(--mantine-color-blue-6)" />
          <Title order={4}>{t('Welcome to GlossBoss')}</Title>
        </Group>
      }
      size="md"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t("You're on the Free plan. Here's what's included:")}
        </Text>

        {/* Free plan */}
        <Paper withBorder p="sm">
          <Stack gap="xs">
            <Group gap="xs">
              <Badge variant="light" color="gray" size="sm">
                {t('Free plan')}
              </Badge>
              <Badge variant="light" color="green" size="xs">
                {t('Current')}
              </Badge>
            </Group>
            <List
              size="sm"
              spacing={4}
              icon={<Check size={14} color="var(--mantine-color-green-6)" />}
            >
              <List.Item>
                {formatLimit(freeLimits.projects)} {t('project')}
              </List.Item>
              <List.Item>
                {formatLimit(freeLimits.strings)} {t('strings')}
              </List.Item>
              <List.Item>
                {formatLimit(freeLimits.members)} {t('member')}
              </List.Item>
            </List>
          </Stack>
        </Paper>

        <Divider label={t('Need more capacity?')} labelPosition="center" />

        {/* Pro teaser */}
        <Paper withBorder p="sm" style={{ borderColor: 'var(--mantine-color-blue-4)' }}>
          <Stack gap="xs">
            <Group gap="xs">
              <ThemeIcon variant="light" color="blue" size="xs" radius="xl">
                <Crown size={10} />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                Pro
              </Text>
              <Badge variant="light" color="blue" size="xs">
                {t('Most popular')}
              </Badge>
            </Group>
            <List
              size="sm"
              spacing={4}
              icon={<Check size={14} color="var(--mantine-color-blue-6)" />}
            >
              <List.Item>
                {formatLimit(proLimits.projects)} {t('projects')}
              </List.Item>
              <List.Item>
                {formatLimit(proLimits.strings)} {t('strings')}
              </List.Item>
              <List.Item>
                {formatLimit(proLimits.members)} {t('team members')}
              </List.Item>
              <List.Item>{t('Real-time collaboration')}</List.Item>
              <List.Item>{t('Review workflows')}</List.Item>
            </List>
          </Stack>
        </Paper>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={handleDismiss}>
            {t('Get started free')}
          </Button>
          <Button
            component={Link}
            to="/settings?tab=billing"
            leftSection={<Zap size={14} />}
            onClick={handleDismiss}
          >
            {t('View plans')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
