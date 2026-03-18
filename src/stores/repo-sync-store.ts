/**
 * Repository Sync Store
 *
 * Zustand store for tracking the active repository connection.
 * Persisted to localStorage so users can resume work after refresh.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { RepoConnection, RepoProviderId, RepoSyncSettings } from '@/lib/repo-sync/types';
import { REPO_SYNC_STORE_KEY } from '@/lib/constants/storage-keys';
import { DEFAULT_SYNC_SETTINGS } from '@/lib/repo-sync/types';

/** Sync operation status */
export type RepoSyncStatus = 'idle' | 'loading' | 'saving' | 'error';

export interface RepoSyncState {
  /** Active repository connection (null when working with local file) */
  connection: RepoConnection | null;

  /** Persisted push/commit settings */
  syncSettings: RepoSyncSettings;

  /** Current sync status */
  status: RepoSyncStatus;

  /** Last error message */
  error: string | null;
}

export interface RepoSyncActions {
  /** Set the active repository connection after loading a file */
  setConnection: (connection: RepoConnection) => void;

  /** Clear the connection (back to local mode) */
  clearConnection: () => void;

  /** Update the base SHA after a successful commit */
  updateBaseSha: (sha: string) => void;

  /** Update the base content after a commit (new baseline for diff) */
  updateBaseContent: (content: string) => void;

  /** Update connection branch (after creating a new branch) */
  updateBranch: (branch: string) => void;

  /** Set sync status */
  setStatus: (status: RepoSyncStatus) => void;

  /** Set error */
  setError: (error: string | null) => void;

  /** Update sync settings */
  setSyncSettings: (settings: Partial<RepoSyncSettings>) => void;

  /** Check if currently connected to a repository */
  isConnected: () => boolean;

  /** Get provider label */
  getProviderLabel: () => string;
}

const STORAGE_KEY = REPO_SYNC_STORE_KEY;

export const REPO_PROVIDER_LABELS: Record<RepoProviderId, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
};

export const useRepoSyncStore = create<RepoSyncState & RepoSyncActions>()(
  persist(
    (set, get) => ({
      connection: null,
      syncSettings: { ...DEFAULT_SYNC_SETTINGS },
      status: 'idle',
      error: null,

      setConnection: (connection) => {
        set({ connection, status: 'idle', error: null });
      },

      clearConnection: () => {
        set({ connection: null, status: 'idle', error: null });
      },

      updateBaseSha: (sha) => {
        set((state) => {
          if (!state.connection) return {};
          return { connection: { ...state.connection, baseSha: sha } };
        });
      },

      updateBaseContent: (content) => {
        set((state) => {
          if (!state.connection) return {};
          return { connection: { ...state.connection, baseContent: content } };
        });
      },

      updateBranch: (branch) => {
        set((state) => {
          if (!state.connection) return {};
          return { connection: { ...state.connection, branch } };
        });
      },

      setStatus: (status) => {
        set({ status });
      },

      setError: (error) => {
        set({ error, status: error ? 'error' : 'idle' });
      },

      setSyncSettings: (settings) => {
        set((state) => ({
          syncSettings: { ...state.syncSettings, ...settings },
        }));
      },

      isConnected: () => {
        return get().connection !== null;
      },

      getProviderLabel: () => {
        const conn = get().connection;
        if (!conn) return '';
        return REPO_PROVIDER_LABELS[conn.provider] ?? conn.provider;
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        connection: state.connection ? { ...state.connection, baseContent: undefined } : null,
        syncSettings: state.syncSettings,
      }),
    },
  ),
);
