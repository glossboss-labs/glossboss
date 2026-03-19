import { queryClient } from '@/providers';
import { listOrganizations } from '@/lib/organizations/api';
import { organizationKeys } from '@/lib/organizations/queries';
import {
  getProjectEditorPage,
  getProjectSettingsPage,
  getProject,
  getProjectLanguages,
  listProjects,
  listPublicProjects,
} from '@/lib/projects/api';
import { projectKeys } from '@/lib/projects/queries';
import { roadmapKeys } from '@/lib/roadmap/queries';
import { fetchRoadmap } from '@/lib/roadmap/api';

function ignorePromise(promise: Promise<unknown>) {
  void promise.catch(() => {});
}

function preloadModule(path: string) {
  switch (path) {
    case '/dashboard':
      ignorePromise(import('@/pages/Dashboard'));
      return;
    case '/explore':
      ignorePromise(import('@/pages/Explore'));
      return;
    case '/roadmap':
      ignorePromise(import('@/pages/Roadmap'));
      return;
    case '/settings':
      ignorePromise(import('@/pages/Settings'));
      return;
    case '/editor':
      ignorePromise(import('@/pages/Index'));
      return;
    default:
      break;
  }

  if (/^\/projects\/[^/]+$/.test(path)) {
    ignorePromise(import('@/pages/ProjectDetail'));
    return;
  }

  if (/^\/projects\/[^/]+\/settings$/.test(path)) {
    ignorePromise(import('@/pages/ProjectSettings'));
    return;
  }

  if (/^\/projects\/[^/]+\/languages\/[^/]+$/.test(path)) {
    ignorePromise(import('@/pages/ProjectEditor'));
  }
}

export function prefetchPath(path: string) {
  preloadModule(path);

  if (path === '/dashboard') {
    ignorePromise(
      queryClient.prefetchQuery({
        queryKey: projectKeys.all,
        queryFn: listProjects,
        staleTime: 30_000,
      }),
    );
    ignorePromise(
      queryClient.prefetchQuery({
        queryKey: organizationKeys.all,
        queryFn: listOrganizations,
        staleTime: 30_000,
      }),
    );
    return;
  }

  if (path === '/explore') {
    ignorePromise(
      queryClient.prefetchQuery({
        queryKey: projectKeys.public,
        queryFn: listPublicProjects,
        staleTime: 30_000,
      }),
    );
    return;
  }

  if (path === '/roadmap') {
    ignorePromise(
      queryClient.prefetchQuery({
        queryKey: roadmapKeys.all,
        queryFn: fetchRoadmap,
        staleTime: 5 * 60_000,
      }),
    );
    return;
  }

  const projectMatch = path.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    const [, projectId] = projectMatch;
    ignorePromise(
      queryClient.prefetchQuery({
        queryKey: projectKeys.detail(projectId),
        queryFn: () => getProject(projectId),
        staleTime: 30_000,
      }),
    );
    ignorePromise(
      queryClient.prefetchQuery({
        queryKey: projectKeys.languages(projectId),
        queryFn: () => getProjectLanguages(projectId),
        staleTime: 30_000,
      }),
    );
    return;
  }

  const projectSettingsMatch = path.match(/^\/projects\/([^/]+)\/settings$/);
  if (projectSettingsMatch) {
    const [, projectId] = projectSettingsMatch;
    ignorePromise(
      queryClient.prefetchQuery({
        queryKey: projectKeys.settingsPage(projectId),
        queryFn: () => getProjectSettingsPage(projectId),
        staleTime: 60_000,
      }),
    );
    return;
  }

  const editorMatch = path.match(/^\/projects\/([^/]+)\/languages\/([^/]+)$/);
  if (editorMatch) {
    const [, projectId, languageId] = editorMatch;
    ignorePromise(
      queryClient.prefetchQuery({
        queryKey: projectKeys.editorPage(projectId, languageId),
        queryFn: () => getProjectEditorPage(projectId, languageId),
        staleTime: 60_000,
      }),
    );
  }
}
