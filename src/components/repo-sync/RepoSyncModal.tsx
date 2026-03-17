/**
 * Repository Sync Modal
 *
 * Main modal for connecting to GitHub/GitLab repositories,
 * browsing files, and pushing changes back.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  Stack,
  Tabs,
  Group,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Select,
  Alert,
  Switch,
  Loader,
  Anchor,
  Badge,
  Paper,
  UnstyledButton,
  Divider,
} from '@mantine/core';
import {
  GitBranch,
  Key,
  FolderOpen,
  Upload,
  AlertCircle,
  ExternalLink,
  FileText,
  Search,
  Settings,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  getGitHubSettings,
  saveGitHubSettings,
  clearGitHubSettings,
  isGitHubPersistEnabled,
  setGitHubPersistEnabled,
  hasAnyGitHubToken,
  clearGitHubOAuthToken,
  saveGitHubOAuthToken,
  getGitHubTokenType,
} from '@/lib/github';
import {
  getGitLabSettings,
  saveGitLabSettings,
  clearGitLabSettings,
  isGitLabPersistEnabled,
  setGitLabPersistEnabled,
  hasAnyGitLabToken,
  saveGitLabOAuthToken,
  clearGitLabOAuthToken,
  getGitLabTokenType,
} from '@/lib/gitlab';
import { startRepoOAuth } from '@/lib/repo-sync/oauth';
import { createRepoClient } from '@/lib/repo-sync/client';
import type {
  RepoProviderId,
  RepoConnection,
  RepoTreeEntry,
  RepoListEntry,
  CommitResult,
} from '@/lib/repo-sync/types';
import { DEFAULT_SYNC_SETTINGS } from '@/lib/repo-sync/types';
import { useRepoSyncStore } from '@/stores';
import { RepoBrowser } from './RepoBrowser';
import { CommitPanel } from './CommitPanel';
import { useTranslation } from '@/lib/app-language';
import { trackEvent } from '@/lib/analytics';

type ModalTab = 'connect' | 'browse' | 'push';

/* ------------------------------------------------------------------ */
/*  GitHubConnectSection                                               */
/* ------------------------------------------------------------------ */

interface GitHubConnectSectionProps {
  ghToken: string;
  onGhTokenChange: (token: string) => void;
  ghPersist: boolean;
  onGhPersistChange: (persist: boolean) => void;
  onLoadRepos: () => void;
  onOAuthConnect: () => void;
  oauthLoading: boolean;
  oauthError: string | null;
  loadingRepos: boolean;
  onClearToken: () => void;
}

