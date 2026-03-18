/**
 * SaveToCloudModal — save the current local editor state as a cloud project.
 *
 * Lightweight modal that collects project name and visibility,
 * then creates the project + first language and redirects to /projects/:id.
 */

import { useCallback, useState } from 'react';
import { Modal, Stack, TextInput, Select, Button, Group, Badge, Alert } from '@mantine/core';
import { Cloud, AlertCircle } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { msgid } from '@/lib/app-language';
import { useEditorStore } from '@/stores/editor-store';
import { useCreateProject } from '@/lib/projects/queries';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router';

const VISIBILITY_OPTIONS = [
  { value: 'private', label: msgid('Private') },
  { value: 'public', label: msgid('Public') },
  { value: 'unlisted', label: msgid('Unlisted') },
];

interface SaveToCloudModalProps {
  opened: boolean;
  onClose: () => void;
}

export function SaveToCloudModal({ opened, onClose }: SaveToCloudModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const createProjectMutation = useCreateProject();

  const projectName = useEditorStore((s) => s.projectName);
  const filename = useEditorStore((s) => s.filename);
  const header = useEditorStore((s) => s.header);
  const entries = useEditorStore((s) => s.entries);
  const sourceFormat = useEditorStore((s) => s.sourceFormat);

  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<string>('private');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize name when modal opens
  const handleOpen = useCallback(() => {
    setName(projectName || filename?.replace(/\.(po|pot|json)$/i, '') || t('New project'));
    setVisibility('private');
    setError(null);
  }, [filename, projectName, t]);

  const handleSave = useCallback(async () => {
    if (!user || !entries.length) return;
    setSaving(true);
    setError(null);

    try {
      const locale = header?.language ?? 'unknown';

      const { project } = await createProjectMutation.mutateAsync({
        insert: {
          owner_id: user.id,
          name: name.trim() || projectName || 'Untitled',
          description: '',
          visibility: visibility as 'private' | 'public' | 'unlisted',
          source_language: header?.language ?? null,
          target_language: header?.language ?? null,
          source_format: sourceFormat === 'i18next' ? 'i18next' : 'po',
          source_filename: filename,
          po_header: header as Record<string, string> | null,
          wp_project_type: null,
          wp_slug: null,
          wp_track: null,
        },
        languageInsert: {
          project_id: '', // will be set by mutation
          locale,
          source_filename: filename,
          po_header: header as Record<string, string> | null,
          wp_locale: null,
          repo_provider: null,
          repo_owner: null,
          repo_name: null,
          repo_branch: null,
          repo_file_path: null,
          repo_default_branch: null,
        },
        entries,
      });

      onClose();
      void navigate(`/projects/${project.id}`);
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : t('Failed to save project');
      setError(message);
      setSaving(false);
    }
  }, [
    createProjectMutation,
    entries,
    filename,
    header,
    name,
    navigate,
    onClose,
    projectName,
    sourceFormat,
    t,
    user,
    visibility,
  ]);

  const targetLanguage = header?.language ?? null;

  return (
    <Modal opened={opened} onClose={onClose} title={t('Save to cloud')} onOpen={handleOpen}>
      <Stack gap="md">
        {error && (
          <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        <TextInput
          label={t('Project name')}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />

        <Select
          label={t('Visibility')}
          data={VISIBILITY_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
          value={visibility}
          onChange={(v) => setVisibility(v ?? 'private')}
        />

        <Group gap="sm">
          {targetLanguage && (
            <Badge variant="light" color="blue">
              {t('Target: {{language}}', { language: targetLanguage })}
            </Badge>
          )}
          <Badge variant="light">{t('{{count}} total entries', { count: entries.length })}</Badge>
          {filename && (
            <Badge variant="light" color="gray">
              {filename}
            </Badge>
          )}
        </Group>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            leftSection={<Cloud size={16} />}
            loading={saving}
            onClick={() => void handleSave()}
            disabled={!name.trim() || !entries.length}
          >
            {t('Save to cloud')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
