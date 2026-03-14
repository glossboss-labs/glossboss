/**
 * Projects Store
 *
 * Zustand store for managing the user's cloud projects list.
 * Fetches from Supabase and exposes loading/error state.
 */

import { create } from 'zustand';
import type { ProjectRow, ProjectInsert } from '@/lib/projects/types';
import {
  listProjects,
  createProject as apiCreateProject,
  deleteProject as apiDeleteProject,
  syncProjectEntries,
} from '@/lib/projects/api';
import type { POEntry } from '@/lib/po/types';

export interface ProjectsState {
  projects: ProjectRow[];
  loading: boolean;
  error: string | null;
}

export interface ProjectsActions {
  fetchProjects: () => Promise<void>;
  createProject: (insert: ProjectInsert, entries: POEntry[]) => Promise<ProjectRow>;
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

  createProject: async (insert: ProjectInsert, entries: POEntry[]) => {
    const project = await apiCreateProject(insert);

    // Sync entries to the new project
    await syncProjectEntries(project.id, entries, new Map(), new Map());

    // Re-fetch to get stats updated by triggers
    const projects = await listProjects();
    set({ projects });

    return project;
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
