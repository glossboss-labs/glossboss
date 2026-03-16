/**
 * AuthPromptModal — prompts unauthenticated users to sign in.
 *
 * Used in place of hard redirects when a user clicks an action
 * that requires authentication (e.g. Share feedback, Settings).
 */

import { Link } from 'react-router';
import { Modal, Stack, Text, Button, Divider, Group } from '@mantine/core';
import { LogIn } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useAuthStore } from '@/stores/auth-store';
import { GithubIcon } from './GithubIcon';

interface AuthPromptModalProps {
  opened: boolean;
  onClose: () => void;
  /** Optional message explaining why sign-in is needed */
  message?: string;
}

export function AuthPromptModal({ opened, onClose, message }: AuthPromptModalProps) {
  const { t } = useTranslation();
  const signInWithGitHub = useAuthStore((s) => s.signInWithGitHub);

  const handleGitHub = async () => {
    await signInWithGitHub();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <LogIn size={18} />
          <Text fw={600}>{t('Sign in to continue')}</Text>
        </Group>
      }
      centered
      size="sm"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {message || t('Sign in to your GlossBoss account to use this feature.')}
        </Text>

        <Button fullWidth variant="default" leftSection={<GithubIcon />} onClick={handleGitHub}>
          {t('Continue with GitHub')}
        </Button>

        <Divider label={t('or')} labelPosition="center" />

        <Button fullWidth component={Link} to="/login" onClick={onClose}>
          {t('Sign in with email')}
        </Button>

        <Text size="xs" c="dimmed" ta="center">
          {t("Don't have an account?")}{' '}
          <Text component={Link} to="/signup" size="xs" c="blue" inherit onClick={onClose}>
            {t('Create one')}
          </Text>
        </Text>
      </Stack>
    </Modal>
  );
}
