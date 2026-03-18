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
  createOrganization as apiCreateOrganization,
  deleteOrganization as apiDeleteOrganization,
} from './api';
import type { OrganizationRow, OrganizationInsert, OrgMemberWithProfile } from './types';

// ── Query key factory ────────────────────────────────────────

export const organizationKeys = {
  all: ['organizations'] as const,
  members: (orgId: string) => ['organizations', orgId, 'members'] as const,
};

// ── Query hooks ──────────────────────────────────────────────

export function useOrganizations() {
  return useQuery<OrganizationRow[]>({
    queryKey: organizationKeys.all,
    queryFn: listOrganizations,
  });
}

export function useOrgMembers(orgId: string | undefined) {
  return useQuery<OrgMemberWithProfile[]>({
    queryKey: organizationKeys.members(orgId!),
    queryFn: () => listOrgMembers(orgId!),
    enabled: Boolean(orgId),
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
