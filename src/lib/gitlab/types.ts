/**
 * GitLab API Response Types
 *
 * Minimal types for the GitLab REST API responses we use.
 */

/** GitLab project from /projects */
export interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string | null;
  default_branch: string;
  visibility: string;
  last_activity_at: string;
  namespace: {
    path: string;
    full_path: string;
  };
}

/** GitLab branch from /projects/:id/repository/branches */
export interface GitLabBranch {
  name: string;
  default: boolean;
  commit: {
    id: string;
  };
}

/** GitLab tree entry from /projects/:id/repository/tree */
export interface GitLabTreeEntry {
  id: string;
  name: string;
  type: 'blob' | 'tree';
  path: string;
  mode: string;
}

/** GitLab file content from /projects/:id/repository/files/:path */
export interface GitLabFile {
  file_name: string;
  file_path: string;
  size: number;
  encoding: string;
  content: string;
  content_sha256: string;
  blob_id: string;
  last_commit_id: string;
}

/** GitLab commit response */
export interface GitLabCommitResponse {
  id: string;
  web_url: string;
  message: string;
}

/** GitLab merge request response */
export interface GitLabMergeRequest {
  iid: number;
  web_url: string;
  title: string;
  state: string;
}

/** GitLab branch creation response */
export interface GitLabBranchResponse {
  name: string;
  commit: {
    id: string;
  };
}
