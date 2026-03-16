import { useState } from 'react';
import { Link } from 'react-router';
import { Tooltip } from '@mantine/core';
import { Check, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '@/lib/app-language';
import { PLAN_CATALOG } from '@/lib/billing/catalog';
import { PLAN_PRICING } from '@/lib/billing/polar';
import { getFlexMonthlyCost, FLEX_PRICING } from '@/lib/billing/limits';
import { cn } from '@/lib/utils';

type Interval = 'month' | 'year';

function PriceDisplay({ tier, interval }: { tier: string; interval: Interval }) {
  if (tier === 'free') {
    return (
      <div className="my-4 h-[52px]">
        <span className="text-3xl font-semibold text-text-primary">€0</span>
        <span className="text-sm text-text-tertiary">/mo</span>
      </div>
    );
  }
  if (tier === 'flex') {
    return (
      <div className="my-4 h-[52px]">
        <span className="text-3xl font-semibold text-text-primary">
          €{FLEX_PRICING.pricePerKStrings}
        </span>
        <span className="text-sm text-text-tertiary">/1k strings</span>
      </div>
    );
  }
  const pricing = PLAN_PRICING[tier as 'pro' | 'organization'];
  const price = interval === 'year' ? Math.round(pricing.year / 12) : pricing.month;
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
          <span className="text-3xl font-semibold text-text-primary">€{price}</span>
          <span className="text-sm text-text-tertiary">/mo</span>
          {interval === 'year' && (
            <p className="mt-0.5 text-xs text-text-tertiary">€{pricing.year} billed yearly</p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function FlexCalculator({ interval }: { interval: Interval }) {
  const { t } = useTranslation();
  const [strings, setStrings] = useState(10_000);
  const cost = getFlexMonthlyCost(strings);

  const proCost = interval === 'year' ? PLAN_PRICING.pro.year / 12 : PLAN_PRICING.pro.month;
  const orgCost =
    interval === 'year' ? PLAN_PRICING.organization.year / 12 : PLAN_PRICING.organization.month;
  const cheaperPlan = cost > orgCost ? 'Organization' : cost > proCost ? 'Pro' : null;

  // Swap the bottom label text to show the savings hint — no extra element, no height change
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

export function PricingSection() {
  const { t } = useTranslation();
  const [interval, setInterval] = useState<Interval>('month');

  return (
    <section id="pricing" className="border-t border-border-subtle px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            {t('Simple, transparent pricing')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-text-secondary">
            {t(
              'The local editor is free forever, without limits. Cloud features like projects, collaboration, and repo sync use these plans.',
            )}
          </p>

          <div className="relative mt-8 inline-flex items-center rounded-md border border-border-subtle bg-surface-1 p-0.5">
            <span className="absolute -top-2.5 right-0 translate-x-2 rounded-full bg-status-translated px-2 py-0.5 text-[10px] font-bold text-black">
              {t('Save 17%')}
            </span>
            <button
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

        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLAN_CATALOG.filter((p) => p.tier !== 'flex').map((plan) => (
            <motion.div
              key={plan.tier}
              initial={{ opacity: 0.15, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: 0 }}
              className={cn(
                'relative flex flex-col rounded-lg border bg-surface-1 p-5 shadow-sm',
                plan.featured ? 'border-text-primary/25' : 'border-border-subtle',
              )}
            >
              {plan.featured && (
                <span className="absolute -top-2.5 right-4 rounded-full bg-text-primary px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-surface-0">
                  {t('Popular')}
                </span>
              )}

              <h3 className="text-sm font-semibold text-text-primary">{t(plan.name)}</h3>
              <p className="text-xs text-text-tertiary">{t(plan.description)}</p>

              <PriceDisplay tier={plan.tier} interval={interval} />

              <Link
                to={
                  plan.tier === 'free'
                    ? '/signup'
                    : `/signup?plan=${plan.tier}&interval=${interval}`
                }
                className={cn(
                  'mb-5 block rounded-md py-2 text-center text-sm font-medium transition-colors',
                  plan.featured
                    ? 'bg-text-primary text-surface-0 hover:opacity-90'
                    : 'border border-border-default text-text-primary hover:bg-surface-2',
                )}
              >
                {t('Get started')}
              </Link>

              <ul className="flex flex-col gap-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-text-secondary">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-translated" />
                    {t(feature)}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Flex — full-width card below the subscription grid */}
        {(() => {
          const flex = PLAN_CATALOG.find((p) => p.tier === 'flex');
          if (!flex) return null;
          return (
            <motion.div
              initial={{ opacity: 0.15, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: 0 }}
              className="mt-4 grid grid-cols-1 gap-5 rounded-lg border border-border-subtle bg-surface-1 p-5 shadow-sm md:grid-cols-2"
            >
              <div>
                <div className="flex items-baseline gap-3">
                  <h3 className="text-sm font-semibold text-text-primary">{t(flex.name)}</h3>
                  <p className="text-xs text-text-tertiary">{t(flex.description)}</p>
                </div>

                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-text-primary">
                    €{FLEX_PRICING.pricePerKStrings}
                  </span>
                  <span className="text-sm text-text-tertiary">/1k strings</span>
                </div>

                <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-1.5">
                  {flex.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-1.5 text-xs text-text-secondary"
                    >
                      <Check className="h-3.5 w-3.5 shrink-0 text-status-translated" />
                      {t(feature)}
                    </li>
                  ))}
                </ul>

                <Link
                  to={`/signup?plan=flex&interval=${interval}`}
                  className="mt-4 block w-full rounded-md border border-border-default px-6 py-2 text-center text-sm font-medium text-text-primary transition-colors hover:bg-surface-2 md:inline-block md:w-auto"
                >
                  {t('Get started')}
                </Link>
              </div>

              <FlexCalculator interval={interval} />
            </motion.div>
          );
        })()}
      </div>
    </section>
  );
}
