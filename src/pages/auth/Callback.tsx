/**
 * OAuth callback handler — processes the auth code exchange after
 * an OAuth redirect (e.g. GitHub) and navigates back to where
 * the user was before the sign-in flow.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Center, Loader, Text, Stack } from '@mantine/core';
import { useTranslation } from '@/lib/app-language';
import { consumeReturnPath } from '@/lib/auth/session';

export default function Callback() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase client automatically handles the code exchange via the
    // URL hash (#access_token=...) or query (?code=...). The auth state
    // change listener in the auth store picks up the new session.
    // We just need to wait briefly and redirect back to the original page.
    const returnPath = consumeReturnPath();
    const timer = setTimeout(() => navigate(returnPath, { replace: true }), 1000);
    return () => clearTimeout(timer);
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
