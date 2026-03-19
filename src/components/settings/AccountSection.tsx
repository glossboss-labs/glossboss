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
  TextInput,
  Avatar,
  Loader,
  Divider,
  Modal,
  Menu,
} from '@mantine/core';
import {
  Check,
  AlertCircle,
  Cloud,
  RefreshCw,
  ShieldAlert,
  Pencil,
  X,
  Upload,
  Download,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { getSizedAvatarUrl } from '@/lib/utils/avatar';
import { useAuthStore } from '@/stores/auth-store';
import { useCloudSettingsSync } from '@/hooks/use-cloud-settings-sync';
import { useTranslation } from '@/lib/app-language';
import { getSupabaseClient } from '@/lib/supabase/client';

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
    pushToCloud,
    pullFromCloud,
    pendingCloudSettings,
    resolveConflict,
    dismissPending,
  } = useCloudSettingsSync();

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordResult, setPasswordResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileResult, setProfileResult] = useState<{
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
  const githubUsername = (user?.user_metadata?.user_name ||
    user?.user_metadata?.preferred_username) as string | undefined;

  const startEditing = () => {
    setEditName(user?.user_metadata?.full_name || '');
    setEditEmail(user?.email || '');
    setProfileResult(null);
    setEditingProfile(true);
  };

  const cancelEditing = () => {
    setEditingProfile(false);
    setProfileResult(null);
  };

  const handleProfileSave = useCallback(async () => {
    setProfileSaving(true);
    setProfileResult(null);

    try {
      const client = getSupabaseClient('Auth');
      const updates: { email?: string; data?: { full_name: string } } = {};

      const currentName = user?.user_metadata?.full_name || '';
      const currentEmail = user?.email || '';

      if (editName !== currentName) {
        updates.data = { full_name: editName };
      }

      if (editEmail !== currentEmail) {
        updates.email = editEmail;
      }

      if (!updates.data && !updates.email) {
        setProfileResult({ success: true, message: t('No changes to save.') });
        setProfileSaving(false);
        return;
      }

      const { error } = await client.auth.updateUser(updates);

      if (error) {
        setProfileResult({ success: false, message: error.message });
      } else {
        const message =
          updates.email && editEmail !== currentEmail
            ? t('Profile updated. Check your new email for a confirmation link.')
            : t('Profile updated.');
        setProfileResult({ success: true, message });
        setEditingProfile(false);
      }
    } catch {
      setProfileResult({ success: false, message: t('Failed to update profile.') });
    }

    setProfileSaving(false);
  }, [editName, editEmail, user, t]);

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

  const handlePush = useCallback(async () => {
    await pushToCloud();
  }, [pushToCloud]);

  const handlePull = useCallback(async () => {
    await pullFromCloud();
  }, [pullFromCloud]);

  const handleResolveConflict = useCallback(
    async (choice: 'cloud' | 'local') => {
      await resolveConflict(choice);
    },
    [resolveConflict],
  );

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
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              {t('Profile')}
            </Text>
            {!editingProfile && (
              <Button
                variant="subtle"
                size="xs"
                leftSection={<Pencil size={14} />}
                onClick={startEditing}
              >
                {t('Edit')}
              </Button>
            )}
          </Group>

          {editingProfile ? (
            <>
              <Group gap="md" align="flex-start">
                <Avatar src={getSizedAvatarUrl(avatarUrl, 56)} size="lg" radius="xl" color="blue">
                  {initials}
                </Avatar>
                <Stack gap="xs" style={{ flex: 1 }}>
                  <TextInput
                    label={t('Display name')}
                    value={editName}
                    onChange={(e) => setEditName(e.currentTarget.value)}
                    placeholder={t('Your name')}
                  />
                  <TextInput
                    label={t('Email')}
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.currentTarget.value)}
                    type="email"
                    description={
                      isGitHubProvider
                        ? t('Changing your email requires confirmation via both addresses.')
                        : undefined
                    }
                  />
                </Stack>
              </Group>
              <Group gap="xs">
                <Button size="xs" onClick={handleProfileSave} loading={profileSaving}>
                  {t('Save')}
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  leftSection={<X size={14} />}
                  onClick={cancelEditing}
                >
                  {t('Cancel')}
                </Button>
              </Group>
            </>
          ) : (
            <Group gap="md">
              <Avatar src={getSizedAvatarUrl(avatarUrl, 56)} size="lg" radius="xl" color="blue">
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
          )}

          {profileResult && (
            <Alert
              color={profileResult.success ? 'green' : 'red'}
              icon={profileResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
            >
              <Text size="sm">{profileResult.message}</Text>
            </Alert>
          )}
        </Stack>
      </Paper>

      {/* Password section */}
      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Text size="sm" fw={500}>
            {t('Change password')}
          </Text>
          <Text size="xs" c="dimmed">
            {t('Set a new password for this account.')}
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
            <Group justify="space-between">
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
                  {t('GitHub')}
                </Badge>
                <Text size="xs" c="dimmed">
                  {githubUsername ? (
                    <>
                      {t('Connected as')}{' '}
                      <Text
                        component="a"
                        href={`https://github.com/${githubUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="xs"
                        fw={500}
                        td="underline"
                        inherit
                      >
                        @{githubUsername}
                      </Text>
                    </>
                  ) : (
                    t('Signed in with GitHub')
                  )}
                </Text>
              </Group>
              <Button
                variant="subtle"
                size="xs"
                onClick={() => {
                  void getSupabaseClient('Auth').auth.signInWithOAuth({
                    provider: 'github',
                    options: { redirectTo: `${window.location.origin}/auth/callback` },
                  });
                }}
              >
                {t('Reconnect')}
              </Button>
            </Group>
          ) : (
            <>
              <Text size="sm" c="dimmed">
                {t('You are currently using email and password only.')}
              </Text>
              <Button
                variant="light"
                size="xs"
                leftSection={
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                }
                onClick={() => {
                  void getSupabaseClient('Auth').auth.linkIdentity({
                    provider: 'github',
                    options: { redirectTo: `${window.location.origin}/auth/callback` },
                  });
                }}
              >
                {t('Connect GitHub')}
              </Button>
            </>
          )}
        </Stack>
      </Paper>

      {/* Cloud sync conflict dialog */}
      <Modal
        opened={pendingCloudSettings !== null}
        onClose={dismissPending}
        title={t('Cloud settings found')}
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            {t(
              'Your cloud account has existing settings from another device. Would you like to use those settings, or save your current local settings to the cloud?',
            )}
          </Text>
          {pendingCloudSettings?.updatedAt && (
            <Text size="xs" c="dimmed">
              {t('Cloud settings last updated: {{time}}', {
                time: new Date(pendingCloudSettings.updatedAt).toLocaleString(),
              })}
            </Text>
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => void handleResolveConflict('local')}>
              {t('Use my local settings')}
            </Button>
            <Button onClick={() => void handleResolveConflict('cloud')}>
              {t('Use cloud settings')}
            </Button>
          </Group>
        </Stack>
      </Modal>

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
            {t('Keep your settings in sync across browsers when you sign in.')}
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

              <Group gap="xs">
                <Menu shadow="md" width={200} position="bottom-start">
                  <Menu.Target>
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<RefreshCw size={14} />}
                      rightSection={<ChevronDown size={12} />}
                      loading={syncStatus === 'syncing'}
                    >
                      {t('Sync')}
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<Upload size={14} />} onClick={() => void handlePush()}>
                      {t('Push to cloud')}
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<Download size={14} />}
                      onClick={() => void handlePull()}
                    >
                      {t('Pull from cloud')}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>

              <Divider />

              <Alert color="yellow" variant="light" icon={<ShieldAlert size={16} />}>
                <Text size="xs">
                  {t('API credentials are sensitive. Only sync them to devices you trust.')}
                </Text>
              </Alert>

              <Switch
                label={t('Include API credentials in sync')}
                description={t(
                  'When enabled, saved translation and TTS keys sync with your account. Otherwise they stay local to this browser.',
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
