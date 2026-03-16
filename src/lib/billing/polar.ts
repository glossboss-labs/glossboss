import type { BillingInterval, PlanTier } from './types';

/**
 * Polar.sh product IDs — each plan tier × billing interval maps to a
 * separate Polar product because Polar uses one interval per product.
 *
 * Flex is a single metered subscription product (monthly billing cycle).
 */
export const POLAR_PRODUCT_IDS: Record<
  Exclude<PlanTier, 'free'>,
  Partial<Record<BillingInterval, string>>
> = {
  pro: {
    month: 'a05ba809-8991-4b7d-b624-a44b92fdf072',
    year: 'b2792805-fbd7-4e6e-b272-f75cef5754bc',
  },
  organization: {
    month: 'b2d90cd3-918a-4ef5-aa7a-6e6459bcbac8',
    year: '5c1f8bc1-080b-4734-9097-a6cc66290790',
  },
  flex: {
    month: '2a946d88-730e-484a-a10e-4dc0bfa582b2',
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
  flex: { month: 0, year: 0 },
};
