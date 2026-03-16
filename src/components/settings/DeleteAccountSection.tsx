/**
 * DeleteAccountSection — GDPR Article 17 account deletion UI.
 * Placed in the Account settings tab.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Stack, Text, Paper, Button, Modal, TextInput, Alert, Group } from '@mantine/core';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { invokeSupabaseFunction, readSupabaseFunctionError } from '@/lib/supabase/client';

export function DeleteAccountSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    if (confirmation !== 'DELETE') return;

    setDeleting(true);
    setError(null);

    try {
      const { error: invokeError, response } = await invokeSupabaseFunction<{
        ok: boolean;
        message?: string;
      }>('account-delete', {
        featureLabel: 'Account deletion',
        method: 'POST',
        body: {},
      });

      if (invokeError || response?.status !== 200) {
        const errorBody = await readSupabaseFunctionError(response);
        setError(
          (errorBody.message as string) ||
            t('Account deletion failed. Please try again or contact support.'),
        );
        setDeleting(false);
        return;
      }

      // Clear all local state
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // Ignore storage errors
      }

      await signOut();
      navigate('/');
    } catch {
      setError(t('Account deletion failed. Please try again or contact support.'));
      setDeleting(false);
    }
  }, [confirmation, signOut, navigate, t]);

  if (!user) return null;

  return (
    <>
      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Text size="sm" fw={500} c="red">
            {t('Delete account')}
          </Text>
          <Text size="xs" c="dimmed">
            {t(
              'Permanently delete your account and all associated data. This includes all projects, translations, organization memberships, and subscription records. This action cannot be undone.',
            )}
          </Text>
          <Group>
            <Button
              color="red"
              variant="light"
              leftSection={<Trash2 size={14} />}
              onClick={() => setModalOpen(true)}
            >
              {t('Delete account')}
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Modal
        opened={modalOpen}
        onClose={() => {
          if (!deleting) {
            setModalOpen(false);
            setConfirmation('');
            setError(null);
          }
        }}
        title={t('Delete your account')}
        centered
      >
        <Stack gap="md">
          <Alert color="red" variant="light" icon={<AlertTriangle size={16} />}>
            <Text size="sm">
              {t(
                'This will permanently delete your account, all projects, translations, and subscription data. This cannot be undone.',
              )}
            </Text>
          </Alert>

          <TextInput
            label={t('Type DELETE to confirm')}
            placeholder="DELETE"
            value={confirmation}
            onChange={(e) => setConfirmation(e.currentTarget.value)}
            disabled={deleting}
          />

          {error && (
            <Alert color="red" variant="light">
              <Text size="sm">{error}</Text>
            </Alert>
          )}

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setModalOpen(false);
                setConfirmation('');
                setError(null);
              }}
              disabled={deleting}
            >
              {t('Cancel')}
            </Button>
            <Button
              color="red"
              onClick={handleDelete}
              loading={deleting}
              disabled={confirmation !== 'DELETE'}
            >
              {t('Delete my account')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
