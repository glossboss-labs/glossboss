/**
 * TanStack Query hooks for organizations.
 *
 * Provides cached, deduplicated data fetching for org listing and members.
 * Mutations invalidate relevant caches automatically.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listOrganizations,
  listOrgMembers,
  getOrganizationBySlug,
  getOrgSettingsPage,
  getInviteByToken,
  createOrganization as apiCreateOrganization,
  deleteOrganization as apiDeleteOrganization,
} from './api';
import { listOrgProjects } from '@/lib/projects/api';
import type { OrganizationRow, OrganizationInsert, OrgMemberWithProfile, InviteRow } from './types';
import type { ProjectWithLanguages } from '@/lib/projects/types';

// ── Query key factory ────────────────────────────────────────

export const organizationKeys = {
  all: ['organizations'] as const,
  members: (orgId: string) => ['organizations', orgId, 'members'] as const,
  detailBySlug: (slug: string) => ['organizations', 'slug', slug] as const,
  settingsPage: (slug: string) => ['organizations', slug, 'settings-page'] as const,
  inviteToken: (token: string) => ['organizations', 'invites', 'token', token] as const,
};

// ── Query hooks ──────────────────────────────────────────────

export function useOrganizations() {
  return useQuery<OrganizationRow[]>({
    queryKey: organizationKeys.all,
    queryFn: listOrganizations,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

export function useOrgMembers(orgId: string | undefined) {
  return useQuery<OrgMemberWithProfile[]>({
    queryKey: organizationKeys.members(orgId!),
    queryFn: () => listOrgMembers(orgId!),
    enabled: Boolean(orgId),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

export function useOrganizationBySlug(slug: string | undefined) {
  return useQuery<OrganizationRow | null>({
    queryKey: slug ? organizationKeys.detailBySlug(slug) : organizationKeys.all,
    queryFn: () => getOrganizationBySlug(slug!),
    enabled: Boolean(slug),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

interface OrgSettingsPageQueryData {
  organization: OrganizationRow | null;
  members: OrgMemberWithProfile[];
  invites: InviteRow[];
  orgProjects: ProjectWithLanguages[];
}

export function useOrgSettingsPage(slug: string | undefined) {
  return useQuery<OrgSettingsPageQueryData>({
    queryKey: slug ? organizationKeys.settingsPage(slug) : organizationKeys.all,
    queryFn: async () => {
      const page = await getOrgSettingsPage(slug!);
      const orgProjects = page.organization
        ? await listOrgProjects(page.organization.id).catch(() => [] as ProjectWithLanguages[])
        : [];

      return {
        ...page,
        orgProjects,
      };
    },
    enabled: Boolean(slug),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

export function useInviteByToken(token: string | undefined, enabled = true) {
  return useQuery<InviteRow | null>({
    queryKey: token ? organizationKeys.inviteToken(token) : organizationKeys.all,
    queryFn: () => getInviteByToken(token!),
    enabled: Boolean(token) && enabled,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation<OrganizationRow, Error, OrganizationInsert>({
    mutationFn: apiCreateOrganization,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: apiDeleteOrganization,
    onSuccess: (_data, id) => {
      queryClient.setQueryData<OrganizationRow[]>(organizationKeys.all, (old) =>
        old ? old.filter((o) => o.id !== id) : [],
      );
    },
  });
}
