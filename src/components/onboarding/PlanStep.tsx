/**
 * PlanStep — plan picker that mirrors the homepage PricingSection layout.
 *
 * Selecting a paid plan opens a Polar checkout session.
 * "Continue with Free" advances to the next onboarding step.
 */

import { useState } from 'react';
import { Alert } from '@mantine/core';
import { Tooltip } from '@mantine/core';
import { Check, AlertCircle, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '@/lib/app-language';
import { PLAN_CATALOG, formatMonthlyPrice } from '@/lib/billing/catalog';
import { PLAN_PRICING, POLAR_PRODUCT_IDS } from '@/lib/billing/polar';
import { FLEX_PRICING, getFlexMonthlyCost } from '@/lib/billing/limits';
import { createCheckoutSession } from '@/lib/billing/api';
import type { PlanTier } from '@/lib/billing/types';
import type { UserRole } from '@/lib/onboarding/types';
import { cn } from '@/lib/utils';

type Interval = 'month' | 'year';

const ROLE_TO_PLAN: Record<UserRole, PlanTier> = {
  individual: 'free',
  team_lead: 'pro',
  agency: 'organization',
  developer: 'flex',
};

/* ------------------------------------------------------------------ */
/*  PriceDisplay — identical to PricingSection                         */
/* ------------------------------------------------------------------ */

function PriceDisplay({ tier, interval }: { tier: string; interval: Interval }) {
  const { t } = useTranslation();

  if (tier === 'free') {
    return (
      <div className="my-4 h-[52px]">
        <span className="text-3xl font-semibold text-text-primary">€0</span>
        <span className="text-sm text-text-tertiary">{t('/mo')}</span>
      </div>
    );
  }
  if (tier === 'flex') {
    return (
      <div className="my-4 h-[52px]">
        <span className="text-3xl font-semibold text-text-primary">
          €{FLEX_PRICING.pricePerKStrings}
        </span>
        <span className="text-sm text-text-tertiary">{t('/1k strings')}</span>
      </div>
    );
  }
  const pricing = PLAN_PRICING[tier as 'pro' | 'organization'];
  const displayPrice = formatMonthlyPrice(tier as Exclude<PlanTier, 'free'>, interval);
  return (
    <div className="my-4 h-[52px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${tier}-${interval}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          <span className="text-3xl font-semibold text-text-primary">{displayPrice}</span>
          <span className="text-sm text-text-tertiary">{t('/mo')}</span>
          {interval === 'year' && (
            <p className="mt-0.5 text-xs text-text-tertiary">
              {t('€{{price}} billed yearly', { price: pricing.year })}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FlexCalculator — identical to PricingSection                       */
/* ------------------------------------------------------------------ */

function FlexCalculator({ interval }: { interval: Interval }) {
  const { t } = useTranslation();
  const [strings, setStrings] = useState(10_000);
  const cost = getFlexMonthlyCost(strings);

  const proCost = interval === 'year' ? PLAN_PRICING.pro.year / 12 : PLAN_PRICING.pro.month;
  const orgCost =
    interval === 'year' ? PLAN_PRICING.organization.year / 12 : PLAN_PRICING.organization.month;
  const cheaperPlan = cost > orgCost ? 'Organization' : cost > proCost ? 'Pro' : null;

  const bottomLabel = cheaperPlan
    ? cheaperPlan === 'Organization'
      ? t('At {{count}} strings, the Organization plan (€{{price}}/mo) would save you money.', {
          count: strings.toLocaleString(),
          price: orgCost.toFixed(2),
        })
      : t('At {{count}} strings, the Pro plan (€{{price}}/mo) would save you money.', {
          count: strings.toLocaleString(),
          price: proCost.toFixed(2),
        })
    : strings <= FLEX_PRICING.freeStrings
      ? t('First {{count}} strings are free', {
          count: FLEX_PRICING.freeStrings.toLocaleString(),
        })
      : t('Estimated monthly cost');

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-0 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] text-text-tertiary">{t('Strings')}</span>
        <span className="text-[11px] font-medium text-text-secondary tabular-nums">
          {strings.toLocaleString()}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={500_000}
        step={1000}
        value={strings}
        onChange={(e) => setStrings(Number(e.target.value))}
        className="mb-3 h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-accent [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
      />

      <div className="flex items-center justify-between text-[11px] text-text-tertiary">
        <span>0</span>
        <span>500k</span>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <Tooltip
          label={bottomLabel}
          multiline
          w={240}
          withArrow
          position="bottom-start"
          disabled={!cheaperPlan}
        >
          <span
            className={cn(
              'min-w-0 truncate text-[11px]',
              cheaperPlan ? 'cursor-help text-accent' : 'text-text-tertiary',
            )}
          >
            {cheaperPlan && <TrendingUp className="mr-1 inline h-3 w-3 align-[-2px]" />}
            {bottomLabel}
          </span>
        </Tooltip>
        <span className="shrink-0 text-lg font-semibold text-status-translated tabular-nums">
          €{cost.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PlanStep                                                           */
/* ------------------------------------------------------------------ */

interface PlanStepProps {
  role: UserRole | null;
  preselectedPlan: string | null;
  preselectedInterval: string | null;
  onNext: (plan: PlanTier, interval: Interval) => void;
}

export function PlanStep({ role, preselectedPlan, preselectedInterval, onNext }: PlanStepProps) {
  const { t } = useTranslation();
  const [interval, setInterval] = useState<Interval>(
    preselectedInterval === 'year' ? 'year' : 'month',
  );
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recommendedTier: PlanTier =
    (preselectedPlan as PlanTier) || (role ? ROLE_TO_PLAN[role] : 'pro');

  const handleSelectPlan = async (tier: PlanTier) => {
    if (tier === 'free') {
      onNext('free', interval);
      return;
    }

    setCheckoutLoading(tier);
    setError(null);

    try {
      const productIds = POLAR_PRODUCT_IDS[tier];
      const productId = productIds?.[tier === 'flex' ? 'month' : interval];
      if (!productId) throw new Error('Product not found');

      const successUrl = `${window.location.origin}/onboarding?step=attribution&checkout=success&plan=${tier}&interval=${interval}`;
      const checkoutUrl = await createCheckoutSession(productId, successUrl);
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to start checkout'));
      setCheckoutLoading(null);
    }
  };

  const displayPlans = PLAN_CATALOG.filter((p) => p.tier !== 'flex');
  const flexPlan = PLAN_CATALOG.find((p) => p.tier === 'flex');

  return (
    <div>
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-text-primary">
          {t('Choose your plan')}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-text-secondary">
          {t('You can always change your plan later.')}
        </p>

        {/* Interval toggle */}
        <div className="relative mt-6 inline-flex items-center rounded-md border border-border-subtle bg-surface-1 p-0.5">
          <span className="absolute -top-2.5 right-0 translate-x-0 rounded-full bg-status-translated px-2 py-0.5 text-[10px] font-bold text-black sm:translate-x-2">
            {t('Save up to 20%')}
          </span>
          <button
            type="button"
            className={cn(
              'rounded-[5px] px-4 py-1.5 text-sm font-medium transition-all',
              interval === 'month'
                ? 'bg-surface-0 text-text-primary shadow-sm'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
            onClick={() => setInterval('month')}
          >
            {t('Monthly')}
          </button>
          <button
            type="button"
            className={cn(
              'rounded-[5px] px-4 py-1.5 text-sm font-medium transition-all',
              interval === 'year'
                ? 'bg-surface-0 text-text-primary shadow-sm'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
            onClick={() => setInterval('year')}
          >
            {t('Yearly')}
          </button>
        </div>
      </div>

      {error && (
        <Alert icon={<AlertCircle size={16} />} color="red" variant="light" mb="md">
          {error}
        </Alert>
      )}

      {/* Plan cards — matches homepage grid */}
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayPlans.map((plan) => {
          const isRecommended = plan.tier === recommendedTier;
          return (
            <div
              key={plan.tier}
              className={cn(
                'relative flex flex-col rounded-lg border bg-surface-1 p-5 shadow-sm',
                isRecommended ? 'border-text-primary/25' : 'border-border-subtle',
              )}
            >
              {isRecommended && (
                <span className="absolute -top-2.5 right-4 rounded-full bg-text-primary px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-surface-0">
                  {t('Recommended')}
                </span>
              )}

              <h3 className="text-sm font-semibold text-text-primary">{t(plan.name)}</h3>
              <p className="text-xs text-text-tertiary">{t(plan.description)}</p>

              <PriceDisplay tier={plan.tier} interval={interval} />

              <button
                type="button"
                onClick={() => void handleSelectPlan(plan.tier)}
                disabled={checkoutLoading !== null}
                className={cn(
                  'mb-5 block w-full rounded-md py-2 text-center text-sm font-medium transition-colors',
                  isRecommended
                    ? 'bg-text-primary text-surface-0 hover:opacity-90'
                    : 'border border-border-default text-text-primary hover:bg-surface-2',
                  checkoutLoading === plan.tier && 'opacity-60',
                )}
              >
                {checkoutLoading === plan.tier
                  ? t('Redirecting...')
                  : plan.tier === 'free'
                    ? t('Continue with Free')
                    : t('Get started')}
              </button>

              <ul className="flex flex-col gap-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-text-secondary">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-translated" />
                    {t(feature)}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Flex — full-width card below the subscription grid */}
      {flexPlan && (
        <div className="mt-4 grid grid-cols-1 gap-5 rounded-lg border border-border-subtle bg-surface-1 p-5 shadow-sm md:grid-cols-2">
          <div>
            <div className="flex items-baseline gap-3">
              <h3 className="text-sm font-semibold text-text-primary">{t(flexPlan.name)}</h3>
              <p className="text-xs text-text-tertiary">{t(flexPlan.description)}</p>
            </div>

            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-text-primary">
                €{FLEX_PRICING.pricePerKStrings}
              </span>
              <span className="text-sm text-text-tertiary">/1k strings</span>
            </div>

            <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-1.5">
              {flexPlan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Check className="h-3.5 w-3.5 shrink-0 text-status-translated" />
                  {t(feature)}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => void handleSelectPlan('flex')}
              disabled={checkoutLoading !== null}
              className={cn(
                'mt-4 block w-full rounded-md border border-border-default px-6 py-2 text-center text-sm font-medium text-text-primary transition-colors hover:bg-surface-2 md:inline-block md:w-auto',
                checkoutLoading === 'flex' && 'opacity-60',
              )}
            >
              {checkoutLoading === 'flex' ? t('Redirecting...') : t('Get started')}
            </button>
          </div>

          <FlexCalculator interval={interval} />
        </div>
      )}
    </div>
  );
}
