/**
 * Organizations Store
 *
 * Zustand store for managing the user's organizations list.
 * Follows the same pattern as projects-store.ts.
 */

import { create } from 'zustand';
import type { OrganizationRow, OrganizationInsert } from '@/lib/organizations/types';
import {
  listOrganizations,
  createOrganization as apiCreateOrganization,
  deleteOrganization as apiDeleteOrganization,
} from '@/lib/organizations/api';

export interface OrganizationsState {
  organizations: OrganizationRow[];
  loading: boolean;
  error: string | null;
}

export interface OrganizationsActions {
  fetchOrganizations: () => Promise<void>;
  createOrganization: (insert: OrganizationInsert) => Promise<OrganizationRow>;
  deleteOrganization: (id: string) => Promise<void>;
}

export const useOrganizationsStore = create<OrganizationsState & OrganizationsActions>()(
  (set, get) => ({
    organizations: [],
    loading: false,
    error: null,

    fetchOrganizations: async () => {
      set({ loading: true, error: null });
      try {
        const organizations = await listOrganizations();
        set({ organizations, loading: false });
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Failed to load organizations',
          loading: false,
        });
      }
    },

    createOrganization: async (insert: OrganizationInsert) => {
      const org = await apiCreateOrganization(insert);
      const organizations = await listOrganizations();
      set({ organizations });
      return org;
    },

    deleteOrganization: async (id: string) => {
      try {
        await apiDeleteOrganization(id);
        set({ organizations: get().organizations.filter((o) => o.id !== id) });
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Failed to delete organization',
        });
      }
    },
  }),
);
