/**
 * Repository Sync Modal
 *
 * Main modal for connecting to GitHub/GitLab repositories,
 * browsing files, and pushing changes back.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
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
} from '@mantine/core';
import { GitBranch, Key, FolderOpen, Upload, AlertCircle, ExternalLink } from 'lucide-react';
import {
  getGitHubSettings,
  saveGitHubSettings,
  clearGitHubSettings,
  hasGitHubToken,
  isGitHubPersistEnabled,
  setGitHubPersistEnabled,
} from '@/lib/github';
import {
  getGitLabSettings,
  saveGitLabSettings,
  clearGitLabSettings,
  hasGitLabToken,
  isGitLabPersistEnabled,
  setGitLabPersistEnabled,
} from '@/lib/gitlab';
import { createRepoClient } from '@/lib/repo-sync/client';
import type { RepoProviderId, RepoConnection, CommitResult } from '@/lib/repo-sync/types';
import { useRepoSyncStore } from '@/stores';
import { RepoBrowser } from './RepoBrowser';
import { CommitPanel } from './CommitPanel';
import { useTranslation } from '@/lib/app-language';

type ModalTab = 'connect' | 'browse' | 'push';

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

  const [activeTab, setActiveTab] = useState<string | null>(initialTab ?? 'connect');

  // Provider selection
  const [provider, setProvider] = useState<RepoProviderId>('github');

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

  // File loading
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const hasToken = provider === 'github' ? hasGitHubToken() : hasGitLabToken();

  // Reset when modal opens
  useEffect(() => {
    if (opened) {
      setGhToken(getGitHubSettings().token);
      setGlToken(getGitLabSettings().token);
      setGlInstanceUrl(getGitLabSettings().instanceUrl);
      setGhPersist(isGitHubPersistEnabled());
      setGlPersist(isGitLabPersistEnabled());
      if (initialTab) setActiveTab(initialTab);
    }
  }, [opened, initialTab]);

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
      setGhToken('');
    } else {
      clearGitLabSettings();
      setGlToken('');
    }
    setRepos([]);
    setSelectedRepo(null);
  }, [provider]);

  const handleLoadRepos = useCallback(async () => {
    handleSaveToken();
    setLoadingRepos(true);
    setRepoError(null);
    setRepos([]);

    try {
      const client = createRepoClient(provider);
      const result = await client.listRepos(1, 50);
      setRepos(result);
      if (result.length > 0) {
        setActiveTab('browse');
      }
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingRepos(false);
    }
  }, [provider, handleSaveToken]);

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
              <Stack gap="sm">
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
                        {t('Create a fine-grained PAT')}{' '}
                        <ExternalLink
                          size={10}
                          style={{ display: 'inline', verticalAlign: 'middle' }}
                        />
                      </Anchor>{' '}
                      {t('with Contents and Pull requests read/write permissions')}
                    </>
                  }
                  value={ghToken}
                  onChange={(e) => setGhToken(e.currentTarget.value)}
                  placeholder="github_pat_..."
                />
                <Switch
                  label={t('Remember token')}
                  description={t('Store in localStorage (persists across sessions)')}
                  checked={ghPersist}
                  onChange={(e) => setGhPersist(e.currentTarget.checked)}
                  size="sm"
                />
              </Stack>
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

            <Group>
              <Button
                onClick={() => void handleLoadRepos()}
                loading={loadingRepos}
                disabled={provider === 'github' ? !ghToken.trim() : !glToken.trim()}
              >
                {t('Connect & list repositories')}
              </Button>
              {hasToken && (
                <Button variant="subtle" color="red" onClick={handleClearToken}>
                  {t('Clear token')}
                </Button>
              )}
            </Group>
          </Stack>
        </Tabs.Panel>

        {/* Browse tab */}
        <Tabs.Panel value="browse" pt="md">
          <Stack gap="md">
            {repos.length === 0 && !loadingRepos ? (
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
                  onChange={setSelectedRepo}
                  searchable
                  placeholder={t('Select a repository')}
                  nothingFoundMessage={t('No repositories found')}
                />

                {fileError && (
                  <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
                    {fileError}
                  </Alert>
                )}

                {loadingFile && (
                  <Stack align="center" py="md">
                    <Loader size="sm" />
                    <Text size="sm" c="dimmed">
                      {t('Loading file...')}
                    </Text>
                  </Stack>
                )}

                {selectedRepo && selectedRepoEntry && client && !loadingFile && (
                  <RepoBrowser
                    client={client}
                    owner={selectedRepoEntry.owner}
                    repo={selectedRepoEntry.name}
                    onFileSelect={handleFileSelect}
                  />
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
