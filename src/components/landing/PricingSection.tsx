import { useState } from 'react';
import { Link } from 'react-router';
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
      <div className="my-4">
        <span className="text-3xl font-semibold text-text-primary">€0</span>
        <span className="text-sm text-text-tertiary">/mo</span>
      </div>
    );
  }
  if (tier === 'flex') {
    return (
      <div className="my-4">
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
    <div className="my-4">
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
            <p className="mt-1 text-xs text-text-tertiary">€{pricing.year} billed yearly</p>
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

  return (
    <div className="mt-6 rounded-lg border border-border-subtle bg-surface-0 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-text-tertiary">{t('Strings')}</span>
        <span className="text-xs font-medium text-text-secondary tabular-nums">
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
        className="mb-4 h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-accent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
      />

      <div className="flex items-center justify-between text-xs text-text-tertiary">
        <span>0</span>
        <span>500k</span>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-xs text-text-tertiary">
          {strings <= FLEX_PRICING.freeStrings
            ? t('First {{count}} strings are free', {
                count: FLEX_PRICING.freeStrings.toLocaleString(),
              })
            : t('Estimated monthly cost')}
        </span>
        <span className="text-xl font-semibold text-status-translated tabular-nums">
          €{cost.toFixed(2)}
        </span>
      </div>

      {cheaperPlan && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-accent/5 p-3 text-xs text-text-secondary">
          <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <span>
            {cheaperPlan === 'Organization'
              ? t(
                  'At {{count}} strings, the Organization plan (€{{price}}/mo) would save you money.',
                  { count: strings.toLocaleString(), price: orgCost.toFixed(2) },
                )
              : t('At {{count}} strings, the Pro plan (€{{price}}/mo) would save you money.', {
                  count: strings.toLocaleString(),
                  price: proCost.toFixed(2),
                })}
          </span>
        </div>
      )}
    </div>
  );
}

export function PricingSection() {
  const { t } = useTranslation();
  const [interval, setInterval] = useState<Interval>('month');

  return (
    <section id="pricing" className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            {t('Simple, transparent pricing')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-text-secondary">
            {t(
              'The local editor is free forever, without limits. Cloud features like projects, collaboration, and repo sync use these plans.',
            )}
          </p>

          <div className="mt-8 inline-flex items-center rounded-md border border-border-subtle bg-surface-1 p-0.5">
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
              {t('Yearly')}{' '}
              <span className="text-xs font-medium text-status-translated">{t('Save 17%')}</span>
            </button>
          </div>
        </div>

        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_CATALOG.map((plan) => (
            <motion.div
              key={plan.tier}
              initial={{ opacity: 0.15, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: 0 }}
              className={cn(
                'flex flex-col rounded-lg border bg-surface-1 p-5',
                plan.featured ? 'border-accent/40' : 'border-border-subtle',
              )}
            >
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

              {plan.tier === 'flex' && <FlexCalculator interval={interval} />}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
