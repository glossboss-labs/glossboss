/**
 * GitLab Token Resolution
 *
 * Resolves a GitLab token for repo API access. Supports two sources:
 *   1. OAuth token — obtained via the repo-oauth popup flow (gitlab.com only)
 *   2. PAT — user-configured personal access token (any instance)
 *
 * OAuth takes priority when both are available.
 */

import { getGitLabSettings } from './settings';

const OAUTH_TOKEN_KEY = 'glossboss-gitlab-oauth-token';

// ── OAuth token storage ────────────────────────────────────

/** Save a GitLab OAuth token (persisted in localStorage). */
export function saveGitLabOAuthToken(token: string): void {
  try {
    localStorage.setItem(OAUTH_TOKEN_KEY, token);
  } catch {
    // non-fatal
  }
}

/** Get the stored GitLab OAuth token, or null. */
export function getGitLabOAuthToken(): string | null {
  try {
    const token = localStorage.getItem(OAUTH_TOKEN_KEY);
    return token?.trim() || null;
  } catch {
    return null;
  }
}

/** Clear the GitLab OAuth token. */
export function clearGitLabOAuthToken(): void {
  try {
    localStorage.removeItem(OAUTH_TOKEN_KEY);
  } catch {
    // non-fatal
  }
}

/** Check if a GitLab OAuth token is stored. */
export function hasGitLabOAuthToken(): boolean {
  return getGitLabOAuthToken() !== null;
}

// ── Token resolution ────────────────────────────────────────

export interface ResolvedGitLabToken {
  token: string;
  /** 'oauth' uses Authorization: Bearer; 'pat' uses PRIVATE-TOKEN header */
  type: 'oauth' | 'pat';
}

/**
 * Resolve a GitLab token — checks OAuth first, then PAT.
 * Returns the token and its type (needed for correct HTTP header).
 */
export function resolveGitLabToken(): ResolvedGitLabToken | null {
  // OAuth token takes priority
  const oauthToken = getGitLabOAuthToken();
  if (oauthToken) return { token: oauthToken, type: 'oauth' };

  // Fall back to PAT
  const { token } = getGitLabSettings();
  if (token.trim()) return { token: token.trim(), type: 'pat' };

  return null;
}

/** Check if any GitLab token (OAuth or PAT) is available. */
export function hasAnyGitLabToken(): boolean {
  return resolveGitLabToken() !== null;
}

/** Get the type of the currently active GitLab token. */
export function getGitLabTokenType(): 'oauth' | 'pat' | null {
  if (getGitLabOAuthToken()) return 'oauth';
  const { token } = getGitLabSettings();
  if (token.trim()) return 'pat';
  return null;
}
