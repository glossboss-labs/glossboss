/**
 * Signup page — email/password + GitHub OAuth.
 */

import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
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
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useAuthStore } from '@/stores/auth-store';
import { useAuth } from '@/hooks/use-auth';
import { savePlanParams } from '@/lib/auth/session';
import { trackEvent } from '@/lib/analytics';
import { GithubIcon } from '@/components/auth/GithubIcon';

export default function Signup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { error } = useAuth();

  // If user came from pricing page with a plan, redirect to checkout after signup
  const selectedPlan = searchParams.get('plan');
  const selectedInterval = searchParams.get('interval') || 'month';

  function getPostSignupRedirect(): string {
    const params = new URLSearchParams();
    if (selectedPlan) params.set('plan', selectedPlan);
    if (selectedInterval) params.set('interval', selectedInterval);
    const qs = params.toString();
    return qs ? `/onboarding?${qs}` : '/onboarding';
  }
  const signUpWithEmail = useAuthStore((s) => s.signUpWithEmail);
  const signInWithGitHub = useAuthStore((s) => s.signInWithGitHub);
  const clearError = useAuthStore((s) => s.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const computedColorScheme = useComputedColorScheme('light');

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    clearError();
    await signUpWithEmail(email, password);
    setSubmitting(false);
    if (!useAuthStore.getState().error) {
      setSuccess(true);
      trackEvent('signup_completed', { method: 'email' });
      // If email confirmation is disabled, navigate directly
      const session = useAuthStore.getState().session;
      if (session) {
        navigate(getPostSignupRedirect());
      }
    }
  };

  const handleGitHubSignup = async () => {
    clearError();
    savePlanParams(selectedPlan, selectedInterval);
    await signInWithGitHub();
  };

  return (
    <Container size={420} py={80}>
      <Stack align="center" gap={8} mb="md">
        <img
          src={
            computedColorScheme === 'dark'
              ? '/glossboss-combined-light.svg'
              : '/glossboss-combined-dark.svg'
          }
          alt="GlossBoss"
          style={{ height: 32 }}
        />
      </Stack>
      <Title ta="center" style={{ fontWeight: 800 }}>
        {t('Create an account')}
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        {t('Already have an account?')}{' '}
        <Anchor component={Link} to="/login" size="sm">
          {t('Sign in')}
        </Anchor>
      </Text>

      <Paper withBorder p="xl" mt={30} radius="md">
        {success ? (
          <Alert icon={<CheckCircle size={16} />} color="green" variant="light">
            {t('Account created. Check your email to confirm, or sign in now.')}
          </Alert>
        ) : (
          <>
            <Button
              fullWidth
              variant="default"
              leftSection={<GithubIcon />}
              onClick={handleGitHubSignup}
            >
              {t('Continue with GitHub')}
            </Button>

            <Divider label={t('or create account with email')} labelPosition="center" my="lg" />

            <form onSubmit={handleEmailSignup}>
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
                  placeholder={t('Choose a password')}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  autoComplete="new-password"
                  description={t('Minimum 8 characters, with uppercase, lowercase, and a digit')}
                />

                <Text size="xs" c="dimmed" ta="center">
                  {t('By creating an account, you agree to our')}{' '}
                  <Anchor href="/terms/" target="_blank" size="xs">
                    {t('Terms of Service')}
                  </Anchor>{' '}
                  {t('and')}{' '}
                  <Anchor href="/privacy/" target="_blank" size="xs">
                    {t('Privacy Policy')}
                  </Anchor>
                  .
                </Text>

                <Button type="submit" fullWidth loading={submitting}>
                  {t('Create account')}
                </Button>
              </Stack>
            </form>
          </>
        )}
      </Paper>

      <Text size="xs" c="dimmed" ta="center" mt="xl">
        <Anchor href="/terms/" target="_blank" size="xs" c="dimmed">
          {t('Terms')}
        </Anchor>
        {' · '}
        <Anchor href="/privacy/" target="_blank" size="xs" c="dimmed">
          {t('Privacy')}
        </Anchor>
        {' · '}
        <Anchor href="/license/" target="_blank" size="xs" c="dimmed">
          {t('License')}
        </Anchor>
      </Text>
    </Container>
  );
}
