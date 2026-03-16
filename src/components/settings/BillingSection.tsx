/**
 * Billing Section — plan overview, usage stats, upgrade/manage subscription.
 */

import { Stack, Text, Paper, Group, Button, Progress, Badge, Alert, Loader } from '@mantine/core';
import { CreditCard, ExternalLink, Zap, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSubscription } from '@/hooks/use-subscription';
import { useProjectsStore } from '@/stores/projects-store';
import { useTranslation } from '@/lib/app-language';
import { createCheckoutSession } from '@/lib/billing/api';
import { formatLimit, PLAN_LIMITS } from '@/lib/billing/limits';
import { PLAN_PRICING, POLAR_PRODUCT_IDS } from '@/lib/billing/polar';
import { PlanBadge } from '@/components/billing/PlanBadge';

function UsageBar({ label, current, limit }: { label: string; current: number; limit: number }) {
  const { t } = useTranslation();
  const isUnlimited = limit === Infinity || limit >= 2_147_483_647;
  const percentage = isUnlimited ? 0 : Math.min(100, (current / limit) * 100);
  const atLimit = !isUnlimited && current >= limit;

  return (
    <Stack gap={4}>
      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        <Text size="xs" fw={500} c={atLimit ? 'red' : undefined}>
          {current.toLocaleString()} / {isUnlimited ? t('Unlimited') : limit.toLocaleString()}
        </Text>
      </Group>
      {!isUnlimited && (
        <Progress
          value={percentage}
          size="sm"
          color={atLimit ? 'red' : percentage > 80 ? 'yellow' : 'blue'}
        />
      )}
    </Stack>
  );
}

