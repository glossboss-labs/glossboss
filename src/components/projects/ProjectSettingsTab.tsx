/**
 * ProjectSettingsTab — edit project details (admin/maintainer) and danger zone (admin-only delete).
 */

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { Stack, Paper, Text, TextInput, Textarea, Select, Button, Group } from '@mantine/core';
import { motion } from 'motion/react';
import { Trash2 } from 'lucide-react';
import { buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { updateProject } from '@/lib/projects/api';
import type { ProjectRow } from '@/lib/projects/types';
import { useDeleteProject } from '@/lib/projects/queries';
import { ConfirmModal } from '@/components/ui';

interface ProjectSettingsTabProps {
  project: ProjectRow;
  canManage: boolean;
  isAdmin: boolean;
  onProjectUpdate: (project: ProjectRow) => void;
  onError: (msg: string) => void;
}

export function ProjectSettingsTab({
  project,
  canManage,
  isAdmin,
  onProjectUpdate,
  onError,
}: ProjectSettingsTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const deleteProjectMutation = useDeleteProject();

  const [editName, setEditName] = useState(project.name);
  const [editDescription, setEditDescription] = useState(project.description);
  const [editVisibility, setEditVisibility] = useState(project.visibility);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = useCallback(async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const updated = await updateProject(project.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        visibility: editVisibility as 'private' | 'public' | 'unlisted',
      });
      onProjectUpdate(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : t('Failed to save project'));
    } finally {
      setSaving(false);
    }
  }, [project.id, editName, editDescription, editVisibility, onProjectUpdate, onError, t]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteProjectMutation.mutateAsync(project.id);
      setConfirmDeleteOpen(false);
      void navigate('/dashboard');
    } catch (err) {
      onError(err instanceof Error ? err.message : t('Failed to delete project'));
      setDeleting(false);
    }
  }, [deleteProjectMutation, project.id, navigate, onError, t]);

  return (
    <Stack gap="lg">
      {/* Project details */}
      <Paper withBorder p="md">
        <Text size="sm" fw={500} mb="sm">
          {t('Project details')}
        </Text>
        {canManage ? (
          <Stack gap="sm">
            <TextInput
              label={t('Project name')}
              value={editName}
              onChange={(e) => setEditName(e.currentTarget.value)}
              maw={400}
            />
            <Textarea
              label={t('Description')}
              value={editDescription}
              onChange={(e) => setEditDescription(e.currentTarget.value)}
              autosize
              minRows={2}
              maxRows={4}
              maw={400}
            />
            <Select
              label={t('Visibility')}
              data={[
                { value: 'private', label: t('Private') },
                { value: 'public', label: t('Public') },
                { value: 'unlisted', label: t('Unlisted') },
              ]}
              value={editVisibility}
              onChange={(v) => setEditVisibility(v || 'private')}
              w={200}
              allowDeselect={false}
            />
            <div>
              <motion.div {...buttonStates}>
                <Button
                  onClick={() => void handleSave()}
                  loading={saving}
                  disabled={!editName.trim()}
                >
                  {t('Save changes')}
                </Button>
              </motion.div>
            </div>
          </Stack>
        ) : (
          <Stack gap="xs">
            <Text size="sm">
              <strong>{t('Name')}:</strong> {project.name}
            </Text>
            <Text size="sm">
              <strong>{t('Description')}:</strong> {project.description || '—'}
            </Text>
            <Text size="sm">
              <strong>{t('Visibility')}:</strong> {project.visibility}
            </Text>
            <Text size="sm">
              <strong>{t('Format')}:</strong> {project.source_format}
            </Text>
          </Stack>
        )}
      </Paper>

      {/* Danger zone (admin-only) */}
      {isAdmin && (
        <Paper withBorder p="md" style={{ borderColor: 'var(--mantine-color-red-4)' }}>
          <Text size="sm" fw={500} mb="sm" c="red">
            {t('Danger zone')}
          </Text>
          <Group justify="space-between" align="center">
            <div>
              <Text size="sm">{t('Delete this project')}</Text>
              <Text size="xs" style={{ color: 'var(--gb-text-secondary)' }}>
                {t(
                  'Permanently delete this project, all languages, and all entries. This cannot be undone.',
                )}
              </Text>
            </div>
            <motion.div {...buttonStates}>
              <Button
                color="red"
                variant="outline"
                leftSection={<Trash2 size={14} />}
                onClick={() => setConfirmDeleteOpen(true)}
              >
                {t('Delete project')}
              </Button>
            </motion.div>
          </Group>
        </Paper>
      )}

      <ConfirmModal
        opened={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        title={t('Delete project')}
        message={t(
          'Are you sure you want to delete "{{name}}"? All languages and entries will be permanently removed.',
          { name: project.name },
        )}
        confirmLabel={t('Delete project')}
        variant="danger"
        loading={deleting}
      />
    </Stack>
  );
}
