/**
 * GitHub Token Resolution
 *
 * Unified token resolution for GitHub API access.
 *
 * Priority order:
 * 1. GitHub OAuth provider_token (captured on sign-in via Supabase Auth)
 * 2. GitHub PAT from repo sync settings (manual fallback)
 *
 * The OAuth token is captured in the auth store's onAuthStateChange handler
 * and persisted in localStorage so it survives page refreshes (Supabase only
 * provides provider_token on the initial sign-in event).
 */

import { getGitHubSettings } from './settings';

const OAUTH_TOKEN_KEY = 'glossboss-github-oauth-token';

// ── OAuth token storage ──────────────────────────────────────

/** Store the GitHub OAuth provider_token for repo access. */
export function setGitHubOAuthToken(token: string): void {
  try {
    localStorage.setItem(OAUTH_TOKEN_KEY, token);
  } catch {
    // localStorage unavailable — non-fatal
  }
}

/** Retrieve the stored GitHub OAuth provider_token. */
export function getGitHubOAuthToken(): string | null {
  try {
    return localStorage.getItem(OAUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Clear the stored GitHub OAuth token (e.g. on sign-out). */
export function clearGitHubOAuthToken(): void {
  try {
    localStorage.removeItem(OAUTH_TOKEN_KEY);
  } catch {
    // non-fatal
  }
}

/** Check if a GitHub OAuth token is stored. */
export function hasGitHubOAuthToken(): boolean {
  return Boolean(getGitHubOAuthToken());
}

// ── Unified token resolution ─────────────────────────────────

/**
 * Resolve a GitHub token from the best available source.
 *
 * Returns the token string or null if no token is available.
 * Prefers OAuth token (automatic) over PAT (manual).
 */
export function resolveGitHubToken(): string | null {
  // 1. OAuth provider_token (from GitHub sign-in)
  const oauthToken = getGitHubOAuthToken();
  if (oauthToken) return oauthToken;

  // 2. PAT from repo sync settings (manual fallback)
  const { token } = getGitHubSettings();
  if (token.trim()) return token.trim();

  return null;
}

/** Check if any GitHub token is available (OAuth or PAT). */
export function hasAnyGitHubToken(): boolean {
  return resolveGitHubToken() !== null;
}
