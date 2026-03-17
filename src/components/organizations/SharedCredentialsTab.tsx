/**
 * SharedCredentialsTab — manage shared API keys at org or project scope.
 *
 * Admins can add, edit, and remove credentials that team members
 * can use for translation without needing personal API keys.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Stack,
  Paper,
  Group,
  Text,
  TextInput,
  PasswordInput,
  Select,
  Button,
  Alert,
  Badge,
  ActionIcon,
  Collapse,
} from '@mantine/core';
import { Plus, Trash2, AlertCircle, Edit2, Key } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import {
  listSharedCredentials,
  createSharedCredential,
  updateSharedCredential,
  deleteSharedCredential,
} from '@/lib/shared-credentials/api';
import type { SharedCredentialRow, SharedCredentialProvider } from '@/lib/shared-credentials/types';
import { getTranslationProviderLabel } from '@/lib/translation';

const PROVIDER_OPTIONS: { value: SharedCredentialProvider; label: string }[] = [
  { value: 'deepl', label: 'DeepL' },
  { value: 'azure', label: 'Azure Translator' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'elevenlabs', label: 'ElevenLabs (TTS)' },
];

function maskKey(key: string): string {
  if (!key || key.length <= 4) return key ? '****' : '';
  return '****' + key.slice(-4);
}

interface SharedCredentialsTabProps {
  /** Org ID (for org-scoped credentials). Mutually exclusive with projectId. */
  orgId?: string;
  /** Project ID (for project-scoped credentials). Mutually exclusive with orgId. */
  projectId?: string;
  /** Whether the current user can manage credentials. */
  canManage: boolean;
}

