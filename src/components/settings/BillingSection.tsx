/**
 * Billing Section — plan overview, usage stats, pricing comparison, upgrade flow.
 *
 * Follows proven SaaS pricing page patterns: all plans visible, annual savings
 * always prominent, highlighted recommended tier, differentiated CTAs, and
 * clear visual hierarchy.
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
  SimpleGrid,
  Title,
  Box,
  ThemeIcon,
} from '@mantine/core';
import {
  CreditCard,
  ExternalLink,
  Zap,
  AlertCircle,
  Check,
  Crown,
  Building2,
  Sparkles,
  User,
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

interface PricingCardProps {
  tier: PlanTier;
  name: string;
  icon: React.ReactNode;
  color: string;
  interval: BillingInterval;
  features: string[];
  isCurrentPlan: boolean;
  isHighlighted: boolean;
  ctaLabel: string;
  onUpgrade?: () => void;
  upgrading: boolean;
}

function PricingCard({
  tier,
  name,
  icon,
  color,
  interval,
  features,
  isCurrentPlan,
  isHighlighted,
  ctaLabel,
  onUpgrade,
  upgrading,
}: PricingCardProps) {
  const { t } = useTranslation();
  const isFree = tier === 'free';
  const paidTier = tier as Exclude<PlanTier, 'free'>;

  const yearlyPrice = isFree ? 0 : PLAN_PRICING[paidTier].year;
  const monthlyPrice = isFree ? 0 : PLAN_PRICING[paidTier].month;
  const monthlyEquivalent = isFree
    ? 0
    : interval === 'year'
      ? Math.round((yearlyPrice / 12) * 100) / 100
      : monthlyPrice;
  const savingsPercent =
    isFree || interval === 'month' ? 0 : Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);

  return (
    <Paper
      p="lg"
      withBorder
      style={{
        borderColor: isHighlighted ? `var(--mantine-color-${color}-6)` : undefined,
        borderWidth: isHighlighted ? 2 : 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {isHighlighted && (
        <Badge
          color={color}
          size="sm"
          variant="filled"
          style={{
            position: 'absolute',
            top: -12,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {t('Most popular')}
        </Badge>
      )}

      <Stack gap="md" style={{ flex: 1 }}>
        {/* Plan header */}
        <Group gap="xs">
          <ThemeIcon variant="light" color={color} size="sm" radius="xl">
            {icon}
          </ThemeIcon>
          <Text size="sm" fw={600}>
            {name}
          </Text>
        </Group>

        {/* Price */}
        <Box>
          <Group gap={4} align="baseline">
            <Text fz={32} fw={800} lh={1}>
              {isFree ? t('Free') : `€${monthlyEquivalent.toFixed(interval === 'year' ? 2 : 0)}`}
            </Text>
            {!isFree && (
              <Text size="sm" c="dimmed">
                /{t('month')}
              </Text>
            )}
          </Group>

          {!isFree && interval === 'year' && (
            <Group gap="xs" mt={4}>
              <Text size="xs" c="dimmed" td="line-through">
                €{monthlyPrice}/{t('month')}
              </Text>
              <Badge size="xs" color="green" variant="light">
                {t('Save {{percent}}%', { percent: savingsPercent })}
              </Badge>
            </Group>
          )}

          {!isFree && interval === 'year' && (
            <Text size="xs" c="dimmed" mt={2}>
              €{yearlyPrice} {t('billed annually')}
            </Text>
          )}

          {!isFree && interval === 'month' && (
            <Text size="xs" c="dimmed" mt={2}>
              {t('Billed monthly')}
            </Text>
          )}

          {isFree && (
            <Text size="xs" c="dimmed" mt={2}>
              {t('No credit card required')}
            </Text>
          )}
        </Box>

        <Divider />

        {/* Features */}
        <List
          size="xs"
          spacing={8}
          icon={<Check size={14} color={`var(--mantine-color-${color}-6)`} />}
          style={{ flex: 1 }}
        >
          {features.map((f) => (
            <List.Item key={f}>{f}</List.Item>
          ))}
        </List>

        {/* CTA */}
        <Button
          fullWidth
          variant={isHighlighted ? 'filled' : isCurrentPlan ? 'default' : 'light'}
          color={isCurrentPlan ? 'gray' : color}
          disabled={isCurrentPlan}
          loading={upgrading}
          onClick={onUpgrade}
          leftSection={isCurrentPlan ? <Check size={14} /> : <Zap size={14} />}
          size="md"
        >
          {isCurrentPlan ? t('Current plan') : ctaLabel}
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
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('year');
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

  const freeFeatures = [
    `${formatLimit(PLAN_LIMITS.free.projects)} ${t('project')}`,
    `${formatLimit(PLAN_LIMITS.free.strings)} ${t('strings')}`,
    `${formatLimit(PLAN_LIMITS.free.members)} ${t('member')}`,
  ];

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

  const showUpgradeSection = (isFreePlan || plan === 'pro') && !isAdminOverride;

  return (
    <Stack gap="xl">
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

      {/* Pricing section */}
      {showUpgradeSection && (
        <Stack gap="lg">
          {/* Section header */}
          <Stack gap={4}>
            <Title order={4}>{t('Upgrade your plan')}</Title>
            <Text size="sm" c="dimmed">
              {t('Choose the plan that fits your translation workflow.')}
            </Text>
          </Stack>

          {/* Billing toggle with savings callout */}
          <Group justify="space-between" align="center" wrap="wrap">
            <SegmentedControl
              size="sm"
              value={billingInterval}
              onChange={(v) => setBillingInterval(v as BillingInterval)}
              data={[
                { label: t('Monthly'), value: 'month' },
                { label: t('Yearly'), value: 'year' },
              ]}
            />

            <Badge size="lg" variant="light" color="green" leftSection={<Sparkles size={14} />}>
              {t('Save up to 20% with annual billing')}
            </Badge>
          </Group>

          {/* Plan cards */}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <PricingCard
              tier="free"
              name={t('Free plan')}
              icon={<User size={14} />}
              color="gray"
              interval={billingInterval}
              features={freeFeatures}
              isCurrentPlan={isFreePlan}
              isHighlighted={false}
              ctaLabel={t('Get started free')}
              upgrading={false}
            />

            <PricingCard
              tier="pro"
              name="Pro"
              icon={<Crown size={14} />}
              color="blue"
              interval={billingInterval}
              features={proFeatures}
              isCurrentPlan={plan === 'pro'}
              isHighlighted={isFreePlan}
              ctaLabel={t('Upgrade to {{plan}}', { plan: 'Pro' })}
              onUpgrade={() => void handleUpgrade('pro')}
              upgrading={upgrading === 'pro'}
            />

            <PricingCard
              tier="organization"
              name={t('Organization')}
              icon={<Building2 size={14} />}
              color="violet"
              interval={billingInterval}
              features={orgFeatures}
              isCurrentPlan={plan === 'organization'}
              isHighlighted={plan === 'pro'}
              ctaLabel={t('Upgrade to {{plan}}', { plan: 'Organization' })}
              onUpgrade={() => void handleUpgrade('organization')}
              upgrading={upgrading === 'organization'}
            />
          </SimpleGrid>
        </Stack>
      )}
    </Stack>
  );
}
