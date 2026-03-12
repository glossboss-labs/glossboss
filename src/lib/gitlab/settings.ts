/**
 * GitLab Settings Storage
 *
 * Manages user's GitLab Personal Access Token and instance URL.
 * Follows the same session/localStorage pattern as other providers.
 */

const STORAGE_KEY = 'glossboss-gitlab-settings';
const PERSIST_KEY = 'glossboss-gitlab-persist';

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

export function isGitLabPersistEnabled(): boolean {
  try {
    return localStorage.getItem(PERSIST_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setGitLabPersistEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      const session = sessionStorage.getItem(STORAGE_KEY);
      if (session) {
        localStorage.setItem(STORAGE_KEY, session);
        sessionStorage.removeItem(STORAGE_KEY);
      }
      localStorage.setItem(PERSIST_KEY, 'true');
    } else {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) {
        sessionStorage.setItem(STORAGE_KEY, local);
        localStorage.removeItem(STORAGE_KEY);
      }
      localStorage.removeItem(PERSIST_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function getStore(): Storage {
  return isGitLabPersistEnabled() ? localStorage : sessionStorage;
}

export function getGitLabSettings(): GitLabSettings {
  try {
    const stored = getStore().getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_SETTINGS;
}

export function saveGitLabSettings(settings: Partial<GitLabSettings>): void {
  try {
    const current = getGitLabSettings();
    const updated: GitLabSettings = {
      ...current,
      ...settings,
      updatedAt: Date.now(),
    };
    getStore().setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function clearGitLabSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    // Ignore storage errors
  }
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
