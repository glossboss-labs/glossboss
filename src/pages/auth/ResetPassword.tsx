/**
 * Reset password page — lets the user set a new password after clicking
 * the password reset link from their email. The Supabase auth callback
 * establishes a session with PASSWORD_RECOVERY event before landing here.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Anchor,
  Container,
  Paper,
  Title,
  Text,
  PasswordInput,
  Button,
  Alert,
  Stack,
  useComputedColorScheme,
} from '@mantine/core';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useAuthStore } from '@/stores/auth-store';
import { useAuth } from '@/hooks/use-auth';

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { error } = useAuth();
  const updatePw = useAuthStore((s) => s.updatePassword);
  const clearError = useAuthStore((s) => s.clearError);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);
  const computedColorScheme = useComputedColorScheme('light');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    setSubmitting(true);
    clearError();
    const ok = await updatePw(password);
    setSubmitting(false);
    if (ok) {
      setDone(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
    }
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
        {t('Set new password')}
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        {t('Choose a new password for your account.')}
      </Text>

      <Paper withBorder p="xl" mt={30} radius="md">
        {done ? (
          <Alert icon={<CheckCircle size={16} />} color="green" variant="light">
            {t('Password updated. Redirecting...')}
          </Alert>
        ) : (
          <form onSubmit={handleSubmit}>
            <Stack>
              {error && (
                <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
                  {error.message}
                </Alert>
              )}

              {mismatch && (
                <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
                  {t('Passwords do not match.')}
                </Alert>
              )}

              <PasswordInput
                label={t('New password')}
                placeholder={t('Choose a password')}
                required
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                autoComplete="new-password"
                description={t('Minimum 8 characters, with uppercase, lowercase, and a digit')}
              />

              <PasswordInput
                label={t('Confirm password')}
                placeholder={t('Repeat your password')}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.currentTarget.value)}
                autoComplete="new-password"
              />

              <Button type="submit" fullWidth loading={submitting}>
                {t('Update password')}
              </Button>
            </Stack>
          </form>
        )}
      </Paper>
    </Container>
  );
}
