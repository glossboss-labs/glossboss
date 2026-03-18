/**
 * GitHub Token Resolution
 *
 * Resolves a GitHub token for repo API access. Supports two sources:
 *   1. OAuth token — obtained via the repo-oauth popup flow
 *   2. PAT — user-configured personal access token
 *
 * OAuth takes priority when both are available.
 */

import { getGitHubSettings } from './settings';
import { GITHUB_OAUTH_TOKEN_KEY } from '@/lib/constants/storage-keys';

const OAUTH_TOKEN_KEY = GITHUB_OAUTH_TOKEN_KEY;

// ── OAuth token storage ────────────────────────────────────

/** Save a GitHub OAuth token (persisted in localStorage). */
export function saveGitHubOAuthToken(token: string): void {
  try {
    localStorage.setItem(OAUTH_TOKEN_KEY, token);
  } catch {
    // non-fatal
  }
}

/** Get the stored GitHub OAuth token, or null. */
export function getGitHubOAuthToken(): string | null {
  try {
    const token = localStorage.getItem(OAUTH_TOKEN_KEY);
    return token?.trim() || null;
  } catch {
    return null;
  }
}

/** Clear the GitHub OAuth token. */
export function clearGitHubOAuthToken(): void {
  try {
    localStorage.removeItem(OAUTH_TOKEN_KEY);
  } catch {
    // non-fatal
  }
}

/** Check if a GitHub OAuth token is stored. */
export function hasGitHubOAuthToken(): boolean {
  return getGitHubOAuthToken() !== null;
}

// ── Token resolution ────────────────────────────────────────

/**
 * Resolve a GitHub token — checks OAuth first, then PAT.
 * Returns the token string or null if no token is available.
 */
export function resolveGitHubToken(): string | null {
  // OAuth token takes priority
  const oauthToken = getGitHubOAuthToken();
  if (oauthToken) return oauthToken;

  // Fall back to PAT
  const { token } = getGitHubSettings();
  if (token.trim()) return token.trim();

  return null;
}

/** Check if any GitHub token (OAuth or PAT) is available. */
export function hasAnyGitHubToken(): boolean {
  return resolveGitHubToken() !== null;
}

/** Get the type of the currently active GitHub token. */
export function getGitHubTokenType(): 'oauth' | 'pat' | null {
  if (getGitHubOAuthToken()) return 'oauth';
  const { token } = getGitHubSettings();
  if (token.trim()) return 'pat';
  return null;
}