export function BillingSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { subscription, plan, limits, loading } = useSubscription();
  const projects = useProjectsStore((s) => s.projects);

  if (!user) {
    return (
      <Stack gap="md">
        <Alert color="blue" icon={<AlertCircle size={16} />}>
          <Text size="sm">{t('Sign in to manage your subscription.')}</Text>
        </Alert>
      </Stack>
    );
  }

  if (loading) {
    return (
      <Stack gap="md" align="center" py="xl">
        <Loader size="sm" />
      </Stack>
    );
  }

  // Calculate current usage
  const projectCount = projects.filter((p) => !p.organization_id).length;
  const stringCount = projects
    .filter((p) => !p.organization_id)
    .reduce((sum, p) => sum + (p.stats_total ?? 0), 0);

  const isFreePlan = plan === 'free';
  const isAdminOverride = subscription !== null && !subscription.polar_subscription_id;
  const isCanceled = subscription?.status === 'canceled';
  const isPastDue = subscription?.status === 'past_due';

  const handleUpgrade = async (tier: 'pro' | 'organization') => {
    const productId = POLAR_PRODUCT_IDS[tier].month;
    try {
      const url = await createCheckoutSession(productId);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Failed to create checkout session:', err);
    }
  };

  const handleManage = () => {
    window.open('https://polar.sh/glossboss/portal', '_blank');
  };

  return (
    <Stack gap="md">
      {/* Status alerts */}
      {isPastDue && (
        <Alert color="red" icon={<AlertCircle size={16} />}>
          <Text size="sm">
            {t(
              'Your payment is past due. Please update your payment method to avoid service interruption.',
            )}
          </Text>
        </Alert>
      )}

      {isCanceled && subscription?.current_period_end && (
        <Alert color="yellow" icon={<AlertCircle size={16} />}>
          <Text size="sm">
            {t('Your subscription is canceled and will expire on {{date}}.', {
              date: new Date(subscription.current_period_end).toLocaleDateString(),
            })}
          </Text>
        </Alert>
      )}

      {/* Current plan */}
      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <CreditCard size={16} />
              <Text size="sm" fw={500}>
                {t('Current plan')}
              </Text>
            </Group>
            <Group gap="xs">
              <PlanBadge plan={plan} />
              {isAdminOverride && (
                <Badge variant="light" color="green" size="sm">
                  {t('Admin')}
                </Badge>
              )}
            </Group>
          </Group>

          {isAdminOverride && (
            <Text size="xs" c="dimmed">
              {t('Unlimited access granted manually. No billing required.')}
            </Text>
          )}

          {!isFreePlan && !isAdminOverride && subscription && (
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                {subscription.billing_interval === 'year'
                  ? t('Billed annually')
                  : t('Billed monthly')}
              </Text>
              {subscription.current_period_end && (
                <>
                  <Text size="xs" c="dimmed">
                    &middot;
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t('Renews {{date}}', {
                      date: new Date(subscription.current_period_end).toLocaleDateString(),
                    })}
                  </Text>
                </>
              )}
            </Group>
          )}

          {!isFreePlan && !isAdminOverride && (
            <Button
              variant="light"
              size="xs"
              leftSection={<ExternalLink size={14} />}
              onClick={handleManage}
            >
              {t('Manage subscription')}
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Usage */}
      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Text size="sm" fw={500}>
            {t('Usage')}
          </Text>

          <UsageBar label={t('Projects')} current={projectCount} limit={limits.projects} />
          <UsageBar label={t('Strings')} current={stringCount} limit={limits.strings} />
        </Stack>
      </Paper>

      {/* Upgrade options */}
      {isFreePlan && !isAdminOverride && (
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Group gap="xs">
              <Zap size={16} />
              <Text size="sm" fw={500}>
                {t('Upgrade')}
              </Text>
            </Group>

            <Group grow>
              <Paper
                p="sm"
                withBorder
                style={{ cursor: 'pointer' }}
                onClick={() => handleUpgrade('pro')}
              >
                <Stack gap={4}>
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>
                      Pro
                    </Text>
                    <Badge variant="light" color="blue" size="xs">
                      {t('Popular')}
                    </Badge>
                  </Group>
                  <Text size="lg" fw={700}>
                    €{PLAN_PRICING.pro.month}
                    <Text span size="xs" c="dimmed" fw={400}>
                      /{t('month')}
                    </Text>
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatLimit(PLAN_LIMITS.pro.projects)} {t('projects')} &middot;{' '}
                    {formatLimit(PLAN_LIMITS.pro.strings)} {t('strings')} &middot;{' '}
                    {formatLimit(PLAN_LIMITS.pro.members)} {t('members')}
                  </Text>
                </Stack>
              </Paper>

              <Paper
                p="sm"
                withBorder
                style={{ cursor: 'pointer' }}
                onClick={() => handleUpgrade('organization')}
              >
                <Stack gap={4}>
                  <Text size="sm" fw={600}>
                    Organization
                  </Text>
                  <Text size="lg" fw={700}>
                    €{PLAN_PRICING.organization.month}
                    <Text span size="xs" c="dimmed" fw={400}>
                      /{t('month')}
                    </Text>
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatLimit(PLAN_LIMITS.organization.projects)} {t('projects')} &middot;{' '}
                    {formatLimit(PLAN_LIMITS.organization.strings)} {t('strings')} &middot;{' '}
                    {formatLimit(PLAN_LIMITS.organization.members)} {t('members')}
                  </Text>
                </Stack>
              </Paper>
            </Group>

            <Text size="xs" c="dimmed" ta="center">
              {t('Save with annual billing')}: Pro €{PLAN_PRICING.pro.year}/{t('year')} &middot; Org
              €{PLAN_PRICING.organization.year}/{t('year')}
            </Text>
          </Stack>
        </Paper>
      )}

      {plan === 'pro' && (
        <Paper p="sm" withBorder>
          <Group justify="space-between" align="center">
            <Text size="sm">{t('Need more capacity?')}</Text>
            <Button
              variant="light"
              size="xs"
              leftSection={<Zap size={14} />}
              onClick={() => handleUpgrade('organization')}
            >
              {t('Upgrade to Organization')}
            </Button>
          </Group>
        </Paper>
      )}
    </Stack>
  );
}
