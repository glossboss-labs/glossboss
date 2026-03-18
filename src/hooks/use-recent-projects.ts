/**
 * Track and retrieve recently visited projects.
 *
 * Stores an ordered list of { id, name, path } in localStorage (max 5).
 * Most-recently visited project is first. The path records the exact
 * page the user was on (e.g. the language editor, not just the overview).
 */

import { useCallback, useSyncExternalStore } from 'react';
import { RECENT_PROJECTS_KEY } from '@/lib/constants/storage-keys';

export interface RecentProject {
  id: string;
  name: string;
  /** The path the user last visited for this project */
  path: string;
}

const MAX_RECENT = 5;

function getSnapshot(): RecentProject[] {
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentProject[];
    // Migrate old entries that lack a path
    return parsed.map((p) => ({ ...p, path: p.path || `/projects/${p.id}` }));
  } catch {
    return [];
  }
}

// Cache to avoid re-parsing on every render
let cachedSnapshot = getSnapshot();

function subscribe(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === RECENT_PROJECTS_KEY) {
      cachedSnapshot = getSnapshot();
      callback();
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

function getSnapshotCached(): RecentProject[] {
  return cachedSnapshot;
}

export function recordRecentProject(id: string, name: string, path: string): void {
  const current = getSnapshot();
  const filtered = current.filter((p) => p.id !== id);
  const updated = [{ id, name, path }, ...filtered].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(updated));
  cachedSnapshot = updated;
}

export function useRecentProjects() {
  const recentProjects = useSyncExternalStore(subscribe, getSnapshotCached, () => []);

  const record = useCallback((id: string, name: string, path: string) => {
    recordRecentProject(id, name, path);
  }, []);

  return { recentProjects, recordRecentProject: record };
}
