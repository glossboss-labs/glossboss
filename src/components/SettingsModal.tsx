/**
 * Settings Modal Component
 *
 * Unified settings panel for:
 * - DeepL API key configuration
 * - Glossary management (load, view, configure)
 * - Display preferences (container width)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  Stack,
  Tabs,
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
  Kbd,
  FileButton,
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
  Eye,
  Keyboard,
  GitBranch,
  Monitor,
  Upload,
} from 'lucide-react';
import {
  getDeepLSettings,
  saveDeepLSettings,
  clearDeepLSettings,
  isPersistEnabled,
  setPersistEnabled,
  type DeepLApiType,
  type DeepLFormality,
  getDeepLClient,
} from '@/lib/deepl';
import { fetchWPGlossary, clearWPGlossaryCache, type FetchResult } from '@/lib/glossary/wp-fetcher';
import { parseGlossaryCSV, isValidGlossaryCSV } from '@/lib/glossary/csv-parser';
import { GlossaryTermsPreview, GlossaryViewerModal } from '@/components/glossary/shared';
import {
  COMMON_GLOSSARY_LOCALES,
  GLOSSARY_ENFORCEMENT_KEY,
  GLOSSARY_SELECTED_LOCALE_KEY,
} from '@/components/glossary/constants';
import type { Glossary } from '@/lib/glossary/types';
import { NAV_SKIP_TRANSLATED_KEY } from '@/components/editor/EditorTable';
import { CONTAINER_WIDTH_OPTIONS, type ContainerWidth } from '@/lib/container-width';

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
  branchChipEnabled?: boolean;
  onBranchChipEnabledChange?: (enabled: boolean) => void;
  containerWidth?: ContainerWidth;
  onContainerWidthChange?: (width: ContainerWidth) => void;
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
  branchChipEnabled = true,
  onBranchChipEnabledChange,
  containerWidth = 'xl',
  onContainerWidthChange,
}: SettingsModalProps) {
  const isDevelopment = import.meta.env.DEV;

  // DeepL API settings state
  const [apiKey, setApiKey] = useState('');
  const [apiType, setApiType] = useState<DeepLApiType>('free');
  const [formality, setFormality] = useState<DeepLFormality>('prefer_less');
  const [persistKey, setPersistKey] = useState(() => isPersistEnabled());
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
      const stored = localStorage.getItem(GLOSSARY_SELECTED_LOCALE_KEY);
      return stored || initialLocale || '';
    } catch {
      return initialLocale || '';
    }
  });
  const [isLoadingGlossary, setIsLoadingGlossary] = useState(false);
  const [glossaryError, setGlossaryError] = useState<string | null>(null);
  const [enforcementEnabled, setEnforcementEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(GLOSSARY_ENFORCEMENT_KEY);
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
      setFormality(settings.formality);
      setIsSaved(Boolean(settings.apiKey));
      setPersistKey(isPersistEnabled());
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
        localStorage.setItem(GLOSSARY_SELECTED_LOCALE_KEY, selectedLocale);
      }
    } catch {
      // Ignore storage errors
    }
  }, [selectedLocale]);

  // Persist enforcement setting
  useEffect(() => {
    try {
      localStorage.setItem(GLOSSARY_ENFORCEMENT_KEY, String(enforcementEnabled));
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
      saveDeepLSettings({ apiKey, apiType, formality });
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
  }, [apiKey, apiType, formality]);

  const handleSaveApiKey = useCallback(() => {
    saveDeepLSettings({ apiKey, apiType, formality });
    setIsSaved(true);
    setTestResult({ success: true, message: 'Settings saved!' });
  }, [apiKey, apiType, formality]);

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

  const csvUploadResetRef = useRef<() => void>(null);
  const handleCsvUpload = useCallback(
    (file: File | null) => {
      if (!file || !selectedLocale) return;
      setGlossaryError(null);

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;

        if (!isValidGlossaryCSV(text)) {
          setGlossaryError('File does not appear to be a valid WordPress glossary CSV.');
          csvUploadResetRef.current?.();
          return;
        }

        const parseResult = parseGlossaryCSV(text);
        if (parseResult.entries.length === 0) {
          setGlossaryError(
            parseResult.errors[0] || 'No glossary entries found in the uploaded file.',
          );
          csvUploadResetRef.current?.();
          return;
        }

        const uploaded: Glossary = {
          sourceLocale: parseResult.sourceLocale || 'en',
          targetLocale: selectedLocale,
          project: 'wordpress',
          entries: parseResult.entries,
          fetchedAt: new Date().toISOString(),
        };

        onGlossaryLoaded?.(uploaded);
        csvUploadResetRef.current?.();
      };
      reader.onerror = () => {
        setGlossaryError('Failed to read the file.');
        csvUploadResetRef.current?.();
      };
      reader.readAsText(file);
    },
    [selectedLocale, onGlossaryLoaded],
  );

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
            <Tabs.Tab value="display" leftSection={<Monitor size={14} />}>
              Display
            </Tabs.Tab>
            {isDevelopment && (
              <Tabs.Tab
                value="development"
                leftSection={<GitBranch size={14} />}
                style={{
                  border: '1px dotted var(--mantine-color-orange-5)',
                  borderRadius: 'var(--mantine-radius-md)',
                }}
              >
                Development
              </Tabs.Tab>
            )}
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

              <Alert color="yellow" icon={<AlertCircle size={16} />}>
                <Text size="sm">
                  Your API key is kept in this browser tab by default and will be cleared when you
                  close the tab. Enable &quot;Remember API key&quot; below to persist it across
                  sessions — only do this on a personal, trusted device.
                </Text>
              </Alert>

              <Switch
                label="Remember API key across sessions"
                description="When enabled, your key is stored in localStorage and survives browser restarts. Disable on shared or untrusted devices."
                checked={persistKey}
                onChange={(e) => {
                  const enabled = e.currentTarget.checked;
                  setPersistKey(enabled);
                  setPersistEnabled(enabled);
                  setIsSaved(false);
                }}
              />

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

              <div>
                <Text size="sm" fw={500} mb={4}>
                  Formality
                </Text>
                <SegmentedControl
                  value={formality}
                  onChange={(value) => {
                    setFormality(value as DeepLFormality);
                    saveDeepLSettings({ formality: value as DeepLFormality });
                  }}
                  data={[
                    { label: 'Informal', value: 'prefer_less' },
                    { label: 'Formal', value: 'prefer_more' },
                  ]}
                  fullWidth
                />

                <Text size="xs" c="dimmed" mt={4}>
                  Controls the tone of DeepL translations. Not all languages support formality.
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
                    Remove saved key
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
                  data={COMMON_GLOSSARY_LOCALES}
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

              <Divider label="or upload manually" labelPosition="center" />

              <Group align="center" gap="sm">
                <FileButton
                  resetRef={csvUploadResetRef}
                  onChange={handleCsvUpload}
                  accept=".csv,text/csv"
                >
                  {(props) => (
                    <Button
                      variant="light"
                      leftSection={<Upload size={14} />}
                      disabled={!selectedLocale}
                      {...props}
                    >
                      Upload CSV
                    </Button>
                  )}
                </FileButton>
                <Text size="xs" c="dimmed">
                  Upload a WordPress glossary CSV for the selected language
                </Text>
              </Group>

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
                          <GlossaryTermsPreview
                            sourceText={selectedSourceText}
                            glossary={glossary}
                          />
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

          {/* Display Tab */}
          <Tabs.Panel value="display">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Adjust the appearance of the editor to suit your screen and preferences.
              </Text>

              <Paper p="md" withBorder>
                <Stack gap="sm">
                  <div>
                    <Text size="sm" fw={500}>
                      Container width
                    </Text>
                    <Text size="xs" c="dimmed">
                      Controls the maximum width of the main content area. Use a wider setting on
                      large monitors, or full width to use all available space.
                    </Text>
                  </div>

                  <SegmentedControl
                    value={containerWidth}
                    onChange={(value) => onContainerWidthChange?.(value as ContainerWidth)}
                    data={CONTAINER_WIDTH_OPTIONS.map((opt) => ({
                      value: opt.value,
                      label: opt.label,
                    }))}
                    fullWidth
                    size="xs"
                  />
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          {isDevelopment && (
            <Tabs.Panel value="development">
              <Stack gap="md">
                <Alert color="orange" variant="light" icon={<GitBranch size={16} />}>
                  <Text size="sm" fw={600}>
                    Development Mode Only
                  </Text>
                  <Text size="sm">
                    These tools only appear while running the app locally in development and are not
                    shown in production.
                  </Text>
                </Alert>

                <Paper p="md" withBorder>
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text size="sm" fw={500}>
                          Branch status chip
                        </Text>
                        <Text size="xs" c="dimmed">
                          Show the current git branch in a small floating chip at the bottom right
                          of the site.
                        </Text>
                      </div>

                      <Badge variant="light" color="gray">
                        {__GIT_BRANCH__}
                      </Badge>
                    </Group>

                    <Switch
                      label="Show branch chip"
                      description="Only visible while running the app in development mode"
                      checked={branchChipEnabled}
                      onChange={(e) => onBranchChipEnabledChange?.(e.currentTarget.checked)}
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
                </Paper>
              </Stack>
            </Tabs.Panel>
          )}
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
