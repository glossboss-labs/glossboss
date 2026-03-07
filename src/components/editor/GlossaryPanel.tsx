/**
 * Glossary Panel Component
 *
 * Enhanced UI for WordPress.org glossary integration:
 * - Locale selector (with custom input)
 * - Load/refresh/clear controls
 * - Glossary stats and sync status
 * - Enable/disable glossary enforcement
 * - Preview matched terms for selected row
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Paper,
  Group,
  Stack,
  Text,
  Button,
  Select,
  Badge,
  Alert,
  Collapse,
  Tooltip,
  Loader,
  ActionIcon,
  UnstyledButton,
  Modal,
  TextInput,
  Table,
  ScrollArea,
  Switch,
  Box,
} from '@mantine/core';
import {
  BookOpen,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Eye,
  Check,
  X,
} from 'lucide-react';
import {
  fetchWPGlossary,
  clearWPGlossaryCache,
  hasGlossaryCache,
  type FetchResult,
} from '@/lib/glossary/wp-fetcher';
import { findGlossaryMatches } from '@/lib/glossary/matcher';
import type { Glossary } from '@/lib/glossary/types';

/** localStorage keys */
const SELECTED_LOCALE_KEY = 'glossboss-selected-glossary-locale';
const ENFORCEMENT_ENABLED_KEY = 'glossboss-glossary-enforcement';

/** Common WordPress locales with their display names */
const COMMON_LOCALES = [
  { value: 'nl', label: 'Dutch (nl)' },
  { value: 'de', label: 'German (de)' },
  { value: 'fr', label: 'French (fr)' },
  { value: 'es', label: 'Spanish (es)' },
  { value: 'it', label: 'Italian (it)' },
  { value: 'pt-br', label: 'Portuguese - Brazil (pt-br)' },
  { value: 'ru', label: 'Russian (ru)' },
  { value: 'ja', label: 'Japanese (ja)' },
  { value: 'zh-cn', label: 'Chinese - China (zh-cn)' },
  { value: 'ko', label: 'Korean (ko)' },
  { value: 'ar', label: 'Arabic (ar)' },
  { value: 'he', label: 'Hebrew (he)' },
  { value: 'pl', label: 'Polish (pl)' },
  { value: 'sv', label: 'Swedish (sv)' },
  { value: 'nb', label: 'Norwegian (nb)' },
  { value: 'da', label: 'Danish (da)' },
  { value: 'fi', label: 'Finnish (fi)' },
  { value: 'cs', label: 'Czech (cs)' },
  { value: 'tr', label: 'Turkish (tr)' },
  { value: 'uk', label: 'Ukrainian (uk)' },
];

/** Sync status types */
type SyncStatus = 'idle' | 'syncing' | 'ready' | 'failed';

interface GlossaryPanelProps {
  /** Callback when glossary is loaded */
  onGlossaryLoaded?: (glossary: Glossary) => void;
  /** Callback when glossary is cleared */
  onGlossaryCleared?: () => void;
  /** Callback when enforcement setting changes */
  onEnforcementChange?: (enabled: boolean) => void;
  /** Callback for force resync to DeepL */
  onForceResync?: (glossary: Glossary) => void;
  /** Initial locale to select (e.g., from PO file header) */
  initialLocale?: string;
  /** Current sync status from parent */
  syncStatus?: string | null;
  /** DeepL glossary ID (indicates sync success) */
  deeplGlossaryId?: string | null;
  /** Number of terms synced to DeepL */
  deeplTermCount?: number;
  /** Currently selected entry's source text (for preview) */
  selectedSourceText?: string | null;
}

