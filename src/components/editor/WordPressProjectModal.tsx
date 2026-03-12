import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Group, Loader, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { Globe, Info } from 'lucide-react';
import {
  buildWordPressReleaseList,
  fetchProjectReleases,
  fetchWordPressProjectInfo,
  type WordPressPluginTranslationTrack,
  type WordPressProjectType,
} from '@/lib/wp-source';
import { useTranslation } from '@/lib/app-language';

export interface WordPressProjectOpenRequest {
  projectType: WordPressProjectType;
  slug: string;
  locale: string;
  track: WordPressPluginTranslationTrack;
  release: string | null;
}

interface WordPressProjectModalProps {
  opened: boolean;
  onClose: () => void;
  initialLocale?: string;
  onOpenProject: (request: WordPressProjectOpenRequest) => Promise<void>;
}

function normalizeLocale(value?: string): string {
  return value?.trim().split(/[-_]/)[0]?.toLowerCase() || '';
}

export function WordPressProjectModal({
  opened,
  onClose,
  initialLocale,
  onOpenProject,
}: WordPressProjectModalProps) {
  const { t } = useTranslation();
  const [projectType, setProjectType] = useState<WordPressProjectType>('plugin');
  const [slug, setSlug] = useState('');
  const [locale, setLocale] = useState(normalizeLocale(initialLocale));
  const [track, setTrack] = useState<WordPressPluginTranslationTrack>('stable');
  const [selectedRelease, setSelectedRelease] = useState<string | null>(null);
  const [availableReleases, setAvailableReleases] = useState<string[]>([]);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setLocale((current) => current || normalizeLocale(initialLocale));
  }, [initialLocale, opened]);

  useEffect(() => {
    if (!opened) return;
    const trimmedSlug = slug.trim().toLowerCase();
    if (!trimmedSlug) {
      setProjectName(null);
      setAvailableReleases([]);
      setSelectedRelease(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsLoadingMeta(true);
      setError(null);
      try {
        const [infoResult, releasesResult] = await Promise.allSettled([
          fetchWordPressProjectInfo(projectType, trimmedSlug),
          fetchProjectReleases(projectType, trimmedSlug),
        ]);
        if (cancelled) return;

        const info = infoResult.status === 'fulfilled' ? infoResult.value : null;
        if (!info) {
          setProjectName(null);
          setAvailableReleases([]);
          setSelectedRelease(null);
          setError(t('Project not found on WordPress.org.'));
          return;
        }

        const releases = buildWordPressReleaseList([
          ...(releasesResult.status === 'fulfilled' ? releasesResult.value : []),
          info.latestVersion,
        ]);

        setProjectName(info.name);
        setAvailableReleases(releases);
        setSelectedRelease((current) => current ?? info.latestVersion ?? releases[0] ?? null);
      } catch (metaError) {
        if (!cancelled) {
          setProjectName(null);
          setAvailableReleases([]);
          setSelectedRelease(null);
          setError(
            metaError instanceof Error ? metaError.message : t('Failed to load project metadata.'),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMeta(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [opened, projectType, slug, t]);

  const releaseOptions = useMemo(
    () => availableReleases.map((release) => ({ value: release, label: release })),
    [availableReleases],
  );

  const handleSubmit = useCallback(async () => {
    const trimmedSlug = slug.trim().toLowerCase();
    const trimmedLocale = locale.trim().toLowerCase();
    if (!trimmedSlug || !trimmedLocale) {
      setError(t('Choose a slug and locale before opening a project.'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onOpenProject({
        projectType,
        slug: trimmedSlug,
        locale: trimmedLocale,
        track,
        release: projectType === 'plugin' && track === 'dev' ? null : selectedRelease,
      });
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t('Failed to open the WordPress project.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [locale, onClose, onOpenProject, projectType, selectedRelease, slug, t, track]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('Open from WordPress.org')}
      centered
      size="md"
    >
      <Stack gap="md">
        <Group grow align="flex-start">
          <Select
            label={t('Project type')}
            value={projectType}
            onChange={(value) => setProjectType((value as WordPressProjectType) || 'plugin')}
            data={[
              { value: 'plugin', label: t('Plugin') },
              { value: 'theme', label: t('Theme') },
            ]}
            allowDeselect={false}
          />
          <TextInput
            label={t('Slug')}
            placeholder={projectType === 'theme' ? 'twentytwentyfive' : 'woocommerce'}
            value={slug}
            onChange={(event) => setSlug(event.currentTarget.value)}
          />
        </Group>

        <Group grow align="flex-start">
          <TextInput
            label={t('Locale')}
            placeholder="nl"
            value={locale}
            onChange={(event) => setLocale(event.currentTarget.value)}
          />
          {projectType === 'plugin' ? (
            <Select
              label={t('Translation track')}
              value={track}
              onChange={(value) => setTrack((value as WordPressPluginTranslationTrack) || 'stable')}
              data={[
                { value: 'stable', label: t('Stable') },
                { value: 'dev', label: t('Development') },
              ]}
              allowDeselect={false}
            />
          ) : (
            <TextInput
              label={t('Release')}
              value={selectedRelease ?? ''}
              readOnly
              placeholder={t('Latest')}
            />
          )}
        </Group>

        <Select
          label={t('Source release')}
          value={selectedRelease}
          onChange={setSelectedRelease}
          data={releaseOptions}
          placeholder={
            track === 'dev' && projectType === 'plugin'
              ? t('Trunk / development')
              : t('Select a release')
          }
          disabled={projectType === 'plugin' && track === 'dev'}
          searchable
          nothingFoundMessage={t('No releases found')}
        />

        {isLoadingMeta && (
          <Group gap="xs">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              {t('Loading project metadata...')}
            </Text>
          </Group>
        )}

        {projectName && (
          <Alert icon={<Info size={16} />} color="blue" variant="light">
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                {projectName}
              </Text>
              <Text size="xs" c="dimmed">
                {projectType === 'plugin' && track === 'dev'
                  ? t(
                      'The translation file will be loaded from the development track and source browsing will follow trunk.',
                    )
                  : t(
                      'The translation file will be loaded from WordPress.org and source browsing will use the selected release.',
                    )}
              </Text>
            </Stack>
          </Alert>
        )}

        {error && (
          <Alert icon={<Globe size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={() => void handleSubmit()} loading={isSubmitting}>
            {t('Open project')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
