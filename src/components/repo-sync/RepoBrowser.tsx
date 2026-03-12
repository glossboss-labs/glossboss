/**
 * Repository File Browser
 *
 * Browsable file tree for selecting locale files from a repository.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Stack,
  Group,
  Text,
  Select,
  ActionIcon,
  Loader,
  Paper,
  Badge,
  UnstyledButton,
  Breadcrumbs,
  Anchor,
  Alert,
} from '@mantine/core';
import { Folder, FileText, ChevronLeft, AlertCircle, RefreshCw } from 'lucide-react';
import type { RepoClient } from '@/lib/repo-sync/client';
import type { RepoBranch, RepoTreeEntry } from '@/lib/repo-sync/types';
import { isLocaleFile } from '@/lib/repo-sync/types';
import { useTranslation } from '@/lib/app-language';

interface RepoBrowserProps {
  client: RepoClient;
  owner: string;
  repo: string;
  onFileSelect: (branch: string, path: string, defaultBranch: string) => void;
}

export function RepoBrowser({ client, owner, repo, onFileSelect }: RepoBrowserProps) {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<RepoBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [defaultBranch, setDefaultBranch] = useState<string>('main');
  const [entries, setEntries] = useState<RepoTreeEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelBranchesRef = useRef<(() => void) | null>(null);
  const cancelTreeRef = useRef<(() => void) | null>(null);

  const loadBranches = useCallback(() => {
    cancelBranchesRef.current?.();
    let cancelled = false;
    cancelBranchesRef.current = () => {
      cancelled = true;
    };
    setLoading(true);
    setError(null);

    client
      .listBranches(owner, repo)
      .then((result) => {
        if (cancelled) return;
        setBranches(result);
        const def = result.find((b) => b.isDefault);
        const branchName = def?.name ?? result[0]?.name ?? 'main';
        setSelectedBranch(branchName);
        if (def) setDefaultBranch(def.name);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err instanceof Error ? err.message : err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
  }, [client, owner, repo]);

  // Load branches on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => loadBranches());
    return () => {
      cancelAnimationFrame(id);
      cancelBranchesRef.current?.();
    };
  }, [loadBranches]);

  const loadTree = useCallback(
    (branch: string, path: string) => {
      cancelTreeRef.current?.();
      let cancelled = false;
      cancelTreeRef.current = () => {
        cancelled = true;
      };
      setLoading(true);
      setError(null);

      client
        .listTree(owner, repo, branch, path)
        .then((result) => {
          if (cancelled) return;
          const sorted = [...result].sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
          setEntries(sorted);
        })
        .catch((err) => {
          if (!cancelled) setError(String(err instanceof Error ? err.message : err));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    },
    [client, owner, repo],
  );

  // Load tree when branch or path changes
  useEffect(() => {
    if (!selectedBranch) return;
    // Schedule via microtask to avoid synchronous setState in effect body
    const id = requestAnimationFrame(() => loadTree(selectedBranch, currentPath));
    return () => {
      cancelAnimationFrame(id);
      cancelTreeRef.current?.();
    };
  }, [selectedBranch, currentPath, loadTree]);

  const handleEntryClick = useCallback(
    (entry: RepoTreeEntry) => {
      if (entry.type === 'directory') {
        setCurrentPath(entry.path);
      } else if (isLocaleFile(entry.name) && selectedBranch) {
        onFileSelect(selectedBranch, entry.path, defaultBranch);
      }
    },
    [selectedBranch, defaultBranch, onFileSelect],
  );

  const navigateUp = useCallback(() => {
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  }, [currentPath]);

  const navigateToSegment = useCallback((index: number) => {
    setCurrentPath((prev) => {
      const parts = prev.split('/');
      return parts.slice(0, index + 1).join('/');
    });
  }, []);

  const branchOptions = branches.map((b) => ({
    value: b.name,
    label: `${b.name}${b.isDefault ? ` (${t('default')})` : ''}`,
  }));

  const pathParts = currentPath ? currentPath.split('/') : [];

  return (
    <Stack gap="sm">
      <Group gap="sm">
        <Select
          data={branchOptions}
          value={selectedBranch}
          onChange={setSelectedBranch}
          placeholder={t('Select branch')}
          searchable
          style={{ flex: 1 }}
          size="sm"
        />
        <ActionIcon
          variant="subtle"
          onClick={() => {
            // Force reload
            setEntries([]);
            setCurrentPath(currentPath);
          }}
          aria-label={t('Refresh')}
        >
          <RefreshCw size={16} />
        </ActionIcon>
      </Group>

      {/* Breadcrumb navigation */}
      <Group gap={4}>
        <Breadcrumbs separator="/">
          <Anchor size="sm" onClick={() => setCurrentPath('')} style={{ cursor: 'pointer' }}>
            {repo}
          </Anchor>
          {pathParts.map((part, i) => (
            <Anchor
              key={i}
              size="sm"
              onClick={() => navigateToSegment(i)}
              style={{ cursor: 'pointer' }}
            >
              {part}
            </Anchor>
          ))}
        </Breadcrumbs>
      </Group>

      {error && (
        <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      {loading ? (
        <Stack align="center" py="xl">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            {t('Loading...')}
          </Text>
        </Stack>
      ) : (
        <Paper withBorder style={{ maxHeight: 400, overflow: 'auto' }}>
          <Stack gap={0}>
            {currentPath && (
              <UnstyledButton
                onClick={navigateUp}
                p="xs"
                style={{
                  borderBottom: '1px solid var(--mantine-color-default-border)',
                }}
              >
                <Group gap="xs">
                  <ChevronLeft size={16} style={{ color: 'var(--gb-text-secondary)' }} />
                  <Text size="sm" c="dimmed">
                    ..
                  </Text>
                </Group>
              </UnstyledButton>
            )}

            {entries.length === 0 && !loading && (
              <Text size="sm" c="dimmed" p="md" ta="center">
                {t('No files found')}
              </Text>
            )}

            {entries.map((entry) => {
              const isLocale = entry.type === 'file' && isLocaleFile(entry.name);
              return (
                <UnstyledButton
                  key={entry.path}
                  onClick={() => handleEntryClick(entry)}
                  p="xs"
                  style={{
                    borderBottom: '1px solid var(--mantine-color-default-border)',
                    opacity: entry.type === 'file' && !isLocale ? 0.5 : 1,
                    cursor: entry.type === 'file' && !isLocale ? 'default' : 'pointer',
                  }}
                  disabled={entry.type === 'file' && !isLocale}
                >
                  <Group gap="xs" justify="space-between">
                    <Group gap="xs">
                      {entry.type === 'directory' ? (
                        <Folder size={16} style={{ color: 'var(--gb-text-secondary)' }} />
                      ) : (
                        <FileText
                          size={16}
                          style={{
                            color: isLocale
                              ? 'var(--mantine-color-blue-6)'
                              : 'var(--gb-text-secondary)',
                          }}
                        />
                      )}
                      <Text size="sm" fw={isLocale ? 500 : undefined}>
                        {entry.name}
                      </Text>
                    </Group>

                    {isLocale && (
                      <Badge size="xs" variant="light" color="blue">
                        {entry.name.split('.').pop()}
                      </Badge>
                    )}

                    {entry.type === 'directory' && (
                      <Text size="xs" c="dimmed">
                        &rsaquo;
                      </Text>
                    )}
                  </Group>
                </UnstyledButton>
              );
            })}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
