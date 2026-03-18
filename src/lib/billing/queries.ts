/**
 * TanStack Query hooks for billing / subscriptions.
 *
 * Replaces the manual useState/useEffect pattern in use-subscription.ts
 * with a cached query that supports stale-while-revalidate.
 * Keeps the localStorage warm-cache for instant plan display on mount.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getUserSubscription } from './api';
import { getPlanLimits } from './limits';
import type { PlanTier, SubscriptionRow, PlanLimits } from './types';

const CACHE_KEY = 'gb-subscription-cache';

// ── Query key factory ────────────────────────────────────────

export const billingKeys = {
  subscription: ['billing', 'subscription'] as const,
};

// ── Local cache helpers (kept for instant display) ───────────

interface CachedSubscription {
  plan: PlanTier;
  userId: string;
}

function readCache(): CachedSubscription | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedSubscription;
  } catch {
    return null;
  }
}

function writeCache(plan: PlanTier, userId: string) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ plan, userId }));
}

// ── Hook ─────────────────────────────────────────────────────

interface UseSubscriptionResult {
  subscription: SubscriptionRow | null;
  plan: PlanTier;
  limits: PlanLimits;
  loading: boolean;
}

export function useSubscription(): UseSubscriptionResult {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const cached = readCache();
  const cachedPlan = cached && userId && cached.userId === userId ? cached.plan : null;

  const {
    data: subscription = null,
    isLoading,
    isFetched,
  } = useQuery<SubscriptionRow | null>({
    queryKey: billingKeys.subscription,
    queryFn: async () => {
      const sub = await getUserSubscription();
      if (userId) {
        writeCache(sub?.plan ?? 'free', userId);
      }
      return sub;
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const plan: PlanTier = subscription?.plan ?? cachedPlan ?? 'free';
  const limits = useMemo(() => getPlanLimits(plan), [plan]);

  // Only "loading" if we have no cached data AND haven't fetched yet
  const loading = !cachedPlan && (authLoading || (Boolean(userId) && !isFetched && isLoading));

  return { subscription, plan, limits, loading };
}
