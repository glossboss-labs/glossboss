/**
 * OAuth callback handler — waits for Supabase to complete the code exchange,
 * then navigates back to where the user was before the sign-in flow.
 *
 * For new users (onboarding not yet completed), redirects to /onboarding
 * instead of the saved return path.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Center, Loader, Text, Stack } from '@mantine/core';
import { useTranslation } from '@/lib/app-language';
import { trackEvent } from '@/lib/analytics';
import { getSupabaseClient } from '@/lib/supabase/client';
import { consumeReturnPath, consumePlanParams } from '@/lib/auth/session';
import { fetchOnboardingStatus } from '@/lib/onboarding/api';

function buildOnboardingPath(): string {
  const planParams = consumePlanParams();
  if (planParams) {
    const qs = new URLSearchParams(planParams).toString();
    return `/onboarding?${qs}`;
  }
  return '/onboarding';
}

export default function Callback() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const returnPath = consumeReturnPath();

    async function resolveDestination(): Promise<string> {
      try {
        const status = await fetchOnboardingStatus();
        if (status && !status.onboardingCompletedAt) {
          return buildOnboardingPath();
        }
      } catch {
        // If the profile fetch fails, fall through to the normal return path
      }
      return returnPath;
    }

    function handleAuthenticated() {
      trackEvent('login_succeeded', { method: 'github' });
      void resolveDestination().then((dest) => {
        navigate(dest, { replace: true });
      });
    }

    const client = getSupabaseClient('Auth');

    // Listen for the auth state change that signals the code exchange completed.
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        subscription.unsubscribe();
        navigate('/reset-password', { replace: true });
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        subscription.unsubscribe();
        handleAuthenticated();
      }
    });

    // Fallback: if the session is already present (e.g. the listener fired
    // before we subscribed), navigate immediately.
    client.auth.getSession().then(({ data }) => {
      if (data.session) {
        subscription.unsubscribe();
        handleAuthenticated();
      }
    });

    // Safety timeout — if nothing happens after 15 seconds, send the user back
    // so they aren't stuck on the spinner forever.
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      navigate('/login', { replace: true });
    }, 15_000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <Center h="100vh">
      <Stack align="center" gap="sm">
        <Loader size="lg" />
        <Text c="dimmed">{t('Signing you in...')}</Text>
      </Stack>
    </Center>
  );
}
