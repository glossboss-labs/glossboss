/**
 * Commit Panel
 *
 * UI for committing changes back to a repository and creating pull requests.
 */

import { useState, useCallback } from 'react';
import {
  Stack,
  TextInput,
  Textarea,
  Button,
  Group,
  Text,
  Alert,
  Switch,
  Divider,
  Badge,
  Paper,
  Code,
  Anchor,
} from '@mantine/core';
import { GitBranch, GitPullRequest, AlertCircle, Check, ExternalLink } from 'lucide-react';
import type { RepoClient } from '@/lib/repo-sync/client';
import type { RepoConnection, CommitResult, PullRequestResult } from '@/lib/repo-sync/types';
import { useTranslation } from '@/lib/app-language';
import { useRepoSyncStore } from '@/stores';

interface CommitPanelProps {
  client: RepoClient;
  connection: RepoConnection;
  serializedContent: string;
  onCommitSuccess: (result: CommitResult, newBranch?: string) => void;
  onPrSuccess: (result: PullRequestResult) => void;
}

export function CommitPanel({
  client,
  connection,
  serializedContent,
  onCommitSuccess,
  onPrSuccess,
}: CommitPanelProps) {
  const { t } = useTranslation();
  const syncSettings = useRepoSyncStore((s) => s.syncSettings);

  const filename = connection.filePath.split('/').pop() ?? 'translations';
  const fileStem = filename.replace(/\.[^.]+$/, '');
  const prefix = syncSettings.commitPrefix ? `${syncSettings.commitPrefix} ` : '';

  const [commitMessage, setCommitMessage] = useState(`${prefix}update ${filename} translations`);
  const [createNewBranch, setCreateNewBranch] = useState(
    syncSettings.createNewBranch || connection.branch === connection.defaultBranch,
  );
  const [newBranchName, setNewBranchName] = useState(
    syncSettings.branchTemplate.replace('{{file}}', fileStem),
  );
  const [createPr, setCreatePr] = useState(syncSettings.createPr);
  const [prTitle, setPrTitle] = useState(`${prefix}update ${filename} translations`);
  const [prBody, setPrBody] = useState(syncSettings.prBody);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [prResult, setPrResult] = useState<PullRequestResult | null>(null);

  const isOnDefaultBranch = connection.branch === connection.defaultBranch;

  const handleCommit = useCallback(async () => {
    setSaving(true);
    setError(null);
    setCommitResult(null);
    setPrResult(null);

    try {
      let targetBranch = connection.branch;

      // Create a new branch if requested
      if (createNewBranch) {
        const fromSha = await client.getBranchSha(
          connection.owner,
          connection.repo,
          connection.branch,
        );
        await client.createBranch({
          owner: connection.owner,
          repo: connection.repo,
          branchName: newBranchName,
          fromSha,
        });
        targetBranch = newBranchName;
      }

      // Commit the file
      const result = await client.commitFile({
        owner: connection.owner,
        repo: connection.repo,
        branch: targetBranch,
        filePath: connection.filePath,
        content: serializedContent,
        message: commitMessage,
        sha: connection.baseSha,
      });

      setCommitResult(result);
      onCommitSuccess(result, createNewBranch ? newBranchName : undefined);

      // Create PR if requested
      if (createPr && (createNewBranch || !isOnDefaultBranch)) {
        const prResult = await client.createPullRequest({
          owner: connection.owner,
          repo: connection.repo,
          title: prTitle,
          body: prBody,
          head: targetBranch,
          base: connection.defaultBranch,
        });
        setPrResult(prResult);
        onPrSuccess(prResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [
    client,
    connection,
    serializedContent,
    commitMessage,
    createNewBranch,
    newBranchName,
    createPr,
    prTitle,
    prBody,
    isOnDefaultBranch,
    onCommitSuccess,
    onPrSuccess,
  ]);

  // Show results if already committed
  if (commitResult) {
    return (
      <Stack gap="md">
        <Alert icon={<Check size={16} />} color="green" variant="light">
          <Text size="sm" fw={500}>
            {t('Changes committed successfully')}
          </Text>
          <Anchor href={commitResult.url} target="_blank" rel="noopener noreferrer" size="sm">
            {t('View commit')} <ExternalLink size={12} style={{ display: 'inline' }} />
          </Anchor>
        </Alert>

        {prResult && (
          <Alert icon={<GitPullRequest size={16} />} color="blue" variant="light">
            <Text size="sm" fw={500}>
              {t('Pull request created: #{{number}}', { number: prResult.number })}
            </Text>
            <Anchor href={prResult.url} target="_blank" rel="noopener noreferrer" size="sm">
              {prResult.title} <ExternalLink size={12} style={{ display: 'inline' }} />
            </Anchor>
          </Alert>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {/* Commit target info */}
      <Paper p="sm" withBorder>
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            {t('Repository:')}
          </Text>
          <Code>
            {connection.owner}/{connection.repo}
          </Code>
        </Group>
        <Group gap="xs" mt={4}>
          <Text size="sm" c="dimmed">
            {t('File:')}
          </Text>
          <Code>{connection.filePath}</Code>
        </Group>
        <Group gap="xs" mt={4}>
          <Text size="sm" c="dimmed">
            {t('Branch:')}
          </Text>
          <Badge variant="light" leftSection={<GitBranch size={12} />}>
            {connection.branch}
          </Badge>
        </Group>
      </Paper>

      {/* Commit message */}
      <TextInput
        label={t('Commit message')}
        value={commitMessage}
        onChange={(e) => setCommitMessage(e.currentTarget.value)}
        placeholder={t('Update translations')}
      />

      {/* New branch option */}
      <Switch
        label={t('Create new branch')}
        description={
          isOnDefaultBranch
            ? t("You're on the default branch — creating a new branch is recommended")
            : t('Create a feature branch for these changes')
        }
        checked={createNewBranch}
        onChange={(e) => setCreateNewBranch(e.currentTarget.checked)}
      />

      {createNewBranch && (
        <TextInput
          label={t('Branch name')}
          value={newBranchName}
          onChange={(e) => setNewBranchName(e.currentTarget.value)}
          placeholder="glossboss/update-translations"
          leftSection={<GitBranch size={16} />}
        />
      )}

      {/* PR option */}
      {(createNewBranch || !isOnDefaultBranch) && (
        <>
          <Divider />

          <Switch
            label={t('Create pull request')}
            description={t('Open a PR targeting {{branch}}', {
              branch: connection.defaultBranch,
            })}
            checked={createPr}
            onChange={(e) => setCreatePr(e.currentTarget.checked)}
          />

          {createPr && (
            <Stack gap="sm">
              <TextInput
                label={t('PR title')}
                value={prTitle}
                onChange={(e) => setPrTitle(e.currentTarget.value)}
              />
              <Textarea
                label={t('PR description')}
                value={prBody}
                onChange={(e) => setPrBody(e.currentTarget.value)}
                minRows={3}
                autosize
              />
            </Stack>
          )}
        </>
      )}

      {error && (
        <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      <Button
        onClick={() => void handleCommit()}
        loading={saving}
        disabled={!commitMessage.trim() || (createNewBranch && !newBranchName.trim())}
        leftSection={<GitBranch size={16} />}
      >
        {createPr && (createNewBranch || !isOnDefaultBranch)
          ? t('Commit & create PR')
          : t('Commit changes')}
      </Button>
    </Stack>
  );
}
