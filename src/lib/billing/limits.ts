import type { PlanLimits, PlanTier } from './types';

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: { projects: 1, strings: 5_000, members: 1 },
  pro: { projects: 25, strings: 100_000, members: 10 },
  organization: { projects: Infinity, strings: Infinity, members: Infinity },
};

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