/** Glossary viewer modal component */
function GlossaryViewerModal({
  glossary,
  opened,
  onClose,
}: {
  glossary: Glossary;
  opened: boolean;
  onClose: () => void;
}) {
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
          <Text fw={600}>WordPress Glossary</Text>
          <Badge color="blue" variant="light">
            {glossary.targetLocale.toUpperCase()}
          </Badge>
          <Badge color="gray" variant="light">
            {glossary.entries.length} terms
          </Badge>
        </Group>
      }
      size="xl"
      styles={{ body: { padding: 0 } }}
    >
      <Stack gap={0}>
        <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
          <TextInput
            placeholder="Search terms..."
            leftSection={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            size="sm"
          />
          {search && (
            <Text size="xs" c="dimmed" mt="xs">
              Showing {filteredEntries.length} of {glossary.entries.length} terms
            </Text>
          )}
        </Box>

        <ScrollArea h={400}>
          <Table striped highlightOnHover>
            <Table.Thead
              style={{ position: 'sticky', top: 0, background: 'var(--mantine-color-body)' }}
            >
              <Table.Tr>
                <Table.Th style={{ width: '25%' }}>Term (EN)</Table.Th>
                <Table.Th style={{ width: '25%' }}>Translation</Table.Th>
                <Table.Th style={{ width: '15%' }}>Type</Table.Th>
                <Table.Th style={{ width: '35%' }}>Notes</Table.Th>
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
                          —
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
                        —
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {entry.comment || '—'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
              {filteredEntries.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      No terms match your search
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Stack>
    </Modal>
  );
}

/** Preview of glossary terms for selected row */
function TermsPreview({ sourceText, glossary }: { sourceText: string; glossary: Glossary }) {
  const matches = useMemo(() => {
    if (!sourceText || !glossary) return [];
    return findGlossaryMatches(sourceText, glossary);
  }, [sourceText, glossary]);

  if (matches.length === 0) {
    return (
      <Text size="xs" c="dimmed" fs="italic">
        No glossary terms in selected text
      </Text>
    );
  }

  const displayMatches = matches.slice(0, 5);
  const remaining = matches.length - 5;

  return (
    <Group gap={6} wrap="wrap">
      {displayMatches.map((match, i) => (
        <Tooltip key={i} label={`"${match.term}" → "${match.translation}"`} color="dark">
          <Badge size="xs" variant="light" color="blue" style={{ cursor: 'help' }}>
            {match.term} → {match.translation}
          </Badge>
        </Tooltip>
      ))}
      {remaining > 0 && (
        <Text size="xs" c="dimmed">
          +{remaining} more
        </Text>
      )}
    </Group>
  );
}

export function GlossaryPanel({
  onGlossaryLoaded,
  onGlossaryCleared,
  onEnforcementChange,
  onForceResync,
  initialLocale,
  syncStatus,
  deeplGlossaryId,
  deeplTermCount,
  selectedSourceText,
}: GlossaryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(SELECTED_LOCALE_KEY);
      return stored || initialLocale || '';
    } catch {
      return initialLocale || '';
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [glossary, setGlossary] = useState<Glossary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [viewerOpened, setViewerOpened] = useState(false);
  const [enforcementEnabled, setEnforcementEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(ENFORCEMENT_ENABLED_KEY);
      return stored !== 'false'; // Default to true
    } catch {
      return true;
    }
  });

  // Determine sync status display
  const syncState: SyncStatus = useMemo(() => {
    if (!glossary) return 'idle';
    if (syncStatus?.includes('Syncing')) return 'syncing';
    if (syncStatus?.includes('failed')) return 'failed';
    if (deeplGlossaryId) return 'ready';
    return 'syncing';
  }, [glossary, syncStatus, deeplGlossaryId]);

  // On mount, restore glossary from cache if available
  useEffect(() => {
    const restoreGlossary = async () => {
      const localeToRestore = selectedLocale || initialLocale;
      if (localeToRestore && hasGlossaryCache(localeToRestore)) {
        setIsLoading(true);
        try {
          const result = await fetchWPGlossary(localeToRestore, false);
          if (result.glossary) {
            setGlossary(result.glossary);
            setFromCache(result.fromCache);
            setSelectedLocale(localeToRestore);
            onGlossaryLoaded?.(result.glossary);
          }
        } catch {
          // Ignore errors on restore
        } finally {
          setIsLoading(false);
        }
      }
    };
    restoreGlossary();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist settings
  useEffect(() => {
    try {
      if (selectedLocale) {
        localStorage.setItem(SELECTED_LOCALE_KEY, selectedLocale);
      } else {
        localStorage.removeItem(SELECTED_LOCALE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [selectedLocale]);

  useEffect(() => {
    try {
      localStorage.setItem(ENFORCEMENT_ENABLED_KEY, String(enforcementEnabled));
    } catch {
      // Ignore storage errors
    }
    onEnforcementChange?.(enforcementEnabled);
  }, [enforcementEnabled, onEnforcementChange]);

  // Update locale when initialLocale prop changes
  useEffect(() => {
    if (initialLocale && initialLocale !== selectedLocale && !glossary) {
      setSelectedLocale(initialLocale);
    }
  }, [initialLocale]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoad = useCallback(
    async (forceRefresh = false) => {
      if (!selectedLocale) return;
      setIsLoading(true);
      setError(null);

      try {
        const result: FetchResult = await fetchWPGlossary(selectedLocale, forceRefresh);
        if (result.glossary) {
          setGlossary(result.glossary);
          setFromCache(result.fromCache);
          onGlossaryLoaded?.(result.glossary);
          if (result.error) setError(result.error);
        } else {
          setError(result.error || 'Failed to load glossary');
          setGlossary(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setGlossary(null);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedLocale, onGlossaryLoaded],
  );

  const handleClear = useCallback(() => {
    if (selectedLocale) {
      clearWPGlossaryCache(selectedLocale);
    }
    setGlossary(null);
    setError(null);
    setFromCache(false);
    onGlossaryCleared?.();
  }, [selectedLocale, onGlossaryCleared]);

  const handleLocaleChange = useCallback(
    (value: string | null) => {
      const newLocale = value || '';
      setSelectedLocale(newLocale);
      if (newLocale !== selectedLocale) {
        setGlossary(null);
        setError(null);
        setFromCache(false);
      }
    },
    [selectedLocale],
  );

  // Render sync status indicator
  const renderSyncStatus = () => {
    if (!glossary) return null;

    switch (syncState) {
      case 'syncing':
        return (
          <Group gap={4}>
            <Loader size={12} />
            <Text size="xs" c="dimmed">
              Syncing to DeepL...
            </Text>
          </Group>
        );
      case 'ready':
        return (
          <Group gap={4}>
            <Check size={12} color="var(--mantine-color-green-6)" />
            <Text size="xs" c="green">
              DeepL ready{deeplTermCount ? ` (${deeplTermCount} terms)` : ''}
            </Text>
            <Tooltip label="Force recreate glossary on DeepL" color="dark">
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                onClick={() => onForceResync?.(glossary)}
              >
                Resync
              </Button>
            </Tooltip>
          </Group>
        );
      case 'failed':
        return (
          <Group gap={4}>
            <X size={12} color="var(--mantine-color-red-6)" />
            <Text size="xs" c="red">
              Sync failed
            </Text>
            <Button size="compact-xs" variant="subtle" onClick={() => onGlossaryLoaded?.(glossary)}>
              Retry
            </Button>
          </Group>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Paper p="xs" withBorder>
        <Stack gap="xs">
          {/* Header row */}
          <Group justify="space-between">
            <UnstyledButton onClick={() => setIsExpanded(!isExpanded)}>
              <Group gap="xs">
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <BookOpen size={16} />
                <Text size="sm" fw={500}>
                  Glossary
                </Text>

                {glossary && (
                  <>
                    <Badge color="green" size="xs" variant="light">
                      {glossary.entries.length} terms
                    </Badge>
                    <Text size="xs" c="dimmed">
                      ({glossary.targetLocale})
                    </Text>
                    {fromCache && (
                      <Badge color="gray" size="xs" variant="light">
                        cached
                      </Badge>
                    )}
                  </>
                )}

                {!glossary && !isLoading && (
                  <Text size="xs" c="dimmed">
                    Not loaded
                  </Text>
                )}
              </Group>
            </UnstyledButton>

            <Group gap="xs">
              {isLoading ? (
                <Loader size="xs" />
              ) : glossary ? (
                <>
                  <Tooltip label="Refresh from WordPress.org" color="dark">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoad(true);
                      }}
                    >
                      <RefreshCw size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="gray"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear();
                    }}
                  >
                    Clear
                  </Button>
                </>
              ) : selectedLocale ? (
                <Button
                  size="xs"
                  variant="light"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLoad(false);
                  }}
                >
                  Load
                </Button>
              ) : null}
            </Group>
          </Group>

          {/* Expanded content */}
          <Collapse in={isExpanded}>
            <Stack gap="sm" pt="xs">
              {/* Language selector row */}
              <Group gap="sm" align="flex-end">
                <Select
                  label="Language"
                  data={COMMON_LOCALES}
                  value={selectedLocale}
                  onChange={handleLocaleChange}
                  placeholder="Select or type locale..."
                  searchable
                  clearable
                  w={200}
                  size="xs"
                  nothingFoundMessage="Type a custom locale code"
                />

                {glossary && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<Eye size={14} />}
                    onClick={() => setViewerOpened(true)}
                  >
                    View All
                  </Button>
                )}
              </Group>

              {/* Enforcement toggle */}
              {glossary && (
                <Box>
                  <Switch
                    size="sm"
                    checked={enforcementEnabled}
                    onChange={(e) => setEnforcementEnabled(e.currentTarget.checked)}
                    label="Apply glossary terms during translation"
                    description={
                      enforcementEnabled
                        ? 'DeepL will use glossary for consistent terminology'
                        : 'Translations without glossary enforcement'
                    }
                  />

                  {/* Sync status */}
                  {enforcementEnabled && (
                    <Box mt="xs" ml={54}>
                      {renderSyncStatus()}
                    </Box>
                  )}
                </Box>
              )}

              {/* Selected row preview */}
              {glossary && selectedSourceText && (
                <Box>
                  <Text size="xs" fw={500} mb={4}>
                    Terms in selected row:
                  </Text>
                  <TermsPreview sourceText={selectedSourceText} glossary={glossary} />
                </Box>
              )}

              {/* Error */}
              {error && !isLoading && (
                <Alert
                  color={glossary ? 'yellow' : 'red'}
                  icon={<AlertCircle size={14} />}
                  withCloseButton
                  onClose={() => setError(null)}
                  p="xs"
                >
                  <Text size="xs">{error}</Text>
                </Alert>
              )}
            </Stack>
          </Collapse>
        </Stack>
      </Paper>

      {/* Glossary viewer modal */}
      {glossary && (
        <GlossaryViewerModal
          glossary={glossary}
          opened={viewerOpened}
          onClose={() => setViewerOpened(false)}
        />
      )}
    </>
  );
}
