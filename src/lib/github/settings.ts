/**
 * GitHub Settings Storage
 *
 * Manages user's GitHub Personal Access Token.
 * Follows the same session/localStorage pattern as other providers.
 */

import { createPersistenceManager } from '@/lib/settings/storage-persistence';
import { GITHUB_SETTINGS_KEY, GITHUB_PERSIST_KEY } from '@/lib/constants/storage-keys';

export interface GitHubSettings {
  /** GitHub Personal Access Token */
  token: string;
  /** When the settings were last updated */
  updatedAt: number;
}

const DEFAULT_SETTINGS: GitHubSettings = {
  token: '',
  updatedAt: 0,
};

const manager = createPersistenceManager<GitHubSettings>({
  storageKey: GITHUB_SETTINGS_KEY,
  persistKey: GITHUB_PERSIST_KEY,
  defaults: DEFAULT_SETTINGS,
  label: 'GitHub Settings',
});

export function isGitHubPersistEnabled(): boolean {
  return manager.isPersistEnabled();
}

export function setGitHubPersistEnabled(enabled: boolean): void {
  manager.setPersistEnabled(enabled);
}

export function getGitHubSettings(): GitHubSettings {
  return manager.get();
}

export function saveGitHubSettings(settings: Partial<GitHubSettings>): void {
  manager.save(settings);
}

export function clearGitHubSettings(): void {
  manager.clear();
}

export function hasGitHubToken(): boolean {
  return Boolean(getGitHubSettings().token.trim());
}
