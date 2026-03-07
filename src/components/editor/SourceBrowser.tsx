/**
 * Reusable source browser for navigating plugin files from the source store.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Anchor,
  Breadcrumbs,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { ChevronRight, File, Folder } from 'lucide-react';
import { getEffectiveSlug, useSourceStore } from '@/stores/source-store';
import { SourceCodeViewer } from './SourceCodeViewer';

interface SourceBrowserProps {
  listingMaxHeight?: number;
  viewerMaxHeight?: number;
}

export function SourceBrowser({
  listingMaxHeight = 400,
  viewerMaxHeight = 400,
}: SourceBrowserProps) {
  const {
    directoryTree,
    browsingPath,
    isLoadingDirectory,
    directoryError,
    fetchDirectory,
    fetchSource,
    sourceContent,
    isLoadingSource,
  } = useSourceStore();
  const slug = useSourceStore((state) => getEffectiveSlug(state));
  const [viewingFile, setViewingFile] = useState<string | null>(null);

  useEffect(() => {
    if (slug && !directoryTree) {
      fetchDirectory('');
    }
  }, [slug, directoryTree, fetchDirectory]);

  const breadcrumbParts = browsingPath ? browsingPath.split('/').filter(Boolean) : [];

  const handleNavigate = useCallback(
    (path: string) => {
      setViewingFile(null);
      fetchDirectory(path);
    },
    [fetchDirectory],
  );

  const handleFileClick = useCallback(
    (filePath: string) => {
      setViewingFile(filePath);
      fetchSource(filePath);
    },
    [fetchSource],
  );

  if (!slug) {
    return (
      <Text size="sm" c="dimmed" p="md" ta="center">
        Set a plugin slug to browse source files.
      </Text>
    );
  }

  return (
    <Stack gap={0}>
      <Group
        gap="xs"
        p="xs"
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        <Breadcrumbs separator={<ChevronRight size={12} />}>
          <Anchor size="sm" onClick={() => handleNavigate('')}>
            {slug}
          </Anchor>
          {breadcrumbParts.map((part, i) => {
            const path = breadcrumbParts.slice(0, i + 1).join('/');
            return (
              <Anchor key={path} size="sm" onClick={() => handleNavigate(path)}>
                {part}
              </Anchor>
            );
          })}
        </Breadcrumbs>
      </Group>

      {isLoadingDirectory && (
        <Group justify="center" p="md">
          <Loader size="sm" />
        </Group>
      )}

      {!isLoadingDirectory && !viewingFile && directoryTree && (
        <ScrollArea mah={listingMaxHeight} type="auto">
          <Stack gap={0}>
            {directoryTree.map((entry) => (
              <UnstyledButton
                key={entry.name}
                onClick={() =>
                  entry.isDir
                    ? handleNavigate(browsingPath ? `${browsingPath}/${entry.name}` : entry.name)
                    : handleFileClick(browsingPath ? `${browsingPath}/${entry.name}` : entry.name)
                }
                p="xs"
                style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = 'var(--mantine-color-default-hover)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Group gap="xs">
                  {entry.isDir ? (
                    <Folder size={14} style={{ color: 'var(--mantine-color-blue-text)' }} />
                  ) : (
                    <File size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  )}
                  <Text size="sm">{entry.name}</Text>
                </Group>
              </UnstyledButton>
            ))}
            {directoryTree.length === 0 && (
              <Text size="sm" c="dimmed" p="md" ta="center">
                Empty directory
              </Text>
            )}
          </Stack>
        </ScrollArea>
      )}

      {!isLoadingDirectory && !viewingFile && !directoryTree && (
        <Text size="sm" c="dimmed" p="md" ta="center">
          {directoryError ?? 'Directory listing is unavailable.'}
        </Text>
      )}

      {viewingFile && (
        <Stack gap={0}>
          <Group gap="xs" p="xs" justify="space-between">
            <Anchor size="sm" onClick={() => setViewingFile(null)}>
              Back to listing
            </Anchor>
          </Group>
          {isLoadingSource ? (
            <Group justify="center" p="md">
              <Loader size="sm" />
            </Group>
          ) : sourceContent ? (
            <SourceCodeViewer
              content={sourceContent}
              targetLine={null}
              filePath={viewingFile}
              maxHeight={viewerMaxHeight}
            />
          ) : (
            <Text size="sm" c="dimmed" p="md" ta="center">
              Failed to load file.
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  );
}
