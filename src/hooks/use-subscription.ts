/**
 * Re-export useSubscription from the TanStack Query-based billing queries.
 *
 * All consumers import from this path; the implementation now lives in
 * `@/lib/billing/queries` using TanStack Query instead of manual
 * useState/useEffect.
 */

export { useSubscription } from '@/lib/billing/queries';
