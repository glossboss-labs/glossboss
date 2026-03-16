/**
 * Billing Section — plan overview, usage stats, pricing comparison, upgrade flow.
 *
 * Uses a proven SaaS pricing layout: monthly/yearly toggle, feature comparison,
 * highlighted recommended plan, clear CTAs, and social proof elements.
 */

import { useState } from 'react';
import {
  Stack,
  Text,
  Paper,
  Group,
  Button,
  Progress,
  Badge,
  Alert,
  Loader,
  SegmentedControl,
  List,
  Divider,
  Notification,
} from '@mantine/core';
import {
  CreditCard,
  ExternalLink,
  Zap,
  AlertCircle,
  Check,
  Crown,
  Building2,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSubscription } from '@/hooks/use-subscription';
import { useProjectsStore } from '@/stores/projects-store';
import { useTranslation } from '@/lib/app-language';
import { createCheckoutSession } from '@/lib/billing/api';
import { formatLimit, PLAN_LIMITS } from '@/lib/billing/limits';
import { PLAN_PRICING, POLAR_PRODUCT_IDS } from '@/lib/billing/polar';
import { PlanBadge } from '@/components/billing/PlanBadge';
import type { BillingInterval, PlanTier } from '@/lib/billing/types';

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

function PlanCard({
  tier,
  name,
  icon,
  price,
  interval,
  features,
  isCurrentPlan,
  isRecommended,
  onUpgrade,
  upgrading,
}: {
  tier: Exclude<PlanTier, 'free'>;
  name: string;
  icon: React.ReactNode;
  price: number;
  interval: BillingInterval;
  features: string[];
  isCurrentPlan: boolean;
  isRecommended: boolean;
  onUpgrade: () => void;
  upgrading: boolean;
}) {
  const { t } = useTranslation();
  const yearlyPrice = PLAN_PRICING[tier].year;
  const monthlyEquivalent =
    interval === 'year' ? Math.round((yearlyPrice / 12) * 100) / 100 : price;
  const savingsPercent =
    interval === 'year' ? Math.round((1 - yearlyPrice / (PLAN_PRICING[tier].month * 12)) * 100) : 0;

  return (
    <Paper
      p="md"
      withBorder
      style={{
        borderColor: isRecommended ? 'var(--mantine-color-blue-6)' : undefined,
        borderWidth: isRecommended ? 2 : undefined,
        position: 'relative',
      }}
    >
      {isRecommended && (
        <Badge
          color="blue"
          size="xs"
          style={{
            position: 'absolute',
            top: -10,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {t('Most popular')}
        </Badge>
      )}

      <Stack gap="sm">
        <Group gap="xs">
          {icon}
          <Text size="sm" fw={600}>
            {name}
          </Text>
        </Group>

        <Group gap={2} align="baseline">
          <Text size="xl" fw={800}>
            €{interval === 'year' ? monthlyEquivalent.toFixed(2) : price}
          </Text>
          <Text size="xs" c="dimmed">
            /{t('month')}
          </Text>
        </Group>

        {interval === 'year' && (
          <Group gap="xs">
            <Text size="xs" c="dimmed" td="line-through">
              €{PLAN_PRICING[tier].month}/{t('month')}
            </Text>
            <Badge size="xs" color="green" variant="light">
              {t('Save {{percent}}%', { percent: savingsPercent })}
            </Badge>
          </Group>
        )}

        {interval === 'year' && (
          <Text size="xs" c="dimmed">
            €{yearlyPrice} {t('billed annually')}
          </Text>
        )}

        <Divider />

        <List size="xs" spacing={6} icon={<Check size={12} color="var(--mantine-color-green-6)" />}>
          {features.map((f) => (
            <List.Item key={f}>{f}</List.Item>
          ))}
        </List>

        <Button
          fullWidth
          variant={isRecommended ? 'filled' : 'light'}
          color="blue"
          disabled={isCurrentPlan}
          loading={upgrading}
          onClick={onUpgrade}
          leftSection={isCurrentPlan ? <Check size={14} /> : <Zap size={14} />}
        >
          {isCurrentPlan ? t('Current plan') : t('Upgrade')}
        </Button>
      </Stack>
    </Paper>
  );
}

export function BillingSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { subscription, plan, limits, loading } = useSubscription();
  const projects = useProjectsStore((s) => s.projects);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

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

  const projectCount = projects.filter((p) => !p.organization_id).length;
  const stringCount = projects
    .filter((p) => !p.organization_id)
    .reduce((sum, p) => sum + (p.stats_total ?? 0), 0);

  const isFreePlan = plan === 'free';
  const isAdminOverride = subscription !== null && !subscription.polar_subscription_id;
  const isCanceled = subscription?.status === 'canceled';
  const isPastDue = subscription?.status === 'past_due';

  const handleUpgrade = async (tier: 'pro' | 'organization') => {
    setUpgrading(tier);
    setCheckoutError(null);
    try {
      const productId = POLAR_PRODUCT_IDS[tier][billingInterval];
      const url = await createCheckoutSession(productId);
      window.location.href = url;
    } catch (err) {
      console.error('Checkout failed:', err);
      setCheckoutError(t('Failed to start checkout. Please try again.'));
    } finally {
      setUpgrading(null);
    }
  };

  const handleManage = () => {
    window.open('https://polar.sh/glossboss/portal', '_blank');
  };

  const proFeatures = [
    `${formatLimit(PLAN_LIMITS.pro.projects)} ${t('projects')}`,
    `${formatLimit(PLAN_LIMITS.pro.strings)} ${t('strings')}`,
    `${formatLimit(PLAN_LIMITS.pro.members)} ${t('team members')}`,
    t('Real-time collaboration'),
    t('Review workflows'),
    t('Repository sync'),
  ];

  const orgFeatures = [
    t('Unlimited projects'),
    t('Unlimited strings'),
    t('Unlimited team members'),
    t('Real-time collaboration'),
    t('Review workflows'),
    t('Repository sync'),
    t('Organization management'),
    t('Priority support'),
  ];

  return (
    <Stack gap="md">
      {/* Status alerts */}
      {isPastDue && (
        <Alert color="red" icon={<AlertCircle size={16} />}>
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="sm">
              {t(
                'Your payment is past due. Please update your payment method to avoid service interruption.',
              )}
            </Text>
            <Button size="xs" color="red" variant="light" onClick={handleManage}>
              {t('Update payment')}
            </Button>
          </Group>
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

      {checkoutError && (
        <Notification
          color="red"
          icon={<AlertCircle size={16} />}
          onClose={() => setCheckoutError(null)}
        >
          {checkoutError}
        </Notification>
      )}

      {/* Current plan + usage */}
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

          <Divider />

          <UsageBar label={t('Projects')} current={projectCount} limit={limits.projects} />
          <UsageBar label={t('Strings')} current={stringCount} limit={limits.strings} />

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

      {/* Pricing cards */}
      {(isFreePlan || plan === 'pro') && !isAdminOverride && (
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Zap size={16} />
              <Text size="sm" fw={500}>
                {isFreePlan ? t('Upgrade your plan') : t('Need more capacity?')}
              </Text>
            </Group>
            <SegmentedControl
              size="xs"
              value={billingInterval}
              onChange={(v) => setBillingInterval(v as BillingInterval)}
              data={[
                { label: t('Monthly'), value: 'month' },
                { label: t('Yearly'), value: 'year' },
              ]}
            />
          </Group>

          {billingInterval === 'year' && (
            <Alert color="green" variant="light" icon={<Shield size={16} />} py="xs">
              <Text size="xs" fw={500}>
                {t('Save up to 20% with annual billing')}
              </Text>
            </Alert>
          )}

          <Group grow align="stretch">
            {isFreePlan && (
              <PlanCard
                tier="pro"
                name="Pro"
                icon={<Crown size={16} color="var(--mantine-color-blue-6)" />}
                price={PLAN_PRICING.pro.month}
                interval={billingInterval}
                features={proFeatures}
                isCurrentPlan={plan === 'pro'}
                isRecommended
                onUpgrade={() => void handleUpgrade('pro')}
                upgrading={upgrading === 'pro'}
              />
            )}

            <PlanCard
              tier="organization"
              name="Organization"
              icon={<Building2 size={16} color="var(--mantine-color-violet-6)" />}
              price={PLAN_PRICING.organization.month}
              interval={billingInterval}
              features={orgFeatures}
              isCurrentPlan={plan === 'organization'}
              isRecommended={plan === 'pro'}
              onUpgrade={() => void handleUpgrade('organization')}
              upgrading={upgrading === 'organization'}
            />
          </Group>

          {/* Free plan comparison */}
          {isFreePlan && (
            <Paper p="sm" withBorder bg="var(--mantine-color-dark-7)">
              <Group justify="space-between" align="center">
                <Stack gap={2}>
                  <Text size="xs" fw={500}>
                    {t('Free plan')}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatLimit(PLAN_LIMITS.free.projects)} {t('project')} &middot;{' '}
                    {formatLimit(PLAN_LIMITS.free.strings)} {t('strings')} &middot;{' '}
                    {formatLimit(PLAN_LIMITS.free.members)} {t('member')}
                  </Text>
                </Stack>
                <Badge variant="outline" color="dimmed" size="sm">
                  {t('Current')}
                </Badge>
              </Group>
            </Paper>
          )}
        </Stack>
      )}
    </Stack>
  );
}
