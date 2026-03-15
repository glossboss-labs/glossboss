/**
 * useRepoDbSync — writes repo connection changes back to the project_languages DB record.
 *
 * Watches the repo sync store and persists connection state to the database
 * whenever it changes (after the initial load from DB).
 */

import { useEffect, useRef } from 'react';
import { useRepoSyncStore } from '@/stores/repo-sync-store';
import { updateProjectLanguage } from '@/lib/projects/api';
import type { RepoConnection } from '@/lib/repo-sync/types';

export function useRepoDbSync(languageId: string | undefined) {
  const connection = useRepoSyncStore((s) => s.connection);
  const initializedRef = useRef(false);
  const prevConnectionRef = useRef<RepoConnection | null>(null);

  useEffect(() => {
    // Reset on language change
    initializedRef.current = false;
    prevConnectionRef.current = null;
  }, [languageId]);

  useEffect(() => {
    if (!languageId) return;

    // Skip the first change — that's the initialization from DB
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevConnectionRef.current = connection;
      return;
    }

    // Skip if unchanged
    if (connection === prevConnectionRef.current) return;
    prevConnectionRef.current = connection;

    if (connection) {
      void updateProjectLanguage(languageId, {
        repo_provider: connection.provider,
        repo_owner: connection.owner,
        repo_name: connection.repo,
        repo_branch: connection.branch,
        repo_file_path: connection.filePath,
        repo_default_branch: connection.defaultBranch,
      });
    } else {
      void updateProjectLanguage(languageId, {
        repo_provider: null,
        repo_owner: null,
        repo_name: null,
        repo_branch: null,
        repo_file_path: null,
        repo_default_branch: null,
      });
    }
  }, [connection, languageId]);
}
