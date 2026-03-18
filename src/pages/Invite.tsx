/**
 * Invite — accept an organization invite via token URL.
 *
 * /invite/:token — validates the invite token and lets authenticated
 * users accept, becoming a member of the organization.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Container, Stack, Center, Loader, Alert, Button, Paper, Text, Group } from '@mantine/core';
import { motion } from 'motion/react';
import { AlertCircle, Check, Users } from 'lucide-react';
import { contentVariants } from '@/lib/motion';
import { AnimatedStateSwitch } from '@/components/ui';
import { useTranslation } from '@/lib/app-language';
import { acceptInvite, getInviteByToken } from '@/lib/organizations/api';
import type { InviteRow } from '@/lib/organizations/types';
import { useAuth } from '@/hooks/use-auth';

const MotionDiv = motion.div;

export default function Invite() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteRow | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token || authLoading) return;

    if (!isAuthenticated) {
      void navigate(`/login?redirect=/invite/${token}`, { replace: true });
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const inv = await getInviteByToken(token!);
        if (cancelled) return;
        if (!inv) {
          setError(t('This invite link is invalid or has expired.'));
        } else {
          setInvite(inv);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t('Failed to load invite'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, isAuthenticated, authLoading, navigate, t]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setError(null);

    try {
      await acceptInvite(token);
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to accept invite'));
    } finally {
      setAccepting(false);
    }
  };

  const stateKey =
    authLoading || loading
      ? 'loading'
      : accepted
        ? 'accepted'
        : error && !invite
          ? 'error'
          : 'invite';

  return (
    <Container size="xs" py={80}>
      <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
        <AnimatedStateSwitch stateKey={stateKey}>
          {authLoading || loading ? (
            <Center py={80}>
              <Loader size="lg" />
            </Center>
          ) : (
            <>
              {error && !invite && (
                <Stack align="center" gap="md">
                  <Alert icon={<AlertCircle size={16} />} color="red" variant="light" w="100%">
                    {error}
                  </Alert>
                  <Button component={Link} to="/dashboard" variant="light">
                    {t('Back to dashboard')}
                  </Button>
                </Stack>
              )}

              {accepted && (
                <Paper withBorder p="xl">
                  <Stack align="center" gap="md">
                    <Check size={40} color="var(--mantine-color-teal-6)" />
                    <Text size="lg" fw={600}>
                      {t('Invite accepted')}
                    </Text>
                    <Text size="sm" c="dimmed" ta="center">
                      {t('You are now a member of this organization.')}
                    </Text>
                    <Button component={Link} to="/dashboard">
                      {t('Go to dashboard')}
                    </Button>
                  </Stack>
                </Paper>
              )}

              {invite && !accepted && (
                <Paper withBorder p="xl">
                  <Stack align="center" gap="md">
                    <Users size={40} color="var(--mantine-color-blue-6)" />
                    <Text size="lg" fw={600}>
                      {t('Organization invite')}
                    </Text>
                    <Text size="sm" c="dimmed" ta="center">
                      {t("You've been invited to join an organization as {{role}}.", {
                        role: invite.role,
                      })}
                    </Text>

                    {error && (
                      <Alert icon={<AlertCircle size={16} />} color="red" variant="light" w="100%">
                        {error}
                      </Alert>
                    )}

                    <Group>
                      <Button variant="light" component={Link} to="/dashboard">
                        {t('Decline')}
                      </Button>
                      <Button onClick={handleAccept} loading={accepting}>
                        {t('Accept invite')}
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              )}
            </>
          )}
        </AnimatedStateSwitch>
      </MotionDiv>
    </Container>
  );
}
