import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Group,
  Modal,
  ScrollArea,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { BookOpen, Search } from 'lucide-react';
import { findGlossaryMatches } from '@/lib/glossary/matcher';
import type { Glossary } from '@/lib/glossary/types';
import { useTranslation } from '@/lib/app-language';

export function GlossaryViewerModal({
  glossary,
  opened,
  onClose,
}: {
  glossary: Glossary;
  opened: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filteredEntries = useMemo(() => {
    if (!search.trim()) {
      return glossary.entries;
    }
    const query = search.toLowerCase();
    return glossary.entries.filter(
      (entry) =>
        entry.term.toLowerCase().includes(query) ||
        entry.translation.toLowerCase().includes(query) ||
        entry.partOfSpeech?.toLowerCase().includes(query) ||
        entry.comment?.toLowerCase().includes(query),
    );
  }, [glossary.entries, search]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <BookOpen size={20} />
          <Text fw={600}>{t('WordPress Glossary')}</Text>
          <Badge color="blue" variant="light">
            {glossary.targetLocale.toUpperCase()}
          </Badge>
          <Badge color="gray" variant="light">
            {t('{{count}} terms', { count: glossary.entries.length })}
          </Badge>
        </Group>
      }
      size="xl"
      centered
      styles={{ body: { padding: 0 } }}
    >
      <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <TextInput
          placeholder={t('Search terms...')}
          leftSection={<Search size={16} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          size="sm"
          aria-label={t('Search terms...')}
        />
        {search && (
          <Text size="xs" c="dimmed" mt="xs">
            {t('Showing {{shown}} of {{total}} terms', {
              shown: filteredEntries.length,
              total: glossary.entries.length,
            })}
          </Text>
        )}
      </Box>

      <ScrollArea h={400}>
        <Table striped highlightOnHover>
          <Table.Thead
            style={{ position: 'sticky', top: 0, background: 'var(--mantine-color-body)' }}
          >
            <Table.Tr>
              <Table.Th style={{ width: '25%' }}>{t('Term (EN)')}</Table.Th>
              <Table.Th style={{ width: '25%' }}>{t('Translation')}</Table.Th>
              <Table.Th style={{ width: '15%' }}>{t('Type')}</Table.Th>
              <Table.Th style={{ width: '35%' }}>{t('Notes')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredEntries.map((entry, index) => (
              <Table.Tr key={`${entry.term}-${index}`}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {entry.term}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {entry.translation || (
                      <Text span c="dimmed">
                        -
                      </Text>
                    )}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {entry.partOfSpeech ? (
                    <Badge size="xs" variant="light" color="gray">
                      {entry.partOfSpeech}
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">
                      -
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed" lineClamp={2}>
                    {entry.comment || '-'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
            {filteredEntries.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    {t('No terms match your search')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Modal>
  );
}

export function GlossaryTermsPreview({
  sourceText,
  glossary,
}: {
  sourceText: string;
  glossary: Glossary;
}) {
  const { t } = useTranslation();
  const matches = useMemo(() => {
    if (!sourceText) return [];
    return findGlossaryMatches(sourceText, glossary);
  }, [glossary, sourceText]);

  if (matches.length === 0) {
    return (
      <Text size="xs" c="dimmed" fs="italic">
        {t('No glossary terms in selected text')}
      </Text>
    );
  }

  const displayMatches = matches.slice(0, 5);
  const remaining = matches.length - 5;

  return (
    <Group gap={6} wrap="wrap">
      {displayMatches.map((match, index) => (
        <Tooltip
          key={`${match.term}-${index}`}
          label={`"${match.term}" -> "${match.translation}"`}
          color="dark"
        >
          <Badge size="xs" variant="light" color="blue" style={{ cursor: 'help' }}>
            {match.term}
            {' -> '}
            {match.translation}
          </Badge>
        </Tooltip>
      ))}
      {remaining > 0 && (
        <Text size="xs" c="dimmed">
          {t('+{{count}} more', { count: remaining })}
        </Text>
      )}
    </Group>
  );
}
