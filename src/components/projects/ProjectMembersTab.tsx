/**
 * ProjectMembersTab — member list with add/invite, role management, and leave.
 */

import { useCallback, useState } from 'react';
import {
  Stack,
  Group,
  Paper,
  Text,
  TextInput,
  Select,
  Button,
  Avatar,
  ActionIcon,
  Menu,
  Alert,
  Center,
} from '@mantine/core';
import { motion } from 'motion/react';
import { UserPlus, MoreVertical, Trash2, LogOut, AlertCircle } from 'lucide-react';
import { buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import {
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  findProfileByEmail,
  createProjectInvite,
} from '@/lib/projects/api';
import type { ProjectMemberWithProfile, ProjectRole, ProjectInviteRow } from '@/lib/projects/types';
import { RoleBadge } from '@/components/ui';

const ROLE_OPTIONS: { value: ProjectRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'maintainer', label: 'Maintainer' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'translator', label: 'Translator' },
  { value: 'viewer', label: 'Viewer' },
];

interface ProjectMembersTabProps {
  projectId: string;
  members: ProjectMemberWithProfile[];
  isAdmin: boolean;
  currentUserId: string | undefined;
  onMembersChange: (members: ProjectMemberWithProfile[]) => void;
  onInviteCreated: (invite: ProjectInviteRow) => void;
  onLeave: () => void;
  onError: (msg: string) => void;
}

export function ProjectMembersTab({
  projectId,
  members,
  isAdmin,
  currentUserId,
  onMembersChange,
  onInviteCreated,
  onLeave,
  onError,
}: ProjectMembersTabProps) {
  const { t } = useTranslation();
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<ProjectRole>('translator');
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    if (!addEmail.trim()) return;
    setAdding(true);
    setAddMessage(null);

    try {
      const profile = await findProfileByEmail(addEmail.trim());
      if (profile) {
        await addProjectMember(projectId, profile.id, addRole);
        // Re-fetch would be cleaner, but for now add inline
        onMembersChange([
          ...members,
          {
            id: crypto.randomUUID(),
            project_id: projectId,
            user_id: profile.id,
            role: addRole,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            profiles: {
              email: profile.email,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
            },
          },
        ]);
        setAddEmail('');
      } else {
        const invite = await createProjectInvite({
          project_id: projectId,
          email: addEmail.trim(),
          role: addRole,
        });
        onInviteCreated(invite);
        setAddMessage(t('No account found — invite link created in Invites tab.'));
        setAddEmail('');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : t('Failed to add member'));
    } finally {
      setAdding(false);
    }
  }, [addEmail, addRole, projectId, members, onMembersChange, onInviteCreated, onError, t]);

  const handleUpdateRole = useCallback(
    async (memberId: string, role: ProjectRole) => {
      try {
        await updateProjectMemberRole(memberId, role);
        onMembersChange(members.map((m) => (m.id === memberId ? { ...m, role } : m)));
      } catch (err) {
        onError(err instanceof Error ? err.message : t('Failed to update role'));
      }
    },
    [members, onMembersChange, onError, t],
  );

  const handleRemove = useCallback(
    async (memberId: string) => {
      try {
        await removeProjectMember(memberId);
        onMembersChange(members.filter((m) => m.id !== memberId));
      } catch (err) {
        onError(err instanceof Error ? err.message : t('Failed to remove member'));
      }
    },
    [members, onMembersChange, onError, t],
  );

  return (
    <Stack gap="md">
      {/* Add member form (admin-only) */}
      {isAdmin && (
        <Paper withBorder p="md">
          <Text size="sm" fw={500} mb="sm">
            {t('Add a member')}
          </Text>
          <Group gap="sm" align="end">
            <TextInput
              placeholder={t('Email address')}
              value={addEmail}
              onChange={(e) => {
                setAddEmail(e.currentTarget.value);
                setAddMessage(null);
              }}
              style={{ flex: 1 }}
              type="email"
            />
            <Select
              data={ROLE_OPTIONS}
              value={addRole}
              onChange={(v) => setAddRole((v as ProjectRole) || 'translator')}
              w={140}
              allowDeselect={false}
            />
            <motion.div {...buttonStates}>
              <Button
                leftSection={<UserPlus size={16} />}
                onClick={() => void handleAdd()}
                loading={adding}
                disabled={!addEmail.trim()}
              >
                {t('Add')}
              </Button>
            </motion.div>
          </Group>
          {addMessage && (
            <Alert icon={<AlertCircle size={14} />} color="blue" variant="light" mt="sm">
              {addMessage}
            </Alert>
          )}
        </Paper>
      )}

      {/* Members list */}
      {members.length === 0 && (
        <Center py={40}>
          <Text size="sm" style={{ color: 'var(--gb-text-secondary)' }}>
            {t('No members')}
          </Text>
        </Center>
      )}

      {members.map((member) => {
        const canModify = isAdmin && member.user_id !== currentUserId;
        return (
          <Paper key={member.id} withBorder p="sm">
            <Group justify="space-between" align="center" wrap="nowrap">
              <Group gap="sm">
                <Avatar
                  src={member.profiles.avatar_url}
                  alt={member.profiles.full_name ?? member.profiles.email}
                  size="sm"
                  radius="xl"
                >
                  {(member.profiles.full_name ?? member.profiles.email)[0]?.toUpperCase()}
                </Avatar>
                <div>
                  <Text size="sm" fw={500}>
                    {member.profiles.full_name ?? member.profiles.email}
                  </Text>
                  {member.profiles.full_name && (
                    <Text size="xs" style={{ color: 'var(--gb-text-secondary)' }}>
                      {member.profiles.email}
                    </Text>
                  )}
                </div>
              </Group>
              <Group gap="sm">
                <RoleBadge role={member.role} />
                {canModify && (
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle" size="sm" color="gray">
                        <MoreVertical size={14} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Label>{t('Change role')}</Menu.Label>
                      {ROLE_OPTIONS.filter((r) => r.value !== member.role).map((r) => (
                        <Menu.Item
                          key={r.value}
                          onClick={() => void handleUpdateRole(member.id, r.value)}
                        >
                          {r.label}
                        </Menu.Item>
                      ))}
                      <Menu.Divider />
                      <Menu.Item
                        color="red"
                        leftSection={<Trash2 size={14} />}
                        onClick={() => void handleRemove(member.id)}
                      >
                        {t('Remove')}
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>
            </Group>
          </Paper>
        );
      })}

      {/* Leave project (non-owner) */}
      {currentUserId && members.some((m) => m.user_id === currentUserId) && !isAdmin && (
        <Paper withBorder p="md" style={{ borderColor: 'var(--mantine-color-red-4)' }}>
          <Group justify="space-between" align="center">
            <div>
              <Text size="sm">{t('Leave this project')}</Text>
              <Text size="xs" style={{ color: 'var(--gb-text-secondary)' }}>
                {t('Remove yourself from this project.')}
              </Text>
            </div>
            <motion.div {...buttonStates}>
              <Button
                color="red"
                variant="outline"
                leftSection={<LogOut size={14} />}
                onClick={onLeave}
              >
                {t('Leave project')}
              </Button>
            </motion.div>
          </Group>
        </Paper>
      )}
    </Stack>
  );
}
