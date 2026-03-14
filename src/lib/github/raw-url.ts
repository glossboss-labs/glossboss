/**
 * GitHub Raw URL Resolver
 *
 * Detects raw.githubusercontent.com URLs and fetches their content
 * using the GitHub API with available authentication tokens.
 *
 * Token resolution order:
 * 1. GitHub OAuth provider_token from Supabase session
 * 2. GitHub PAT from repo sync settings
 * 3. Unauthenticated (works for public repos only)
 */

import { getGitHubSettings } from './settings';
import { useAuthStore } from '@/stores/auth-store';

const RAW_GITHUB_PATTERN =
  /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/;

export interface GitHubRawUrl {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}

/** Parse a raw.githubusercontent.com URL into its components. */
export function parseGitHubRawUrl(url: string): GitHubRawUrl | null {
  const match = RAW_GITHUB_PATTERN.exec(url);
  if (!match) return null;
  return { owner: match[1], repo: match[2], ref: match[3], path: match[4] };
}

/** Check if a URL is a raw.githubusercontent.com URL. */
export function isGitHubRawUrl(url: string): boolean {
  return RAW_GITHUB_PATTERN.test(url);
}

/**
 * Resolve a GitHub token from available sources.
 * Returns the token or null if no token is available.
 */
export function resolveGitHubToken(): string | null {
  // 1. Check Supabase session for GitHub OAuth provider_token
  const session = useAuthStore.getState().session;
  if (session?.provider_token && session.user?.app_metadata?.provider === 'github') {
    return session.provider_token;
  }

  // 2. Check repo sync settings for a manually entered PAT
  const { token } = getGitHubSettings();
  if (token.trim()) {
    return token.trim();
  }

  return null;
}

/**
 * Fetch file content from a GitHub raw URL using the API.
 * Works for private repos when a token is available.
 *
 * @returns The file content as text, or throws an error.
 */
export async function fetchGitHubRawContent(parsed: GitHubRawUrl): Promise<string> {
  const token = resolveGitHubToken();

  const pathEnc = parsed.path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');

  const apiUrl =
    `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}` +
    `/${encodeURIComponent(parsed.repo)}/contents/${pathEnc}` +
    `?ref=${encodeURIComponent(parsed.ref)}`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl, { headers });

  if (!response.ok) {
    if (response.status === 404 && !token) {
      throw new GitHubPrivateRepoError(parsed);
    }
    throw new Error(`GitHub API ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as { type: string; content: string; encoding: string };

  if (data.type !== 'file') {
    throw new Error(`Path is not a file: ${parsed.path}`);
  }

  // GitHub returns base64-encoded content
  const decoded = atob(data.content.replace(/\n/g, ''));
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/** Error thrown when a private repo is accessed without authentication. */
export class GitHubPrivateRepoError extends Error {
  readonly parsed: GitHubRawUrl;

  constructor(parsed: GitHubRawUrl) {
    super(
      `This file is in a private repository (${parsed.owner}/${parsed.repo}). ` +
        `Sign in with GitHub or connect your GitHub account in the repository sync settings to access it.`,
    );
    this.name = 'GitHubPrivateRepoError';
    this.parsed = parsed;
  }
}
