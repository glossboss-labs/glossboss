/**
 * Track and retrieve recently visited projects.
 *
 * Stores an ordered list of { id, name } in localStorage (max 5).
 * Most-recently visited project is first.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { RECENT_PROJECTS_KEY } from '@/lib/constants/storage-keys';

interface RecentProject {
  id: string;
  name: string;
}

const MAX_RECENT = 5;

function getSnapshot(): RecentProject[] {
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as RecentProject[]) : [];
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

export function recordRecentProject(id: string, name: string): void {
  const current = getSnapshot();
  const filtered = current.filter((p) => p.id !== id);
  const updated = [{ id, name }, ...filtered].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(updated));
  cachedSnapshot = updated;
}

export function useRecentProjects() {
  const recentProjects = useSyncExternalStore(subscribe, getSnapshotCached, () => []);

  const record = useCallback((id: string, name: string) => {
    recordRecentProject(id, name);
  }, []);

  return { recentProjects, recordRecentProject: record };
}
