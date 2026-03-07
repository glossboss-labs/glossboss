/**
 * Source Context Panel
 *
 * Displays PHP source code from WordPress plugin SVN for the active reference.
 * Includes a file browser mode for navigating plugin source files.
 */

import { useState } from 'react';
import {
  Paper,
  Group,
  Text,
  Collapse,
  UnstyledButton,
  Loader,
  SegmentedControl,
  ActionIcon,
  Tooltip,
  Divider,
  Badge,
} from '@mantine/core';
import { Code, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useSourceStore, getEffectiveSlug } from '@/stores/source-store';
import { SourceCodeViewer } from './SourceCodeViewer';
import { SourceBrowser } from './SourceBrowser';

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
                <SourceCodeViewer
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
            <SourceBrowser />
          </Paper>
        )}
      </Collapse>
    </Paper>
  );
}
