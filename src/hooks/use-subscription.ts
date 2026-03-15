import { useState, useEffect, useMemo } from 'react';
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
  const { user } = useAuth();
  const userId = user?.id;

  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    getUserSubscription()
      .then((sub) => {
        if (!cancelled) {
          setSubscription(sub);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch subscription:', err);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const plan: PlanTier = subscription?.plan ?? 'free';
  const limits = useMemo(() => getPlanLimits(plan), [plan]);

  return { subscription, plan, limits, loading };
}
