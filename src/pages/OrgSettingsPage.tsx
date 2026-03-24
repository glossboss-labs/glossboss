/**
 * OrgSettingsPage — dedicated settings page for an organization.
 *
 * Route: /orgs/:slug/settings
 * Tabs: General, Members, Projects, Danger Zone
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router';
import {
  Box,
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
  Textarea,
  Tooltip,
  CopyButton,
  Tabs,
  Avatar,
  Divider,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  AlertCircle,
  Settings,
  Users,
  FolderOpen,
  Trash2,
  LogOut,
  UserPlus,
  Shield,
  MoreVertical,
  Copy,
  Check,
  ExternalLink,
  Key,
} from 'lucide-react';
import {
  staggerPageVariants,
  contentVariants,
  fadeVariants,
  staggerContainerVariants,
  buttonStates,
} from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import {
  updateOrgMemberRole,
  removeOrgMember,
  updateOrganization,
  deleteOrganization,
  transferOrganizationOwnership,
  createInvite,
  revokeInvite,
} from '@/lib/organizations/api';
import type {
  OrganizationRow,
  OrgMemberWithProfile,
  OrgRole,
  InviteRow,
} from '@/lib/organizations/types';
import type { ProjectWithLanguages } from '@/lib/projects/types';
import { useAuth } from '@/hooks/use-auth';
import { AnimatedStateSwitch, AnimatedTabPanel, ConfirmModal, RoleBadge } from '@/components/ui';
import { OrgTranslationTab } from '@/components/organizations/OrgTranslationTab';
import { SharedCredentialsTab } from '@/components/organizations/SharedCredentialsTab';
import { useOrganizationBySlug, useOrgSettingsPage } from '@/lib/organizations/queries';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';

const MotionDiv = motion.div;

const ROLE_OPTIONS: { value: OrgRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
];

export default function OrgSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'general';
  const {
    data: baseOrg = null,
    isLoading: orgLoading,
    error: orgError,
  } = useOrganizationBySlug(slug);
  const { data: settingsData, isLoading: pageLoading, error: pageError } = useOrgSettingsPage(slug);
  const [error, setError] = useState<string | null>(null);
  const [org, setOrg] = useState<OrganizationRow | null>(null);
  const [members, setMembers] = useState<OrgMemberWithProfile[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [orgProjects, setOrgProjects] = useState<ProjectWithLanguages[]>([]);

  // Edit state
  const [editOrgName, setEditOrgName] = useState('');
  const [editOrgDescription, setEditOrgDescription] = useState('');
  const [editOrgWebsite, setEditOrgWebsite] = useState('');
  const [saving, setSaving] = useState(false);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviting, setInviting] = useState(false);

  // Confirm state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [confirmTransferOpen, setConfirmTransferOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<OrgMemberWithProfile | null>(null);

  const myMembership = useMemo(
    () => (user ? members.find((m) => m.user_id === user.id) : undefined),
    [user, members],
  );
  const isAdmin = myMembership?.role === 'owner' || myMembership?.role === 'admin';
  const isOwner = myMembership?.role === 'owner' || org?.owner_id === user?.id;
  const canLeaveOrganization = !isOwner && members.length > 1;

  useEffect(() => {
    if (!baseOrg) return;
    setOrg(baseOrg);
    setEditOrgName(baseOrg.name);
    setEditOrgDescription(baseOrg.description);
    setEditOrgWebsite(baseOrg.website ?? '');
  }, [baseOrg]);

  useEffect(() => {
    if (!settingsData) return;

    setMembers(settingsData.members);
    setInvites(settingsData.invites);
    setOrgProjects(settingsData.orgProjects);

    if (settingsData.organization) {
      setOrg(settingsData.organization);
      setEditOrgName(settingsData.organization.name);
      setEditOrgDescription(settingsData.organization.description);
      setEditOrgWebsite(settingsData.organization.website ?? '');
    }
  }, [settingsData]);

  const handleTabChange = (tab: string | null) => {
    if (tab) setSearchParams({ tab }, { replace: true });
  };

  const handleSaveOrg = useCallback(async () => {
    if (!org || !editOrgName.trim()) return;
    setSaving(true);
    try {
      const updated = await updateOrganization(org.id, {
        name: editOrgName.trim(),
        description: editOrgDescription.trim(),
        website: editOrgWebsite.trim(),
      });
      setOrg(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to update organization'));
    } finally {
      setSaving(false);
    }
  }, [org, editOrgName, editOrgDescription, editOrgWebsite, t]);

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

  const queryErrorMessage =
    orgError || pageError
      ? (((orgError ?? pageError) as Error).message ?? t('Failed to load organization'))
      : null;
  const loading = (orgLoading || pageLoading) && !org;

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

  const handleTransferOwnership = useCallback(async () => {
    if (!org || !transferTarget) return;
    setActionLoading(true);
    try {
      await transferOrganizationOwnership(org.id, transferTarget.user_id);
      setMembers((prev) =>
        prev.map((member) => {
          if (member.user_id === transferTarget.user_id) {
            return { ...member, role: 'owner' };
          }
          if (member.user_id === user?.id && member.role === 'owner') {
            return { ...member, role: 'admin' };
          }
          return member;
        }),
      );
      setOrg((prev) => (prev ? { ...prev, owner_id: transferTarget.user_id } : prev));
      setConfirmTransferOpen(false);
      setTransferTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to transfer ownership'));
    } finally {
      setActionLoading(false);
    }
  }, [org, t, transferTarget, user?.id]);

  const handleLeaveOrg = useCallback(async () => {
    if (!myMembership) return;

    if (!canLeaveOrganization) {
      setConfirmLeaveOpen(false);
      if (isOwner) {
        setConfirmDeleteOpen(true);
      }
      return;
    }

    setActionLoading(true);
    try {
      await removeOrgMember(myMembership.id);
      setConfirmLeaveOpen(false);
      void navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to leave organization'));
      setActionLoading(false);
    }
  }, [canLeaveOrganization, isOwner, myMembership, navigate, t]);

  const stateKey = loading ? 'loading' : (error ?? queryErrorMessage) && !org ? 'error' : 'data';

  return (
    <Box maw={960}>
      <AnimatedStateSwitch stateKey={stateKey}>
        {loading && (
          <Center py={80}>
            <Loader size="lg" />
          </Center>
        )}

        {(error ?? queryErrorMessage) && !org && (
          <>
            <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
              {error ?? queryErrorMessage}
            </Alert>
            <Button component={Link} to="/dashboard" variant="light" mt="md">
              {t('Back to dashboard')}
            </Button>
          </>
        )}

        {!loading && org && (
          <>
            <MotionDiv variants={staggerPageVariants} initial="hidden" animate="visible">
              <Stack gap="lg">
                {/* Breadcrumb */}
                <MotionDiv variants={fadeVariants}>
                  <Text
                    component={Link}
                    to={`/orgs/${org.slug}`}
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
                    {org.name}
                  </Text>
                </MotionDiv>

                {/* Title */}
                <MotionDiv variants={fadeVariants}>
                  <Group gap="sm" align="center">
                    <Settings size={20} c="dimmed" />
                    <Title order={3}>{t('Organization settings')}</Title>
                  </Group>
                </MotionDiv>

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

                {/* Tabs */}
                <MotionDiv variants={fadeVariants}>
                  <Box
                    style={
                      isMobile ? undefined : { display: 'flex', gap: 'var(--mantine-spacing-xl)' }
                    }
                  >
                    <Tabs
                      value={activeTab}
                      onChange={handleTabChange}
                      orientation={isMobile ? 'horizontal' : 'vertical'}
                      variant="pills"
                      classNames={{ tab: 'gb-tab-left-align' }}
                      styles={{
                        list: isMobile
                          ? { overflowX: 'auto', flexWrap: 'nowrap' }
                          : { minWidth: 180, flexShrink: 0 },
                      }}
                    >
                      <Tabs.List>
                        <Tabs.Tab value="general" leftSection={<Settings size={14} />}>
                          {t('General')}
                        </Tabs.Tab>
                        <Tabs.Tab value="members" leftSection={<Users size={14} />}>
                          {t('Members')} ({members.length})
                        </Tabs.Tab>
                        <Tabs.Tab value="projects" leftSection={<FolderOpen size={14} />}>
                          {t('Projects')} ({orgProjects.length})
                        </Tabs.Tab>
                        <Tabs.Tab value="translation" leftSection={<Key size={14} />}>
                          {t('Translation')}
                        </Tabs.Tab>
                        <Tabs.Tab value="danger" leftSection={<Trash2 size={14} />} color="red">
                          {t('Danger zone')}
                        </Tabs.Tab>
                      </Tabs.List>
                    </Tabs>

                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <AnimatedTabPanel tabKey={activeTab}>
                        <Box pt={isMobile ? 'md' : undefined}>
                          {/* General tab */}
                          {activeTab === 'general' && (
                            <>
                              <Text size="sm" c="dimmed" mb="md">
                                {t('Basic information about your organization.')}
                              </Text>
                            </>
                          )}
                          {activeTab === 'general' &&
                            (isAdmin ? (
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
                                  <TextInput
                                    label={t('Slug')}
                                    value={org.slug}
                                    disabled
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
                                  <TextInput
                                    label={t('Website')}
                                    placeholder="https://example.com"
                                    value={editOrgWebsite}
                                    onChange={(e) => setEditOrgWebsite(e.currentTarget.value)}
                                    leftSection={<ExternalLink size={14} />}
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
                            ) : (
                              <Paper withBorder p="md">
                                <Stack gap="xs">
                                  <Text size="sm">
                                    <strong>{t('Name')}:</strong> {org.name}
                                  </Text>
                                  <Text size="sm">
                                    <strong>{t('Slug')}:</strong> {org.slug}
                                  </Text>
                                  <Text size="sm">
                                    <strong>{t('Description')}:</strong> {org.description || '—'}
                                  </Text>
                                  <Text size="sm">
                                    <strong>{t('Website')}:</strong>{' '}
                                    {org.website ? (
                                      <Text
                                        component="a"
                                        href={
                                          org.website.startsWith('http')
                                            ? org.website
                                            : `https://${org.website}`
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        size="sm"
                                        style={{
                                          color: 'var(--mantine-color-blue-6)',
                                          textDecoration: 'none',
                                        }}
                                      >
                                        {org.website.replace(/^https?:\/\//, '')}
                                      </Text>
                                    ) : (
                                      '—'
                                    )}
                                  </Text>
                                </Stack>
                              </Paper>
                            ))}

                          {/* Members tab */}
                          {activeTab === 'members' && (
                            <Stack gap="lg">
                              <Text size="sm" c="dimmed">
                                {t(
                                  "Manage your organization's members. Roles: Owner (full control, cannot be removed), Admin (manage members and settings), Member (access organization projects).",
                                )}
                              </Text>
                              {/* Invite form (admin only) */}
                              {isAdmin && (
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
                                      onChange={(v) =>
                                        setInviteRole((v as 'admin' | 'member') || 'member')
                                      }
                                      w={120}
                                      allowDeselect={false}
                                    />
                                    <motion.div {...buttonStates}>
                                      <Button
                                        leftSection={<UserPlus size={16} />}
                                        onClick={() => void handleInvite()}
                                        loading={inviting}
                                        disabled={!inviteEmail.trim()}
                                      >
                                        {t('Invite')}
                                      </Button>
                                    </motion.div>
                                  </Group>
                                </Paper>
                              )}

                              {/* Member list */}
                              <MotionDiv
                                variants={staggerContainerVariants}
                                initial="hidden"
                                animate="visible"
                              >
                                <Stack gap="sm">
                                  {members.map((member) => {
                                    const canModify =
                                      isAdmin &&
                                      member.role !== 'owner' &&
                                      member.user_id !== user?.id;
                                    const canTransferOwnership =
                                      isOwner &&
                                      member.user_id !== user?.id &&
                                      member.role !== 'owner';
                                    return (
                                      <MotionDiv key={member.id} variants={contentVariants}>
                                        <Paper withBorder p="sm">
                                          <Group
                                            justify="space-between"
                                            align="center"
                                            wrap="nowrap"
                                          >
                                            <Group gap="sm">
                                              <Avatar
                                                src={member.profiles.avatar_url}
                                                alt={
                                                  member.profiles.full_name ?? member.profiles.email
                                                }
                                                size="sm"
                                                radius="xl"
                                              >
                                                {(member.profiles.full_name ??
                                                  member.profiles.email)[0]?.toUpperCase()}
                                              </Avatar>
                                              <div>
                                                <Text size="sm" fw={500}>
                                                  {member.profiles.full_name ??
                                                    member.profiles.email}
                                                </Text>
                                                {member.profiles.full_name && (
                                                  <Text size="xs" c="dimmed">
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
                                                    <ActionIcon
                                                      variant="subtle"
                                                      size="sm"
                                                      color="gray"
                                                    >
                                                      <MoreVertical size={14} />
                                                    </ActionIcon>
                                                  </Menu.Target>
                                                  <Menu.Dropdown>
                                                    {canTransferOwnership && (
                                                      <>
                                                        <Menu.Item
                                                          leftSection={<Shield size={14} />}
                                                          onClick={() => {
                                                            setTransferTarget(member);
                                                            setConfirmTransferOpen(true);
                                                          }}
                                                        >
                                                          {t('Transfer ownership')}
                                                        </Menu.Item>
                                                        {canModify && <Menu.Divider />}
                                                      </>
                                                    )}
                                                    {member.role !== 'admin' && (
                                                      <Menu.Item
                                                        leftSection={<Shield size={14} />}
                                                        onClick={() =>
                                                          void handleUpdateRole(member.id, 'admin')
                                                        }
                                                      >
                                                        {t('Make admin')}
                                                      </Menu.Item>
                                                    )}
                                                    {member.role !== 'member' && (
                                                      <Menu.Item
                                                        leftSection={<Users size={14} />}
                                                        onClick={() =>
                                                          void handleUpdateRole(member.id, 'member')
                                                        }
                                                      >
                                                        {t('Make member')}
                                                      </Menu.Item>
                                                    )}
                                                    <Menu.Divider />
                                                    <Menu.Item
                                                      color="red"
                                                      leftSection={<Trash2 size={14} />}
                                                      onClick={() =>
                                                        void handleRemoveMember(member.id)
                                                      }
                                                    >
                                                      {t('Remove')}
                                                    </Menu.Item>
                                                  </Menu.Dropdown>
                                                </Menu>
                                              )}
                                            </Group>
                                          </Group>
                                        </Paper>
                                      </MotionDiv>
                                    );
                                  })}
                                </Stack>
                              </MotionDiv>

                              {/* Pending invites */}
                              {isAdmin && invites.length > 0 && (
                                <>
                                  <Text size="sm" fw={500} mt="md">
                                    {t('Pending invites')}
                                  </Text>
                                  <MotionDiv
                                    variants={staggerContainerVariants}
                                    initial="hidden"
                                    animate="visible"
                                  >
                                    <Stack gap="sm">
                                      {invites.map((invite) => {
                                        const expired = new Date(invite.expires_at) < new Date();
                                        const inviteUrl = `${window.location.origin}/invite/${invite.token}`;

                                        return (
                                          <MotionDiv key={invite.id} variants={contentVariants}>
                                            <Paper withBorder p="sm">
                                              <Group
                                                justify="space-between"
                                                align="center"
                                                wrap="nowrap"
                                              >
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
                                                  <Text size="xs" c="dimmed">
                                                    {t('Expires {{date}}', {
                                                      date: new Date(
                                                        invite.expires_at,
                                                      ).toLocaleDateString(),
                                                    })}
                                                  </Text>
                                                </div>
                                                <Group gap="xs">
                                                  <CopyButton value={inviteUrl}>
                                                    {({ copied, copy }) => (
                                                      <Tooltip
                                                        label={
                                                          copied
                                                            ? t('Copied')
                                                            : t('Copy invite link')
                                                        }
                                                      >
                                                        <ActionIcon
                                                          variant="subtle"
                                                          size="sm"
                                                          color={copied ? 'teal' : 'gray'}
                                                          onClick={copy}
                                                        >
                                                          {copied ? (
                                                            <Check size={14} />
                                                          ) : (
                                                            <Copy size={14} />
                                                          )}
                                                        </ActionIcon>
                                                      </Tooltip>
                                                    )}
                                                  </CopyButton>
                                                  <ActionIcon
                                                    variant="subtle"
                                                    size="sm"
                                                    color="red"
                                                    onClick={() =>
                                                      void handleRevokeInvite(invite.id)
                                                    }
                                                  >
                                                    <Trash2 size={14} />
                                                  </ActionIcon>
                                                </Group>
                                              </Group>
                                            </Paper>
                                          </MotionDiv>
                                        );
                                      })}
                                    </Stack>
                                  </MotionDiv>
                                </>
                              )}
                            </Stack>
                          )}

                          {/* Projects tab */}
                          {activeTab === 'projects' && (
                            <Stack gap="md">
                              <Group justify="flex-end">
                                <motion.div {...buttonStates}>
                                  <Button
                                    variant="light"
                                    leftSection={<FolderOpen size={14} />}
                                    onClick={() => setCreateModalOpen(true)}
                                  >
                                    {t('Create project')}
                                  </Button>
                                </motion.div>
                              </Group>
                              {orgProjects.length === 0 ? (
                                <Center py={40}>
                                  <Text size="sm" c="dimmed">
                                    {t('No projects in this organization yet')}
                                  </Text>
                                </Center>
                              ) : (
                                <MotionDiv
                                  variants={staggerContainerVariants}
                                  initial="hidden"
                                  animate="visible"
                                >
                                  <Stack gap="sm">
                                    {orgProjects.map((proj) => (
                                      <MotionDiv key={proj.id} variants={contentVariants}>
                                        <Paper
                                          component={Link}
                                          to={`/projects/${proj.id}`}
                                          withBorder
                                          p="sm"
                                          style={{
                                            textDecoration: 'none',
                                            color: 'inherit',
                                            cursor: 'pointer',
                                            transition:
                                              'border-color 120ms ease, background-color 120ms ease',
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
                                              <Text size="xs" c="dimmed">
                                                {proj.project_languages?.length ?? 0}{' '}
                                                {t('languages')}
                                                {' · '}
                                                {proj.stats_total} {t('strings')}
                                              </Text>
                                            </div>
                                            <Badge variant="light" size="xs">
                                              {proj.visibility}
                                            </Badge>
                                          </Group>
                                        </Paper>
                                      </MotionDiv>
                                    ))}
                                  </Stack>
                                </MotionDiv>
                              )}
                            </Stack>
                          )}

                          {/* Translation + Credentials tab */}
                          {activeTab === 'translation' && (
                            <Stack gap="lg">
                              <Text size="sm" c="dimmed">
                                {t(
                                  'Organization-wide translation defaults. These apply to all projects unless overridden at the project level.',
                                )}
                              </Text>
                              <OrgTranslationTab orgId={org.id} isAdmin={isAdmin} />
                              <Divider label={t('Shared credentials')} labelPosition="center" />
                              <SharedCredentialsTab orgId={org.id} canManage={isAdmin} />
                            </Stack>
                          )}

                          {/* Danger zone tab */}
                          {activeTab === 'danger' && (
                            <Stack gap="md">
                              {isOwner && (
                                <Paper
                                  withBorder
                                  p="md"
                                  style={{ borderColor: 'var(--mantine-color-red-4)' }}
                                >
                                  <Group justify="space-between" align="center">
                                    <div>
                                      <Text size="sm" fw={500}>
                                        {t('Delete this organization')}
                                      </Text>
                                      <Text size="xs" c="dimmed">
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
                                </Paper>
                              )}

                              <Paper
                                withBorder
                                p="md"
                                style={{ borderColor: 'var(--mantine-color-orange-4)' }}
                              >
                                <Group justify="space-between" align="center">
                                  <div>
                                    <Text size="sm" fw={500}>
                                      {t('Leave this organization')}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      {t('Remove yourself from this organization.')}
                                    </Text>
                                  </div>
                                  <motion.div {...buttonStates}>
                                    <Button
                                      color="orange"
                                      variant="outline"
                                      leftSection={<LogOut size={14} />}
                                      onClick={() => {
                                        if (canLeaveOrganization) {
                                          setConfirmLeaveOpen(true);
                                          return;
                                        }
                                        setConfirmDeleteOpen(true);
                                      }}
                                    >
                                      {t('Leave organization')}
                                    </Button>
                                  </motion.div>
                                </Group>
                              </Paper>
                            </Stack>
                          )}
                        </Box>
                      </AnimatedTabPanel>
                    </Box>
                  </Box>
                </MotionDiv>
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

            <CreateProjectModal
              opened={createModalOpen}
              onClose={() => setCreateModalOpen(false)}
              initialOrganizationId={org?.id ?? null}
            />

            <ConfirmModal
              opened={confirmTransferOpen}
              onClose={() => {
                setConfirmTransferOpen(false);
                setTransferTarget(null);
              }}
              onConfirm={() => void handleTransferOwnership()}
              title={t('Transfer ownership')}
              message={t(
                'Are you sure you want to transfer ownership of "{{name}}" to {{member}}? You will become an admin.',
                {
                  name: org.name,
                  member:
                    transferTarget?.profiles.full_name ??
                    transferTarget?.profiles.email ??
                    t('this member'),
                },
              )}
              confirmLabel={t('Transfer ownership')}
              variant="warning"
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
          </>
        )}
      </AnimatedStateSwitch>
    </Box>
  );
}
