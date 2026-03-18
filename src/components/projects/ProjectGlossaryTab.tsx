/**
 * ProjectGlossaryTab — per-language glossary configuration for cloud projects.
 *
 * Each language card shows:
 * - Source selector (WordPress / Repository / URL / None)
 * - Source-specific fields (repo uses RepoSyncModal in pick mode)
 * - Loaded glossary status: term count, sync state, viewer modal
 * - Enforcement toggle
 * - Refresh / clear / save controls
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Stack,
  Paper,
  Group,
  Text,
  SegmentedControl,
  TextInput,
  Switch,
  Button,
  Alert,
  Badge,
  Loader,
  Divider,
} from '@mantine/core';
import { BookOpen, AlertCircle, Check, X, RefreshCw, Eye, Trash2 } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { updateProjectLanguage } from '@/lib/projects/api';
import type { ProjectLanguageRow } from '@/lib/projects/types';
import { loadGlossaryForLanguage } from '@/lib/glossary/loader';
import type { Glossary } from '@/lib/glossary/types';
import { GlossaryViewerModal } from '@/components/glossary/shared';
import { RepoSyncModal, type RepoFilePickResult } from '@/components/repo-sync/RepoSyncModal';
import {
  getTranslationProviderLabel,
  TRANSLATION_PROVIDER_CAPABILITIES,
  hasProviderCredentials,
} from '@/lib/translation';
import { getTranslationProviderSettings } from '@/lib/translation/settings';
import { syncGlossaryToDeepL } from '@/lib/glossary';

interface LanguageGlossaryCardProps {
  language: ProjectLanguageRow;
  isManager: boolean;
  onUpdated: (updated: ProjectLanguageRow) => void;
}

function LanguageGlossaryCard({ language, isManager, onUpdated }: LanguageGlossaryCardProps) {
  const { t } = useTranslation();
  const [source, setSource] = useState<string>(language.glossary_source ?? 'none');
  const [url, setUrl] = useState(language.glossary_url ?? '');
  const [enforcement, setEnforcement] = useState(language.glossary_enforcement);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Glossary load state
  const [glossary, setGlossary] = useState<Glossary | null>(null);
  const [loadingGlossary, setLoadingGlossary] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewerOpened, setViewerOpened] = useState(false);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Repo picker state
  const [repoPickerOpen, setRepoPickerOpen] = useState(false);

  // Repo display info from saved language
  const hasGlossaryRepo = Boolean(
    language.glossary_repo_provider && language.glossary_repo_owner && language.glossary_repo_name,
  );
  const glossaryRepoLabel = hasGlossaryRepo
    ? `${language.glossary_repo_owner}/${language.glossary_repo_name}`
    : '';

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isDirty =
    source !== (language.glossary_source ?? 'none') ||
    url !== (language.glossary_url ?? '') ||
    enforcement !== language.glossary_enforcement;

  const translationProvider = getTranslationProviderSettings().provider;
  const providerCaps = TRANSLATION_PROVIDER_CAPABILITIES[translationProvider];

  // Load glossary + auto-sync to provider
  const loadPreview = useCallback(async () => {
    if (!language.glossary_source) return;
    setLoadingGlossary(true);
    setLoadError(null);
    setSyncStatus(null);
    try {
      const fetchResult = await loadGlossaryForLanguage(language);
      if (!mountedRef.current) return;
      if (fetchResult.glossary) {
        setGlossary(fetchResult.glossary);
        // Auto-sync to provider if it supports native glossary
        if (providerCaps.nativeGlossary && hasProviderCredentials(translationProvider)) {
          setSyncStatus('syncing');
          try {
            await syncGlossaryToDeepL(
              fetchResult.glossary,
              (s) => mountedRef.current && setSyncStatus(s),
            );
          } catch {
            if (mountedRef.current) setSyncStatus('sync-failed');
          }
        } else {
          setSyncStatus('ready');
        }
      } else {
        setLoadError(fetchResult.error ?? null);
      }
    } catch {
      if (mountedRef.current) setLoadError(t('Failed to load glossary.'));
    } finally {
      if (mountedRef.current) setLoadingGlossary(false);
    }
  }, [language, translationProvider, providerCaps.nativeGlossary, t]);

  // Auto-load preview on mount if source is configured
  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  // Save source + enforcement (for WordPress and URL modes)
  const handleSave = useCallback(async () => {
    setSaving(true);
    setResult(null);
    try {
      const glossarySource = source === 'none' ? null : (source as 'wordpress' | 'repo' | 'url');
      const updated = await updateProjectLanguage(language.id, {
        glossary_source: glossarySource,
        glossary_url: source === 'url' ? url.trim() || null : null,
        // Clear repo fields if not using repo source
        glossary_repo_provider: source === 'repo' ? language.glossary_repo_provider : null,
        glossary_repo_owner: source === 'repo' ? language.glossary_repo_owner : null,
        glossary_repo_name: source === 'repo' ? language.glossary_repo_name : null,
        glossary_repo_branch: source === 'repo' ? language.glossary_repo_branch : null,
        glossary_repo_file_path: source === 'repo' ? language.glossary_repo_file_path : null,
        glossary_repo_default_branch:
          source === 'repo' ? language.glossary_repo_default_branch : null,
        glossary_enforcement: enforcement,
      });
      onUpdated(updated);
      setResult({ ok: true, msg: t('Glossary settings saved.') });
      // Reload preview
      setGlossary(null);
      setSyncStatus(null);
    } catch (err) {
      setResult({
        ok: false,
        msg: err instanceof Error ? err.message : t('Failed to save glossary settings.'),
      });
    } finally {
      setSaving(false);
    }
  }, [language, source, url, enforcement, onUpdated, t]);

  // Handle repo file picked from the RepoSyncModal in pick mode
  const handleRepoPicked = useCallback(
    async (pick: RepoFilePickResult) => {
      setSaving(true);
      setResult(null);
      try {
        const updated = await updateProjectLanguage(language.id, {
          glossary_source: 'repo',
          glossary_repo_provider: pick.provider,
          glossary_repo_owner: pick.owner,
          glossary_repo_name: pick.repo,
          glossary_repo_branch: pick.branch,
          glossary_repo_file_path: pick.filePath,
          glossary_repo_default_branch: pick.defaultBranch,
          glossary_enforcement: enforcement,
        });
        onUpdated(updated);
        setSource('repo');
        setResult({ ok: true, msg: t('Repository glossary linked.') });
        setGlossary(null);
        setSyncStatus(null);
      } catch (err) {
        setResult({
          ok: false,
          msg: err instanceof Error ? err.message : t('Failed to save repo glossary settings.'),
        });
      } finally {
        setSaving(false);
        setRepoPickerOpen(false);
      }
    },
    [language.id, enforcement, onUpdated, t],
  );

  // Clear glossary from this language
  const handleClear = useCallback(async () => {
    setSaving(true);
    try {
      const updated = await updateProjectLanguage(language.id, {
        glossary_source: null,
        glossary_url: null,
        glossary_repo_provider: null,
        glossary_repo_owner: null,
        glossary_repo_name: null,
        glossary_repo_branch: null,
        glossary_repo_file_path: null,
        glossary_repo_default_branch: null,
      });
      onUpdated(updated);
      setSource('none');
      setGlossary(null);
      setSyncStatus(null);
      setLoadError(null);
      setResult(null);
    } catch {
      // best effort
    } finally {
      setSaving(false);
    }
  }, [language.id, onUpdated]);

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="xs">
            <Text size="sm" fw={600}>
              {language.locale}
            </Text>
            {language.source_filename && (
              <Text size="xs" c="dimmed" truncate>
                {language.source_filename}
              </Text>
            )}
          </Group>
          <Group gap="xs">
            {glossary && (
              <Badge variant="light" color="green" size="sm">
                {glossary.entries.length} {t('terms')}
              </Badge>
            )}
            {language.glossary_source && (
              <Badge variant="light" size="sm">
                {language.glossary_source}
              </Badge>
            )}
          </Group>
        </Group>

        {isManager ? (
          <>
            {/* Source selector */}
            <SegmentedControl
              value={source}
              onChange={(v) => {
                setSource(v);
                setResult(null);
              }}
              data={[
                { value: 'none', label: t('None') },
                { value: 'wordpress', label: t('WordPress') },
                { value: 'repo', label: t('Repository') },
                { value: 'url', label: t('URL') },
              ]}
              size="xs"
            />

            {/* Source-specific fields */}
            {source === 'wordpress' && (
              <Text size="xs" c="dimmed">
                {t('Auto-loads the WordPress.org glossary for locale "{{locale}}".', {
                  locale: language.locale,
                })}
              </Text>
            )}

            {source === 'repo' && (
              <Stack gap="xs">
                {hasGlossaryRepo && language.glossary_repo_file_path ? (
                  <Group gap="xs">
                    <Badge variant="light" size="sm">
                      {language.glossary_repo_provider === 'github' ? 'GitHub' : 'GitLab'}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {glossaryRepoLabel} — {language.glossary_repo_file_path}
                    </Text>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      onClick={() => setRepoPickerOpen(true)}
                    >
                      {t('Change')}
                    </Button>
                  </Group>
                ) : (
                  <Button size="xs" variant="light" onClick={() => setRepoPickerOpen(true)}>
                    {t('Select glossary file from repository')}
                  </Button>
                )}
              </Stack>
            )}

            {source === 'url' && (
              <TextInput
                size="xs"
                label={t('Glossary CSV URL')}
                placeholder="https://example.com/glossary.csv"
                value={url}
                onChange={(e) => setUrl(e.currentTarget.value)}
                description={t('HTTPS URL to a CSV glossary file.')}
              />
            )}

            {/* Enforcement toggle */}
            <Switch
              label={t('Glossary enforcement')}
              description={
                providerCaps.nativeGlossary
                  ? t('{{provider}} will enforce glossary terms in machine translations.', {
                      provider: getTranslationProviderLabel(translationProvider),
                    })
                  : providerCaps.promptGlossary
                    ? t('{{provider}} will include glossary terms in the translation prompt.', {
                        provider: getTranslationProviderLabel(translationProvider),
                      })
                    : t(
                        'Glossary analysis is active but {{provider}} does not support enforcement.',
                        {
                          provider: getTranslationProviderLabel(translationProvider),
                        },
                      )
              }
              checked={enforcement}
              onChange={(e) => setEnforcement(e.currentTarget.checked)}
              size="sm"
            />

            {/* Loading state */}
            {loadingGlossary && (
              <Group gap="xs">
                <Loader size={12} />
                <Text size="xs" c="dimmed">
                  {t('Loading glossary...')}
                </Text>
              </Group>
            )}

            {loadError && (
              <Alert color="red" variant="light" icon={<AlertCircle size={14} />}>
                <Text size="xs">{loadError}</Text>
              </Alert>
            )}

            {/* Loaded glossary status */}
            {glossary && !loadingGlossary && (
              <>
                <Divider />
                <Group justify="space-between">
                  <Group gap="xs">
                    {syncStatus === 'syncing' ? (
                      <>
                        <Loader size={12} />
                        <Text size="xs" c="dimmed">
                          {t('Syncing glossary...')}
                        </Text>
                      </>
                    ) : syncStatus === 'ready' || syncStatus === 'synced' ? (
                      <>
                        <Check size={12} color="var(--mantine-color-green-6)" />
                        <Text size="xs" c="green">
                          {t('{{provider}} ready ({{count}} terms)', {
                            provider: getTranslationProviderLabel(translationProvider),
                            count: glossary.entries.length,
                          })}
                        </Text>
                      </>
                    ) : syncStatus === 'sync-failed' ? (
                      <>
                        <X size={12} color="var(--mantine-color-red-6)" />
                        <Text size="xs" c="red">
                          {t('Sync failed')}
                        </Text>
                      </>
                    ) : (
                      <Text size="xs" c="dimmed">
                        {glossary.entries.length} {t('terms loaded')}
                      </Text>
                    )}
                  </Group>
                  <Group gap="xs">
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      leftSection={<RefreshCw size={12} />}
                      onClick={loadPreview}
                      loading={loadingGlossary}
                    >
                      {t('Refresh')}
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      leftSection={<Eye size={12} />}
                      onClick={() => setViewerOpened(true)}
                    >
                      {t('View')}
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="red"
                      leftSection={<Trash2 size={12} />}
                      onClick={handleClear}
                      loading={saving}
                    >
                      {t('Clear')}
                    </Button>
                  </Group>
                </Group>
              </>
            )}

            {/* Save / result */}
            {result && (
              <Alert
                color={result.ok ? 'green' : 'red'}
                variant="light"
                icon={result.ok ? <Check size={14} /> : <AlertCircle size={14} />}
              >
                <Text size="xs">{result.msg}</Text>
              </Alert>
            )}

            {/* Save button — not shown for repo mode (saved via picker) */}
            {source !== 'repo' && (
              <Group>
                <Button size="xs" onClick={handleSave} loading={saving} disabled={!isDirty}>
                  {t('Save')}
                </Button>
              </Group>
            )}
          </>
        ) : (
          /* Read-only view for non-managers */
          <Stack gap="xs">
            {glossary ? (
              <Group gap="xs">
                <Badge variant="light" color="green" size="sm">
                  {glossary.entries.length} {t('terms')}
                </Badge>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  leftSection={<Eye size={12} />}
                  onClick={() => setViewerOpened(true)}
                >
                  {t('View')}
                </Button>
              </Group>
            ) : (
              <Text size="xs" c="dimmed">
                {language.glossary_source
                  ? t('Glossary source: {{source}}', { source: language.glossary_source })
                  : t('No glossary configured.')}
              </Text>
            )}
          </Stack>
        )}
      </Stack>

      {/* Glossary viewer modal */}
      {glossary && (
        <GlossaryViewerModal
          glossary={glossary}
          opened={viewerOpened}
          onClose={() => setViewerOpened(false)}
        />
      )}

      {/* Repo file picker — uses RepoSyncModal in pick mode */}
      <RepoSyncModal
        opened={repoPickerOpen}
        onClose={() => setRepoPickerOpen(false)}
        onFileLoaded={() => {}}
        serializedContent={null}
        mode="pick"
        onFilePicked={handleRepoPicked}
        title={t('Select glossary CSV from repository')}
        pickFileFilter=".csv"
      />
    </Paper>
  );
}

interface ProjectGlossaryTabProps {
  languages: ProjectLanguageRow[];
  isManager: boolean;
  onLanguageUpdated: (updated: ProjectLanguageRow) => void;
}

export function ProjectGlossaryTab({
  languages,
  isManager,
  onLanguageUpdated,
}: ProjectGlossaryTabProps) {
  const { t } = useTranslation();

  if (languages.length === 0) {
    return (
      <Alert color="blue" variant="light" icon={<BookOpen size={16} />}>
        <Text size="sm">{t('Add a language to configure glossary settings.')}</Text>
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {t(
          'Configure glossary sources per language. Glossaries enforce consistent terminology in machine translations.',
        )}
      </Text>
      {languages.map((lang) => (
        <LanguageGlossaryCard
          key={lang.id}
          language={lang}
          isManager={isManager}
          onUpdated={onLanguageUpdated}
        />
      ))}
    </Stack>
  );
}
