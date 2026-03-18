/**
 * GitLab Settings Storage
 *
 * Manages user's GitLab Personal Access Token and instance URL.
 * Follows the same session/localStorage pattern as other providers.
 */

import { createPersistenceManager } from '@/lib/settings/storage-persistence';
import { GITLAB_SETTINGS_KEY, GITLAB_PERSIST_KEY } from '@/lib/constants/storage-keys';

export interface GitLabSettings {
  /** GitLab Personal Access Token */
  token: string;
  /** GitLab instance URL (defaults to gitlab.com) */
  instanceUrl: string;
  /** When the settings were last updated */
  updatedAt: number;
}

const DEFAULT_SETTINGS: GitLabSettings = {
  token: '',
  instanceUrl: 'https://gitlab.com',
  updatedAt: 0,
};

const manager = createPersistenceManager<GitLabSettings>({
  storageKey: GITLAB_SETTINGS_KEY,
  persistKey: GITLAB_PERSIST_KEY,
  defaults: DEFAULT_SETTINGS,
  label: 'GitLab Settings',
});

export function isGitLabPersistEnabled(): boolean {
  return manager.isPersistEnabled();
}

export function setGitLabPersistEnabled(enabled: boolean): void {
  manager.setPersistEnabled(enabled);
}

export function getGitLabSettings(): GitLabSettings {
  return manager.get();
}

export function saveGitLabSettings(settings: Partial<GitLabSettings>): void {
  manager.save(settings);
}

export function clearGitLabSettings(): void {
  manager.clear();
}

export function hasGitLabToken(): boolean {
  return Boolean(getGitLabSettings().token.trim());
}

/** Get the API base URL for the configured GitLab instance */
export function getGitLabApiUrl(): string {
  const { instanceUrl } = getGitLabSettings();
  const base = instanceUrl.replace(/\/+$/, '');
  return `${base}/api/v4`;
}
