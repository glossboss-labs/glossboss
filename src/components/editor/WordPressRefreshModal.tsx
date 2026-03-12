import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import { RefreshCw } from 'lucide-react';
import type { POEntry } from '@/lib/po/types';
import { parsePOFileWithDiagnostics } from '@/lib/po';
import {
  diffEntriesAgainstTemplate,
  fetchProjectReleases,
  fetchUpstreamTemplate,
  fetchWordPressTranslationFile,
  type ReleaseDiffSummary,
  type WordPressPluginTranslationTrack,
  type WordPressProjectType,
} from '@/lib/wp-source';
import { useTranslation } from '@/lib/app-language';

export interface WordPressRefreshApplyRequest {
  mergedEntries: POEntry[];
  deltaEntryIds: string[];
  release: string | null;
  track: WordPressPluginTranslationTrack;
  summary: ReleaseDiffSummary;
  refreshGlossary: boolean;
}

interface WordPressRefreshModalProps {
  opened: boolean;
  onClose: () => void;
  projectType: WordPressProjectType;
  projectSlug: string;
  currentEntries: POEntry[];
  currentRelease?: string | null;
  locale?: string;
  onApplyRefresh: (request: WordPressRefreshApplyRequest) => Promise<void>;
}

export function WordPressRefreshModal({
  opened,
  onClose,
  projectType,
  projectSlug,
  currentEntries,
  currentRelease,
  locale,
  onApplyRefresh,
}: WordPressRefreshModalProps) {
  const { t } = useTranslation();
  const [track, setTrack] = useState<WordPressPluginTranslationTrack>('stable');
  const [release, setRelease] = useState<string | null>(currentRelease ?? null);
  const [availableReleases, setAvailableReleases] = useState<string[]>([]);
  const [refreshGlossary, setRefreshGlossary] = useState(true);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templatePath, setTemplatePath] = useState<string | null>(null);
  const [diffPreview, setDiffPreview] = useState<ReturnType<
    typeof diffEntriesAgainstTemplate
  > | null>(null);

  useEffect(() => {
    if (!opened) return;
    setDiffPreview(null);
    setTemplatePath(null);
    setError(null);
    let cancelled = false;
    setIsLoadingReleases(true);
    void fetchProjectReleases(projectType, projectSlug)
      .then((releases) => {
        if (cancelled) return;
        setAvailableReleases(releases);
        setRelease((current) => current ?? currentRelease ?? releases[0] ?? null);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Failed to load releases.'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingReleases(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentRelease, opened, projectSlug, projectType, t]);

  const releaseOptions = useMemo(
    () => availableReleases.map((item) => ({ value: item, label: item })),
    [availableReleases],
  );

  const handleCompare = useCallback(async () => {
    setIsComparing(true);
    setError(null);
    try {
      const template = await fetchUpstreamTemplate(
        projectType,
        projectSlug,
        projectType === 'plugin' && track === 'dev' ? null : release,
      );

      if (template) {
        setTemplatePath(template.path);
        setDiffPreview(diffEntriesAgainstTemplate(currentEntries, template.file.entries));
        return;
      }

      if (!locale) {
        throw new Error(t('No POT template was found for the selected release.'));
      }

      const translationExport = await fetchWordPressTranslationFile({
        projectType,
        slug: projectSlug,
        locale,
        track,
      });
      const parsed = parsePOFileWithDiagnostics(translationExport, `${projectSlug}-${locale}.po`);
      if (!parsed.success || !parsed.file) {
        throw new Error(t('Neither a POT template nor a usable translation export was found.'));
      }

      setTemplatePath(t('WordPress.org translation export'));
      setDiffPreview(diffEntriesAgainstTemplate(currentEntries, parsed.file.entries));
    } catch (compareError) {
      setDiffPreview(null);
      setTemplatePath(null);
      setError(
        compareError instanceof Error ? compareError.message : t('Failed to compare releases.'),
      );
    } finally {
      setIsComparing(false);
    }
  }, [currentEntries, locale, projectSlug, projectType, release, t, track]);

  const handleApply = useCallback(async () => {
    if (!diffPreview) return;

    setIsApplying(true);
    setError(null);
    try {
      await onApplyRefresh({
        mergedEntries: diffPreview.mergeEntries,
        deltaEntryIds: Array.from(diffPreview.deltaEntryIds),
        release: projectType === 'plugin' && track === 'dev' ? null : release,
        track,
        summary: diffPreview.summary,
        refreshGlossary,
      });
      onClose();
    } catch (applyError) {
      setError(
        applyError instanceof Error ? applyError.message : t('Failed to apply the refresh.'),
      );
    } finally {
      setIsApplying(false);
    }
  }, [diffPreview, onApplyRefresh, onClose, projectType, refreshGlossary, release, t, track]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('Refresh from WordPress.org')}
      centered
      size="md"
    >
      <Stack gap="md">
        <Group grow align="flex-start">
          {projectType === 'plugin' && (
            <Select
              label={t('Track')}
              value={track}
              onChange={(value) => setTrack((value as WordPressPluginTranslationTrack) || 'stable')}
              data={[
                { value: 'stable', label: t('Stable') },
                { value: 'dev', label: t('Development') },
              ]}
              allowDeselect={false}
            />
          )}
          <Select
            label={t('Release')}
            value={release}
            onChange={setRelease}
            data={releaseOptions}
            placeholder={
              projectType === 'plugin' && track === 'dev'
                ? t('Trunk / development')
                : t('Select a release')
            }
            disabled={projectType === 'plugin' && track === 'dev'}
            searchable
            nothingFoundMessage={t('No releases found')}
          />
        </Group>

        <Checkbox
          checked={refreshGlossary}
          onChange={(event) => setRefreshGlossary(event.currentTarget.checked)}
          label={t('Refresh glossary after applying this update')}
        />

        {isLoadingReleases && (
          <Group gap="xs">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              {t('Loading releases...')}
            </Text>
          </Group>
        )}

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        {diffPreview && (
          <Alert color="blue" variant="light" icon={<RefreshCw size={16} />}>
            <Stack gap="sm">
              <Group gap="xs" wrap="wrap">
                <Badge color="green" variant="light">
                  {t('{{count}} added', { count: diffPreview.summary.added })}
                </Badge>
                <Badge color="violet" variant="light">
                  {t('{{count}} changed', { count: diffPreview.summary.changed })}
                </Badge>
                <Badge color="orange" variant="light">
                  {t('{{count}} removed', { count: diffPreview.summary.removed })}
                </Badge>
              </Group>
              {templatePath && (
                <Text size="xs" c="dimmed">
                  {t('Template path: {{path}}', { path: templatePath })}
                </Text>
              )}
              <Text size="sm">
                {t(
                  'Applying this refresh will merge the upstream template into your current file and focus the resulting upstream delta entries.',
                )}
              </Text>
            </Stack>
          </Alert>
        )}

        <Group justify="space-between">
          <Button variant="default" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Group gap="xs">
            <Button variant="default" onClick={() => void handleCompare()} loading={isComparing}>
              {t('Preview diff')}
            </Button>
            <Button onClick={() => void handleApply()} loading={isApplying} disabled={!diffPreview}>
              {t('Apply refresh')}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
