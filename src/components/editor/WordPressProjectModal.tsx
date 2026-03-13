import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Info } from 'lucide-react';
import {
  buildWordPressReleaseList,
  fetchProjectLocales,
  fetchProjectReleases,
  fetchWordPressProjectInfo,
  searchWordPressProjects,
  type WordPressPluginTranslationTrack,
  type WordPressProjectLocale,
  type WordPressProjectSuggestion,
  type WordPressProjectType,
} from '@/lib/wp-source';
import { contentVariants, buttonStates } from '@/lib/motion';
import { debugWarn } from '@/lib/debug';
import { useTranslation } from '@/lib/app-language';

const MotionStack = motion.create(Stack);

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
  return value?.trim().replaceAll('_', '-').toLowerCase() || '';
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function isSlugLike(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
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
  const effectiveTrack: WordPressPluginTranslationTrack =
    projectType === 'plugin' ? track : 'stable';
  const [selectedRelease, setSelectedRelease] = useState<string | null>(null);
  const [availableReleases, setAvailableReleases] = useState<string[]>([]);
  const [availableLocales, setAvailableLocales] = useState<WordPressProjectLocale[]>([]);
  const [localeLoadError, setLocaleLoadError] = useState<string | null>(null);
  const [slugSuggestions, setSlugSuggestions] = useState<WordPressProjectSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipMetaDebounceRef = useRef(false);

  useEffect(() => {
    if (!opened) return;
    setLocale((current) => current || normalizeLocale(initialLocale));
  }, [initialLocale, opened]);

  // Search effect — fires after 250ms debounce
  useEffect(() => {
    if (!opened) return;
    const trimmedQuery = slug.trim();
    if (trimmedQuery.length < 3) {
      setSlugSuggestions([]);
      setIsLoadingSuggestions(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const suggestions = await searchWordPressProjects(projectType, trimmedQuery);
        if (!cancelled) {
          setSlugSuggestions(suggestions);
        }
      } catch (searchError) {
        if (!cancelled) {
          setSlugSuggestions([]);
          debugWarn('[WordPress] Slug search failed', searchError);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSuggestions(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [opened, projectType, slug]);

  // Metadata effect — fires independently on slug-like input after 500ms debounce
  useEffect(() => {
    if (!opened) {
      setIsLoadingMeta(false);
      return;
    }
    const trimmedSlug = normalizeSlug(slug);
    if (!trimmedSlug || trimmedSlug.length < 3 || !isSlugLike(trimmedSlug)) {
      setIsLoadingMeta(false);
      setProjectName(null);
      setAvailableReleases([]);
      setAvailableLocales([]);
      setLocaleLoadError(null);
      setSelectedRelease(null);
      setError(null);
      return;
    }

    const shouldSkipDebounce = skipMetaDebounceRef.current;
    skipMetaDebounceRef.current = false;

    let cancelled = false;
    const timeoutId = window.setTimeout(
      async () => {
        setIsLoadingMeta(true);
        setError(null);
        try {
          const [infoResult, releasesResult, localesResult] = await Promise.allSettled([
            fetchWordPressProjectInfo(projectType, trimmedSlug),
            fetchProjectReleases(projectType, trimmedSlug),
            fetchProjectLocales(projectType, trimmedSlug, effectiveTrack),
          ]);
          if (cancelled) return;

          const info = infoResult.status === 'fulfilled' ? infoResult.value : null;
          if (!info) {
            setProjectName(null);
            setAvailableReleases([]);
            setAvailableLocales([]);
            setLocaleLoadError(null);
            setSelectedRelease(null);
            setLocale('');
            setError(t('Project not found on WordPress.org.'));
            return;
          }

          const releases = buildWordPressReleaseList([
            ...(releasesResult.status === 'fulfilled' ? releasesResult.value : []),
            info.latestVersion,
          ]);

          setProjectName(info.name);
          setAvailableReleases(releases);
          const locales = localesResult.status === 'fulfilled' ? localesResult.value : [];
          const localeError =
            localesResult.status === 'rejected'
              ? localesResult.reason instanceof Error
                ? localesResult.reason.message
                : t('Failed to load supported locales.')
              : null;
          setAvailableLocales(locales);
          setLocaleLoadError(localeError);
          setSelectedRelease((current) =>
            current && releases.includes(current)
              ? current
              : (info.latestVersion ?? releases[0] ?? null),
          );
          setLocale((current) => {
            if (localeError || locales.length === 0) {
              return current || normalizeLocale(initialLocale);
            }
            const availableValues = new Set(locales.map((item) => item.value));
            const initialValue = normalizeLocale(initialLocale);
            if (current && availableValues.has(current)) return current;
            if (initialValue && availableValues.has(initialValue)) return initialValue;
            return '';
          });
        } catch (metaError) {
          if (!cancelled) {
            setProjectName(null);
            setAvailableReleases([]);
            setAvailableLocales([]);
            setLocaleLoadError(null);
            setSelectedRelease(null);
            setLocale('');
            setError(
              metaError instanceof Error
                ? metaError.message
                : t('Failed to load project metadata.'),
            );
          }
        } finally {
          if (!cancelled) {
            setIsLoadingMeta(false);
          }
        }
      },
      shouldSkipDebounce ? 0 : 500,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [initialLocale, opened, projectType, slug, t, effectiveTrack]);

  const releaseOptions = useMemo(
    () => availableReleases.map((release) => ({ value: release, label: release })),
    [availableReleases],
  );
  const slugSuggestionOptions = useMemo(
    () => slugSuggestions.map((suggestion) => suggestion.slug),
    [slugSuggestions],
  );

  const handleSlugChange = useCallback(
    (value: string) => {
      setSlug(value);
    },
    [setSlug],
  );

  const handleSlugOptionSubmit = useCallback(
    (value: string) => {
      setSlug(value);
      skipMetaDebounceRef.current = true;
    },
    [setSlug],
  );

  const handleSubmit = useCallback(async () => {
    const trimmedSlug = normalizeSlug(slug);
    const trimmedLocale = locale.trim().replaceAll('_', '-').toLowerCase();
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
        track: effectiveTrack,
        release: effectiveTrack === 'dev' ? null : selectedRelease,
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
  }, [locale, onClose, onOpenProject, projectType, selectedRelease, slug, t, effectiveTrack]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('Open from WordPress.org')}
      centered
      size="lg"
      closeButtonProps={{ 'aria-label': t('Close dialog') }}
    >
      <AnimatePresence mode="wait">
        {opened && (
          <MotionStack
            gap="md"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Group grow>
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
              <Autocomplete
                label={t('Slug')}
                placeholder={projectType === 'theme' ? 'twentytwentyfive' : 'woocommerce'}
                value={slug}
                onChange={handleSlugChange}
                onOptionSubmit={handleSlugOptionSubmit}
                data={slugSuggestionOptions}
                nothingFoundMessage={t('No matching slugs')}
                rightSection={isLoadingSuggestions ? <Loader size="xs" /> : undefined}
              />
            </Group>

            <Group grow>
              {localeLoadError || availableLocales.length === 0 ? (
                <TextInput
                  label={t('Locale')}
                  placeholder="nl"
                  value={locale}
                  onChange={(event) => setLocale(event.currentTarget.value)}
                />
              ) : (
                <Select
                  label={t('Locale')}
                  placeholder={t('Select a locale')}
                  value={locale}
                  onChange={(value) => setLocale(value || '')}
                  data={availableLocales}
                  searchable
                  nothingFoundMessage={t('No locales found')}
                />
              )}
              {projectType === 'plugin' && (
                <Select
                  label={t('Translation track')}
                  value={track}
                  onChange={(value) =>
                    setTrack((value as WordPressPluginTranslationTrack) || 'stable')
                  }
                  data={[
                    { value: 'stable', label: t('Stable') },
                    { value: 'dev', label: t('Development') },
                  ]}
                  allowDeselect={false}
                />
              )}
              <Select
                label={t('Source release')}
                value={selectedRelease}
                onChange={setSelectedRelease}
                data={releaseOptions}
                placeholder={
                  effectiveTrack === 'dev' ? t('Trunk / development') : t('Select a release')
                }
                disabled={effectiveTrack === 'dev'}
                searchable
                nothingFoundMessage={t('No releases found')}
              />
            </Group>

            {isLoadingMeta && (
              <Stack gap="xs">
                <Skeleton height={16} width="60%" />
                <Skeleton height={12} width="80%" />
              </Stack>
            )}

            {projectName && !isLoadingMeta && (
              <Alert icon={<Info size={16} />} color="blue" variant="light">
                <Stack gap={4}>
                  <Text size="sm" fw={500}>
                    {projectName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {effectiveTrack === 'dev'
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

            <Group justify="flex-end" gap="sm">
              <motion.div {...buttonStates}>
                <Button variant="default" onClick={onClose}>
                  {t('Cancel')}
                </Button>
              </motion.div>
              <motion.div {...buttonStates}>
                <Button onClick={() => void handleSubmit()} loading={isSubmitting}>
                  {t('Open project')}
                </Button>
              </motion.div>
            </Group>
          </MotionStack>
        )}
      </AnimatePresence>
    </Modal>
  );
}
