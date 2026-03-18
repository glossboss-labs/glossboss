/**
 * GitLab API Client
 *
 * Direct browser-side calls to the GitLab REST API using the user's PAT.
 */

import type {
  GitLabProject,
  GitLabBranch,
  GitLabFile,
  GitLabCommitResponse,
  GitLabMergeRequest,
  GitLabBranchResponse,
  GitLabTreeEntry,
} from './types';
import { getGitLabApiUrl } from './settings';
import { resolveGitLabToken } from './token';
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

/** Encode project path for GitLab API (owner/repo → owner%2Frepo) */
function projectId(owner: string, repo: string): string {
  return encodeURIComponent(`${owner}/${repo}`);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resolved = resolveGitLabToken();
  if (!resolved) throw new Error('GitLab token not configured');

  const apiBase = getGitLabApiUrl();

  // OAuth tokens use Bearer header; PATs use PRIVATE-TOKEN
  const authHeader =
    resolved.type === 'oauth'
      ? { Authorization: `Bearer ${resolved.token}` }
      : { 'PRIVATE-TOKEN': resolved.token };

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      (body as { message?: string }).message ||
      (body as { error?: string }).error ||
      `GitLab API error: ${response.status}`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }

  return response.json() as Promise<T>;
}

/** List projects accessible to the authenticated user */
export async function listRepos(page = 1, perPage = 30): Promise<RepoListEntry[]> {
  const projects = await request<GitLabProject[]>(
    `/projects?membership=true&order_by=last_activity_at&sort=desc&per_page=${perPage}&page=${page}`,
  );

  return projects.map((p) => ({
    owner: p.namespace.full_path,
    name: p.name,
    fullName: p.path_with_namespace,
    description: p.description,
    defaultBranch: p.default_branch,
    isPrivate: p.visibility === 'private',
    updatedAt: p.last_activity_at,
  }));
}

/** List branches for a project */
export async function listBranches(
  owner: string,
  repo: string,
  page = 1,
  perPage = 100,
): Promise<RepoBranch[]> {
  const pid = projectId(owner, repo);
  const branches = await request<GitLabBranch[]>(
    `/projects/${pid}/repository/branches?per_page=${perPage}&page=${page}`,
  );

  return branches.map((b) => ({
    name: b.name,
    isDefault: b.default,
    sha: b.commit.id,
  }));
}

/** Get repository default branch name */
export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const pid = projectId(owner, repo);
  const project = await request<GitLabProject>(`/projects/${pid}`);
  return project.default_branch;
}

/** Browse the file tree of a project */
export async function listTree(
  owner: string,
  repo: string,
  branch: string,
  path = '',
): Promise<RepoTreeEntry[]> {
  const pid = projectId(owner, repo);
  const params = new URLSearchParams({
    ref: branch,
    per_page: '100',
  });
  if (path) params.set('path', path);

  const entries = await request<GitLabTreeEntry[]>(
    `/projects/${pid}/repository/tree?${params.toString()}`,
  );

  return entries.map((e) => ({
    path: e.path,
    name: e.name,
    type: e.type === 'tree' ? 'directory' : 'file',
    sha: e.id,
  }));
}

/** Search the full repository tree for locale files (.po, .pot, .json) */
export async function searchLocaleFiles(
  owner: string,
  repo: string,
  branch: string,
): Promise<RepoTreeEntry[]> {
  const pid = projectId(owner, repo);
  const allEntries: GitLabTreeEntry[] = [];
  let page = 1;
  const perPage = 100;

  // GitLab recursive tree may be paginated
  while (true) {
    const entries = await request<GitLabTreeEntry[]>(
      `/projects/${pid}/repository/tree?ref=${encodeURIComponent(branch)}&recursive=true&per_page=${perPage}&page=${page}`,
    );
    allEntries.push(...entries);
    if (entries.length < perPage) break;
    page++;
  }

  return allEntries
    .filter((e) => {
      if (e.type !== 'blob') return false;
      const lower = e.path.toLowerCase();
      return lower.endsWith('.po') || lower.endsWith('.pot') || lower.endsWith('.json');
    })
    .map((e) => ({
      path: e.path,
      name: e.name,
      type: 'file' as const,
      sha: e.id,
    }));
}

/** Get file content from a project */
export async function getFileContent(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<RepoFileContent> {
  const pid = projectId(owner, repo);
  const pathEnc = encodeURIComponent(path);
  const file = await request<GitLabFile>(
    `/projects/${pid}/repository/files/${pathEnc}?ref=${encodeURIComponent(branch)}`,
  );

  // GitLab returns base64-encoded content
  const decoded = atob(file.content);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  const text = new TextDecoder('utf-8').decode(bytes);

  return {
    path: file.file_path,
    content: text,
    sha: file.blob_id,
    encoding: 'utf-8',
    size: file.size,
  };
}

/** Commit a file to a project (create or update) */
export async function commitFile(req: CommitFileRequest): Promise<CommitResult> {
  const pid = projectId(req.owner, req.repo);

  // GitLab uses the Commits API for file modifications
  const response = await request<GitLabCommitResponse>(`/projects/${pid}/repository/commits`, {
    method: 'POST',
    body: JSON.stringify({
      branch: req.branch,
      commit_message: req.message,
      actions: [
        {
          action: 'update',
          file_path: req.filePath,
          content: req.content,
          encoding: 'text',
        },
      ],
    }),
  });

  return {
    sha: response.id,
    url: response.web_url,
  };
}

/** Create a new branch */
export async function createBranch(req: CreateBranchRequest): Promise<void> {
  const pid = projectId(req.owner, req.repo);
  await request<GitLabBranchResponse>(`/projects/${pid}/repository/branches`, {
    method: 'POST',
    body: JSON.stringify({
      branch: req.branchName,
      ref: req.fromSha,
    }),
  });
}

/** Get the SHA of a branch head */
export async function getBranchSha(owner: string, repo: string, branch: string): Promise<string> {
  const pid = projectId(owner, repo);
  const branchInfo = await request<GitLabBranch>(
    `/projects/${pid}/repository/branches/${encodeURIComponent(branch)}`,
  );
  return branchInfo.commit.id;
}

/** Create a merge request */
export async function createPullRequest(req: CreatePullRequestRequest): Promise<PullRequestResult> {
  const pid = projectId(req.owner, req.repo);
  const mr = await request<GitLabMergeRequest>(`/projects/${pid}/merge_requests`, {
    method: 'POST',
    body: JSON.stringify({
      title: req.title,
      description: req.body,
      source_branch: req.head,
      target_branch: req.base,
    }),
  });

  return {
    number: mr.iid,
    url: mr.web_url,
    title: mr.title,
  };
}
