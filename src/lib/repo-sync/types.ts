/**
 * Repository Sync Types
 *
 * Shared types for GitHub and GitLab repository integration.
 */

/** Supported repository providers */
export type RepoProviderId = 'github' | 'gitlab';

/** Repository reference */
export interface RepoRef {
  provider: RepoProviderId;
  owner: string;
  repo: string;
}

/** Branch info */
export interface RepoBranch {
  name: string;
  isDefault: boolean;
  sha: string;
}

/** File tree entry */
export interface RepoTreeEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  sha: string;
}

/** File content fetched from a repository */
export interface RepoFileContent {
  path: string;
  content: string;
  sha: string;
  encoding: string;
  size: number;
}

/** Active repository connection metadata (stored alongside editor state) */
export interface RepoConnection {
  provider: RepoProviderId;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  /** SHA of the blob when file was loaded (used for conflict detection) */
  baseSha: string;
  /** The original file content at load time (used for diff). Stripped from localStorage on persist. */
  baseContent?: string;
  /** Default branch name (for PR targets) */
  defaultBranch: string;
}

/** Request to commit a file back to the repository */
export interface CommitFileRequest {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  content: string;
  message: string;
  /** SHA of the blob being replaced (required for updates) */
  sha: string;
}

/** Result of a commit operation */
export interface CommitResult {
  sha: string;
  url: string;
}

/** Request to create a new branch */
export interface CreateBranchRequest {
  owner: string;
  repo: string;
  branchName: string;
  /** SHA to branch from */
  fromSha: string;
}

/** Request to create a pull/merge request */
export interface CreatePullRequestRequest {
  owner: string;
  repo: string;
  title: string;
  body: string;
  /** Branch with changes */
  head: string;
  /** Target branch (usually default branch) */
  base: string;
}

/** Result of creating a pull/merge request */
export interface PullRequestResult {
  number: number;
  url: string;
  title: string;
}

/** Repository list entry */
export interface RepoListEntry {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  isPrivate: boolean;
  updatedAt: string;
}

/** Persisted push/commit settings for repo sync */
export interface RepoSyncSettings {
  /** Conventional commit prefix, e.g. "fix(i18n):" */
  commitPrefix: string;
  /** Branch name template — {{file}} is replaced with the filename without extension */
  branchTemplate: string;
  /** Whether to create a new branch by default */
  createNewBranch: boolean;
  /** Whether to create a PR by default */
  createPr: boolean;
  /** Default PR body */
  prBody: string;
}

export const DEFAULT_SYNC_SETTINGS: RepoSyncSettings = {
  commitPrefix: 'fix(i18n):',
  branchTemplate: 'glossboss/update-{{file}}',
  createNewBranch: true,
  createPr: true,
  prBody: 'Translations updated via GlossBoss.',
};

/** Locale file extensions we can open */
export const LOCALE_FILE_EXTENSIONS = ['.po', '.pot', '.json'] as const;

/** Check if a filename is a recognized locale file */
export function isLocaleFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return LOCALE_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
