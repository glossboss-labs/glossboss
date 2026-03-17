/**
 * ProjectInvitesTab — create and manage project-level invites (admin-only).
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
  ActionIcon,
  Badge,
  Tooltip,
  CopyButton,
  Center,
} from '@mantine/core';
import { motion } from 'motion/react';
import { UserPlus, Trash2, Copy, Check } from 'lucide-react';
import { buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { trackEvent } from '@/lib/analytics';
import { createProjectInvite, revokeProjectInvite } from '@/lib/projects/api';
import type { ProjectRole, ProjectInviteRow } from '@/lib/projects/types';
import { RoleBadge } from '@/components/ui';

const ROLE_OPTIONS: { value: ProjectRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'maintainer', label: 'Maintainer' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'translator', label: 'Translator' },
  { value: 'viewer', label: 'Viewer' },
];

interface ProjectInvitesTabProps {
  projectId: string;
  invites: ProjectInviteRow[];
  onInvitesChange: (invites: ProjectInviteRow[]) => void;
  onError: (msg: string) => void;
}

export function ProjectInvitesTab({
  projectId,
  invites,
  onInvitesChange,
  onError,
}: ProjectInvitesTabProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>('translator');
  const [inviting, setInviting] = useState(false);

  const handleInvite = useCallback(async () => {
    if (!email.trim()) return;
    setInviting(true);

    try {
      const invite = await createProjectInvite({
        project_id: projectId,
        email: email.trim(),
        role,
      });
      trackEvent('invite_sent', { role });
      onInvitesChange([invite, ...invites]);
      setEmail('');
    } catch (err) {
      onError(err instanceof Error ? err.message : t('Failed to send invite'));
    } finally {
      setInviting(false);
    }
  }, [email, role, projectId, invites, onInvitesChange, onError, t]);

  const handleRevoke = useCallback(
    async (inviteId: string) => {
      try {
        await revokeProjectInvite(inviteId);
        onInvitesChange(invites.filter((i) => i.id !== inviteId));
      } catch (err) {
        onError(err instanceof Error ? err.message : t('Failed to revoke invite'));
      }
    },
    [invites, onInvitesChange, onError, t],
  );

  return (
    <Stack gap="md">
      {/* Invite form */}
      <Paper withBorder p="md">
        <Text size="sm" fw={500} mb="sm">
          {t('Invite a collaborator')}
        </Text>
        <Group gap="sm" align="end">
          <TextInput
            placeholder={t('Email address')}
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            style={{ flex: 1 }}
            type="email"
          />
          <Select
            data={ROLE_OPTIONS}
            value={role}
            onChange={(v) => setRole((v as ProjectRole) || 'translator')}
            w={140}
            allowDeselect={false}
          />
          <motion.div {...buttonStates}>
            <Button
              leftSection={<UserPlus size={16} />}
              onClick={() => void handleInvite()}
              loading={inviting}
              disabled={!email.trim()}
            >
              {t('Invite')}
            </Button>
          </motion.div>
        </Group>
      </Paper>

      {/* Pending invites */}
      {invites.length === 0 ? (
        <Center py={40}>
          <Text size="sm" style={{ color: 'var(--gb-text-secondary)' }}>
            {t('No pending invites')}
          </Text>
        </Center>
      ) : (
        <Stack gap="sm">
          {invites.map((invite) => {
            const expired = new Date(invite.expires_at) < new Date();
            const inviteUrl = `${window.location.origin}/invite/project/${invite.token}`;

            return (
              <Paper key={invite.id} withBorder p="sm">
                <Group justify="space-between" align="center" wrap="nowrap">
                  <div>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        {invite.email}
                      </Text>
                      <RoleBadge role={invite.role} />
                      {expired && (
                        <Badge variant="light" size="xs" color="red">
                          {t('Expired')}
                        </Badge>
                      )}
                    </Group>
                    <Text size="xs" style={{ color: 'var(--gb-text-secondary)' }}>
                      {t('Expires {{date}}', {
                        date: new Date(invite.expires_at).toLocaleDateString(),
                      })}
                    </Text>
                  </div>
                  <Group gap="xs">
                    <CopyButton value={inviteUrl}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? t('Copied') : t('Copy invite link')}>
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            color={copied ? 'teal' : 'gray'}
                            onClick={copy}
                          >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      color="red"
                      onClick={() => void handleRevoke(invite.id)}
                    >
                      <Trash2 size={14} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
