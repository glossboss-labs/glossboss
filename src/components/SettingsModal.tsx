/**
 * Settings Modal Component
 *
 * Unified settings panel for:
 * - DeepL API key configuration
 * - Glossary management (load, view, configure)
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Modal,
  Stack,
  Tabs,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Text,
  Alert,
  Badge,
  SegmentedControl,
  Progress,
  Divider,
  Select,
  Switch,
  Loader,
  Paper,
  ActionIcon,
  Tooltip,
  Anchor,
  Table,
  ScrollArea,
  Box,
  Kbd,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import {
  Key,
  BookOpen,
  Check,
  AlertCircle,
  RefreshCw,
  X,
  ExternalLink,
  Search,
  Eye,
  Keyboard,
} from 'lucide-react';
import {
  getDeepLSettings,
  saveDeepLSettings,
  clearDeepLSettings,
  type DeepLApiType,
  getDeepLClient,
} from '@/lib/deepl';
import { fetchWPGlossary, clearWPGlossaryCache, type FetchResult } from '@/lib/glossary/wp-fetcher';
import { findGlossaryMatches } from '@/lib/glossary/matcher';
import type { Glossary } from '@/lib/glossary/types';
import { NAV_SKIP_TRANSLATED_KEY } from '@/components/editor/EditorTable';

/** localStorage keys */
const SELECTED_LOCALE_KEY = 'glossboss-selected-glossary-locale';
const ENFORCEMENT_ENABLED_KEY = 'glossboss-glossary-enforcement';

/** Common WordPress locales */
const COMMON_LOCALES = [
  { value: 'nl', label: 'Dutch (nl)' },
  { value: 'de', label: 'German (de)' },
  { value: 'fr', label: 'French (fr)' },
  { value: 'es', label: 'Spanish (es)' },
  { value: 'it', label: 'Italian (it)' },
  { value: 'pt', label: 'Portuguese (pt)' },
  { value: 'pl', label: 'Polish (pl)' },
  { value: 'ru', label: 'Russian (ru)' },
  { value: 'ja', label: 'Japanese (ja)' },
  { value: 'zh-cn', label: 'Chinese Simplified (zh-cn)' },
  { value: 'ko', label: 'Korean (ko)' },
  { value: 'sv', label: 'Swedish (sv)' },
  { value: 'da', label: 'Danish (da)' },
  { value: 'fi', label: 'Finnish (fi)' },
  { value: 'nb', label: 'Norwegian (nb)' },
  { value: 'uk', label: 'Ukrainian (uk)' },
  { value: 'cs', label: 'Czech (cs)' },
  { value: 'el', label: 'Greek (el)' },
  { value: 'hu', label: 'Hungarian (hu)' },
  { value: 'ro', label: 'Romanian (ro)' },
  { value: 'tr', label: 'Turkish (tr)' },
  { value: 'he', label: 'Hebrew (he)' },
  { value: 'ar', label: 'Arabic (ar)' },
];

/** Glossary viewer modal */
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
      centered
      styles={{ body: { padding: 0 } }}
    >
      <Stack gap={0}>
        <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
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

/** Keyboard shortcut definitions */
const KEYBINDS: { keys: string[][]; action: string; description?: string }[] = [
  {
    keys: [['Tab']],
    action: 'Next field',
    description: 'Save current field and move to the next translation field',
  },
  {
    keys: [['Shift', 'Tab']],
    action: 'Previous field',
    description: 'Save current field and move to the previous translation field',
  },
  {
    keys: [['Enter']],
    action: 'Next field',
    description: 'Save current field and move to the next translation field',
  },
  {
    keys: [['Shift', 'Enter']],
    action: 'New line',
    description: 'Insert a line break in the translation',
  },
  {
    keys: [
      ['⌘', 'Enter'],
      ['Ctrl', 'Enter'],
    ],
    action: 'Next entry',
    description: 'Save and jump to the next translation entry (skips translated by default)',
  },
  {
    keys: [['Escape']],
    action: 'Cancel edit',
    description: 'Discard changes and exit the current field',
  },
];

/** Renders a key combination using Mantine Kbd components */
function KeyCombo({ keys }: { keys: string[][] }) {
  return (
    <Group gap={6}>
      {keys.map((combo, ci) => (
        <Group key={ci} gap={4} wrap="nowrap">
          {ci > 0 && (
            <Text size="xs" c="dimmed">
              /
            </Text>
          )}
          {combo.map((key, ki) => (
            <span key={ki} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              {ki > 0 && (
                <Text size="xs" c="dimmed">
                  +
                </Text>
              )}
              <Kbd size="sm">{key}</Kbd>
            </span>
          ))}
        </Group>
      ))}
    </Group>
  );
}

