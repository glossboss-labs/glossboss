/**
 * Forgot password page — sends a password reset email via Supabase Auth.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  Button,
  Alert,
  Stack,
  Anchor,
  useComputedColorScheme,
} from '@mantine/core';
import { AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { contentVariants } from '@/lib/motion';
import { AnimatedStateSwitch } from '@/components/ui';
import { useTranslation } from '@/lib/app-language';
import { useAuthStore } from '@/stores/auth-store';
import { useAuth } from '@/hooks/use-auth';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { error } = useAuth();
  const resetPassword = useAuthStore((s) => s.resetPasswordForEmail);
  const clearError = useAuthStore((s) => s.clearError);

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const computedColorScheme = useComputedColorScheme('light');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    clearError();
    const ok = await resetPassword(email);
    setSubmitting(false);
    if (ok) setSent(true);
  };

  return (
    <Container size={420} py={80}>
      <motion.div variants={contentVariants} initial="hidden" animate="visible">
        <Stack align="center" gap={8} mb="md">
          <Anchor
            onClick={() => navigate(-1)}
            style={{ display: 'inline-flex', cursor: 'pointer' }}
          >
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
          {t('Reset your password')}
        </Title>
        <Text c="dimmed" size="sm" ta="center" mt={5}>
          {t("Enter your email and we'll send you a reset link.")}
        </Text>

        <Paper withBorder p="xl" mt={30} radius="md">
          <AnimatedStateSwitch stateKey={sent ? 'success' : 'form'}>
            {sent ? (
              <Stack>
                <Alert icon={<CheckCircle size={16} />} color="green" variant="light">
                  {t('Check your email for a password reset link.')}
                </Alert>
                <Anchor component={Link} to="/login" size="sm">
                  <ArrowLeft size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {t('Back to sign in')}
                </Anchor>
              </Stack>
            ) : (
              <form onSubmit={handleSubmit}>
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

                  <Button type="submit" fullWidth loading={submitting}>
                    {t('Send reset link')}
                  </Button>

                  <Anchor component={Link} to="/login" size="sm" ta="center">
                    <ArrowLeft size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {t('Back to sign in')}
                  </Anchor>
                </Stack>
              </form>
            )}
          </AnimatedStateSwitch>
        </Paper>
      </motion.div>
    </Container>
  );
}
