/**
 * Plan catalog — single source of truth for plan metadata.
 *
 * Used by the landing page pricing section, the in-app billing section,
 * and anywhere else plan details are displayed. Feature lists are derived
 * from PLAN_LIMITS so changing a limit updates every surface automatically.
 *
 * Strings are wrapped in `msgid()` for i18n extraction. Values that depend
 * on limits are interpolated into `msgid()` at module init — the extractor
 * sees the template, and `t()` resolves the translation at render time.
 */

import { msgid } from '@/lib/app-language';
import { PLAN_LIMITS, FLEX_PRICING, formatLimit } from './limits';
import { PLAN_PRICING } from './polar';
import type { PlanTier } from './types';

export interface PlanCatalogEntry {
  tier: PlanTier;
  /** Display name (translatable via `t()`). */
  name: string;
  /** Short tagline (translatable via `t()`). */
  description: string;
  /** Whether this plan should be visually highlighted. */
  featured?: boolean;
  /** Feature bullet points (translatable via `t()`). */
  features: string[];
}

// Pre-format limit values so they appear in feature strings.
const FREE = PLAN_LIMITS.free;
const PRO = PLAN_LIMITS.pro;
const freeStrings = formatLimit(FLEX_PRICING.freeStrings);

export const PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    tier: 'free',
    name: msgid('Free'),
    description: msgid('For individuals'),
    features: [
      msgid(`${formatLimit(FREE.projects)} project`),
      msgid(`${formatLimit(FREE.strings)} strings`),
      msgid(`${formatLimit(FREE.members)} member`),
      msgid('DeepL, Azure & Gemini'),
      msgid('Glossary & translation memory'),
      msgid('QA checks'),
    ],
  },
  {
    tier: 'pro',
    name: msgid('Pro'),
    description: msgid('For small teams'),
    featured: true,
    features: [
      msgid(`${formatLimit(PRO.projects)} projects`),
      msgid(`${formatLimit(PRO.strings)} strings`),
      msgid(`${formatLimit(PRO.members)} members`),
      msgid('Review workflow'),
      msgid('Push to GitHub & GitLab'),
      msgid('Priority support'),
    ],
  },
  {
    tier: 'organization',
    name: msgid('Organization'),
    description: msgid('For agencies and studios'),
    features: [
      msgid('Unlimited projects'),
      msgid('Unlimited strings'),
      msgid('Unlimited members'),
      msgid('All Pro features'),
      msgid('Organization management'),
      msgid('Custom billing'),
    ],
  },
  {
    tier: 'flex',
    name: msgid('Flex'),
    description: msgid('Pay as you go'),
    features: [
      msgid('Unlimited projects, strings & members'),
      msgid(`${freeStrings} strings free`),
      msgid('No commitment'),
      msgid('All Pro features included'),
      msgid('Cancel anytime'),
    ],
  },
];

/** Look up a single plan entry by tier. */
export function getPlanCatalogEntry(tier: PlanTier): PlanCatalogEntry | undefined {
  return PLAN_CATALOG.find((p) => p.tier === tier);
}

/**
 * Format the monthly display price for a paid tier at a given billing interval.
 * Returns the string "€X.XX" - use this everywhere prices are shown to avoid
 * rounding discrepancies between the landing page and billing section.
 */
export function formatMonthlyPrice(
  tier: Exclude<PlanTier, 'free'>,
  interval: 'month' | 'year',
): string {
  if (tier === 'flex') return `€${FLEX_PRICING.pricePerKStrings}`;
  const pricing = PLAN_PRICING[tier];
  const monthly = interval === 'year' ? pricing.year / 12 : pricing.month;
  // Show whole euros when the number is round, otherwise 2 decimal places
  return Number.isInteger(monthly) ? `€${monthly}` : `€${monthly.toFixed(2)}`;
}
