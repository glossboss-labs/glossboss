/**
 * Source Context Panel
 *
 * Displays PHP source code from WordPress plugin SVN for the active reference.
 * Includes a file browser mode for navigating plugin source files.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Box,
  Collapse,
  UnstyledButton,
  Breadcrumbs,
  Anchor,
  Loader,
  ScrollArea,
  SegmentedControl,
  ActionIcon,
  Tooltip,
  Divider,
  Badge,
} from '@mantine/core';
import {
  Code,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  File,
  Folder,
  ChevronRight,
  X,
} from 'lucide-react';
import { useSourceStore, getEffectiveSlug } from '@/stores/source-store';
import { buildTracUrl } from '@/lib/wp-source/references';

/** Number of context lines to show above/below the target line */
const CONTEXT_LINES = 5;

/** PHP syntax highlighting tokens */
const PHP_KEYWORD_RE =
  /\b(abstract|and|array|as|break|callable|case|catch|class|clone|const|continue|declare|default|do|echo|else|elseif|empty|enddeclare|endfor|endforeach|endif|endswitch|endwhile|eval|exit|extends|final|finally|fn|for|foreach|function|global|goto|if|implements|include|include_once|instanceof|insteadof|interface|isset|list|match|namespace|new|or|print|private|protected|public|readonly|require|require_once|return|static|switch|throw|trait|try|unset|use|var|while|xor|yield|yield\s+from)\b/;

const PHP_TYPE_RE = /\b(int|float|string|bool|array|object|null|void|mixed|never|self|parent)\b/;

