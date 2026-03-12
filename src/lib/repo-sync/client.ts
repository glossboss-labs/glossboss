/**
 * Repository Sync Client
 *
 * Dispatches repository operations to the active provider (GitHub or GitLab).
 */

import * as github from '../github/client';
import * as gitlab from '../gitlab/client';
import type {
  RepoProviderId,
  RepoBranch,
  RepoTreeEntry,
  RepoFileContent,
  CommitFileRequest,
  CommitResult,
  CreateBranchRequest,
  CreatePullRequestRequest,
  PullRequestResult,
  RepoListEntry,
} from './types';

export interface RepoClient {
  listRepos(page?: number, perPage?: number): Promise<RepoListEntry[]>;
  listBranches(owner: string, repo: string, page?: number, perPage?: number): Promise<RepoBranch[]>;
  getDefaultBranch(owner: string, repo: string): Promise<string>;
  listTree(owner: string, repo: string, branch: string, path?: string): Promise<RepoTreeEntry[]>;
  searchLocaleFiles(owner: string, repo: string, branch: string): Promise<RepoTreeEntry[]>;
  getFileContent(
    owner: string,
    repo: string,
    branch: string,
    path: string,
  ): Promise<RepoFileContent>;
  commitFile(req: CommitFileRequest): Promise<CommitResult>;
  createBranch(req: CreateBranchRequest): Promise<void>;
  getBranchSha(owner: string, repo: string, branch: string): Promise<string>;
  createPullRequest(req: CreatePullRequestRequest): Promise<PullRequestResult>;
}

/** Create a repository client for the given provider */
export function createRepoClient(provider: RepoProviderId): RepoClient {
  switch (provider) {
    case 'github':
      return {
        listRepos: github.listRepos,
        listBranches: github.listBranches,
        getDefaultBranch: github.getDefaultBranch,
        listTree: github.listTree,
        searchLocaleFiles: github.searchLocaleFiles,
        getFileContent: github.getFileContent,
        commitFile: github.commitFile,
        createBranch: github.createBranch,
        getBranchSha: github.getBranchSha,
        createPullRequest: github.createPullRequest,
      };
    case 'gitlab':
      return {
        listRepos: gitlab.listRepos,
        listBranches: gitlab.listBranches,
        getDefaultBranch: gitlab.getDefaultBranch,
        listTree: gitlab.listTree,
        searchLocaleFiles: gitlab.searchLocaleFiles,
        getFileContent: gitlab.getFileContent,
        commitFile: gitlab.commitFile,
        createBranch: gitlab.createBranch,
        getBranchSha: gitlab.getBranchSha,
        createPullRequest: gitlab.createPullRequest,
      };
    default:
      throw new Error(`Unknown repo provider: ${provider}`);
  }
}