function GitHubConnectSection({
  ghToken,
  onGhTokenChange,
  ghPersist,
  onGhPersistChange,
  onLoadRepos,
  onOAuthConnect,
  oauthLoading,
  oauthError,
  loadingRepos,
  onClearToken,
}: GitHubConnectSectionProps) {
  const { t } = useTranslation();
  const [showPat, setShowPat] = useState(false);
  const tokenType = getGitHubTokenType();

  // Connected — show connected state with auth method
  if (tokenType) {
    return (
      <Stack gap="sm">
        <Paper p="sm" withBorder>
          <Group justify="space-between">
            <Group gap="xs">
              <Badge size="sm" variant="dot" color="green">
                {t('Connected')}
              </Badge>
              <Text size="sm" c="dimmed">
                {tokenType === 'oauth' ? t('GitHub account') : t('Personal access token')}
              </Text>
            </Group>
            <Button variant="subtle" size="xs" color="red" onClick={onClearToken}>
              {t('Disconnect')}
            </Button>
          </Group>
        </Paper>

        <Button onClick={onLoadRepos} loading={loadingRepos}>
          {t('Connect & list repositories')}
        </Button>
      </Stack>
    );
  }

  // Not connected — OAuth + PAT
  return (
    <Stack gap="sm">
      <Button
        variant="default"
        leftSection={
          <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        }
        onClick={onOAuthConnect}
        loading={oauthLoading}
        fullWidth
      >
        {t('Connect with GitHub')}
      </Button>

      {oauthError && (
        <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
          {oauthError}
        </Alert>
      )}

      {!showPat ? (
        <Button variant="subtle" size="xs" c="dimmed" onClick={() => setShowPat(true)}>
          {t('or connect with a personal access token')}
        </Button>
      ) : (
        <>
          <Divider label={t('or use a personal access token')} labelPosition="center" />
          <PasswordInput
            label={t('Personal access token')}
            description={
              <>
                <Anchor
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                >
                  {t('Create a fine-grained token')}{' '}
                  <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />
                </Anchor>
                <Text component="span" size="xs" c="dimmed">
                  {' — '}
                  {t(
                    'select only the repositories you need, with Contents read & write permission.',
                  )}
                </Text>
              </>
            }
            value={ghToken}
            onChange={(e) => onGhTokenChange(e.currentTarget.value)}
            placeholder="github_pat_..."
          />
          <Switch
            label={t('Remember token')}
            description={t('Store in localStorage (persists across sessions)')}
            checked={ghPersist}
            onChange={(e) => onGhPersistChange(e.currentTarget.checked)}
            size="sm"
          />
          <Button onClick={onLoadRepos} loading={loadingRepos} disabled={!ghToken.trim()}>
            {t('Connect & list repositories')}
          </Button>
        </>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/*  GitLabConnectSection                                               */
/* ------------------------------------------------------------------ */

interface GitLabConnectSectionProps {
  glToken: string;
  onGlTokenChange: (token: string) => void;
  glInstanceUrl: string;
  onGlInstanceUrlChange: (url: string) => void;
  glPersist: boolean;
  onGlPersistChange: (persist: boolean) => void;
  onLoadRepos: () => void;
  onOAuthConnect: () => void;
  oauthLoading: boolean;
  oauthError: string | null;
  loadingRepos: boolean;
  onClearToken: () => void;
}

function GitLabConnectSection({
  glToken,
  onGlTokenChange,
  glInstanceUrl,
  onGlInstanceUrlChange,
  glPersist,
  onGlPersistChange,
  onLoadRepos,
  onOAuthConnect,
  oauthLoading,
  oauthError,
  loadingRepos,
  onClearToken,
}: GitLabConnectSectionProps) {
  const { t } = useTranslation();
  const [showPat, setShowPat] = useState(false);
  const tokenType = getGitLabTokenType();
  const isGitLabCom =
    !glInstanceUrl.trim() || /^https?:\/\/(www\.)?gitlab\.com\/?$/i.test(glInstanceUrl.trim());

  // Connected — show connected state
  if (tokenType) {
    return (
      <Stack gap="sm">
        <Paper p="sm" withBorder>
          <Group justify="space-between">
            <Group gap="xs">
              <Badge size="sm" variant="dot" color="green">
                {t('Connected')}
              </Badge>
              <Text size="sm" c="dimmed">
                {tokenType === 'oauth' ? t('GitLab account') : t('Personal access token')}
              </Text>
            </Group>
            <Button variant="subtle" size="xs" color="red" onClick={onClearToken}>
              {t('Disconnect')}
            </Button>
          </Group>
        </Paper>

        <Button onClick={onLoadRepos} loading={loadingRepos}>
          {t('Connect & list repositories')}
        </Button>
      </Stack>
    );
  }

  // Not connected
  return (
    <Stack gap="sm">
      <TextInput
        label={t('GitLab instance URL')}
        value={glInstanceUrl}
        onChange={(e) => onGlInstanceUrlChange(e.currentTarget.value)}
        placeholder="https://gitlab.com"
      />

      {/* OAuth is available for gitlab.com only */}
      {isGitLabCom && (
        <>
          <Button
            variant="default"
            leftSection={
              <svg width={16} height={16} viewBox="0 0 32 32" fill="none">
                <path
                  d="M31.46 12.78l-.04-.12-4.35-11.35a.84.84 0 00-.8-.54.87.87 0 00-.83.57L21.7 11.41H10.3L6.56 1.34a.85.85 0 00-.83-.57.84.84 0 00-.8.54L.58 12.65l-.04.13a6.03 6.03 0 002 6.77l.01.01.04.03 4.94 3.7 2.45 1.85 1.49 1.13a1 1 0 001.16 0l1.49-1.13 2.45-1.85 4.98-3.73.01-.01a6.03 6.03 0 002-6.77z"
                  fill="#E24329"
                />
                <path
                  d="M31.46 12.78l-.04-.12a11.35 11.35 0 00-4.56 2.02l-10.86 8.2 6.94 5.24 4.98-3.73.01-.01a6.03 6.03 0 002-6.77l-1.47-4.83z"
                  fill="#FC6D26"
                />
                <path
                  d="M9.06 28.12l2.45 1.85 1.49 1.13a1 1 0 001.16 0l1.49-1.13 2.45-1.85-6.94-5.24-2.1 5.24z"
                  fill="#FCA326"
                />
                <path
                  d="M5.14 14.68A11.35 11.35 0 00.58 12.66l-.04.13a6.03 6.03 0 002 6.77l.01.01.04.03 4.94 3.7 2.53-5.38-5-3.24z"
                  fill="#FC6D26"
                />
              </svg>
            }
            onClick={onOAuthConnect}
            loading={oauthLoading}
            fullWidth
          >
            {t('Connect with GitLab')}
          </Button>

          {oauthError && (
            <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
              {oauthError}
            </Alert>
          )}
        </>
      )}

      {!showPat && isGitLabCom ? (
        <Button variant="subtle" size="xs" c="dimmed" onClick={() => setShowPat(true)}>
          {t('or connect with a personal access token')}
        </Button>
      ) : (
        <>
          {isGitLabCom && (
            <Divider label={t('or use a personal access token')} labelPosition="center" />
          )}
          <PasswordInput
            label={t('Personal access token')}
            description={
              <>
                <Anchor
                  href={`${glInstanceUrl.replace(/\/+$/, '') || 'https://gitlab.com'}/-/user_settings/personal_access_tokens?name=GlossBoss&scopes=api`}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                >
                  {t('Create a token')}{' '}
                  <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />
                </Anchor>{' '}
                {t('with api scope')}
              </>
            }
            value={glToken}
            onChange={(e) => onGlTokenChange(e.currentTarget.value)}
            placeholder="glpat-..."
          />
          <Switch
            label={t('Remember token')}
            description={t('Store in localStorage (persists across sessions)')}
            checked={glPersist}
            onChange={(e) => onGlPersistChange(e.currentTarget.checked)}
            size="sm"
          />
          <Button onClick={onLoadRepos} loading={loadingRepos} disabled={!glToken.trim()}>
            {t('Connect & list repositories')}
          </Button>
        </>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/*  RepoSyncModal                                                      */
/* ------------------------------------------------------------------ */

/** Result returned in 'pick' mode instead of loading file content. */
export interface RepoFilePickResult {
  provider: RepoProviderId;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  defaultBranch: string;
}

interface RepoSyncModalProps {
  opened: boolean;
  onClose: () => void;
  /** Called when a file is loaded from a repository (sync mode). */
  onFileLoaded: (content: string, filename: string) => void;
  /** Serialized file content for pushing (null when no file loaded). */
  serializedContent: string | null;
  /** Initial tab to show. */
  initialTab?: ModalTab;
  /**
   * 'sync' (default) — full repo sync with content loading and push tab.
   * 'pick' — file picker only: returns repo info + path via onFilePicked, no push tab,
   *   doesn't touch the Zustand repo store.
   */
  mode?: 'sync' | 'pick';
  /** Called when a file is picked in 'pick' mode. */
  onFilePicked?: (result: RepoFilePickResult) => void;
  /** Modal title override (defaults vary by mode). */
  title?: string;
  /** File extension filter for auto-scan in 'pick' mode (e.g. '.csv'). */
  pickFileFilter?: string;
}

export function RepoSyncModal({
  opened,
  onClose,
  onFileLoaded,
  serializedContent,
  initialTab,
  mode = 'sync',
  onFilePicked,
  title: titleOverride,
  pickFileFilter,
}: RepoSyncModalProps) {
  const { t } = useTranslation();
  const connection = useRepoSyncStore((s) => s.connection);
  const setConnection = useRepoSyncStore((s) => s.setConnection);
  const updateBaseSha = useRepoSyncStore((s) => s.updateBaseSha);
  const updateBaseContent = useRepoSyncStore((s) => s.updateBaseContent);
  const updateBranch = useRepoSyncStore((s) => s.updateBranch);
  const syncSettings = useRepoSyncStore((s) => s.syncSettings);
  const setSyncSettings = useRepoSyncStore((s) => s.setSyncSettings);

  // Derive the best default tab from current state
  const defaultTab = (): ModalTab => {
    if (initialTab) return initialTab;
    if (connection && serializedContent) return 'push';
    if (hasAnyGitHubToken() || hasAnyGitLabToken()) return 'browse';
    return 'connect';
  };

  const [activeTab, setActiveTab] = useState<string | null>(defaultTab);
  const [showSettings, setShowSettings] = useState(false);

  // Provider selection — restore from active connection
  const [provider, setProvider] = useState<RepoProviderId>(
    () =>
      connection?.provider ?? (hasAnyGitLabToken() && !hasAnyGitHubToken() ? 'gitlab' : 'github'),
  );

  // Token inputs
  const [ghToken, setGhToken] = useState(() => getGitHubSettings().token);
  const [glToken, setGlToken] = useState(() => getGitLabSettings().token);
  const [glInstanceUrl, setGlInstanceUrl] = useState(() => getGitLabSettings().instanceUrl);
  const [ghPersist, setGhPersist] = useState(() => isGitHubPersistEnabled());
  const [glPersist, setGlPersist] = useState(() => isGitLabPersistEnabled());

  // Repo selection
  const [repos, setRepos] = useState<RepoListEntry[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  // Locale file auto-detection
  const [localeFiles, setLocaleFiles] = useState<RepoTreeEntry[]>([]);
  const [scanningFiles, setScanningFiles] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);

  // File loading
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // OAuth state
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const hasToken = provider === 'github' ? hasAnyGitHubToken() : hasAnyGitLabToken();
  const autoLoadedRef = useRef(false);

  // Refresh token state and set the right tab/provider when modal opens
  useEffect(() => {
    if (opened) {
      setGhToken(getGitHubSettings().token);
      setGlToken(getGitLabSettings().token);
      setGlInstanceUrl(getGitLabSettings().instanceUrl);
      setGhPersist(isGitHubPersistEnabled());
      setGlPersist(isGitLabPersistEnabled());
      // Restore provider from connection
      if (connection?.provider) {
        setProvider(connection.provider);
      }
      setActiveTab(defaultTab());
    } else {
      autoLoadedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  // Auto-load repos when the Browse tab needs them
  useEffect(() => {
    if (!opened || autoLoadedRef.current || loadingRepos) return;
    const tokenAvailable = provider === 'github' ? hasAnyGitHubToken() : hasAnyGitLabToken();
    if (tokenAvailable && repos.length === 0) {
      autoLoadedRef.current = true;
      void handleLoadRepos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, provider]);

  const handleSaveToken = useCallback(() => {
    if (provider === 'github') {
      saveGitHubSettings({ token: ghToken });
      setGitHubPersistEnabled(ghPersist);
    } else {
      saveGitLabSettings({ token: glToken, instanceUrl: glInstanceUrl });
      setGitLabPersistEnabled(glPersist);
    }
  }, [provider, ghToken, glToken, glInstanceUrl, ghPersist, glPersist]);

  const handleClearToken = useCallback(() => {
    if (provider === 'github') {
      clearGitHubSettings();
      clearGitHubOAuthToken();
      setGhToken('');
    } else {
      clearGitLabSettings();
      clearGitLabOAuthToken();
      setGlToken('');
    }
    setRepos([]);
    setSelectedRepo(null);
  }, [provider]);

  const handleLoadRepos = useCallback(async () => {
    // Save PAT settings if a PAT was entered (skip for OAuth-only connections)
    const ghPATEntered = provider === 'github' && ghToken.trim();
    const glPATEntered = provider === 'gitlab' && glToken.trim();
    if (ghPATEntered || glPATEntered) {
      handleSaveToken();
    }
    setLoadingRepos(true);
    setRepoError(null);

    try {
      const client = createRepoClient(provider);
      const result = await client.listRepos(1, 50);
      setRepos(result);
      if (result.length > 0) {
        setActiveTab('browse');
        // Pre-select repo from active connection
        if (connection) {
          const connRepo = `${connection.owner}/${connection.repo}`;
          if (result.some((r) => r.fullName === connRepo)) {
            setSelectedRepo(connRepo);
          }
        }
      }
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingRepos(false);
    }
  }, [provider, ghToken, glToken, handleSaveToken, connection]);

  const handleOAuthConnect = useCallback(async () => {
    setOauthLoading(true);
    setOauthError(null);
    try {
      const result = await startRepoOAuth(provider);
      if (provider === 'github') {
        saveGitHubOAuthToken(result.token);
      } else {
        saveGitLabOAuthToken(result.token);
      }
      trackEvent('repo_oauth_connected', { provider });
      // Auto-load repos after OAuth
      await handleLoadRepos();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message !== 'OAuth flow was cancelled') {
        setOauthError(message);
      }
    } finally {
      setOauthLoading(false);
    }
  }, [provider, handleLoadRepos]);

  /** Auto-scan a repo for locale files on the default branch */
  const handleScanLocaleFiles = useCallback(
    async (repoFullName: string) => {
      const entry = repos.find((r) => r.fullName === repoFullName);
      // Fall back to connection metadata if repos haven't loaded yet
      const [owner, repoName] = repoFullName.split('/');
      const scanOwner = entry?.owner ?? owner;
      const scanRepo = entry?.name ?? repoName;
      const scanBranch = entry?.defaultBranch ?? connection?.defaultBranch ?? 'main';
      if (!scanOwner || !scanRepo) return;

      setScanningFiles(true);
      setScanError(null);
      setLocaleFiles([]);
      setShowBrowser(false);

      try {
        const client = createRepoClient(provider);
        const files = await client.searchLocaleFiles(scanOwner, scanRepo, scanBranch);

        // In pick mode with a file filter, only show matching files
        if (mode === 'pick' && pickFileFilter) {
          const ext = pickFileFilter.toLowerCase();
          setLocaleFiles(files.filter((f) => f.name.toLowerCase().endsWith(ext)));
        } else {
          // Filter out common non-locale JSON files (package.json, tsconfig, etc.)
          const filtered = files.filter((f) => {
            const name = f.name.toLowerCase();
            if (!name.endsWith('.json')) return true;
            const skip = [
              'package.json',
              'package-lock.json',
              'tsconfig',
              'jsconfig',
              '.eslintrc',
              '.prettierrc',
              'composer.json',
              'manifest.json',
              'renovate.json',
              '.babelrc',
            ];
            return !skip.some((s) => name.includes(s));
          });
          setLocaleFiles(filtered);
        }
      } catch (err) {
        setScanError(err instanceof Error ? err.message : String(err));
      } finally {
        setScanningFiles(false);
      }
    },
    [repos, provider, connection, mode, pickFileFilter],
  );

  const handleRepoSelected = useCallback(
    (repoFullName: string | null) => {
      setSelectedRepo(repoFullName);
      setLocaleFiles([]);
      setScanError(null);
      setShowBrowser(false);
      if (repoFullName) {
        void handleScanLocaleFiles(repoFullName);
      }
    },
    [handleScanLocaleFiles],
  );

  /** Handle clicking a locale file from the auto-detected list */
  const handleLocaleFileClick = useCallback(
    async (path: string) => {
      if (!selectedRepo) return;
      const entry = repos.find((r) => r.fullName === selectedRepo);
      // Fall back to connection metadata
      const [ownerFb, repoFb] = selectedRepo.split('/');
      const owner = entry?.owner ?? ownerFb;
      const repoName = entry?.name ?? repoFb;
      const branch = entry?.defaultBranch ?? connection?.defaultBranch ?? 'main';
      if (!owner || !repoName) return;

      // Pick mode: return repo info without loading content or touching the store
      if (mode === 'pick') {
        onFilePicked?.({
          provider,
          owner,
          repo: repoName,
          branch,
          filePath: path,
          defaultBranch: branch,
        });
        onClose();
        return;
      }

      setLoadingFile(true);
      setFileError(null);

      try {
        const client = createRepoClient(provider);
        const fileContent = await client.getFileContent(owner, repoName, branch, path);

        const conn: RepoConnection = {
          provider,
          owner,
          repo: repoName,
          branch,
          filePath: path,
          baseSha: fileContent.sha,
          baseContent: fileContent.content,
          defaultBranch: branch,
        };

        setConnection(conn);
        trackEvent('repo_connected', { provider });
        onFileLoaded(fileContent.content, path.split('/').pop() ?? path);
        onClose();
      } catch (err) {
        setFileError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingFile(false);
      }
    },
    [
      selectedRepo,
      repos,
      provider,
      connection,
      setConnection,
      onFileLoaded,
      onClose,
      mode,
      onFilePicked,
    ],
  );

  const handleFileSelect = useCallback(
    async (branch: string, path: string, defaultBranch: string) => {
      if (!selectedRepo) return;

      const [owner, repo] = selectedRepo.split('/');
      if (!owner || !repo) return;

      // Pick mode: return repo info without loading content or touching the store
      if (mode === 'pick') {
        onFilePicked?.({ provider, owner, repo, branch, filePath: path, defaultBranch });
        onClose();
        return;
      }

      setLoadingFile(true);
      setFileError(null);

      try {
        const client = createRepoClient(provider);
        const fileContent = await client.getFileContent(owner, repo, branch, path);

        const conn: RepoConnection = {
          provider,
          owner,
          repo,
          branch,
          filePath: path,
          baseSha: fileContent.sha,
          baseContent: fileContent.content,
          defaultBranch,
        };

        setConnection(conn);
        trackEvent('repo_connected', { provider });
        onFileLoaded(fileContent.content, path.split('/').pop() ?? path);
        onClose();
      } catch (err) {
        setFileError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingFile(false);
      }
    },
    [selectedRepo, provider, setConnection, onFileLoaded, onClose, mode, onFilePicked],
  );

  const handleCommitSuccess = useCallback(
    (result: CommitResult, newBranch?: string) => {
      updateBaseSha(result.sha);
      if (serializedContent) updateBaseContent(serializedContent);
      if (newBranch) updateBranch(newBranch);
    },
    [updateBaseSha, updateBaseContent, updateBranch, serializedContent],
  );

  const handlePrSuccess = useCallback(() => {
    // PR created — notification shown by CommitPanel
  }, []);

  const client = useMemo(() => {
    try {
      return createRepoClient(provider);
    } catch {
      return null;
    }
  }, [provider]);

  const repoOptions = repos.map((r) => ({
    value: r.fullName,
    label: `${r.fullName}${r.isPrivate ? ' (private)' : ''}`,
  }));

  const selectedRepoEntry = repos.find((r) => r.fullName === selectedRepo);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <GitBranch size={20} />
          <Text fw={600}>
            {titleOverride ??
              (mode === 'pick' ? t('Select file from repository') : t('Repository sync'))}
          </Text>
        </Group>
      }
      size="lg"
    >
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="connect" leftSection={<Key size={14} />}>
            {t('Connect')}
          </Tabs.Tab>
          <Tabs.Tab value="browse" leftSection={<FolderOpen size={14} />} disabled={!hasToken}>
            {t('Browse')}
          </Tabs.Tab>
          {mode !== 'pick' && connection && serializedContent && (
            <Tabs.Tab value="push" leftSection={<Upload size={14} />}>
              {t('Push')}
            </Tabs.Tab>
          )}
        </Tabs.List>

        {/* Connect tab */}
        <Tabs.Panel value="connect" pt="md">
          <Stack gap="md">
            <Select
              label={t('Provider')}
              data={[
                { value: 'github', label: 'GitHub' },
                { value: 'gitlab', label: 'GitLab' },
              ]}
              value={provider}
              onChange={(v) => {
                if (v) setProvider(v as RepoProviderId);
              }}
            />

            {provider === 'github' ? (
              <GitHubConnectSection
                ghToken={ghToken}
                onGhTokenChange={setGhToken}
                ghPersist={ghPersist}
                onGhPersistChange={setGhPersist}
                onLoadRepos={() => void handleLoadRepos()}
                onOAuthConnect={() => void handleOAuthConnect()}
                oauthLoading={oauthLoading}
                oauthError={oauthError}
                loadingRepos={loadingRepos}
                onClearToken={handleClearToken}
              />
            ) : (
              <GitLabConnectSection
                glToken={glToken}
                onGlTokenChange={setGlToken}
                glInstanceUrl={glInstanceUrl}
                onGlInstanceUrlChange={setGlInstanceUrl}
                glPersist={glPersist}
                onGlPersistChange={setGlPersist}
                onLoadRepos={() => void handleLoadRepos()}
                onOAuthConnect={() => void handleOAuthConnect()}
                oauthLoading={oauthLoading}
                oauthError={oauthError}
                loadingRepos={loadingRepos}
                onClearToken={handleClearToken}
              />
            )}

            {repoError && (
              <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
                {repoError}
              </Alert>
            )}
          </Stack>
        </Tabs.Panel>

        {/* Browse tab */}
        <Tabs.Panel value="browse" pt="md">
          <Stack gap="md">
            {/* Active connection summary */}
            {connection && (
              <Paper p="sm" withBorder>
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Group gap="xs">
                      <Badge size="sm" variant="dot" color="green">
                        {t('Connected')}
                      </Badge>
                      <Text size="sm" fw={500}>
                        {connection.owner}/{connection.repo}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <GitBranch size={12} />
                      <Text size="xs" c="dimmed">
                        {connection.branch}
                      </Text>
                      <Text size="xs" c="dimmed">
                        &middot;
                      </Text>
                      <Text size="xs" c="dimmed">
                        {connection.filePath}
                      </Text>
                    </Group>
                  </Stack>
                  <Button
                    variant="subtle"
                    size="xs"
                    color="dimmed"
                    onClick={() => {
                      // Allow browsing for a different file
                      setSelectedRepo(`${connection.owner}/${connection.repo}`);
                      void handleScanLocaleFiles(`${connection.owner}/${connection.repo}`);
                    }}
                  >
                    {t('Change file')}
                  </Button>
                </Group>
              </Paper>
            )}

            {repos.length === 0 && !loadingRepos && !connection ? (
              <Stack align="center" py="xl">
                <Text size="sm" c="dimmed">
                  {t('Connect to a provider first to browse repositories')}
                </Text>
                <Button variant="light" onClick={() => setActiveTab('connect')}>
                  {t('Go to Connect')}
                </Button>
              </Stack>
            ) : (
              <>
                <Select
                  label={t('Repository')}
                  data={repoOptions}
                  value={selectedRepo}
                  onChange={handleRepoSelected}
                  searchable
                  placeholder={t('Select a repository')}
                  nothingFoundMessage={t('No repositories found')}
                />

                {(fileError || scanError) && (
                  <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
                    {fileError || scanError}
                  </Alert>
                )}

                {(loadingFile || scanningFiles) && (
                  <Stack align="center" py="md">
                    <Loader size="sm" />
                    <Text size="sm" c="dimmed">
                      {scanningFiles ? t('Scanning for locale files...') : t('Loading file...')}
                    </Text>
                  </Stack>
                )}

                {/* Auto-detected locale files */}
                {selectedRepo &&
                  !scanningFiles &&
                  !loadingFile &&
                  localeFiles.length > 0 &&
                  !showBrowser && (
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text size="sm" fw={500}>
                          <Search
                            size={14}
                            style={{
                              display: 'inline',
                              verticalAlign: 'middle',
                              marginRight: 4,
                            }}
                          />
                          {t('{{count}} locale files found', { count: localeFiles.length })}
                        </Text>
                        <Button
                          variant="subtle"
                          size="xs"
                          leftSection={<FolderOpen size={12} />}
                          onClick={() => setShowBrowser(true)}
                        >
                          {t('Browse all files')}
                        </Button>
                      </Group>
                      <Paper withBorder style={{ maxHeight: 350, overflow: 'auto' }}>
                        <Stack gap={0}>
                          {localeFiles.map((file) => (
                            <UnstyledButton
                              key={file.path}
                              onClick={() => void handleLocaleFileClick(file.path)}
                              p="xs"
                              style={{
                                borderBottom: '1px solid var(--mantine-color-default-border)',
                              }}
                            >
                              <Group gap="xs" justify="space-between">
                                <Group gap="xs">
                                  <FileText
                                    size={16}
                                    style={{ color: 'var(--mantine-color-blue-6)' }}
                                  />
                                  <Stack gap={0}>
                                    <Text size="sm" fw={500}>
                                      {file.name}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      {file.path}
                                    </Text>
                                  </Stack>
                                </Group>
                                <Badge size="xs" variant="light" color="blue">
                                  {file.name.split('.').pop()}
                                </Badge>
                              </Group>
                            </UnstyledButton>
                          ))}
                        </Stack>
                      </Paper>
                    </Stack>
                  )}

                {/* No locale files found */}
                {selectedRepo &&
                  !scanningFiles &&
                  !loadingFile &&
                  localeFiles.length === 0 &&
                  !scanError &&
                  !showBrowser && (
                    <Stack align="center" gap="sm" py="md">
                      <Text size="sm" c="dimmed">
                        {t('No locale files detected automatically')}
                      </Text>
                      <Button
                        variant="light"
                        size="sm"
                        leftSection={<FolderOpen size={14} />}
                        onClick={() => setShowBrowser(true)}
                      >
                        {t('Browse files manually')}
                      </Button>
                    </Stack>
                  )}

                {/* Sync settings — shown when a repo is selected */}
                {selectedRepo && !scanningFiles && !loadingFile && (
                  <>
                    <Divider />
                    <UnstyledButton
                      onClick={() => setShowSettings((v) => !v)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Settings size={14} />
                      <Text size="sm" fw={500}>
                        {t('Push settings')}
                      </Text>
                      {showSettings ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </UnstyledButton>

                    {showSettings && (
                      <Paper p="sm" withBorder>
                        <Stack gap="sm">
                          <TextInput
                            label={t('Commit prefix')}
                            description={t(
                              'Conventional commit prefix prepended to commit messages, e.g. fix(i18n):',
                            )}
                            value={syncSettings.commitPrefix}
                            onChange={(e) =>
                              setSyncSettings({ commitPrefix: e.currentTarget.value })
                            }
                            placeholder={DEFAULT_SYNC_SETTINGS.commitPrefix}
                            size="sm"
                          />
                          <TextInput
                            label={t('Branch template')}
                            description={t(
                              '{{file}} is replaced with the filename without extension',
                            )}
                            value={syncSettings.branchTemplate}
                            onChange={(e) =>
                              setSyncSettings({ branchTemplate: e.currentTarget.value })
                            }
                            placeholder={DEFAULT_SYNC_SETTINGS.branchTemplate}
                            size="sm"
                          />
                          <Switch
                            label={t('Create new branch')}
                            description={t('Push to a new branch instead of the default branch')}
                            checked={syncSettings.createNewBranch}
                            onChange={(e) =>
                              setSyncSettings({ createNewBranch: e.currentTarget.checked })
                            }
                            size="sm"
                          />
                          <Switch
                            label={t('Create pull request')}
                            description={t('Automatically open a PR after committing')}
                            checked={syncSettings.createPr}
                            onChange={(e) => setSyncSettings({ createPr: e.currentTarget.checked })}
                            size="sm"
                          />
                        </Stack>
                      </Paper>
                    )}
                  </>
                )}

                {/* Manual file browser fallback */}
                {selectedRepo &&
                  selectedRepoEntry &&
                  client &&
                  !loadingFile &&
                  !scanningFiles &&
                  showBrowser && (
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text size="sm" fw={500}>
                          {t('File browser')}
                        </Text>
                        {localeFiles.length > 0 && (
                          <Button variant="subtle" size="xs" onClick={() => setShowBrowser(false)}>
                            {t('Back to detected files')}
                          </Button>
                        )}
                      </Group>
                      <RepoBrowser
                        client={client}
                        owner={selectedRepoEntry.owner}
                        repo={selectedRepoEntry.name}
                        onFileSelect={handleFileSelect}
                      />
                    </Stack>
                  )}
              </>
            )}
          </Stack>
        </Tabs.Panel>

        {/* Push tab (hidden in pick mode) */}
        {mode !== 'pick' && connection && serializedContent && (
          <Tabs.Panel value="push" pt="md">
            {client ? (
              <CommitPanel
                client={client}
                connection={connection}
                serializedContent={serializedContent}
                onCommitSuccess={handleCommitSuccess}
                onPrSuccess={handlePrSuccess}
              />
            ) : (
              <Alert icon={<AlertCircle size={16} />} color="orange" variant="light">
                {t('Token not configured. Go to Connect tab to set up authentication.')}
              </Alert>
            )}
          </Tabs.Panel>
        )}
      </Tabs>
    </Modal>
  );
}
