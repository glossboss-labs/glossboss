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
import { contentVariants, fadeVariants } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { acceptProjectInvite, getProjectInviteByToken } from '@/lib/projects/api';
import type { ProjectInviteRow } from '@/lib/projects/types';
import { useAuth } from '@/hooks/use-auth';

const MotionDiv = motion.div;

export default function ProjectInvite() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<ProjectInviteRow | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!token || authLoading) return;

    if (!isAuthenticated) {
      void navigate(`/login?redirect=/invite/project/${token}`, { replace: true });
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const inv = await getProjectInviteByToken(token!);
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
      const pid = await acceptProjectInvite(token);
      setProjectId(pid);
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to accept invite'));
    } finally {
      setAccepting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <MotionDiv variants={fadeVariants} initial="hidden" animate="visible">
        <Center py={80}>
          <Loader size="lg" />
        </Center>
      </MotionDiv>
    );
  }

  return (
    <Container size="xs" py={80}>
      <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
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
                {t('You are now a member of this project.')}
              </Text>
              <Button component={Link} to={projectId ? `/projects/${projectId}` : '/dashboard'}>
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
      </MotionDiv>
    </Container>
  );
}
