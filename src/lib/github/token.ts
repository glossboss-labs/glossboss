/**
 * GitHub Token Resolution
 *
 * Resolves a GitHub personal access token (PAT) for repo API access.
 * Repo access is decoupled from account sign-in — users configure a
 * PAT (classic or fine-grained) that grants access only to the
 * repositories they choose.
 */

import { getGitHubSettings } from './settings';

const OAUTH_TOKEN_KEY = 'glossboss-github-oauth-token';

// ── Legacy OAuth token cleanup ──────────────────────────────

/** Clear any legacy OAuth token stored from previous sign-ins. */
export function clearGitHubOAuthToken(): void {
  try {
    localStorage.removeItem(OAUTH_TOKEN_KEY);
  } catch {
    // non-fatal
  }
}

// ── Token resolution ────────────────────────────────────────

/**
 * Resolve a GitHub token from PAT settings.
 *
 * Returns the token string or null if no token is available.
 */
export function resolveGitHubToken(): string | null {
  const { token } = getGitHubSettings();
  if (token.trim()) return token.trim();

  return null;
}

/** Check if a GitHub token is available. */
export function hasAnyGitHubToken(): boolean {
  return resolveGitHubToken() !== null;
}