/** Keyboard shortcuts settings panel */
function KeyboardShortcutsPanel() {
  const [skipTranslated, setSkipTranslated] = useLocalStorage<boolean>({
    key: NAV_SKIP_TRANSLATED_KEY,
    defaultValue: true,
  });

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Keyboard shortcuts available when editing translations.
      </Text>

      <Paper withBorder>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: '35%' }}>Shortcut</Table.Th>
              <Table.Th style={{ width: '20%' }}>Action</Table.Th>
              <Table.Th>Description</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {KEYBINDS.map((bind, i) => (
              <Table.Tr key={i}>
                <Table.Td>
                  <KeyCombo keys={bind.keys} />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {bind.action}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {bind.description}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Divider />

      <Text size="sm" fw={500}>
        Navigation Settings
      </Text>

      <Switch
        label="Skip translated entries"
        description="When using ⌘/Ctrl+Enter, skip entries that are already translated and jump to the next untranslated or fuzzy entry"
        checked={skipTranslated}
        onChange={(e) => setSkipTranslated(e.currentTarget.checked)}
        styles={{
          track: {
            transition: 'background-color 0.2s ease, border-color 0.2s ease',
          },
          thumb: {
            transition: 'transform 0.2s ease, left 0.2s ease',
          },
        }}
      />
    </Stack>
  );
}

interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
  initialLocale?: string;
  onGlossaryLoaded?: (glossary: Glossary) => void;
  onGlossaryCleared?: () => void;
  onEnforcementChange?: (enabled: boolean) => void;
  onForceResync?: (glossary: Glossary) => void;
  glossary?: Glossary | null;
  syncStatus?: string | null;
  deeplGlossaryId?: string | null;
  deeplTermCount?: number;
  selectedSourceText?: string | null;
}

