/**
 * Login page — email/password + GitHub OAuth.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Divider,
  Alert,
  Stack,
  Anchor,
  useComputedColorScheme,
} from '@mantine/core';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { trackEvent } from '@/lib/analytics';
import { useAuthStore } from '@/stores/auth-store';
import { useAuth } from '@/hooks/use-auth';
import { GithubIcon } from '@/components/auth/GithubIcon';
import { useAuthCaptcha } from '@/hooks/use-auth-captcha';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { error } = useAuth();
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const signInWithGitHub = useAuthStore((s) => s.signInWithGitHub);
  const clearError = useAuthStore((s) => s.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const computedColorScheme = useComputedColorScheme('light');
  const { containerRef, getCaptchaToken, ready: captchaReady } = useAuthCaptcha();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    clearError();
    try {
      const captchaToken = await getCaptchaToken();
      await signInWithEmail(email, password, captchaToken);
    } catch {
      // Captcha failure — error is already shown via auth store
    }
    setSubmitting(false);
    // Auth state change listener will update session; navigate after
    if (!useAuthStore.getState().error) {
      trackEvent('login_succeeded', { method: 'email' });
      navigate('/dashboard');
    }
  };

  const handleGitHubLogin = async () => {
    clearError();
    await signInWithGitHub();
    // OAuth redirects away — no navigation needed
  };

  return (
    <Container size={420} py={80}>
      <Stack align="center" gap={8} mb="md">
        <Anchor onClick={() => navigate(-1)} style={{ display: 'inline-flex', cursor: 'pointer' }}>
          <img
            src={
              computedColorScheme === 'dark'
                ? '/glossboss-combined-light.svg'
                : '/glossboss-combined-dark.svg'
            }
            alt="GlossBoss"
            style={{ height: 32 }}
          />
        </Anchor>
      </Stack>
      <Title ta="center" style={{ fontWeight: 800 }}>
        {t('Sign in to GlossBoss')}
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        {t("Don't have an account?")}{' '}
        <Anchor component={Link} to="/signup" size="sm">
          {t('Create one')}
        </Anchor>
      </Text>

      <Paper withBorder p="xl" mt={30} radius="md">
        <Button
          fullWidth
          variant="default"
          leftSection={<GithubIcon />}
          onClick={handleGitHubLogin}
        >
          {t('Continue with GitHub')}
        </Button>

        <Divider label={t('or sign in with email')} labelPosition="center" my="lg" />

        <form onSubmit={handleEmailLogin}>
          <Stack>
            {error && (
              <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
                {error.message}
              </Alert>
            )}

            <TextInput
              label={t('Email')}
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              type="email"
              autoComplete="email"
            />

            <PasswordInput
              label={t('Password')}
              placeholder={t('Your password')}
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              autoComplete="current-password"
            />

            <Anchor component={Link} to="/forgot-password" size="sm" ta="right">
              {t('Forgot password?')}
            </Anchor>

            <div ref={containerRef} />

            <Button type="submit" fullWidth loading={submitting} disabled={!captchaReady}>
              {t('Sign in')}
            </Button>

            <Anchor component={Link} to="/editor" size="sm" ta="center">
              {t('Continue without account')}
            </Anchor>
          </Stack>
        </form>
      </Paper>

      <Text size="xs" c="dimmed" ta="center" mt="xl">
        <Anchor href="/terms" target="_blank" size="xs" c="dimmed">
          {t('Terms')}
        </Anchor>
        {' · '}
        <Anchor href="/privacy" target="_blank" size="xs" c="dimmed">
          {t('Privacy')}
        </Anchor>
        {' · '}
        <Anchor href="/license" target="_blank" size="xs" c="dimmed">
          {t('License')}
        </Anchor>
      </Text>
    </Container>
  );
}
