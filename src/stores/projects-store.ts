/**
 * Projects Store
 *
 * Zustand store for managing the user's cloud projects list.
 * Fetches from Supabase and exposes loading/error state.
 */

import { create } from 'zustand';
import type { ProjectRow } from '@/lib/projects/types';
import { listProjects, deleteProject as apiDeleteProject } from '@/lib/projects/api';

export interface ProjectsState {
  projects: ProjectRow[];
  loading: boolean;
  error: string | null;
}

export interface ProjectsActions {
  fetchProjects: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectsStore = create<ProjectsState & ProjectsActions>()((set, get) => ({
  projects: [],
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await listProjects();
      set({ projects, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load projects',
        loading: false,
      });
    }
  },

  deleteProject: async (id: string) => {
    try {
      await apiDeleteProject(id);
      set({ projects: get().projects.filter((p) => p.id !== id) });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to delete project',
      });
    }
  },
}));
