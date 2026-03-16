/**
 * OnboardingGuard — wraps the /onboarding route.
 * Redirects to /login if unauthenticated, or /dashboard if already onboarded.
 */

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { Center, Loader } from '@mantine/core';
import { useAuth } from '@/hooks/use-auth';
import { fetchOnboardingStatus } from '@/lib/onboarding/api';

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [alreadyOnboarded, setAlreadyOnboarded] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    fetchOnboardingStatus()
      .then((status) => {
        if (status?.onboardingCompletedAt) {
          setAlreadyOnboarded(true);
        }
      })
      .catch(() => {
        // If fetch fails, let them through to onboarding anyway
      })
      .finally(() => setChecking(false));
  }, [isAuthenticated, authLoading]);

  if (authLoading || checking) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (alreadyOnboarded) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
