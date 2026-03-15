import type { BillingInterval, PlanTier } from './types';

/**
 * Polar.sh product IDs — each plan tier × billing interval maps to a
 * separate Polar product because Polar uses one interval per product.
 */
export const POLAR_PRODUCT_IDS: Record<
  Exclude<PlanTier, 'free'>,
  Record<BillingInterval, string>
> = {
  pro: {
    month: 'POLAR_PRODUCT_ID',
    year: 'POLAR_PRODUCT_ID',
  },
  organization: {
    month: 'POLAR_PRODUCT_ID',
    year: 'POLAR_PRODUCT_ID',
  },
};

/** Reverse-lookup: given a Polar product ID, return plan tier and interval. */
export function resolvePolarProduct(
  productId: string,
): { tier: PlanTier; interval: BillingInterval } | null {
  for (const [tier, intervals] of Object.entries(POLAR_PRODUCT_IDS)) {
    for (const [interval, id] of Object.entries(intervals)) {
      if (id === productId) {
        return {
          tier: tier as PlanTier,
          interval: interval as BillingInterval,
        };
      }
    }
  }
  return null;
}

/** Pricing display data for the pricing page. */
export const PLAN_PRICING: Record<Exclude<PlanTier, 'free'>, { month: number; year: number }> = {
  pro: { month: 7, year: 69 },
  organization: { month: 29, year: 279 },
};
