import type { PlanLimits, PlanTier } from './types';

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: { projects: 1, strings: 5_000, members: 1 },
  pro: { projects: 25, strings: 100_000, members: 10 },
  organization: { projects: Infinity, strings: Infinity, members: Infinity },
  flex: { projects: Infinity, strings: Infinity, members: Infinity },
};

/** Flex plan pricing constants. */
export const FLEX_PRICING = {
  /** Price per 1,000 strings per month in EUR. */
  pricePerKStrings: 0.1,
  /** Number of strings included free each billing period. */
  freeStrings: 5_000,
} as const;

/** Calculate projected monthly cost for a Flex subscriber. */
export function getFlexMonthlyCost(totalStrings: number): number {
  const billable = Math.max(0, totalStrings - FLEX_PRICING.freeStrings);
  return Math.ceil(billable / 1_000) * FLEX_PRICING.pricePerKStrings;
}

/** Crossover points where fixed plans become cheaper than Flex. */
export const FLEX_CROSSOVER = {
  /** Strings at which Pro (€7/mo) becomes cheaper than Flex. */
  pro: 75_000,
  /** Strings at which Organization (€29/mo) becomes cheaper than Flex. */
  organization: 295_000,
} as const;

export function getPlanLimits(tier: PlanTier): PlanLimits {
  return PLAN_LIMITS[tier];
}

export function isAtLimit(tier: PlanTier, resource: keyof PlanLimits, current: number): boolean {
  const limit = PLAN_LIMITS[tier][resource];
  return limit !== Infinity && current >= limit;
}

export function getRemainingCapacity(
  tier: PlanTier,
  resource: keyof PlanLimits,
  current: number,
): number {
  const limit = PLAN_LIMITS[tier][resource];
  if (limit === Infinity) return Infinity;
  return Math.max(0, limit - current);
}

export function formatLimit(value: number): string {
  if (value === Infinity) return 'Unlimited';
  if (value >= 1_000) return `${(value / 1_000).toLocaleString()}k`;
  return value.toLocaleString();
}
