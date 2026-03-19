/**
 * Glossary Section — locale selector, load from WP/CSV, glossary viewer,
 * enforcement toggle, and DeepL sync status.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Stack,
  Button,
  Group,
  Text,
  Alert,
  Badge,
  Select,
  Switch,
  Loader,
  Paper,
  ActionIcon,
  Tooltip,
  Divider,
  FileButton,
} from '@mantine/core';
import { Check, AlertCircle, RefreshCw, X, Eye, Upload } from 'lucide-react';
import { fetchWPGlossary, clearWPGlossaryCache, type FetchResult } from '@/lib/glossary/wp-fetcher';
import { parseGlossaryCSV, isValidGlossaryCSV } from '@/lib/glossary/csv-parser';
import { GlossaryTermsPreview, GlossaryViewerModal } from '@/components/glossary/shared';
import {
  COMMON_GLOSSARY_LOCALES,
  GLOSSARY_ENFORCEMENT_KEY,
  GLOSSARY_SELECTED_LOCALE_KEY,
} from '@/components/glossary/constants';
import type { Glossary } from '@/lib/glossary/types';
import {
  getTranslationProviderSettings,
  getTranslationProviderLabel,
  TRANSLATION_PROVIDER_CAPABILITIES,
  hasProviderCredentials,
} from '@/lib/translation';
import { syncGlossaryToDeepL } from '@/lib/glossary';
import { useTranslation } from '@/lib/app-language';
import { renderFlagOption } from '@/components/ui';

export interface GlossarySectionProps {
  initialLocale?: string;
  onGlossaryLoaded?: (glossary: Glossary) => void;
  onGlossaryCleared?: () => void;
  onEnforcementChange?: (enabled: boolean) => void;
  onForceResync?: (glossary: Glossary) => void;
  glossary?: Glossary | null;
  syncStatus?: string | null;
  deeplGlossaryId?: string | null;
  glossaryTermCount?: number;
  selectedSourceText?: string | null;
}

export function GlossarySection({
  initialLocale,
  onGlossaryLoaded,
  onGlossaryCleared,
  onEnforcementChange,
  onForceResync,
  glossary,
  syncStatus,
  deeplGlossaryId,
  glossaryTermCount,
  selectedSourceText,
}: GlossarySectionProps) {
  const { t } = useTranslation();

  const translationProvider = getTranslationProviderSettings().provider;

  const [selectedLocale, setSelectedLocale] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(GLOSSARY_SELECTED_LOCALE_KEY);
      return stored || initialLocale || '';
    } catch {
      return initialLocale || '';
    }
  });
  const [localGlossary, setLocalGlossary] = useState<Glossary | null>(null);
  // When rendered standalone (Settings page), use locally-loaded glossary as fallback
  const effectiveGlossary = glossary ?? localGlossary;
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
  const loadTokenRef = useRef(0);
  const csvUploadResetRef = useRef<() => void>(null);

  // Local sync state — used when running standalone (no syncStatus prop)
  const isStandalone = syncStatus === undefined;
  const [localSyncStatus, setLocalSyncStatus] = useState<string | null>(null);
  const [localDeeplGlossaryId, setLocalDeeplGlossaryId] = useState<string | null>(null);
  const [localGlossaryTermCount, setLocalGlossaryTermCount] = useState<number | undefined>(
    undefined,
  );
  const effectiveSyncStatus = isStandalone ? localSyncStatus : syncStatus;
  const effectiveDeeplGlossaryId = isStandalone ? localDeeplGlossaryId : deeplGlossaryId;
  const effectiveGlossaryTermCount = isStandalone ? localGlossaryTermCount : glossaryTermCount;

  // Update locale when initialLocale changes
  useEffect(() => {
    if (initialLocale && initialLocale !== selectedLocale && !effectiveGlossary) {
      setSelectedLocale(initialLocale);
    }
  }, [initialLocale]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist locale selection
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

  // Persist enforcement setting
  useEffect(() => {
    try {
      localStorage.setItem(GLOSSARY_ENFORCEMENT_KEY, String(enforcementEnabled));
    } catch {
      // Ignore storage errors
    }
    onEnforcementChange?.(enforcementEnabled);
  }, [enforcementEnabled, onEnforcementChange]);

  const handleLoadGlossary = useCallback(
    async (forceRefresh = false) => {
      if (!selectedLocale) return;

      const token = ++loadTokenRef.current;
      setIsLoadingGlossary(true);
      setGlossaryError(null);

      try {
        const result: FetchResult = await fetchWPGlossary(selectedLocale, forceRefresh);
        if (loadTokenRef.current !== token) return;
        if (result.glossary) {
          setLocalGlossary(result.glossary);
          onGlossaryLoaded?.(result.glossary);
          if (result.error) setGlossaryError(result.error);
        } else {
          setGlossaryError(result.error || t('Failed to load glossary'));
        }
      } catch (err) {
        if (loadTokenRef.current !== token) return;
        setGlossaryError(err instanceof Error ? t(err.message) : t('Unknown error'));
      } finally {
        if (loadTokenRef.current === token) {
          setIsLoadingGlossary(false);
        }
      }
    },
    [selectedLocale, onGlossaryLoaded, t],
  );

  const handleClearGlossary = useCallback(() => {
    ++loadTokenRef.current; // invalidate any in-flight load
    if (selectedLocale) {
      clearWPGlossaryCache(selectedLocale);
    }
    setLocalGlossary(null);
    setIsLoadingGlossary(false);
    setHasAttemptedAutoLoad(true); // Prevent auto-load from re-fetching after clear
    onGlossaryCleared?.();
  }, [selectedLocale, onGlossaryCleared]);

  const handleCsvUpload = useCallback(
    (file: File | null) => {
      if (!file || !selectedLocale) return;
      setGlossaryError(null);

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;

        if (!isValidGlossaryCSV(text)) {
          setGlossaryError(t('File does not appear to be a valid WordPress glossary CSV.'));
          csvUploadResetRef.current?.();
          return;
        }

        const parseResult = parseGlossaryCSV(text);
        if (parseResult.entries.length === 0) {
          setGlossaryError(
            parseResult.errors[0] || t('No glossary entries found in the uploaded file.'),
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

        setLocalGlossary(uploaded);
        onGlossaryLoaded?.(uploaded);
        csvUploadResetRef.current?.();
      };
      reader.onerror = () => {
        setGlossaryError(t('Failed to read the file.'));
        csvUploadResetRef.current?.();
      };
      reader.readAsText(file);
    },
    [selectedLocale, onGlossaryLoaded, t],
  );

  // Standalone sync: when a glossary is loaded and we have provider credentials, auto-sync
  const handleStandaloneSync = useCallback(async (glossaryToSync: Glossary) => {
    const provider = getTranslationProviderSettings().provider;
    const capabilities = TRANSLATION_PROVIDER_CAPABILITIES[provider];

    if (capabilities.nativeGlossary && hasProviderCredentials(provider)) {
      setLocalSyncStatus('syncing');
      try {
        const glossaryId = await syncGlossaryToDeepL(glossaryToSync, setLocalSyncStatus);
        setLocalDeeplGlossaryId(glossaryId);
        setLocalGlossaryTermCount(glossaryToSync.entries.length);
      } catch {
        setLocalSyncStatus('sync-failed');
      }
    } else {
      setLocalDeeplGlossaryId(null);
      setLocalSyncStatus('ready');
      setLocalGlossaryTermCount(glossaryToSync.entries.length);
    }
  }, []);

  // Auto-sync when glossary changes in standalone mode
  useEffect(() => {
    if (isStandalone && effectiveGlossary) {
      void handleStandaloneSync(effectiveGlossary);
    }
  }, [isStandalone, effectiveGlossary, handleStandaloneSync]);

  // Reset auto-load flag when locale changes
  useEffect(() => {
    setHasAttemptedAutoLoad(false);
  }, [selectedLocale]);

  // Auto-load glossary from cache on initial mount if we have a locale but no glossary
  useEffect(() => {
    if (selectedLocale && !effectiveGlossary && !isLoadingGlossary && !hasAttemptedAutoLoad) {
      setHasAttemptedAutoLoad(true);
      // Try to load from cache (forceRefresh = false)
      handleLoadGlossary(false);
    }
  }, [
    selectedLocale,
    effectiveGlossary,
    isLoadingGlossary,
    hasAttemptedAutoLoad,
    handleLoadGlossary,
  ]);

  return (
    <>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t(
            'Glossaries ensure consistent translations for key terms. Load one from WordPress.org or upload your own CSV. Cloud projects have their own glossary settings in Project Settings.',
          )}
        </Text>

        <Group align="flex-end" gap="sm">
          <Select
            label={t('Language')}
            placeholder={t('Select locale')}
            data={COMMON_GLOSSARY_LOCALES}
            value={selectedLocale}
            onChange={(value) => setSelectedLocale(value || '')}
            searchable
            style={{ flex: 1 }}
            renderOption={renderFlagOption}
          />

          {!effectiveGlossary ? (
            <Button
              onClick={() => handleLoadGlossary(false)}
              loading={isLoadingGlossary}
              disabled={!selectedLocale}
            >
              {t('Load glossary')}
            </Button>
          ) : (
            <Group gap="xs">
              <Tooltip label={t('Refresh from WordPress.org')}>
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
                {t('Clear')}
              </Button>
            </Group>
          )}
        </Group>

        {glossaryError && (
          <Alert color="red" icon={<AlertCircle size={16} />}>
            {glossaryError}
          </Alert>
        )}

        <Divider label={t('or upload manually')} labelPosition="center" />

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
                {t('Upload CSV')}
              </Button>
            )}
          </FileButton>
          <Text size="xs" c="dimmed">
            {t('Upload a WordPress glossary CSV for the selected language')}
          </Text>
        </Group>

        {effectiveGlossary && (
          <Paper p="md" withBorder>
            <Stack gap="sm">
              {/* Header with stats */}
              <Group justify="space-between">
                <Group gap="xs">
                  <Badge color="green" variant="light">
                    {effectiveGlossary.entries.length} {t('terms')}
                  </Badge>
                  <Text size="sm" c="dimmed">
                    ({effectiveGlossary.targetLocale})
                  </Text>
                </Group>

                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<Eye size={14} />}
                  onClick={() => setViewerOpened(true)}
                >
                  {t('View All')}
                </Button>
              </Group>

              {/* Provider sync status */}
              <Group gap="xs">
                {effectiveSyncStatus === 'syncing' ? (
                  <>
                    <Loader size={12} />
                    <Text size="xs" c="dimmed">
                      {t('Syncing glossary...')}
                    </Text>
                  </>
                ) : effectiveDeeplGlossaryId || effectiveSyncStatus === 'ready' ? (
                  <>
                    <Check size={12} color="var(--mantine-color-green-6)" />
                    <Text size="xs" c="green">
                      {effectiveGlossaryTermCount != null
                        ? t('{{provider}} ready ({{count}} terms)', {
                            provider: getTranslationProviderLabel(translationProvider),
                            count: effectiveGlossaryTermCount,
                          })
                        : t('{{provider}} ready', {
                            provider: getTranslationProviderLabel(translationProvider),
                          })}
                    </Text>
                    {TRANSLATION_PROVIDER_CAPABILITIES[translationProvider].nativeGlossary && (
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        color="gray"
                        onClick={() =>
                          isStandalone
                            ? handleStandaloneSync(effectiveGlossary)
                            : onForceResync?.(effectiveGlossary)
                        }
                      >
                        {t('Resync')}
                      </Button>
                    )}
                  </>
                ) : effectiveSyncStatus === 'sync-failed' ? (
                  <>
                    <X size={12} color="var(--mantine-color-red-6)" />
                    <Text size="xs" c="red">
                      {t('Sync failed')}
                    </Text>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      onClick={() =>
                        isStandalone
                          ? handleStandaloneSync(effectiveGlossary)
                          : onGlossaryLoaded?.(effectiveGlossary)
                      }
                    >
                      {t('Retry')}
                    </Button>
                  </>
                ) : null}
              </Group>

              <Divider />

              {/* Enforcement toggle */}
              <Switch
                label={t('Use glossary for translations')}
                description={
                  TRANSLATION_PROVIDER_CAPABILITIES[translationProvider].nativeGlossary
                    ? t('{{provider}} will enforce glossary terms in machine translations', {
                        provider: getTranslationProviderLabel(translationProvider),
                      })
                    : TRANSLATION_PROVIDER_CAPABILITIES[translationProvider].promptGlossary
                      ? t('{{provider}} will include glossary terms in the translation prompt', {
                          provider: getTranslationProviderLabel(translationProvider),
                        })
                      : t(
                          'Glossary analysis is active but {{provider}} does not support glossary enforcement',
                          {
                            provider: getTranslationProviderLabel(translationProvider),
                          },
                        )
                }
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
                      {t('Terms in selected text:')}
                    </Text>
                    <GlossaryTermsPreview
                      sourceText={selectedSourceText}
                      glossary={effectiveGlossary}
                    />
                  </div>
                </>
              )}
            </Stack>
          </Paper>
        )}
      </Stack>

      {/* Glossary viewer modal */}
      {effectiveGlossary && (
        <GlossaryViewerModal
          glossary={effectiveGlossary}
          opened={viewerOpened}
          onClose={() => setViewerOpened(false)}
        />
      )}
    </>
  );
}
