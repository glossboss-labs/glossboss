import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getUserSubscription } from '@/lib/billing/api';
import { getPlanLimits } from '@/lib/billing/limits';
import type { PlanTier, SubscriptionRow, PlanLimits } from '@/lib/billing/types';

interface UseSubscriptionResult {
  subscription: SubscriptionRow | null;
  plan: PlanTier;
  limits: PlanLimits;
  loading: boolean;
}

export function useSubscription(): UseSubscriptionResult {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [fetched, setFetched] = useState(false);
  const prevUserId = useRef<string | undefined>(undefined);

  // Reset fetched state when userId changes (synchronous, no effect needed)
  if (prevUserId.current !== userId) {
    prevUserId.current = userId;
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

  // Loading while auth is loading OR we have a user but haven't fetched yet
  const loading = authLoading || (Boolean(userId) && !fetched);

  const plan: PlanTier = subscription?.plan ?? 'free';
  const limits = useMemo(() => getPlanLimits(plan), [plan]);

  return { subscription, plan, limits, loading };
}
