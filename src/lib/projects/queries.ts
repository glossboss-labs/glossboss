/**
 * TanStack Query hooks for projects.
 *
 * Provides cached, deduplicated data fetching for project listing,
 * detail, and languages. Mutations invalidate relevant caches automatically.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listProjects,
  listPublicProjects,
  getProject,
  getProjectLanguages,
  getProjectEditorPage,
  getProjectSettingsPage,
  getProjectInviteByToken,
  createProject as apiCreateProject,
  deleteProject as apiDeleteProject,
  createProjectLanguage as apiCreateProjectLanguage,
  deleteProjectLanguage as apiDeleteProjectLanguage,
  cloneLanguageEntries as apiCloneLanguageEntries,
  syncProjectEntries,
  listProjectMembers,
  listProjectInvites,
  type ProjectEditorPageData,
  type ProjectSettingsPageData,
} from './api';
import type {
  ProjectInsert,
  ProjectLanguageInsert,
  ProjectWithLanguages,
  ProjectRow,
  ProjectLanguageRow,
  ProjectMemberWithProfile,
  ProjectInviteRow,
} from './types';
import type { POEntry } from '@/lib/po/types';

// ── Query key factory ────────────────────────────────────────

export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
  languages: (projectId: string) => ['projects', projectId, 'languages'] as const,
  members: (projectId: string) => ['projects', projectId, 'members'] as const,
  invites: (projectId: string) => ['projects', projectId, 'invites'] as const,
  public: ['projects', 'public'] as const,
  editorPage: (projectId: string, languageId: string) =>
    ['projects', projectId, 'editor-page', languageId] as const,
  settingsPage: (projectId: string) => ['projects', projectId, 'settings-page'] as const,
  inviteToken: (token: string) => ['projects', 'invites', 'token', token] as const,
};

// ── Query hooks ──────────────────────────────────────────────

export function useProjects() {
  return useQuery<ProjectWithLanguages[]>({
    queryKey: projectKeys.all,
    queryFn: listProjects,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

export function usePublicProjects() {
  return useQuery<ProjectWithLanguages[]>({
    queryKey: projectKeys.public,
    queryFn: listPublicProjects,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

export function useProject(id: string | undefined) {
  return useQuery<ProjectRow | null>({
    queryKey: projectKeys.detail(id!),
    queryFn: () => getProject(id!),
    enabled: Boolean(id),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

export function useProjectLanguages(projectId: string | undefined) {
  return useQuery<ProjectLanguageRow[]>({
    queryKey: projectKeys.languages(projectId!),
    queryFn: () => getProjectLanguages(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

export function useProjectMembers(projectId: string | undefined) {
  return useQuery<ProjectMemberWithProfile[]>({
    queryKey: projectKeys.members(projectId!),
    queryFn: () => listProjectMembers(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

export function useProjectInvites(projectId: string | undefined) {
  return useQuery<ProjectInviteRow[]>({
    queryKey: projectKeys.invites(projectId!),
    queryFn: () => listProjectInvites(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

export function useProjectEditorPage(
  projectId: string | undefined,
  languageId: string | undefined,
) {
  return useQuery<ProjectEditorPageData>({
    queryKey:
      projectId && languageId ? projectKeys.editorPage(projectId, languageId) : projectKeys.all,
    queryFn: () => getProjectEditorPage(projectId!, languageId!),
    enabled: Boolean(projectId && languageId),
    staleTime: 60_000,
  });
}

export function useProjectSettingsPage(projectId: string | undefined) {
  return useQuery<ProjectSettingsPageData>({
    queryKey: projectId ? projectKeys.settingsPage(projectId) : projectKeys.all,
    queryFn: () => getProjectSettingsPage(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

export function useProjectInviteByToken(token: string | undefined, enabled = true) {
  return useQuery<ProjectInviteRow | null>({
    queryKey: token ? projectKeys.inviteToken(token) : projectKeys.all,
    queryFn: () => getProjectInviteByToken(token!),
    enabled: Boolean(token) && enabled,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

// ── Mutations ────────────────────────────────────────────────

interface CreateProjectParams {
  insert: ProjectInsert;
  languageInsert?: ProjectLanguageInsert;
  entries?: POEntry[];
}

interface CreateProjectResult {
  project: ProjectRow;
  languageId: string | null;
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation<CreateProjectResult, Error, CreateProjectParams>({
    mutationFn: async ({ insert, languageInsert, entries }) => {
      const project = await apiCreateProject(insert);

      let languageId: string | null = null;

      if (languageInsert) {
        const language = await apiCreateProjectLanguage({
          ...languageInsert,
          project_id: project.id,
        });
        languageId = language.id;

        if (entries && entries.length > 0) {
          await syncProjectEntries(language.id, project.id, entries, new Map(), new Map());
        }
      }

      return { project, languageId };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: apiDeleteProject,
    onSuccess: (_data, id) => {
      // Optimistic removal from cache
      queryClient.setQueryData<ProjectWithLanguages[]>(projectKeys.all, (old) =>
        old ? old.filter((p) => p.id !== id) : [],
      );
    },
  });
}

export function useAddLanguage() {
  const queryClient = useQueryClient();
  return useMutation<
    string,
    Error,
    { projectId: string; languageInsert: ProjectLanguageInsert; sourceLanguageId?: string }
  >({
    mutationFn: async ({ projectId, languageInsert, sourceLanguageId }) => {
      const language = await apiCreateProjectLanguage({
        ...languageInsert,
        project_id: projectId,
      });

      if (sourceLanguageId) {
        await apiCloneLanguageEntries(sourceLanguageId, language.id);
      }

      return language.id;
    },
    onSuccess: (_data, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      void queryClient.invalidateQueries({ queryKey: projectKeys.languages(projectId) });
    },
  });
}

export function useDeleteLanguage() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { languageId: string; projectId: string }>({
    mutationFn: ({ languageId }) => apiDeleteProjectLanguage(languageId),
    onSuccess: (_data, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      void queryClient.invalidateQueries({ queryKey: projectKeys.languages(projectId) });
    },
  });
}
