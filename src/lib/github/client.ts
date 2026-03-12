/**
 * GitHub API Client
 *
 * Direct browser-side calls to the GitHub REST API using the user's PAT.
 * GitHub supports CORS for authenticated requests, so no edge function proxy is needed.
 */

import type {
  GitHubRepo,
  GitHubBranch,
  GitHubContent,
  GitHubCommitResponse,
  GitHubRef,
  GitHubPullRequest,
  GitHubTree,
} from './types';
import { getGitHubSettings } from './settings';
import type {
  RepoBranch,
  RepoTreeEntry,
  RepoFileContent,
  CommitFileRequest,
  CommitResult,
  CreateBranchRequest,
  CreatePullRequestRequest,
  PullRequestResult,
  RepoListEntry,
} from '../repo-sync/types';

const API_BASE = 'https://api.github.com';

function getToken(): string {
  const { token } = getGitHubSettings();
  if (!token.trim()) throw new Error('GitHub token not configured');
  return token.trim();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      (body as { message?: string }).message || `GitHub API error: ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

/** List repositories accessible to the authenticated user */
export async function listRepos(page = 1, perPage = 30): Promise<RepoListEntry[]> {
  const repos = await request<GitHubRepo[]>(
    `/user/repos?sort=updated&per_page=${perPage}&page=${page}&type=all`,
  );

  return repos.map((r) => ({
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    defaultBranch: r.default_branch,
    isPrivate: r.private,
    updatedAt: r.updated_at,
  }));
}

/** List branches for a repository */
export async function listBranches(
  owner: string,
  repo: string,
  page = 1,
  perPage = 100,
): Promise<RepoBranch[]> {
  const branches = await request<GitHubBranch[]>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=${perPage}&page=${page}`,
  );

  // Fetch repo info to know the default branch
  const repoInfo = await request<GitHubRepo>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );

  return branches.map((b) => ({
    name: b.name,
    isDefault: b.name === repoInfo.default_branch,
    sha: b.commit.sha,
  }));
}

/** Get repository default branch name */
export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const repoInfo = await request<GitHubRepo>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );
  return repoInfo.default_branch;
}

/** Browse the file tree of a repository at a given path */
export async function listTree(
  owner: string,
  repo: string,
  branch: string,
  path = '',
): Promise<RepoTreeEntry[]> {
  const ownerEnc = encodeURIComponent(owner);
  const repoEnc = encodeURIComponent(repo);

  if (!path) {
    // Use Git Trees API for root - more efficient
    const branchInfo = await request<GitHubBranch>(
      `/repos/${ownerEnc}/${repoEnc}/branches/${encodeURIComponent(branch)}`,
    );
    const tree = await request<GitHubTree>(
      `/repos/${ownerEnc}/${repoEnc}/git/trees/${branchInfo.commit.sha}`,
    );

    return tree.tree.map((entry) => ({
      path: entry.path,
      name: entry.path,
      type: entry.type === 'tree' ? 'directory' : 'file',
      size: entry.size,
      sha: entry.sha,
    }));
  }

  // Use Contents API for subdirectories
  const pathEnc = path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const contents = await request<GitHubContent[]>(
    `/repos/${ownerEnc}/${repoEnc}/contents/${pathEnc}?ref=${encodeURIComponent(branch)}`,
  );

  return contents.map((c) => ({
    path: c.path,
    name: c.name,
    type: c.type === 'dir' ? 'directory' : 'file',
    size: c.size,
    sha: c.sha,
  }));
}

/** Get file content from a repository */
export async function getFileContent(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<RepoFileContent> {
  const pathEnc = path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const content = await request<GitHubContent>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${pathEnc}?ref=${encodeURIComponent(branch)}`,
  );

  if (content.type !== 'file') {
    throw new Error(`Path is not a file: ${path}`);
  }

  // GitHub returns base64-encoded content
  const decoded = atob(content.content.replace(/\n/g, ''));
  // Convert to proper string handling for UTF-8
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  const text = new TextDecoder('utf-8').decode(bytes);

  return {
    path: content.path,
    content: text,
    sha: content.sha,
    encoding: 'utf-8',
    size: content.size,
  };
}

/** Commit a file to a repository (create or update) */
export async function commitFile(req: CommitFileRequest): Promise<CommitResult> {
  const pathEnc = req.filePath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');

  // Encode content to base64, handling UTF-8
  const encoder = new TextEncoder();
  const bytes = encoder.encode(req.content);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Content = btoa(binary);

  const body: Record<string, string> = {
    message: req.message,
    content: base64Content,
    branch: req.branch,
  };

  if (req.sha) {
    body.sha = req.sha;
  }

  const response = await request<GitHubCommitResponse>(
    `/repos/${encodeURIComponent(req.owner)}/${encodeURIComponent(req.repo)}/contents/${pathEnc}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  return {
    sha: response.commit.sha,
    url: response.commit.html_url,
  };
}

/** Create a new branch from a given SHA */
export async function createBranch(req: CreateBranchRequest): Promise<void> {
  await request<GitHubRef>(
    `/repos/${encodeURIComponent(req.owner)}/${encodeURIComponent(req.repo)}/git/refs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: `refs/heads/${req.branchName}`,
        sha: req.fromSha,
      }),
    },
  );
}

/** Get the SHA of a branch head */
export async function getBranchSha(owner: string, repo: string, branch: string): Promise<string> {
  const branchInfo = await request<GitHubBranch>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`,
  );
  return branchInfo.commit.sha;
}

/** Create a pull request */
export async function createPullRequest(req: CreatePullRequestRequest): Promise<PullRequestResult> {
  const pr = await request<GitHubPullRequest>(
    `/repos/${encodeURIComponent(req.owner)}/${encodeURIComponent(req.repo)}/pulls`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: req.title,
        body: req.body,
        head: req.head,
        base: req.base,
      }),
    },
  );

  return {
    number: pr.number,
    url: pr.html_url,
    title: pr.title,
  };
}
