/**
 * SourceFileIndicator — shows the status of the source language file.
 *
 * When a source file is loaded: green badge with filename and match count.
 * When entries are key-based but no source file: subtle hint to upload one.
 * When entries are natural text: hidden (not needed).
 */

import { useMemo } from 'react';
import { Group, Text, Badge, CloseButton, Tooltip } from '@mantine/core';
import { FileUp, Check } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useEditorStore } from '@/stores';
import { hasKeyBasedMsgids } from '@/lib/po/key-detection';

export function SourceFileIndicator() {
  const { t } = useTranslation();
  const entries = useEditorStore((s) => s.entries);
  const sourceFilename = useEditorStore((s) => s.sourceFilename);
  const clearSourceFile = useEditorStore((s) => s.clearSourceFile);

  const isKeyBased = useMemo(() => hasKeyBasedMsgids(entries), [entries]);

  // If source file is loaded, show the status badge
  if (sourceFilename) {
    const matchedCount = entries.filter((e) => e.sourceText).length;
    return (
      <Group gap="xs" wrap="nowrap">
        <Badge size="xs" variant="light" color="green" leftSection={<Check size={10} />}>
          {t('Source: {{filename}}', { filename: sourceFilename })}
        </Badge>
        <Text size="xs" c="dimmed">
          {t('{{count}} matched', { count: matchedCount })}
        </Text>
        <Tooltip label={t('Remove source file')}>
          <CloseButton size="xs" onClick={clearSourceFile} />
        </Tooltip>
      </Group>
    );
  }

  // If entries look like keys but no source file, show a subtle hint
  if (isKeyBased) {
    return (
      <Group gap={6} wrap="nowrap">
        <FileUp size={12} color="var(--mantine-color-dimmed)" />
        <Text size="xs" c="dimmed">
          {t('Source strings show as keys — upload a source language file via the File menu')}
        </Text>
      </Group>
    );
  }

  // Natural text entries — no indicator needed
  return null;
}
