/**
 * GitHub Settings Storage
 *
 * Manages user's GitHub Personal Access Token.
 * Follows the same session/localStorage pattern as DeepL settings.
 */

const STORAGE_KEY = 'glossboss-github-settings';
const PERSIST_KEY = 'glossboss-github-persist';

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

export function isGitHubPersistEnabled(): boolean {
  try {
    return localStorage.getItem(PERSIST_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setGitHubPersistEnabled(enabled: boolean): void {
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
  return isGitHubPersistEnabled() ? localStorage : sessionStorage;
}

export function getGitHubSettings(): GitHubSettings {
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

export function saveGitHubSettings(settings: Partial<GitHubSettings>): void {
  try {
    const current = getGitHubSettings();
    const updated: GitHubSettings = {
      ...current,
      ...settings,
      updatedAt: Date.now(),
    };
    getStore().setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function clearGitHubSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function hasGitHubToken(): boolean {
  return Boolean(getGitHubSettings().token.trim());
}
