/**
 * Account Section — user profile info, password change, connected OAuth
 * providers, and cloud settings sync toggle.
 */

import { useState, useCallback } from 'react';
import {
  Stack,
  Text,
  Alert,
  Badge,
  Paper,
  Group,
  Switch,
  Button,
  PasswordInput,
  Avatar,
  Loader,
  Divider,
} from '@mantine/core';
import { Check, AlertCircle, Cloud, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { useCloudSettingsSync } from '@/hooks/use-cloud-settings-sync';
import { useTranslation } from '@/lib/app-language';

export function AccountSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const updatePassword = useAuthStore((s) => s.updatePassword);

  const {
    syncEnabled,
    setSyncEnabled,
    syncStatus,
    lastSynced,
    credentialSyncEnabled,
    setCredentialSyncEnabled,
    syncNow,
  } = useCloudSettingsSync();

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordResult, setPasswordResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const displayName = user?.user_metadata?.full_name || user?.email || '';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const initials = displayName
    .split(/\s+/)
    .map((part: string) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isGitHubProvider = user?.app_metadata?.provider === 'github';

  const handlePasswordChange = useCallback(async () => {
    if (!newPassword.trim()) {
      setPasswordResult({ success: false, message: t('Please enter a new password.') });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordResult({
        success: false,
        message: t('Password must be at least 6 characters.'),
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordResult({ success: false, message: t('Passwords do not match.') });
      return;
    }

    setPasswordChanging(true);
    setPasswordResult(null);

    const success = await updatePassword(newPassword);

    if (success) {
      setPasswordResult({ success: true, message: t('Password updated successfully.') });
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordResult({
        success: false,
        message: t('Failed to update password. Please try again.'),
      });
    }

    setPasswordChanging(false);
  }, [newPassword, confirmPassword, updatePassword, t]);

  const handleSyncToggle = useCallback(
    async (enabled: boolean) => {
      await setSyncEnabled(enabled);
    },
    [setSyncEnabled],
  );

  const handleCredentialSyncToggle = useCallback(
    async (enabled: boolean) => {
      await setCredentialSyncEnabled(enabled);
    },
    [setCredentialSyncEnabled],
  );

  const handleSyncNow = useCallback(async () => {
    await syncNow();
  }, [syncNow]);

  if (!user) {
    return (
      <Stack gap="md">
        <Alert color="blue" icon={<AlertCircle size={16} />}>
          <Text size="sm">
            {t('Sign in to manage your account settings and enable cloud sync.')}
          </Text>
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {/* Profile section */}
      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Text size="sm" fw={500}>
            {t('Profile')}
          </Text>

          <Group gap="md">
            <Avatar src={avatarUrl} size="lg" radius="xl" color="blue">
              {initials}
            </Avatar>
            <Stack gap={2}>
              {displayName && displayName !== user.email && (
                <Text size="sm" fw={500}>
                  {displayName}
                </Text>
              )}
              <Text size="sm" c="dimmed">
                {user.email}
              </Text>
            </Stack>
          </Group>
        </Stack>
      </Paper>

      {/* Password section */}
      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Text size="sm" fw={500}>
            {t('Change password')}
          </Text>
          <Text size="xs" c="dimmed">
            {t('Update your account password. No current password is required while signed in.')}
          </Text>

          <PasswordInput
            label={t('New password')}
            placeholder={t('Enter new password')}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.currentTarget.value);
              setPasswordResult(null);
            }}
          />

          <PasswordInput
            label={t('Confirm new password')}
            placeholder={t('Confirm new password')}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.currentTarget.value);
              setPasswordResult(null);
            }}
          />

          <Group>
            <Button
              onClick={handlePasswordChange}
              loading={passwordChanging}
              disabled={!newPassword.trim() || !confirmPassword.trim()}
            >
              {t('Update password')}
            </Button>
          </Group>

          {passwordResult && (
            <Alert
              color={passwordResult.success ? 'green' : 'red'}
              icon={passwordResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
            >
              <Text size="sm">{passwordResult.message}</Text>
            </Alert>
          )}
        </Stack>
      </Paper>

      {/* Connected accounts */}
      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Text size="sm" fw={500}>
            {t('Connected accounts')}
          </Text>

          {isGitHubProvider ? (
            <Group gap="xs">
              <Badge
                variant="light"
                color="gray"
                leftSection={
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                }
              >
                GitHub
              </Badge>
              <Text size="xs" c="dimmed">
                {t('Signed in with GitHub')}
              </Text>
            </Group>
          ) : (
            <Text size="sm" c="dimmed">
              {t('No external accounts connected. Signed in with email and password.')}
            </Text>
          )}
        </Stack>
      </Paper>

      {/* Cloud sync section */}
      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Group gap="xs">
            <Cloud size={16} />
            <Text size="sm" fw={500}>
              {t('Cloud sync')}
            </Text>
          </Group>

          <Text size="xs" c="dimmed">
            {t(
              'Sync your GlossBoss settings across browsers. When enabled, changes are automatically saved to the cloud and restored on sign-in.',
            )}
          </Text>

          <Switch
            label={t('Sync settings to cloud')}
            description={t('When disabled, all settings are stored locally in this browser only.')}
            checked={syncEnabled}
            onChange={(e) => void handleSyncToggle(e.currentTarget.checked)}
            styles={{
              track: {
                transition: 'background-color 0.2s ease, border-color 0.2s ease',
              },
              thumb: {
                transition: 'transform 0.2s ease, left 0.2s ease',
              },
            }}
          />

          {syncEnabled && (
            <>
              <Divider />

              <Group gap="xs" align="center">
                {syncStatus === 'syncing' ? (
                  <>
                    <Loader size={14} />
                    <Text size="xs" c="dimmed">
                      {t('Syncing...')}
                    </Text>
                  </>
                ) : syncStatus === 'error' ? (
                  <>
                    <AlertCircle size={14} color="var(--mantine-color-red-6)" />
                    <Text size="xs" c="red">
                      {t('Sync error')}
                    </Text>
                  </>
                ) : (
                  <>
                    <Check size={14} color="var(--mantine-color-green-6)" />
                    <Text size="xs" c="green">
                      {t('Synced')}
                    </Text>
                  </>
                )}

                {lastSynced && (
                  <Text size="xs" c="dimmed">
                    {t('Last synced: {{time}}', {
                      time: new Date(lastSynced).toLocaleString(),
                    })}
                  </Text>
                )}
              </Group>

              <Button
                variant="light"
                size="xs"
                leftSection={<RefreshCw size={14} />}
                onClick={handleSyncNow}
                loading={syncStatus === 'syncing'}
              >
                {t('Sync now')}
              </Button>

              <Divider />

              <Alert color="yellow" variant="light" icon={<ShieldAlert size={16} />}>
                <Text size="xs">
                  {t(
                    'API credentials are sensitive. Only enable credential sync if you trust all devices where you sign in to GlossBoss.',
                  )}
                </Text>
              </Alert>

              <Switch
                label={t('Include API credentials in sync')}
                description={t(
                  'When enabled, your translation and TTS API keys are included in cloud sync. When disabled, credentials stay local to each browser.',
                )}
                checked={credentialSyncEnabled}
                onChange={(e) => void handleCredentialSyncToggle(e.currentTarget.checked)}
                styles={{
                  track: {
                    transition: 'background-color 0.2s ease, border-color 0.2s ease',
                  },
                  thumb: {
                    transition: 'transform 0.2s ease, left 0.2s ease',
                  },
                }}
              />
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
