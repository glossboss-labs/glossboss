/**
 * GitHub API Response Types
 *
 * Minimal types for the GitHub REST API responses we use.
 */

/** GitHub repository from /user/repos or /search/repositories */
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  default_branch: string;
  private: boolean;
  updated_at: string;
  owner: {
    login: string;
  };
}

/** GitHub branch from /repos/:owner/:repo/branches */
export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
  protected: boolean;
}

/** GitHub tree entry from /repos/:owner/:repo/git/trees/:sha */
export interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

/** GitHub tree response */
export interface GitHubTree {
  sha: string;
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

/** GitHub file content from /repos/:owner/:repo/contents/:path */
export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  encoding: string;
  content: string;
}

/** GitHub commit response from PUT /repos/:owner/:repo/contents/:path */
export interface GitHubCommitResponse {
  content: {
    sha: string;
  };
  commit: {
    sha: string;
    html_url: string;
  };
}

/** GitHub ref from /repos/:owner/:repo/git/refs */
export interface GitHubRef {
  ref: string;
  object: {
    sha: string;
    type: string;
  };
}

/** GitHub pull request response */
export interface GitHubPullRequest {
  number: number;
  html_url: string;
  title: string;
  state: string;
}
