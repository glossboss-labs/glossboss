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
  Box,
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
  Switch,
} from '@mantine/core';
import {
  BookOpen,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
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
import { GlossaryTermsPreview, GlossaryViewerModal } from '@/components/glossary/shared';
import {
  COMMON_GLOSSARY_LOCALES,
  GLOSSARY_ENFORCEMENT_KEY,
  GLOSSARY_SELECTED_LOCALE_KEY,
} from '@/components/glossary/constants';
import type { Glossary } from '@/lib/glossary/types';
import { useTranslation } from '@/lib/app-language';
import { renderFlagOption } from '@/components/ui';
import {
  getActiveTranslationProvider,
  getTranslationProviderLabel,
  TRANSLATION_PROVIDER_CAPABILITIES,
} from '@/lib/translation';

/** Sync status types */
type SyncStatus = 'idle' | 'syncing' | 'ready' | 'failed';

interface GlossaryPanelProps {
  /** Callback when glossary is loaded */
  onGlossaryLoaded?: (glossary: Glossary) => void;
  /** Callback when glossary is cleared */
  onGlossaryCleared?: () => void;
  /** Callback when enforcement setting changes */
  onEnforcementChange?: (enabled: boolean) => void;
  /** Callback for force resync (DeepL only) */
  onForceResync?: (glossary: Glossary) => void;
  /** Initial locale to select (e.g., from PO file header) */
  initialLocale?: string;
  /** Current sync status from parent */
  syncStatus?: string | null;
  /** DeepL glossary ID (indicates native sync success) */
  deeplGlossaryId?: string | null;
  /** Number of glossary terms loaded */
  glossaryTermCount?: number;
  /** Currently selected entry's source text (for preview) */
  selectedSourceText?: string | null;
}

export function GlossaryPanel({
  onGlossaryLoaded,
  onGlossaryCleared,
  onEnforcementChange,
  onForceResync,
  initialLocale,
  syncStatus,
  deeplGlossaryId,
  glossaryTermCount,
  selectedSourceText,
}: GlossaryPanelProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(GLOSSARY_SELECTED_LOCALE_KEY);
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
      const stored = localStorage.getItem(GLOSSARY_ENFORCEMENT_KEY);
      return stored !== 'false'; // Default to true
    } catch {
      return true;
    }
  });

  // Determine sync status display
  const syncState: SyncStatus = useMemo(() => {
    if (!glossary) return 'idle';
    if (syncStatus === 'syncing') return 'syncing';
    if (syncStatus === 'sync-failed') return 'failed';
    if (deeplGlossaryId || syncStatus === 'ready') return 'ready';
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
        localStorage.setItem(GLOSSARY_SELECTED_LOCALE_KEY, selectedLocale);
      } else {
        localStorage.removeItem(GLOSSARY_SELECTED_LOCALE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [selectedLocale]);

  useEffect(() => {
    try {
      localStorage.setItem(GLOSSARY_ENFORCEMENT_KEY, String(enforcementEnabled));
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
          setError(result.error || t('Failed to load glossary'));
          setGlossary(null);
        }
      } catch (err) {
        setError(err instanceof Error ? t(err.message) : t('Unknown error'));
        setGlossary(null);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedLocale, onGlossaryLoaded, t],
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

    const provider = getActiveTranslationProvider();
    const providerLabel = getTranslationProviderLabel(provider);
    const capabilities = TRANSLATION_PROVIDER_CAPABILITIES[provider];

    switch (syncState) {
      case 'syncing':
        return (
          <Group gap={4}>
            <Loader size={12} />
            <Text size="xs" c="dimmed">
              {t('Syncing glossary...')}
            </Text>
          </Group>
        );
      case 'ready':
        return (
          <Group gap={4}>
            <Check size={12} color="var(--mantine-color-green-6)" />
            <Text size="xs" c="green">
              {glossaryTermCount != null
                ? t('{{provider}} ready ({{count}} terms)', {
                    provider: providerLabel,
                    count: glossaryTermCount,
                  })
                : t('{{provider}} ready', { provider: providerLabel })}
            </Text>
            {capabilities.nativeGlossary && (
              <Tooltip
                label={t('Force recreate glossary on {{provider}}', { provider: providerLabel })}
                color="dark"
              >
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => onForceResync?.(glossary)}
                >
                  {t('Resync')}
                </Button>
              </Tooltip>
            )}
          </Group>
        );
      case 'failed':
        return (
          <Group gap={4}>
            <X size={12} color="var(--mantine-color-red-6)" />
            <Text size="xs" c="red">
              {t('Sync failed')}
            </Text>
            <Button size="compact-xs" variant="subtle" onClick={() => onGlossaryLoaded?.(glossary)}>
              {t('Retry')}
            </Button>
          </Group>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Paper p="xs" withBorder radius="md">
        <Stack gap="xs">
          {/* Header row */}
          <Group justify="space-between">
            <UnstyledButton onClick={() => setIsExpanded(!isExpanded)} aria-expanded={isExpanded}>
              <Group gap="xs">
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <BookOpen size={16} />
                <Text size="sm" fw={500}>
                  {t('Glossary')}
                </Text>

                {glossary && (
                  <>
                    <Badge color="green" size="xs" variant="light">
                      {t('{{count}} terms', { count: glossary.entries.length })}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      ({glossary.targetLocale})
                    </Text>
                    {fromCache && (
                      <Badge color="gray" size="xs" variant="light">
                        {t('cached')}
                      </Badge>
                    )}
                  </>
                )}

                {!glossary && !isLoading && (
                  <Text size="xs" c="dimmed">
                    {t('Not loaded')}
                  </Text>
                )}
              </Group>
            </UnstyledButton>

            <Group gap="xs">
              {isLoading ? (
                <Loader size="xs" />
              ) : glossary ? (
                <>
                  <Tooltip label={t('Refresh from WordPress.org')} color="dark">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      aria-label={t('Refresh from WordPress.org')}
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
                    {t('Clear')}
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
                  {t('Load')}
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
                  label={t('Language')}
                  data={COMMON_GLOSSARY_LOCALES}
                  value={selectedLocale}
                  onChange={handleLocaleChange}
                  placeholder={t('Select or type locale...')}
                  searchable
                  clearable
                  w={200}
                  size="xs"
                  nothingFoundMessage={t('Type a custom locale code')}
                  renderOption={renderFlagOption}
                />

                {glossary && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<Eye size={14} />}
                    onClick={() => setViewerOpened(true)}
                  >
                    {t('View All')}
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
                    label={t('Apply glossary terms during translation')}
                    description={
                      enforcementEnabled
                        ? (() => {
                            const provider = getActiveTranslationProvider();
                            const capabilities = TRANSLATION_PROVIDER_CAPABILITIES[provider];
                            const providerLabel = getTranslationProviderLabel(provider);
                            if (capabilities.nativeGlossary) {
                              return t('{{provider}} will enforce glossary terms in translations', {
                                provider: providerLabel,
                              });
                            }
                            if (capabilities.promptGlossary) {
                              return t(
                                '{{provider}} will include glossary terms in the translation prompt',
                                {
                                  provider: providerLabel,
                                },
                              );
                            }
                            return t(
                              'Glossary loaded for analysis — {{provider}} does not support glossary enforcement',
                              {
                                provider: providerLabel,
                              },
                            );
                          })()
                        : t('Translations without glossary enforcement')
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
                    {t('Terms in selected row:')}
                  </Text>
                  <GlossaryTermsPreview sourceText={selectedSourceText} glossary={glossary} />
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
