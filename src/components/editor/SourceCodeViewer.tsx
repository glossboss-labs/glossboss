/**
 * Shared source code viewer used by editor details and source context panel.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Box,
  Group,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { ExternalLink, File } from 'lucide-react';
import { getEffectiveSlug, useSourceStore } from '@/stores/source-store';
import { buildTracUrl } from '@/lib/wp-source/references';
import { useTranslation } from '@/lib/app-language';

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

interface SourceCodeViewerProps {
  content: string;
  targetLine: number | null;
  filePath: string;
  maxHeight?: number;
}

export function SourceCodeViewer({
  content,
  targetLine,
  filePath,
  maxHeight = 400,
}: SourceCodeViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => content.split('\n'), [content]);
  const [expanded, setExpanded] = useState(false);

  // Determine visible range: if target line is set, show context around it
  const startLine = targetLine ? Math.max(1, targetLine - CONTEXT_LINES) : 1;
  const endLine = targetLine ? Math.min(lines.length, targetLine + CONTEXT_LINES) : lines.length;
  const showAllLines = !targetLine;
  const displayLines = showAllLines || expanded ? lines : lines.slice(startLine - 1, endLine);
  const displayStartLine = showAllLines || expanded ? 1 : startLine;

  // Scroll only the viewer viewport to keep parent layouts from jumping.
  useEffect(() => {
    const viewport = viewportRef.current;
    const target = targetRef.current;
    if (targetLine && viewport && target) {
      const targetTop = target.offsetTop - viewport.clientHeight / 2 + target.clientHeight / 2;
      viewport.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    }
  }, [targetLine, content]);

  const { t } = useTranslation();
  const slug = useSourceStore((s) => getEffectiveSlug(s));
  const basePath = useSourceStore((s) => s.resolvedBasePath) ?? 'trunk';

  return (
    <Stack gap={0}>
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
          <Tooltip label={t('Open in Trac')}>
            <ActionIcon
              component="a"
              href={buildTracUrl(slug, filePath, targetLine ?? undefined, basePath)}
              target="_blank"
              rel="noopener noreferrer"
              variant="subtle"
              size="sm"
              aria-label={t('Open in Trac')}
            >
              <ExternalLink size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      <ScrollArea
        viewportRef={viewportRef}
        h={maxHeight}
        type="auto"
        onWheelCapture={(e) => e.stopPropagation()}
      >
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

      {targetLine && !showAllLines && (
        <UnstyledButton
          onClick={() => setExpanded(!expanded)}
          p="xs"
          style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
          aria-expanded={expanded}
        >
          <Text size="xs" c="blue" ta="center">
            {expanded
              ? t('Show context only')
              : t('Show all {{count}} lines', { count: lines.length })}
          </Text>
        </UnstyledButton>
      )}
    </Stack>
  );
}