export function SharedCredentialsTab({ orgId, projectId, canManage }: SharedCredentialsTabProps) {
  const { t } = useTranslation();
  const [credentials, setCredentials] = useState<SharedCredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addProvider, setAddProvider] = useState<SharedCredentialProvider>('deepl');
  const [addLabel, setAddLabel] = useState('');
  const [addApiKey, setAddApiKey] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editApiKey, setEditApiKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSharedCredentials({ orgId, projectId })
      .then((creds) => {
        if (!cancelled) {
          setCredentials(creds);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('Failed to load credentials.'));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, projectId, t]);

  const handleAdd = useCallback(async () => {
    if (!addLabel.trim() || !addApiKey.trim()) return;
    setAddSaving(true);
    setError(null);
    try {
      const cred = await createSharedCredential({
        organization_id: orgId ?? null,
        project_id: projectId ?? null,
        provider: addProvider,
        label: addLabel.trim(),
        config: { apiKey: addApiKey.trim() },
      });
      setCredentials((prev) => [...prev, cred]);
      setAddLabel('');
      setAddApiKey('');
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to add credential.'));
    } finally {
      setAddSaving(false);
    }
  }, [orgId, projectId, addProvider, addLabel, addApiKey, t]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteSharedCredential(id);
        setCredentials((prev) => prev.filter((c) => c.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : t('Failed to delete credential.'));
      }
    },
    [t],
  );

  const startEdit = useCallback((cred: SharedCredentialRow) => {
    setEditingId(cred.id);
    setEditLabel(cred.label);
    setEditApiKey('');
  }, []);

  const handleSaveEdit = useCallback(
    async (id: string) => {
      if (!editLabel.trim()) return;
      try {
        const config: Record<string, unknown> = {};
        if (editApiKey.trim()) config.apiKey = editApiKey.trim();
        const updated = await updateSharedCredential(id, {
          label: editLabel.trim(),
          ...(Object.keys(config).length > 0 ? { config } : {}),
        });
        setCredentials((prev) => prev.map((c) => (c.id === id ? updated : c)));
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('Failed to update credential.'));
      }
    },
    [editLabel, editApiKey, t],
  );

  const scopeLabel = orgId ? t('organization') : t('project');

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {t(
          'Share API keys with {{scope}} members so they can translate without needing personal keys.',
          { scope: scopeLabel },
        )}
      </Text>

      {error && (
        <Alert
          color="red"
          variant="light"
          icon={<AlertCircle size={14} />}
          withCloseButton
          onClose={() => setError(null)}
        >
          <Text size="xs">{error}</Text>
        </Alert>
      )}

      {loading ? (
        <Text size="sm" c="dimmed">
          {t('Loading...')}
        </Text>
      ) : credentials.length === 0 && !showAddForm ? (
        <Paper withBorder p="md">
          <Stack gap="sm" align="center">
            <Key size={24} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed" ta="center">
              {t('No shared credentials yet.')}
            </Text>
            {canManage && (
              <Button
                size="xs"
                variant="light"
                leftSection={<Plus size={14} />}
                onClick={() => setShowAddForm(true)}
              >
                {t('Add shared credential')}
              </Button>
            )}
          </Stack>
        </Paper>
      ) : (
        <>
          {credentials.map((cred) => {
            const isEditing = editingId === cred.id;
            const apiKey = (cred.config as { apiKey?: string }).apiKey ?? '';
            return (
              <Paper key={cred.id} withBorder p="md">
                {isEditing ? (
                  <Stack gap="sm">
                    <TextInput
                      size="xs"
                      label={t('Label')}
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.currentTarget.value)}
                    />
                    <PasswordInput
                      size="xs"
                      label={t('API key (leave empty to keep current)')}
                      value={editApiKey}
                      onChange={(e) => setEditApiKey(e.currentTarget.value)}
                      placeholder={maskKey(apiKey)}
                    />
                    <Group gap="xs">
                      <Button size="xs" onClick={() => void handleSaveEdit(cred.id)}>
                        {t('Save')}
                      </Button>
                      <Button size="xs" variant="subtle" onClick={() => setEditingId(null)}>
                        {t('Cancel')}
                      </Button>
                    </Group>
                  </Stack>
                ) : (
                  <Group justify="space-between" align="center">
                    <Group gap="sm">
                      <Badge variant="light" size="sm">
                        {cred.provider === 'elevenlabs'
                          ? 'ElevenLabs'
                          : getTranslationProviderLabel(
                              cred.provider as 'deepl' | 'azure' | 'gemini',
                            )}
                      </Badge>
                      <div>
                        <Text size="sm" fw={500}>
                          {cred.label}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {maskKey(apiKey)}
                        </Text>
                      </div>
                    </Group>
                    {canManage && (
                      <Group gap="xs">
                        <ActionIcon variant="subtle" size="sm" onClick={() => startEdit(cred)}>
                          <Edit2 size={14} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          color="red"
                          onClick={() => void handleDelete(cred.id)}
                        >
                          <Trash2 size={14} />
                        </ActionIcon>
                      </Group>
                    )}
                  </Group>
                )}
              </Paper>
            );
          })}

          {canManage && !showAddForm && (
            <Button
              size="xs"
              variant="light"
              leftSection={<Plus size={14} />}
              onClick={() => setShowAddForm(true)}
            >
              {t('Add shared credential')}
            </Button>
          )}
        </>
      )}

      {/* Add form */}
      <Collapse in={showAddForm}>
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Text size="sm" fw={500}>
              {t('Add shared credential')}
            </Text>
            <Select
              size="xs"
              label={t('Provider')}
              data={PROVIDER_OPTIONS}
              value={addProvider}
              onChange={(v) => v && setAddProvider(v as SharedCredentialProvider)}
            />
            <TextInput
              size="xs"
              label={t('Label')}
              placeholder={t('e.g. Company DeepL Pro')}
              value={addLabel}
              onChange={(e) => setAddLabel(e.currentTarget.value)}
            />
            <PasswordInput
              size="xs"
              label={t('API key')}
              placeholder={t('Enter the API key')}
              value={addApiKey}
              onChange={(e) => setAddApiKey(e.currentTarget.value)}
            />
            <Group gap="xs">
              <Button
                size="xs"
                onClick={() => void handleAdd()}
                loading={addSaving}
                disabled={!addLabel.trim() || !addApiKey.trim()}
              >
                {t('Add')}
              </Button>
              <Button
                size="xs"
                variant="subtle"
                onClick={() => {
                  setShowAddForm(false);
                  setAddLabel('');
                  setAddApiKey('');
                }}
              >
                {t('Cancel')}
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Collapse>
    </Stack>
  );
}
