/**
 * OrgSettings — organization management page.
 *
 * Shows org info, member list, pending invites, and actions
 * for admins/owners to manage the organization.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import {
  Container,
  Stack,
  Group,
  Title,
  Text,
  Button,
  Center,
  Loader,
  Alert,
  Paper,
  Badge,
  ActionIcon,
  Menu,
  TextInput,
  Select,
  Tabs,
  Avatar,
  Tooltip,
  CopyButton,
  Textarea,
} from '@mantine/core';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  AlertCircle,
  UserPlus,
  MoreVertical,
  Trash2,
  Users,
  Mail,
  Shield,
  Copy,
  Check,
  Settings,
  LogOut,
  FolderOpen,
} from 'lucide-react';
import { sectionVariants, contentVariants, fadeVariants, buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import {
  getOrganizationBySlug,
  listOrgMembers,
  updateOrgMemberRole,
  removeOrgMember,
  updateOrganization,
  deleteOrganization,
  listInvites,
  createInvite,
  revokeInvite,
} from '@/lib/organizations/api';
import type {
  OrganizationRow,
  OrgMemberWithProfile,
  OrgRole,
  InviteRow,
} from '@/lib/organizations/types';
import { useAuth } from '@/hooks/use-auth';
import { AppHeader } from '@/components/AppHeader';
import { ConfirmModal, RoleBadge } from '@/components/ui';
import { listOrgProjects } from '@/lib/projects/api';
import type { ProjectWithLanguages } from '@/lib/projects/types';

const MotionDiv = motion.div;

const ROLE_OPTIONS: { value: OrgRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
];

export default function OrgSettings() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [org, setOrg] = useState<OrganizationRow | null>(null);
  const [members, setMembers] = useState<OrgMemberWithProfile[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [orgProjects, setOrgProjects] = useState<ProjectWithLanguages[]>([]);

  // Edit org state
  const [editOrgName, setEditOrgName] = useState('');
  const [editOrgDescription, setEditOrgDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviting, setInviting] = useState(false);

  // Delete/leave confirm
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const myMembership = useMemo(
    () => (user ? members.find((m) => m.user_id === user.id) : undefined),
    [user, members],
  );

  const isAdmin = useMemo(
    () => myMembership?.role === 'owner' || myMembership?.role === 'admin',
    [myMembership],
  );

  const isOwner = useMemo(() => myMembership?.role === 'owner', [myMembership]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function load() {
      try {
        const organization = await getOrganizationBySlug(slug!);
        if (cancelled) return;
        if (!organization) {
          setError(t('Organization not found'));
          setLoading(false);
          return;
        }
        setOrg(organization);
        setEditOrgName(organization.name);
        setEditOrgDescription(organization.description);

        const [memberList, inviteList, projectList] = await Promise.all([
          listOrgMembers(organization.id),
          listInvites(organization.id).catch(() => [] as InviteRow[]),
          listOrgProjects(organization.id).catch(() => [] as ProjectWithLanguages[]),
        ]);
        if (cancelled) return;
        setMembers(memberList);
        setInvites(inviteList);
        setOrgProjects(projectList);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t('Failed to load organization'));
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, t]);

  const handleUpdateRole = useCallback(
    async (memberId: string, role: OrgRole) => {
      try {
        await updateOrgMemberRole(memberId, role);
        setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)));
      } catch (err) {
        setError(err instanceof Error ? err.message : t('Failed to update role'));
      }
    },
    [t],
  );

  const handleRemoveMember = useCallback(
    async (memberId: string) => {
      try {
        await removeOrgMember(memberId);
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
      } catch (err) {
        setError(err instanceof Error ? err.message : t('Failed to remove member'));
      }
    },
    [t],
  );

  const handleInvite = useCallback(async () => {
    if (!org || !inviteEmail.trim()) return;
    setInviting(true);
    setError(null);

    try {
      const invite = await createInvite({
        organization_id: org.id,
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInvites((prev) => [invite, ...prev]);
      setInviteEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to send invite'));
    } finally {
      setInviting(false);
    }
  }, [org, inviteEmail, inviteRole, t]);

  const handleSaveOrg = useCallback(async () => {
    if (!org || !editOrgName.trim()) return;
    setSaving(true);
    try {
      const updated = await updateOrganization(org.id, {
        name: editOrgName.trim(),
        description: editOrgDescription.trim(),
      });
      setOrg(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to update organization'));
    } finally {
      setSaving(false);
    }
  }, [org, editOrgName, editOrgDescription, t]);

  const handleDeleteOrg = useCallback(async () => {
    if (!org) return;
    setActionLoading(true);
    try {
      await deleteOrganization(org.id);
      setConfirmDeleteOpen(false);
      void navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to delete organization'));
      setActionLoading(false);
    }
  }, [org, navigate, t]);

  const handleLeaveOrg = useCallback(async () => {
    if (!myMembership) return;
    setActionLoading(true);
    try {
      await removeOrgMember(myMembership.id);
      setConfirmLeaveOpen(false);
      void navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to leave organization'));
      setActionLoading(false);
    }
  }, [myMembership, navigate, t]);

  const handleRevokeInvite = useCallback(
    async (inviteId: string) => {
      try {
        await revokeInvite(inviteId);
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      } catch (err) {
        setError(err instanceof Error ? err.message : t('Failed to revoke invite'));
      }
    },
    [t],
  );

  if (loading) {
    return (
      <MotionDiv variants={fadeVariants} initial="hidden" animate="visible">
        <Center py={80}>
          <Loader size="lg" />
        </Center>
      </MotionDiv>
    );
  }

  if (error && !org) {
    return (
      <Container size="xl" py="xl">
        <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
          <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
          <Button component={Link} to="/dashboard" variant="light" mt="md">
            {t('Back to dashboard')}
          </Button>
        </MotionDiv>
      </Container>
    );
  }

  if (!org) return null;

  return (
    <Container size="xl" py="xl">
      <AppHeader />
      <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
        <Stack gap="lg">
          {/* Breadcrumb */}
          <Text
            component={Link}
            to="/dashboard"
            size="sm"
            style={{
              color: 'var(--gb-text-secondary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ArrowLeft size={14} />
            {t('Dashboard')}
          </Text>

          {/* Title */}
          <div>
            <Title order={3}>{org.name}</Title>
            <Text size="sm" style={{ color: 'var(--gb-text-secondary)' }}>
              {org.slug}
              {org.description && ` — ${org.description}`}
            </Text>
          </div>

          {error && (
            <Alert
              icon={<AlertCircle size={16} />}
              color="red"
              variant="light"
              withCloseButton
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          <Tabs defaultValue="members">
            <Tabs.List>
              <Tabs.Tab value="members" leftSection={<Users size={14} />}>
                {t('Members')} ({members.length})
              </Tabs.Tab>
              <Tabs.Tab value="projects" leftSection={<FolderOpen size={14} />}>
                {t('Projects')} ({orgProjects.length})
              </Tabs.Tab>
              {isAdmin && (
                <Tabs.Tab value="invites" leftSection={<Mail size={14} />}>
                  {t('Invites')} ({invites.length})
                </Tabs.Tab>
              )}
              <Tabs.Tab value="settings" leftSection={<Settings size={14} />}>
                {t('Settings')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Members tab */}
            <Tabs.Panel value="members" pt="md">
              <Stack gap="sm">
                {members.map((member) => {
                  const canModify =
                    isAdmin && member.role !== 'owner' && member.user_id !== user?.id;
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
                                {member.role !== 'admin' && (
                                  <Menu.Item
                                    leftSection={<Shield size={14} />}
                                    onClick={() => void handleUpdateRole(member.id, 'admin')}
                                  >
                                    {t('Make admin')}
                                  </Menu.Item>
                                )}
                                {member.role !== 'member' && (
                                  <Menu.Item
                                    leftSection={<Users size={14} />}
                                    onClick={() => void handleUpdateRole(member.id, 'member')}
                                  >
                                    {t('Make member')}
                                  </Menu.Item>
                                )}
                                <Menu.Divider />
                                <Menu.Item
                                  color="red"
                                  leftSection={<Trash2 size={14} />}
                                  onClick={() => void handleRemoveMember(member.id)}
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
              </Stack>
            </Tabs.Panel>

            {/* Projects tab */}
            <Tabs.Panel value="projects" pt="md">
              {orgProjects.length === 0 ? (
                <Center py={40}>
                  <Text size="sm" style={{ color: 'var(--gb-text-secondary)' }}>
                    {t('No projects in this organization yet')}
                  </Text>
                </Center>
              ) : (
                <Stack gap="sm">
                  {orgProjects.map((proj) => (
                    <Paper
                      key={proj.id}
                      component={Link}
                      to={`/projects/${proj.id}`}
                      withBorder
                      p="sm"
                      style={{
                        textDecoration: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        transition: 'border-color 120ms ease, background-color 120ms ease',
                      }}
                      styles={{
                        root: {
                          '&:hover': {
                            borderColor: 'var(--mantine-color-blue-5)',
                            backgroundColor: 'var(--gb-highlight-row)',
                          },
                        },
                      }}
                    >
                      <Group justify="space-between" align="center">
                        <div>
                          <Text size="sm" fw={600}>
                            {proj.name}
                          </Text>
                          <Text size="xs" style={{ color: 'var(--gb-text-secondary)' }}>
                            {proj.project_languages?.length ?? 0} {t('languages')}
                            {' · '}
                            {proj.stats_total} {t('strings')}
                          </Text>
                        </div>
                        <Badge variant="light" size="xs">
                          {proj.visibility}
                        </Badge>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Tabs.Panel>

            {/* Invites tab */}
            {isAdmin && (
              <Tabs.Panel value="invites" pt="md">
                <Stack gap="md">
                  {/* Invite form */}
                  <Paper withBorder p="md">
                    <Text size="sm" fw={500} mb="sm">
                      {t('Invite a team member')}
                    </Text>
                    <Group gap="sm" align="end">
                      <TextInput
                        placeholder={t('Email address')}
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.currentTarget.value)}
                        style={{ flex: 1 }}
                        type="email"
                      />
                      <Select
                        data={ROLE_OPTIONS}
                        value={inviteRole}
                        onChange={(v) => setInviteRole((v as 'admin' | 'member') || 'member')}
                        w={120}
                        allowDeselect={false}
                      />
                      <motion.div {...buttonStates}>
                        <Button
                          leftSection={<UserPlus size={16} />}
                          onClick={handleInvite}
                          loading={inviting}
                          disabled={!inviteEmail.trim()}
                        >
                          {t('Invite')}
                        </Button>
                      </motion.div>
                    </Group>
                  </Paper>

                  {/* Pending invites list */}
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
                        const inviteUrl = `${window.location.origin}/invite/${invite.token}`;

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
                                  onClick={() => void handleRevokeInvite(invite.id)}
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
              </Tabs.Panel>
            )}
            {/* Settings tab */}
            <Tabs.Panel value="settings" pt="md">
              <Stack gap="lg">
                {/* Edit org details */}
                {isAdmin && (
                  <Paper withBorder p="md">
                    <Text size="sm" fw={500} mb="sm">
                      {t('Organization details')}
                    </Text>
                    <Stack gap="sm">
                      <TextInput
                        label={t('Name')}
                        value={editOrgName}
                        onChange={(e) => setEditOrgName(e.currentTarget.value)}
                        maw={400}
                      />
                      <Textarea
                        label={t('Description')}
                        value={editOrgDescription}
                        onChange={(e) => setEditOrgDescription(e.currentTarget.value)}
                        autosize
                        minRows={2}
                        maxRows={4}
                        maw={400}
                      />
                      <div>
                        <motion.div {...buttonStates}>
                          <Button
                            onClick={() => void handleSaveOrg()}
                            loading={saving}
                            disabled={!editOrgName.trim()}
                          >
                            {t('Save changes')}
                          </Button>
                        </motion.div>
                      </div>
                    </Stack>
                  </Paper>
                )}

                {/* Danger zone */}
                <Paper withBorder p="md" style={{ borderColor: 'var(--mantine-color-red-4)' }}>
                  <Text size="sm" fw={500} mb="sm" c="red">
                    {t('Danger zone')}
                  </Text>
                  <Stack gap="sm">
                    {isOwner ? (
                      <Group justify="space-between" align="center">
                        <div>
                          <Text size="sm">{t('Delete this organization')}</Text>
                          <Text size="xs" style={{ color: 'var(--gb-text-secondary)' }}>
                            {t(
                              'Permanently delete this organization and all its data. This cannot be undone.',
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
                            {t('Delete organization')}
                          </Button>
                        </motion.div>
                      </Group>
                    ) : (
                      <Group justify="space-between" align="center">
                        <div>
                          <Text size="sm">{t('Leave this organization')}</Text>
                          <Text size="xs" style={{ color: 'var(--gb-text-secondary)' }}>
                            {t('Remove yourself from this organization.')}
                          </Text>
                        </div>
                        <motion.div {...buttonStates}>
                          <Button
                            color="red"
                            variant="outline"
                            leftSection={<LogOut size={14} />}
                            onClick={() => setConfirmLeaveOpen(true)}
                          >
                            {t('Leave organization')}
                          </Button>
                        </motion.div>
                      </Group>
                    )}
                  </Stack>
                </Paper>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </MotionDiv>

      <ConfirmModal
        opened={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => void handleDeleteOrg()}
        title={t('Delete organization')}
        message={t(
          'Are you sure you want to delete "{{name}}"? All members, invites, and associated data will be permanently removed.',
          { name: org.name },
        )}
        confirmLabel={t('Delete organization')}
        variant="danger"
        loading={actionLoading}
      />

      <ConfirmModal
        opened={confirmLeaveOpen}
        onClose={() => setConfirmLeaveOpen(false)}
        onConfirm={() => void handleLeaveOrg()}
        title={t('Leave organization')}
        message={t('Are you sure you want to leave "{{name}}"?', { name: org.name })}
        confirmLabel={t('Leave organization')}
        variant="warning"
        loading={actionLoading}
      />
    </Container>
  );
}
