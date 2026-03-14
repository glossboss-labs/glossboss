/**
 * Projects Store
 *
 * Zustand store for managing the user's cloud projects list.
 * Fetches from Supabase and exposes loading/error state.
 */

import { create } from 'zustand';
import type {
  ProjectRow,
  ProjectInsert,
  ProjectLanguageInsert,
  ProjectWithLanguages,
} from '@/lib/projects/types';
import {
  listProjects,
  createProject as apiCreateProject,
  deleteProject as apiDeleteProject,
  createProjectLanguage as apiCreateProjectLanguage,
  deleteProjectLanguage as apiDeleteProjectLanguage,
  cloneLanguageEntries as apiCloneLanguageEntries,
  syncProjectEntries,
} from '@/lib/projects/api';
import type { POEntry } from '@/lib/po/types';

export interface ProjectsState {
  projects: ProjectWithLanguages[];
  loading: boolean;
  error: string | null;
}

export interface ProjectsActions {
  fetchProjects: () => Promise<void>;
  createProject: (
    insert: ProjectInsert,
    languageInsert: ProjectLanguageInsert,
    entries: POEntry[],
  ) => Promise<{ project: ProjectRow; languageId: string }>;
  deleteProject: (id: string) => Promise<void>;
  addLanguage: (
    projectId: string,
    languageInsert: ProjectLanguageInsert,
    sourceLanguageId?: string,
  ) => Promise<string>;
  deleteLanguage: (languageId: string) => Promise<void>;
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

  createProject: async (
    insert: ProjectInsert,
    languageInsert: ProjectLanguageInsert,
    entries: POEntry[],
  ) => {
    // Create project
    const project = await apiCreateProject(insert);

    // Create first language
    const language = await apiCreateProjectLanguage({
      ...languageInsert,
      project_id: project.id,
    });

    // Sync entries to the new language
    await syncProjectEntries(language.id, project.id, entries, new Map(), new Map());

    // Re-fetch to get stats updated by triggers
    const projects = await listProjects();
    set({ projects });

    return { project, languageId: language.id };
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

  addLanguage: async (
    projectId: string,
    languageInsert: ProjectLanguageInsert,
    sourceLanguageId?: string,
  ) => {
    const language = await apiCreateProjectLanguage({
      ...languageInsert,
      project_id: projectId,
    });

    if (sourceLanguageId) {
      await apiCloneLanguageEntries(sourceLanguageId, language.id);
    }

    // Re-fetch to get updated stats
    const projects = await listProjects();
    set({ projects });

    return language.id;
  },

  deleteLanguage: async (languageId: string) => {
    await apiDeleteProjectLanguage(languageId);

    // Re-fetch to get updated stats
    const projects = await listProjects();
    set({ projects });
  },
}));