export function SettingsModal({
  opened,
  onClose,
  initialLocale,
  onGlossaryLoaded,
  onGlossaryCleared,
  onEnforcementChange,
  onForceResync,
  glossary,
  syncStatus,
  deeplGlossaryId,
  deeplTermCount,
  selectedSourceText,
}: SettingsModalProps) {
  // DeepL API settings state
  const [apiKey, setApiKey] = useState('');
  const [apiType, setApiType] = useState<DeepLApiType>('free');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    usage?: { used: number; limit: number };
  } | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Glossary state
  const [selectedLocale, setSelectedLocale] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(SELECTED_LOCALE_KEY);
      return stored || initialLocale || '';
    } catch {
      return initialLocale || '';
    }
  });
  const [isLoadingGlossary, setIsLoadingGlossary] = useState(false);
  const [glossaryError, setGlossaryError] = useState<string | null>(null);
  const [enforcementEnabled, setEnforcementEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(ENFORCEMENT_ENABLED_KEY);
      return stored !== 'false';
    } catch {
      return true;
    }
  });
  const [viewerOpened, setViewerOpened] = useState(false);
  const [hasAttemptedAutoLoad, setHasAttemptedAutoLoad] = useState(false);

  // Load saved settings on open
  useEffect(() => {
    if (opened) {
      const settings = getDeepLSettings();
      setApiKey(settings.apiKey);
      setApiType(settings.apiType);
      setIsSaved(Boolean(settings.apiKey));
    }
  }, [opened]);

  // Update locale when initialLocale changes
  useEffect(() => {
    if (initialLocale && initialLocale !== selectedLocale && !glossary) {
      setSelectedLocale(initialLocale);
    }
  }, [initialLocale]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist locale selection
  useEffect(() => {
    try {
      if (selectedLocale) {
        localStorage.setItem(SELECTED_LOCALE_KEY, selectedLocale);
      }
    } catch {
      // Ignore storage errors
    }
  }, [selectedLocale]);

  // Persist enforcement setting
  useEffect(() => {
    try {
      localStorage.setItem(ENFORCEMENT_ENABLED_KEY, String(enforcementEnabled));
    } catch {
      // Ignore storage errors
    }
    onEnforcementChange?.(enforcementEnabled);
  }, [enforcementEnabled, onEnforcementChange]);

  const handleTestKey = useCallback(async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      saveDeepLSettings({ apiKey, apiType });
      const client = getDeepLClient();
      const usage = await client.getUsage();

      setTestResult({
        success: true,
        message: 'API key is valid!',
        usage: { used: usage.characterCount, limit: usage.characterLimit },
      });
      setIsSaved(true);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to connect',
      });
      clearDeepLSettings();
      setIsSaved(false);
    } finally {
      setIsTesting(false);
    }
  }, [apiKey, apiType]);

  const handleSaveApiKey = useCallback(() => {
    saveDeepLSettings({ apiKey, apiType });
    setIsSaved(true);
    setTestResult({ success: true, message: 'Settings saved!' });
  }, [apiKey, apiType]);

  const handleClearApiKey = useCallback(() => {
    clearDeepLSettings();
    setApiKey('');
    setApiType('free');
    setIsSaved(false);
    setTestResult(null);
  }, []);

  const handleLoadGlossary = useCallback(
    async (forceRefresh = false) => {
      if (!selectedLocale) return;

      setIsLoadingGlossary(true);
      setGlossaryError(null);

      try {
        const result: FetchResult = await fetchWPGlossary(selectedLocale, forceRefresh);
        if (result.glossary) {
          onGlossaryLoaded?.(result.glossary);
          if (result.error) setGlossaryError(result.error);
        } else {
          setGlossaryError(result.error || 'Failed to load glossary');
        }
      } catch (err) {
        setGlossaryError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoadingGlossary(false);
      }
    },
    [selectedLocale, onGlossaryLoaded],
  );

  const handleClearGlossary = useCallback(() => {
    if (selectedLocale) {
      clearWPGlossaryCache(selectedLocale);
    }
    setHasAttemptedAutoLoad(false); // Allow auto-load to try again after manual clear
    onGlossaryCleared?.();
  }, [selectedLocale, onGlossaryCleared]);

  // Reset auto-load flag when locale changes
  useEffect(() => {
    setHasAttemptedAutoLoad(false);
  }, [selectedLocale]);

  // Auto-load glossary from cache on initial mount if we have a locale but no glossary
  useEffect(() => {
    if (selectedLocale && !glossary && !isLoadingGlossary && !hasAttemptedAutoLoad) {
      setHasAttemptedAutoLoad(true);
      // Try to load from cache (forceRefresh = false)
      handleLoadGlossary(false);
    }
  }, [selectedLocale, glossary, isLoadingGlossary, hasAttemptedAutoLoad, handleLoadGlossary]);

  return (
    <>
      <Modal opened={opened} onClose={onClose} title="Settings" size="lg" centered>
        <Tabs defaultValue="api">
          <Tabs.List mb="md">
            <Tabs.Tab value="api" leftSection={<Key size={14} />}>
              DeepL API
            </Tabs.Tab>
            <Tabs.Tab value="glossary" leftSection={<BookOpen size={14} />}>
              Glossary
              {glossary && (
                <Badge size="xs" color="green" ml={6}>
                  {glossary.entries.length}
                </Badge>
              )}
            </Tabs.Tab>
            <Tabs.Tab value="keybinds" leftSection={<Keyboard size={14} />}>
              Keyboard Shortcuts
            </Tabs.Tab>
          </Tabs.List>

          {/* DeepL API Tab */}
          <Tabs.Panel value="api">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Enter your DeepL API key to enable machine translation. Get a free key at{' '}
                <Anchor
                  href="https://www.deepl.com/pro-api"
                  target="_blank"
                  size="sm"
                  style={{
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  deepl.com/pro-api
                  <ExternalLink size={12} />
                </Anchor>
              </Text>

              <PasswordInput
                label="API Key"
                placeholder="Enter your DeepL API key"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.currentTarget.value);
                  setIsSaved(false);
                  setTestResult(null);
                }}
                rightSection={
                  isSaved && apiKey ? (
                    <Tooltip label="Key saved">
                      <Check size={16} color="var(--mantine-color-green-6)" />
                    </Tooltip>
                  ) : null
                }
              />

              <div data-ev-id="ev_a06444cf83">
                <Text size="sm" fw={500} mb={4}>
                  API Type
                </Text>
                <SegmentedControl
                  value={apiType}
                  onChange={(value) => {
                    setApiType(value as DeepLApiType);
                    setIsSaved(false);
                  }}
                  data={[
                    { label: 'Free API', value: 'free' },
                    { label: 'Pro API', value: 'pro' },
                  ]}
                  fullWidth
                />

                <Text size="xs" c="dimmed" mt={4}>
                  Free: 500,000 chars/month • Pro: Pay per use
                </Text>
              </div>

              <Group>
                <Button
                  variant="light"
                  onClick={handleTestKey}
                  loading={isTesting}
                  disabled={!apiKey.trim()}
                >
                  Test Connection
                </Button>
                <Button onClick={handleSaveApiKey} disabled={!apiKey.trim() || isSaved}>
                  Save
                </Button>
                {apiKey && (
                  <Button variant="subtle" color="red" onClick={handleClearApiKey}>
                    Clear
                  </Button>
                )}
              </Group>

              {testResult && (
                <Alert
                  color={testResult.success ? 'green' : 'red'}
                  icon={testResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
                >
                  <Stack gap="xs">
                    <Text size="sm">{testResult.message}</Text>
                    {testResult.usage && (
                      <>
                        <Progress
                          value={(testResult.usage.used / testResult.usage.limit) * 100}
                          size="sm"
                          color={
                            testResult.usage.used / testResult.usage.limit > 0.9 ? 'red' : 'blue'
                          }
                        />

                        <Text size="xs" c="dimmed">
                          {testResult.usage.used.toLocaleString()} /{' '}
                          {testResult.usage.limit.toLocaleString()} characters
                        </Text>
                      </>
                    )}
                  </Stack>
                </Alert>
              )}
            </Stack>
          </Tabs.Panel>

          {/* Glossary Tab */}
          <Tabs.Panel value="glossary">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Load the official WordPress translation glossary to ensure consistent terminology.
              </Text>

              <Group align="flex-end" gap="sm">
                <Select
                  label="Language"
                  placeholder="Select locale"
                  data={COMMON_LOCALES}
                  value={selectedLocale}
                  onChange={(value) => setSelectedLocale(value || '')}
                  searchable
                  style={{ flex: 1 }}
                />

                {!glossary ? (
                  <Button
                    onClick={() => handleLoadGlossary(false)}
                    loading={isLoadingGlossary}
                    disabled={!selectedLocale}
                  >
                    Load Glossary
                  </Button>
                ) : (
                  <Group gap="xs">
                    <Tooltip label="Refresh from WordPress.org">
                      <ActionIcon
                        variant="light"
                        size="lg"
                        onClick={() => handleLoadGlossary(true)}
                        loading={isLoadingGlossary}
                      >
                        <RefreshCw size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Button variant="subtle" color="gray" onClick={handleClearGlossary}>
                      Clear
                    </Button>
                  </Group>
                )}
              </Group>

              {glossaryError && (
                <Alert color="red" icon={<AlertCircle size={16} />}>
                  {glossaryError}
                </Alert>
              )}

              {glossary && (
                <Paper p="md" withBorder>
                  <Stack gap="sm">
                    {/* Header with stats */}
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Badge color="green" variant="light">
                          {glossary.entries.length} terms
                        </Badge>
                        <Text size="sm" c="dimmed">
                          ({glossary.targetLocale})
                        </Text>
                      </Group>

                      <Button
                        variant="subtle"
                        size="xs"
                        leftSection={<Eye size={14} />}
                        onClick={() => setViewerOpened(true)}
                      >
                        View All
                      </Button>
                    </Group>

                    {/* DeepL sync status */}
                    <Group gap="xs">
                      {syncStatus?.includes('Syncing') ? (
                        <>
                          <Loader size={12} />
                          <Text size="xs" c="dimmed">
                            Syncing to DeepL...
                          </Text>
                        </>
                      ) : deeplGlossaryId ? (
                        <>
                          <Check size={12} color="var(--mantine-color-green-6)" />
                          <Text size="xs" c="green">
                            DeepL ready{deeplTermCount ? ` (${deeplTermCount} terms)` : ''}
                          </Text>
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="gray"
                            onClick={() => onForceResync?.(glossary)}
                          >
                            Resync
                          </Button>
                        </>
                      ) : syncStatus?.includes('failed') ? (
                        <>
                          <X size={12} color="var(--mantine-color-red-6)" />
                          <Text size="xs" c="red">
                            Sync failed
                          </Text>
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            onClick={() => onGlossaryLoaded?.(glossary)}
                          >
                            Retry
                          </Button>
                        </>
                      ) : null}
                    </Group>

                    <Divider />

                    {/* Enforcement toggle */}
                    <Switch
                      label="Use glossary for translations"
                      description="DeepL will enforce glossary terms in machine translations"
                      checked={enforcementEnabled}
                      onChange={(e) => setEnforcementEnabled(e.currentTarget.checked)}
                      styles={{
                        track: {
                          transition: 'background-color 0.2s ease, border-color 0.2s ease',
                        },
                        thumb: {
                          transition: 'transform 0.2s ease, left 0.2s ease',
                        },
                      }}
                    />

                    {/* Selected text term preview */}
                    {selectedSourceText && (
                      <>
                        <Divider />
                        <div data-ev-id="ev_898c72be1c">
                          <Text size="xs" fw={500} mb={4}>
                            Terms in selected text:
                          </Text>
                          <TermsPreview sourceText={selectedSourceText} glossary={glossary} />
                        </div>
                      </>
                    )}
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          {/* Keyboard Shortcuts Tab */}
          <Tabs.Panel value="keybinds">
            <KeyboardShortcutsPanel />
          </Tabs.Panel>
        </Tabs>
      </Modal>

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
