import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getUserSubscription } from '@/lib/billing/api';
import { getPlanLimits } from '@/lib/billing/limits';
import type { PlanTier, SubscriptionRow, PlanLimits } from '@/lib/billing/types';

const CACHE_KEY = 'gb-subscription-cache';

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

interface UseSubscriptionResult {
  subscription: SubscriptionRow | null;
  plan: PlanTier;
  limits: PlanLimits;
  loading: boolean;
}

export function useSubscription(): UseSubscriptionResult {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  // Read cached plan synchronously on first render — no flash
  const cached = readCache();
  const cachedPlan = cached && userId && cached.userId === userId ? cached.plan : null;

  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [fetched, setFetched] = useState(false);

  // Track previous userId so we can reset state during render when the user
  // changes, following React's "adjusting state during rendering" pattern.
  // This avoids the lint-unfriendly pattern of calling setState inside an effect.
  const [prevUserId, setPrevUserId] = useState<string | undefined>(undefined);
  if (prevUserId !== userId) {
    setPrevUserId(userId);
    if (!userId) {
      setFetched(false);
      setSubscription(null);
    }
  }

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    getUserSubscription()
      .then((sub) => {
        if (!cancelled) {
          setSubscription(sub);
          setFetched(true);
          const plan = sub?.plan ?? 'free';
          writeCache(plan, userId);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch subscription:', err);
        if (!cancelled) setFetched(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Use fetched plan if available, otherwise cached, otherwise free
  const plan: PlanTier = subscription?.plan ?? cachedPlan ?? 'free';
  const limits = useMemo(() => getPlanLimits(plan), [plan]);

  // Only "loading" if we have no cached data AND haven't fetched yet
  const loading = !cachedPlan && (authLoading || (Boolean(userId) && !fetched));

  return { subscription, plan, limits, loading };
}