/** Tokenize a single line of PHP for syntax highlighting */
function tokenizePHP(line: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  while (remaining.length > 0) {
    // Single-line comment
    let match = remaining.match(/^(\/\/.*|#.*)/);
    if (match) {
      tokens.push(
        <span key={key++} style={{ color: 'var(--mantine-color-dimmed)' }}>
          {match[0]}
        </span>,
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Strings (single and double quoted, simple matching)
    match = remaining.match(/^('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/);
    if (match) {
      tokens.push(
        <span key={key++} style={{ color: 'var(--mantine-color-green-text)' }}>
          {match[0]}
        </span>,
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Variables
    match = remaining.match(/^(\$[a-zA-Z_]\w*)/);
    if (match) {
      tokens.push(
        <span key={key++} style={{ color: 'var(--mantine-color-orange-text)' }}>
          {match[0]}
        </span>,
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Keywords
    match = remaining.match(new RegExp(`^${PHP_KEYWORD_RE.source}`));
    if (match) {
      tokens.push(
        <span key={key++} style={{ color: 'var(--mantine-color-violet-text)', fontWeight: 600 }}>
          {match[0]}
        </span>,
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Type hints
    match = remaining.match(new RegExp(`^${PHP_TYPE_RE.source}`));
    if (match) {
      tokens.push(
        <span key={key++} style={{ color: 'var(--mantine-color-cyan-text)' }}>
          {match[0]}
        </span>,
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Numbers
    match = remaining.match(/^(\d+\.?\d*)/);
    if (match) {
      tokens.push(
        <span key={key++} style={{ color: 'var(--mantine-color-blue-text)' }}>
          {match[0]}
        </span>,
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Plain text (one char at a time for safety)
    tokens.push(remaining[0]);
    remaining = remaining.slice(1);
    // Merge consecutive plain chars
    while (
      remaining.length > 0 &&
      !/^['"$/\d#]/.test(remaining) &&
      !new RegExp(`^${PHP_KEYWORD_RE.source}`).test(remaining) &&
      !new RegExp(`^${PHP_TYPE_RE.source}`).test(remaining)
    ) {
      tokens[tokens.length - 1] = (tokens[tokens.length - 1] as string) + remaining[0];
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

/**
 * Source code viewer with line numbers and highlighting
 */
function SourceViewer({
  content,
  targetLine,
  filePath,
}: {
  content: string;
  targetLine: number | null;
  filePath: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => content.split('\n'), [content]);

  // Determine visible range: if target line is set, show context around it
  const startLine = targetLine ? Math.max(1, targetLine - CONTEXT_LINES) : 1;
  const endLine = targetLine ? Math.min(lines.length, targetLine + CONTEXT_LINES) : lines.length;
  const showAllLines = !targetLine;
  const [expanded, setExpanded] = useState(false);

  const displayLines = showAllLines || expanded ? lines : lines.slice(startLine - 1, endLine);
  const displayStartLine = showAllLines || expanded ? 1 : startLine;

  // Scroll to target line when content loads
  useEffect(() => {
    if (targetLine && targetRef.current) {
      targetRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [targetLine, content]);

  const slug = useSourceStore((s) => getEffectiveSlug(s));
  const basePath = useSourceStore((s) => s.resolvedBasePath) ?? 'trunk';

  return (
    <Stack gap={0}>
      {/* File header */}
      <Group
        gap="xs"
        p="xs"
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        <File size={14} />
        <Text size="sm" fw={500} style={{ fontFamily: 'monospace' }}>
          {filePath}
        </Text>
        {slug && (
          <Tooltip label="Open in Trac">
            <ActionIcon
              component="a"
              href={buildTracUrl(slug, filePath, targetLine ?? undefined, basePath)}
              target="_blank"
              rel="noopener noreferrer"
              variant="subtle"
              size="sm"
            >
              <ExternalLink size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      {/* Code display */}
      <ScrollArea ref={scrollRef} mah={400} type="auto">
        <Box
          p="xs"
          style={{
            fontFamily: 'var(--mantine-font-family-monospace)',
            fontSize: 'var(--mantine-font-size-xs)',
            lineHeight: 1.6,
            whiteSpace: 'pre',
            overflowX: 'auto',
          }}
        >
          {displayLines.map((line, i) => {
            const lineNum = displayStartLine + i;
            const isTarget = lineNum === targetLine;

            return (
              <div
                key={lineNum}
                ref={isTarget ? targetRef : undefined}
                style={{
                  display: 'flex',
                  backgroundColor: isTarget ? 'var(--mantine-color-yellow-light)' : undefined,
                  borderRadius: isTarget ? 2 : undefined,
                  marginLeft: -8,
                  marginRight: -8,
                  paddingLeft: 8,
                  paddingRight: 8,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 48,
                    textAlign: 'right',
                    paddingRight: 12,
                    color: 'var(--mantine-color-dimmed)',
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                >
                  {lineNum}
                </span>
                <span style={{ flex: 1 }}>{tokenizePHP(line)}</span>
              </div>
            );
          })}
        </Box>
      </ScrollArea>

      {/* Expand/collapse for context mode */}
      {targetLine && !showAllLines && (
        <UnstyledButton
          onClick={() => setExpanded(!expanded)}
          p="xs"
          style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
        >
          <Text size="xs" c="blue" ta="center">
            {expanded ? 'Show context only' : `Show all ${lines.length} lines`}
          </Text>
        </UnstyledButton>
      )}
    </Stack>
  );
}

/**
 * File browser for navigating plugin source files
 */
function FileBrowser() {
  const {
    directoryTree,
    browsingPath,
    isLoadingDirectory,
    fetchDirectory,
    fetchSource,
    sourceContent,
    isLoadingSource,
  } = useSourceStore();
  const slug = useSourceStore((s) => getEffectiveSlug(s));
  const [viewingFile, setViewingFile] = useState<string | null>(null);

  // Fetch root on mount
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
      {/* Breadcrumb navigation */}
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

      {/* File/directory listing */}
      {!isLoadingDirectory && !viewingFile && directoryTree && (
        <ScrollArea mah={400} type="auto">
          <Stack gap={0}>
            {(directoryTree ?? []).map((entry) => (
              <UnstyledButton
                key={entry.name}
                onClick={() =>
                  entry.isDir
                    ? handleNavigate(browsingPath ? `${browsingPath}/${entry.name}` : entry.name)
                    : handleFileClick(browsingPath ? `${browsingPath}/${entry.name}` : entry.name)
                }
                p="xs"
                style={{
                  borderBottom: '1px solid var(--mantine-color-default-border)',
                }}
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

      {/* File viewer */}
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
            <SourceViewer content={sourceContent} targetLine={null} filePath={viewingFile} />
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

/**
 * Main SourceContext panel
 */
export function SourceContext() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<'context' | 'browse'>('context');

  const { activeReference, sourceContent, isLoadingSource, sourceError, setActiveReference } =
    useSourceStore();

  const slug = useSourceStore((s) => getEffectiveSlug(s));

  // Don't render if no slug is configured
  if (!slug) return null;

  const hasActiveRef = activeReference !== null;

  return (
    <Paper p="md" withBorder>
      {/* Header */}
      <UnstyledButton onClick={() => setIsExpanded(!isExpanded)} style={{ width: '100%' }}>
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <Code size={16} />
            <Text fw={500}>Source Code</Text>
            {hasActiveRef && (
              <Badge variant="light" size="sm">
                {activeReference.path}
                {activeReference.line ? `:${activeReference.line}` : ''}
              </Badge>
            )}
          </Group>

          <Badge
            variant="light"
            color="gray"
            size="sm"
            rightSection={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          >
            {isExpanded ? 'Hide' : 'Show'}
          </Badge>
        </Group>
      </UnstyledButton>

      <Collapse in={isExpanded}>
        <Divider my="md" />

        {/* Mode toggle */}
        <Group justify="space-between" mb="sm">
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={(v) => setMode(v as 'context' | 'browse')}
            data={[
              { label: 'Context', value: 'context' },
              { label: 'Browse', value: 'browse' },
            ]}
          />

          {hasActiveRef && mode === 'context' && (
            <Tooltip label="Clear reference">
              <ActionIcon variant="subtle" size="sm" onClick={() => setActiveReference(null)}>
                <X size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>

        {/* Context mode */}
        {mode === 'context' && (
          <>
            {!hasActiveRef && (
              <Text size="sm" c="dimmed" ta="center" py="lg">
                Click a source reference in the Meta column to view code context.
              </Text>
            )}

            {hasActiveRef && isLoadingSource && (
              <Group justify="center" py="lg">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">
                  Loading source...
                </Text>
              </Group>
            )}

            {hasActiveRef && sourceError && (
              <Text size="sm" c="red" ta="center" py="lg">
                {sourceError}
              </Text>
            )}

            {hasActiveRef && sourceContent && !isLoadingSource && (
              <Paper withBorder style={{ overflow: 'hidden' }}>
                <SourceViewer
                  content={sourceContent}
                  targetLine={activeReference.line}
                  filePath={activeReference.path}
                />
              </Paper>
            )}
          </>
        )}

        {/* Browse mode */}
        {mode === 'browse' && (
          <Paper withBorder style={{ overflow: 'hidden' }}>
            <FileBrowser />
          </Paper>
        )}
      </Collapse>
    </Paper>
  );
}
