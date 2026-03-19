/**
 * ProjectInvite — accept a project invite via token URL.
 *
 * /invite/project/:token — validates the invite token and lets
 * authenticated users accept, becoming a member of the project.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Container, Stack, Center, Loader, Alert, Button, Paper, Text, Group } from '@mantine/core';
import { motion } from 'motion/react';
import { AlertCircle, Check, FolderOpen } from 'lucide-react';
import { contentVariants } from '@/lib/motion';
import { AnimatedStateSwitch } from '@/components/ui';
import { useTranslation } from '@/lib/app-language';
import { acceptProjectInvite } from '@/lib/projects/api';
import { useAuth } from '@/hooks/use-auth';
import { useProjectInviteByToken } from '@/lib/projects/queries';

const MotionDiv = motion.div;

export default function ProjectInvite() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const {
    data: invite = null,
    isLoading: inviteLoading,
    error: inviteError,
  } = useProjectInviteByToken(token, isAuthenticated && !authLoading);

  useEffect(() => {
    if (!token || authLoading || isAuthenticated) return;
    if (!isAuthenticated) {
      void navigate(`/login?redirect=/invite/project/${token}`, { replace: true });
    }
  }, [token, authLoading, isAuthenticated, navigate]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setError(null);

    try {
      const pid = await acceptProjectInvite(token);
      setProjectId(pid);
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to accept invite'));
    } finally {
      setAccepting(false);
    }
  };

  const queryErrorMessage = inviteError
    ? ((inviteError as Error).message ?? t('Failed to load invite'))
    : null;
  const resolvedError =
    error ??
    (queryErrorMessage || (invite ? null : t('This invite link is invalid or has expired.')));
  const loading = authLoading || (isAuthenticated && inviteLoading && !invite);
  const stateKey = loading
    ? 'loading'
    : accepted
      ? 'accepted'
      : resolvedError && !invite
        ? 'error'
        : 'invite';

  return (
    <Container size="xs" py={80}>
      <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
        <AnimatedStateSwitch stateKey={stateKey}>
          {loading ? (
            <Center py={80}>
              <Loader size="lg" />
            </Center>
          ) : (
            <>
              {resolvedError && !invite && (
                <Stack align="center" gap="md">
                  <Alert icon={<AlertCircle size={16} />} color="red" variant="light" w="100%">
                    {resolvedError}
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
                      {t('You are now a member of this project.')}
                    </Text>
                    <Button
                      component={Link}
                      to={projectId ? `/projects/${projectId}` : '/dashboard'}
                    >
                      {t('Go to project')}
                    </Button>
                  </Stack>
                </Paper>
              )}

              {invite && !accepted && (
                <Paper withBorder p="xl">
                  <Stack align="center" gap="md">
                    <FolderOpen size={40} color="var(--mantine-color-blue-6)" />
                    <Text size="lg" fw={600}>
                      {t('Project invite')}
                    </Text>
                    <Text size="sm" c="dimmed" ta="center">
                      {t("You've been invited to join a translation project as {{role}}.", {
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
