/**
 * OAuth callback handler — waits for Supabase to complete the code exchange,
 * then navigates back to where the user was before the sign-in flow.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Center, Loader, Text, Stack } from '@mantine/core';
import { useTranslation } from '@/lib/app-language';
import { getSupabaseClient } from '@/lib/supabase/client';
import { consumeReturnPath } from '@/lib/auth/session';

export default function Callback() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const returnPath = consumeReturnPath();

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
        navigate(returnPath, { replace: true });
      }
    });

    // Fallback: if the session is already present (e.g. the listener fired
    // before we subscribed), navigate immediately.
    client.auth.getSession().then(({ data }) => {
      if (data.session) {
        subscription.unsubscribe();
        navigate(returnPath, { replace: true });
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
