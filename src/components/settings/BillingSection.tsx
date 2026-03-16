/**
 * Billing Section — current plan overview, upgrade cards, Flex calculator.
 *
 * Follows in-app billing patterns (Linear, Vercel, Supabase): compact plan
 * cards with key differentiators, current plan prominently displayed, and
 * usage-based calculator shown only when relevant.
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
  Divider,
  Notification,
  Title,
  Box,
  ThemeIcon,
  SimpleGrid,
  NumberInput,
  Slider,
  Collapse,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
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
  TrendingUp,
  Activity,
  Calculator,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSubscription } from '@/hooks/use-subscription';
import { useProjectsStore } from '@/stores/projects-store';
import { useTranslation } from '@/lib/app-language';
import { createCheckoutSession } from '@/lib/billing/api';
import {
  formatLimit,
  PLAN_LIMITS,
  FLEX_PRICING,
  FLEX_CROSSOVER,
  getFlexMonthlyCost,
} from '@/lib/billing/limits';
import { PLAN_PRICING, POLAR_PRODUCT_IDS } from '@/lib/billing/polar';
import { PlanBadge } from '@/components/billing/PlanBadge';
import type { BillingInterval, PlanTier } from '@/lib/billing/types';

/* ------------------------------------------------------------------ */
/* Usage bar                                                           */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Flex cost calculator                                                */
/* ------------------------------------------------------------------ */

