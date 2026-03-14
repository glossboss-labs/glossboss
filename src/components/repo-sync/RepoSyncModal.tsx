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
  hasGitHubToken,
  isGitHubPersistEnabled,
  setGitHubPersistEnabled,
} from '@/lib/github';
import { hasAnyGitHubToken, hasGitHubOAuthToken, clearGitHubOAuthToken } from '@/lib/github/token';
import {
  getGitLabSettings,
  saveGitLabSettings,
  clearGitLabSettings,
  hasGitLabToken,
  isGitLabPersistEnabled,
  setGitLabPersistEnabled,
} from '@/lib/gitlab';
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
import { useAuth } from '@/hooks/use-auth';
import { signInWithGitHub } from '@/lib/auth/session';
import { RepoBrowser } from './RepoBrowser';
import { CommitPanel } from './CommitPanel';
import { useTranslation } from '@/lib/app-language';

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
  loadingRepos: boolean;
}

function GitHubConnectSection({
  ghToken,
  onGhTokenChange,
  ghPersist,
  onGhPersistChange,
  onLoadRepos,
  loadingRepos,
}: GitHubConnectSectionProps) {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const [showPatFallback, setShowPatFallback] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const isGitHubUser = user?.app_metadata?.provider === 'github';
  const hasOAuth = hasGitHubOAuthToken();
  const hasPat = hasGitHubToken();

  // If connected via OAuth, show connected state
  if (hasOAuth || hasPat) {
    const label = hasOAuth
      ? isGitHubUser && user?.user_metadata?.user_name
        ? `@${user.user_metadata.user_name}`
        : 'GitHub'
      : t('Personal access token');

    return (
      <Stack gap="sm">
        <Paper p="sm" withBorder>
          <Group justify="space-between">
            <Group gap="xs">
              <Badge size="sm" variant="dot" color="green">
                {t('Connected')}
              </Badge>
              <Text size="sm" fw={hasOAuth ? 500 : undefined} c={hasOAuth ? undefined : 'dimmed'}>
                {label}
              </Text>
            </Group>
            <Button
              variant="subtle"
              size="compact-sm"
              onClick={async () => {
                setSigningIn(true);
                await signInWithGitHub();
              }}
              loading={signingIn}
            >
              {t('Switch account')}
            </Button>
          </Group>
        </Paper>

        <Button onClick={onLoadRepos} loading={loadingRepos}>
          {t('Connect & list repositories')}
        </Button>
      </Stack>
    );
  }

  // Not connected — show OAuth sign-in primary, PAT fallback
  return (
    <Stack gap="sm">
      {isAuthenticated && isGitHubUser ? (
        <Alert variant="light" color="blue">
          <Text size="sm">
            {t(
              'You signed in with GitHub but the repo access token has expired. Sign in again to reconnect.',
            )}
          </Text>
        </Alert>
      ) : null}

      <Button
        fullWidth
        leftSection={
          <svg viewBox="0 0 98 96" width={16} height={16} fill="currentColor">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
            />
          </svg>
        }
        loading={signingIn}
        onClick={async () => {
          setSigningIn(true);
          await signInWithGitHub();
          // OAuth redirect will handle the rest
        }}
      >
        {t('Continue with GitHub')}
      </Button>

      <Divider label={t('or')} labelPosition="center" />

      <UnstyledButton onClick={() => setShowPatFallback(!showPatFallback)}>
        <Group gap={4}>
          {showPatFallback ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Text size="sm" c="dimmed">
            {t('Use a personal access token')}
          </Text>
        </Group>
      </UnstyledButton>

      {showPatFallback && (
        <Stack gap="sm">
          <PasswordInput
            label={t('Personal access token')}
            description={
              <>
                <Anchor
                  href="https://github.com/settings/tokens/new?description=GlossBoss&scopes=repo"
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                >
                  {t('Create a token with repo scope pre-selected')}{' '}
                  <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />
                </Anchor>
                <br />
                <Text component="span" size="xs" c="dimmed">
                  {t(
                    'Your token is sent directly to the GitHub API from your browser and is never stored on our servers.',
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
        </Stack>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/*  RepoSyncModal                                                      */
/* ------------------------------------------------------------------ */

interface RepoSyncModalProps {
  opened: boolean;
  onClose: () => void;
  /** Called when a file is loaded from a repository */
  onFileLoaded: (content: string, filename: string) => void;
  /** Serialized file content for pushing (null when no file loaded) */
  serializedContent: string | null;
  /** Initial tab to show */
  initialTab?: ModalTab;
}

export function RepoSyncModal({
  opened,
  onClose,
  onFileLoaded,
  serializedContent,
  initialTab,
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
    if (hasAnyGitHubToken() || hasGitLabToken()) return 'browse';
    return 'connect';
  };

  const [activeTab, setActiveTab] = useState<string | null>(defaultTab);
  const [showSettings, setShowSettings] = useState(false);

  // Provider selection — restore from active connection
  const [provider, setProvider] = useState<RepoProviderId>(
    () => connection?.provider ?? (hasGitLabToken() && !hasGitHubToken() ? 'gitlab' : 'github'),
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

  const hasToken = provider === 'github' ? hasAnyGitHubToken() : hasGitLabToken();
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
    const tokenAvailable = provider === 'github' ? hasAnyGitHubToken() : hasGitLabToken();
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
      setGlToken('');
    }
    setRepos([]);
    setSelectedRepo(null);
  }, [provider]);

  const handleLoadRepos = useCallback(async () => {
    // Save PAT settings if a PAT was entered (skip for OAuth-only)
    if (provider === 'github' ? ghToken.trim() : true) {
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
  }, [provider, ghToken, handleSaveToken, connection]);

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

        // Filter out common non-locale JSON files (package.json, tsconfig, etc.)
        const filtered = files.filter((f) => {
          const name = f.name.toLowerCase();
          if (!name.endsWith('.json')) return true;
          // Skip common config/meta JSON files
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
      } catch (err) {
        setScanError(err instanceof Error ? err.message : String(err));
      } finally {
        setScanningFiles(false);
      }
    },
    [repos, provider, connection],
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
        onFileLoaded(fileContent.content, path.split('/').pop() ?? path);
        onClose();
      } catch (err) {
        setFileError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingFile(false);
      }
    },
    [selectedRepo, repos, provider, connection, setConnection, onFileLoaded, onClose],
  );

  const handleFileSelect = useCallback(
    async (branch: string, path: string, defaultBranch: string) => {
      if (!selectedRepo) return;

      const [owner, repo] = selectedRepo.split('/');
      if (!owner || !repo) return;

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
        onFileLoaded(fileContent.content, path.split('/').pop() ?? path);
        onClose();
      } catch (err) {
        setFileError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingFile(false);
      }
    },
    [selectedRepo, provider, setConnection, onFileLoaded, onClose],
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
          <Text fw={600}>{t('Repository sync')}</Text>
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
          {connection && serializedContent && (
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
                loadingRepos={loadingRepos}
              />
            ) : (
              <Stack gap="sm">
                <TextInput
                  label={t('GitLab instance URL')}
                  value={glInstanceUrl}
                  onChange={(e) => setGlInstanceUrl(e.currentTarget.value)}
                  placeholder="https://gitlab.com"
                />
                <PasswordInput
                  label={t('Personal access token')}
                  description={
                    <>
                      <Anchor
                        href={`${glInstanceUrl.replace(/\/+$/, '')}/-/user_settings/personal_access_tokens?name=GlossBoss&scopes=api`}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="xs"
                      >
                        {t('Create a token')}{' '}
                        <ExternalLink
                          size={10}
                          style={{ display: 'inline', verticalAlign: 'middle' }}
                        />
                      </Anchor>{' '}
                      {t('with api scope')}
                      <br />
                      <Text component="span" size="xs" c="dimmed">
                        {t(
                          'Your token is sent directly to the GitLab API from your browser and is never stored on our servers.',
                        )}
                      </Text>
                    </>
                  }
                  value={glToken}
                  onChange={(e) => setGlToken(e.currentTarget.value)}
                  placeholder="glpat-..."
                />
                <Switch
                  label={t('Remember token')}
                  description={t('Store in localStorage (persists across sessions)')}
                  checked={glPersist}
                  onChange={(e) => setGlPersist(e.currentTarget.checked)}
                  size="sm"
                />
              </Stack>
            )}

            {repoError && (
              <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
                {repoError}
              </Alert>
            )}

            {/* For GitLab, show the connect button here (GitHub uses its own section) */}
            {provider === 'gitlab' && (
              <Group>
                <Button
                  onClick={() => void handleLoadRepos()}
                  loading={loadingRepos}
                  disabled={!glToken.trim()}
                >
                  {t('Connect & list repositories')}
                </Button>
                {hasToken && (
                  <Button variant="subtle" color="red" onClick={handleClearToken}>
                    {t('Clear token')}
                  </Button>
                )}
              </Group>
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

        {/* Push tab */}
        {connection && serializedContent && (
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