function FlexCalculator({ interval }: { interval: BillingInterval }) {
  const { t } = useTranslation();
  const [strings, setStrings] = useState(10_000);
  const cost = getFlexMonthlyCost(strings);

  const proCost = interval === 'year' ? PLAN_PRICING.pro.year / 12 : PLAN_PRICING.pro.month;
  const orgCost =
    interval === 'year' ? PLAN_PRICING.organization.year / 12 : PLAN_PRICING.organization.month;

  const cheaperPlan = cost > orgCost ? 'Organization' : cost > proCost ? 'Pro' : null;

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            {t('Strings')}
          </Text>
          <NumberInput
            value={strings}
            onChange={(v) => setStrings(typeof v === 'number' ? v : 0)}
            min={0}
            max={500_000}
            step={1000}
            size="xs"
            w={120}
            thousandSeparator=","
          />
        </Group>
        <Slider
          value={strings}
          onChange={setStrings}
          min={0}
          max={500_000}
          step={1000}
          color="teal"
          size="sm"
          label={(v) => `${(v / 1000).toFixed(0)}K`}
          marks={[
            { value: 5_000, label: '5K' },
            { value: 100_000, label: '100K' },
            { value: 250_000, label: '250K' },
            { value: 500_000, label: '500K' },
          ]}
          mb="lg"
        />
      </Stack>

      <Group justify="space-between" align="baseline">
        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            {t('Estimated monthly cost')}
          </Text>
          {strings <= FLEX_PRICING.freeStrings && (
            <Text size="xs" c="teal">
              {t('First {{count}} strings are free', {
                count: FLEX_PRICING.freeStrings.toLocaleString(),
              })}
            </Text>
          )}
        </Stack>
        <Text fz={24} fw={700} c="teal">
          €{cost.toFixed(2)}
        </Text>
      </Group>

      {cheaperPlan && (
        <Alert color="blue" variant="light" icon={<TrendingUp size={14} />} py="xs">
          <Text size="xs">
            {cheaperPlan === 'Organization'
              ? t(
                  'At {{count}} strings, the Organization plan (€{{price}}/mo) would save you money.',
                  {
                    count: strings.toLocaleString(),
                    price: orgCost.toFixed(2),
                  },
                )
              : t('At {{count}} strings, the Pro plan (€{{price}}/mo) would save you money.', {
                  count: strings.toLocaleString(),
                  price: proCost.toFixed(2),
                })}
          </Text>
        </Alert>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/* Plan card                                                           */
/* ------------------------------------------------------------------ */

interface PlanCardProps {
  name: string;
  icon: React.ReactNode;
  color: string;
  price: React.ReactNode;
  subtitle: string;
  features: string[];
  isCurrent: boolean;
  ctaLabel: string;
  onUpgrade?: () => void;
  upgrading: boolean;
  children?: React.ReactNode;
}

function PlanCard({
  name,
  icon,
  color,
  price,
  subtitle,
  features,
  isCurrent,
  ctaLabel,
  onUpgrade,
  upgrading,
  children,
}: PlanCardProps) {
  return (
    <Paper
      p="md"
      withBorder
      style={{
        borderTop: `3px solid var(--mantine-color-${color}-6)`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack gap="sm" style={{ flex: 1 }}>
        {/* Header */}
        <Group gap="xs">
          <ThemeIcon variant="light" color={color} size="sm" radius="xl">
            {icon}
          </ThemeIcon>
          <Text size="sm" fw={600}>
            {name}
          </Text>
          {isCurrent && (
            <Badge variant="light" color={color} size="xs">
              Current
            </Badge>
          )}
        </Group>

        {/* Price */}
        <Box>
          {price}
          <Text size="xs" c="dimmed" mt={2}>
            {subtitle}
          </Text>
        </Box>

        <Divider />

        {/* Features */}
        <Stack gap={6} style={{ flex: 1 }}>
          {features.map((f) => (
            <Group key={f} gap={6} wrap="nowrap" align="flex-start">
              <Check
                size={12}
                color={`var(--mantine-color-${color}-6)`}
                style={{ flexShrink: 0, marginTop: 3 }}
              />
              <Text size="xs" lh={1.4}>
                {f}
              </Text>
            </Group>
          ))}
        </Stack>

        {/* Extra content (e.g. calculator toggle) */}
        {children}

        {/* CTA */}
        <Button
          fullWidth
          variant={isCurrent ? 'default' : 'light'}
          color={isCurrent ? 'gray' : color}
          disabled={isCurrent}
          loading={upgrading}
          onClick={onUpgrade}
          leftSection={isCurrent ? <Check size={14} /> : <Zap size={14} />}
          size="sm"
        >
          {isCurrent ? 'Current plan' : ctaLabel}
        </Button>
      </Stack>
    </Paper>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function BillingSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { subscription, plan, limits, loading } = useSubscription();
  const projects = useProjectsStore((s) => s.projects);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('year');
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [calcOpen, { toggle: toggleCalc }] = useDisclosure(false);

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
  const isFlexPlan = plan === 'flex';
  const isAdminOverride = subscription !== null && !subscription.polar_subscription_id;
  const isCanceled = subscription?.status === 'canceled';
  const isPastDue = subscription?.status === 'past_due';

  const flexMonthlyCost = getFlexMonthlyCost(stringCount);

  const handleUpgrade = async (tier: Exclude<PlanTier, 'free'>) => {
    setUpgrading(tier);
    setCheckoutError(null);
    try {
      const productId = POLAR_PRODUCT_IDS[tier][tier === 'flex' ? 'month' : billingInterval]!;
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

  // Price helpers
  const proMonthly = PLAN_PRICING.pro.month;
  const proYearly = PLAN_PRICING.pro.year;
  const orgMonthly = PLAN_PRICING.organization.month;
  const orgYearly = PLAN_PRICING.organization.year;

  const proDisplayPrice =
    billingInterval === 'year' ? `€${(proYearly / 12).toFixed(2)}` : `€${proMonthly}`;
  const orgDisplayPrice =
    billingInterval === 'year' ? `€${(orgYearly / 12).toFixed(2)}` : `€${orgMonthly}`;

  const proSavings = Math.round((1 - proYearly / (proMonthly * 12)) * 100);
  const orgSavings = Math.round((1 - orgYearly / (orgMonthly * 12)) * 100);

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

          {isFlexPlan && (
            <>
              <Divider />
              <Group justify="space-between">
                <Group gap="xs">
                  <Activity size={14} />
                  <Text size="xs" c="dimmed">
                    {t('Estimated monthly cost')}
                  </Text>
                </Group>
                <Text size="sm" fw={600} c="teal">
                  €{flexMonthlyCost.toFixed(2)}
                </Text>
              </Group>
              {stringCount > FLEX_CROSSOVER.pro && (
                <Alert color="blue" variant="light" icon={<TrendingUp size={14} />} py="xs">
                  <Text size="xs">
                    {stringCount > FLEX_CROSSOVER.organization
                      ? t(
                          'At {{count}} strings, the Organization plan (€{{price}}/mo) would save you money.',
                          {
                            count: stringCount.toLocaleString(),
                            price: orgMonthly,
                          },
                        )
                      : t(
                          'At {{count}} strings, the Pro plan (€{{price}}/mo) would save you money.',
                          {
                            count: stringCount.toLocaleString(),
                            price: proMonthly,
                          },
                        )}
                  </Text>
                </Alert>
              )}
            </>
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

      {/* Plan cards */}
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={2}>
            <Title order={4}>{t('Compare plans')}</Title>
            <Text size="sm" c="dimmed">
              {t('Choose the plan that fits your translation workflow.')}
            </Text>
          </Stack>

          <Group gap="sm">
            <SegmentedControl
              size="xs"
              value={billingInterval}
              onChange={(v) => setBillingInterval(v as BillingInterval)}
              data={[
                { label: t('Monthly'), value: 'month' },
                { label: t('Yearly'), value: 'year' },
              ]}
            />
            <Badge size="sm" variant="light" color="green" leftSection={<Sparkles size={10} />}>
              {t('Save up to 20% with annual billing')}
            </Badge>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {/* Free */}
          <PlanCard
            name={t('Free')}
            icon={<User size={14} />}
            color="gray"
            price={
              <Text fz={24} fw={700}>
                €0
              </Text>
            }
            subtitle={t('No credit card required')}
            features={[
              `${formatLimit(PLAN_LIMITS.free.projects)} ${t('project')}`,
              `${formatLimit(PLAN_LIMITS.free.strings)} ${t('strings')}`,
              `${formatLimit(PLAN_LIMITS.free.members)} ${t('member')}`,
            ]}
            isCurrent={isFreePlan}
            ctaLabel={t('Get started free')}
            upgrading={false}
          />

          {/* Flex */}
          <PlanCard
            name="Flex"
            icon={<Activity size={14} />}
            color="teal"
            price={
              <Group gap={4} align="baseline">
                <Text fz={24} fw={700}>
                  €{FLEX_PRICING.pricePerKStrings}
                </Text>
                <Text size="xs" c="dimmed">
                  / 1K {t('strings')}
                </Text>
              </Group>
            }
            subtitle={t('Pay as you go · billed monthly')}
            features={[
              t('Unlimited projects'),
              t('Unlimited team members'),
              `${formatLimit(FLEX_PRICING.freeStrings)} ${t('strings')} ${t('Free').toLowerCase()}`,
              t('Real-time collaboration'),
            ]}
            isCurrent={isFlexPlan}
            ctaLabel={t('Upgrade to {{plan}}', { plan: 'Flex' })}
            onUpgrade={() => void handleUpgrade('flex')}
            upgrading={upgrading === 'flex'}
          >
            {/* Inline calculator toggle */}
            <Button
              variant="subtle"
              size="compact-xs"
              color="teal"
              onClick={toggleCalc}
              leftSection={<Calculator size={12} />}
              rightSection={calcOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            >
              {t('Estimate cost')}
            </Button>
            <Collapse in={calcOpen}>
              <FlexCalculator interval={billingInterval} />
            </Collapse>
          </PlanCard>

          {/* Pro */}
          <PlanCard
            name="Pro"
            icon={<Crown size={14} />}
            color="blue"
            price={
              <Group gap={4} align="baseline">
                <Text fz={24} fw={700}>
                  {proDisplayPrice}
                </Text>
                <Text size="xs" c="dimmed">
                  / {t('month')}
                </Text>
              </Group>
            }
            subtitle={
              billingInterval === 'year'
                ? `€${proYearly} ${t('billed annually')} · ${t('Save {{percent}}%', { percent: proSavings })}`
                : t('Billed monthly')
            }
            features={[
              `${formatLimit(PLAN_LIMITS.pro.projects)} ${t('projects')}`,
              `${formatLimit(PLAN_LIMITS.pro.strings)} ${t('strings')}`,
              `${formatLimit(PLAN_LIMITS.pro.members)} ${t('team members')}`,
              t('Real-time collaboration'),
              t('Repository sync'),
            ]}
            isCurrent={plan === 'pro'}
            ctaLabel={t('Upgrade to {{plan}}', { plan: 'Pro' })}
            onUpgrade={() => void handleUpgrade('pro')}
            upgrading={upgrading === 'pro'}
          />

          {/* Organization */}
          <PlanCard
            name={t('Organization')}
            icon={<Building2 size={14} />}
            color="violet"
            price={
              <Group gap={4} align="baseline">
                <Text fz={24} fw={700}>
                  {orgDisplayPrice}
                </Text>
                <Text size="xs" c="dimmed">
                  / {t('month')}
                </Text>
              </Group>
            }
            subtitle={
              billingInterval === 'year'
                ? `€${orgYearly} ${t('billed annually')} · ${t('Save {{percent}}%', { percent: orgSavings })}`
                : t('Billed monthly')
            }
            features={[
              t('Unlimited projects'),
              t('Unlimited strings'),
              t('Unlimited team members'),
              t('Organization management'),
              t('Priority support'),
            ]}
            isCurrent={plan === 'organization'}
            ctaLabel={t('Upgrade to {{plan}}', { plan: 'Organization' })}
            onUpgrade={() => void handleUpgrade('organization')}
            upgrading={upgrading === 'organization'}
          />
        </SimpleGrid>
      </Stack>
    </Stack>
  );
}
