/**
 * Explore — public discovery page with platform stats and project listing.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Title,
  Group,
  Text,
  Center,
  Loader,
  Alert,
  Stack,
  TextInput,
  Select,
  ThemeIcon,
  Paper,
  Progress,
  SimpleGrid,
} from '@mantine/core';
import { motion, useInView, useMotionValue, useSpring } from 'motion/react';
import { AlertCircle, Search, Globe, Languages, FileText, Users, TrendingUp } from 'lucide-react';
import { staggerPageVariants, fadeVariants } from '@/lib/motion';
import { AnimatedStateSwitch } from '@/components/ui';
import { useTranslation, msgid } from '@/lib/app-language';
import { sortProjects, type ProjectSortOption } from '@/lib/utils/sorting';
import { trackEvent } from '@/lib/analytics';
import { listPublicProjects } from '@/lib/projects/api';
import { invokeSupabaseFunction } from '@/lib/supabase/client';
import { ProjectGrid } from '@/components/projects/ProjectGrid';
import { renderFlagOption } from '@/components/ui/renderFlagOption';
import type { ProjectWithLanguages } from '@/lib/projects/types';
import { createFuseSearch, fuzzyFilter } from '@/lib/utils/fuzzy-search';

const MotionDiv = motion.div;

type SortOption = ProjectSortOption;

const SORT_LABELS: Record<SortOption, string> = {
  updated: msgid('Last updated'),
  name: msgid('Name A\u2013Z'),
  'most-strings': msgid('Most strings'),
  'most-complete': msgid('Most complete'),
  'least-complete': msgid('Least complete'),
};

interface PlatformStats {
  totalStrings: number;
  totalProjects: number;
  totalMembers: number;
  totalLanguages: number;
}

/** Animated counter that springs from 0 to the target value on scroll-into-view. */
function AnimatedStat({
  value,
  label,
  icon,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const isInView = useInView(containerRef, { once: true });

  useEffect(() => {
    if (isInView && value > 0) motionValue.set(value);
  }, [isInView, motionValue, value]);

  useEffect(
    () =>
      springValue.on('change', (latest) => {
        if (ref.current) {
          ref.current.textContent = Math.round(latest).toLocaleString();
        }
      }),
    [springValue],
  );

  return (
    <Paper ref={containerRef} p="lg" radius="md" withBorder style={{ textAlign: 'center' }}>
      <Group justify="center" mb={8}>
        <ThemeIcon variant="light" color="blue" size="lg" radius="xl">
          {icon}
        </ThemeIcon>
      </Group>
      <Text size="xl" fw={700} className="gb-tabular-nums">
        <span ref={ref}>0</span>
      </Text>
      <Text size="xs" c="dimmed" mt={4}>
        {label}
      </Text>
    </Paper>
  );
}

/** Aggregate stats computed from public projects for the summary bar. */
function useProjectStats(projects: ProjectWithLanguages[]) {
  return useMemo(() => {
    const totalStrings = projects.reduce((s, p) => s + p.stats_total, 0);
    const totalTranslated = projects.reduce((s, p) => s + p.stats_translated, 0);
    const totalLanguages = new Set(
      projects.flatMap((p) => (p.project_languages ?? []).map((l) => l.locale)),
    ).size;
    const avgCompletion = totalStrings > 0 ? Math.round((totalTranslated / totalStrings) * 100) : 0;
    return { totalStrings, totalTranslated, totalLanguages, avgCompletion };
  }, [projects]);
}

export default function Explore() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectWithLanguages[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('updated');
  const [formatFilter, setFormatFilter] = useState<string | null>(null);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);

  // Fetch public projects
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await listPublicProjects();
        if (!cancelled) {
          setProjects(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('Failed to load projects'));
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  // Fetch platform-wide stats
  const statsFetchedRef = useRef(false);
  useEffect(() => {
    if (statsFetchedRef.current) return;
    statsFetchedRef.current = true;

    async function loadStats() {
      try {
        const { data } = await invokeSupabaseFunction<{ ok: boolean; stats: PlatformStats }>(
          'platform-stats',
          { featureLabel: 'Platform stats' },
        );
        if (data?.ok && data.stats) setPlatformStats(data.stats);
      } catch {
        // Stats are non-critical — fail silently
      }
    }
    void loadStats();
  });

  const projectStats = useProjectStats(projects);

  const exploreFuse = useMemo(
    () => createFuseSearch(projects, ['name', 'description', 'wp_slug']),
    [projects],
  );

  const filtered = useMemo(() => {
    let result = fuzzyFilter(exploreFuse, projects, search, ['name', 'description', 'wp_slug']);

    if (formatFilter) {
      result = result.filter((p) => p.source_format === formatFilter);
    }

    if (languageFilter) {
      result = result.filter((p) => p.project_languages?.some((l) => l.locale === languageFilter));
    }

    return sortProjects(result, sort);
  }, [exploreFuse, projects, search, sort, formatFilter, languageFilter]);

  const sortOptions = (Object.keys(SORT_LABELS) as SortOption[]).map((k) => ({
    value: k,
    label: t(SORT_LABELS[k]),
  }));

  const formatOptions = [
    { value: 'po', label: 'PO' },
    { value: 'i18next', label: 'i18next' },
  ];

  const languageOptions = useMemo(() => {
    const locales = new Set<string>();
    for (const p of projects) {
      for (const l of p.project_languages ?? []) {
        locales.add(l.locale);
      }
    }
    const dn = new Intl.DisplayNames(['en'], { type: 'language' });
    return [...locales]
      .map((l) => {
        let name: string;
        try {
          name = dn.of(l.replace(/_/g, '-')) ?? l;
        } catch {
          name = l;
        }
        return { value: l, label: `${name} (${l})` };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [projects]);

  const stateKey = loading ? 'loading' : error ? 'error' : projects.length === 0 ? 'empty' : 'data';

  return (
    <>
      <MotionDiv variants={staggerPageVariants} initial="hidden" animate="visible">
        {/* Hero header */}
        <MotionDiv variants={fadeVariants}>
          <Stack gap={4} mb="xl">
            <Group gap="sm" align="center">
              <ThemeIcon variant="light" color="blue" size="xl" radius="xl">
                <Globe size={22} />
              </ThemeIcon>
              <div>
                <Title order={2}>{t('Explore')}</Title>
                <Text size="sm" c="dimmed">
                  {t('Discover and contribute to public translation projects')}
                </Text>
              </div>
            </Group>
          </Stack>
        </MotionDiv>

        {/* Platform stats counters */}
        {platformStats && (platformStats.totalStrings > 0 || platformStats.totalProjects > 0) && (
          <MotionDiv variants={fadeVariants}>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="xl">
              <AnimatedStat
                value={platformStats.totalStrings}
                label={t('strings translated')}
                icon={<FileText size={18} />}
              />
              <AnimatedStat
                value={platformStats.totalProjects}
                label={t('projects')}
                icon={<Globe size={18} />}
              />
              <AnimatedStat
                value={platformStats.totalMembers}
                label={t('members')}
                icon={<Users size={18} />}
              />
              <AnimatedStat
                value={platformStats.totalLanguages}
                label={t('languages')}
                icon={<Languages size={18} />}
              />
            </SimpleGrid>
          </MotionDiv>
        )}

        {/* Content — animated state transitions */}
        <MotionDiv variants={fadeVariants}>
          <AnimatedStateSwitch stateKey={stateKey}>
            {loading && (
              <Center py={80}>
                <Loader size="lg" />
              </Center>
            )}

            {error && (
              <Alert icon={<AlertCircle size={16} />} color="red" variant="light" mb="md">
                {error}
              </Alert>
            )}

            {!loading && !error && projects.length === 0 && (
              <Center py={80}>
                <Stack align="center" gap="md">
                  <ThemeIcon size="xl" variant="light" color="blue" radius="xl">
                    <Globe size={24} />
                  </ThemeIcon>
                  <Text size="lg" c="dimmed">
                    {t('No public projects yet')}
                  </Text>
                </Stack>
              </Center>
            )}

            {!loading && projects.length > 0 && (
              <>
                {/* Community summary bar */}
                <Paper withBorder p="md" radius="md" mb="lg">
                  <Group justify="space-between" wrap="wrap" gap="md">
                    <Group gap="lg">
                      <Group gap={6}>
                        <Globe size={14} style={{ opacity: 0.5 }} />
                        <Text size="sm" fw={500}>
                          {t('{{count}} projects', { count: projects.length })}
                        </Text>
                      </Group>
                      <Group gap={6}>
                        <FileText size={14} style={{ opacity: 0.5 }} />
                        <Text size="sm" c="dimmed">
                          {t('{{count}} strings', {
                            count: projectStats.totalStrings.toLocaleString(),
                          })}
                        </Text>
                      </Group>
                      <Group gap={6}>
                        <Languages size={14} style={{ opacity: 0.5 }} />
                        <Text size="sm" c="dimmed">
                          {t('{{count}} languages', { count: projectStats.totalLanguages })}
                        </Text>
                      </Group>
                    </Group>
                    <Group gap={8}>
                      <TrendingUp size={14} style={{ opacity: 0.5 }} />
                      <Text size="sm" c="dimmed">
                        {t('{{pct}}% translated', { pct: projectStats.avgCompletion })}
                      </Text>
                      <Progress
                        value={projectStats.avgCompletion}
                        size="sm"
                        color="blue"
                        style={{ width: 80 }}
                        radius="xl"
                      />
                    </Group>
                  </Group>
                </Paper>

                {/* Search + filters */}
                <Group mb="md" gap="sm" wrap="wrap">
                  <TextInput
                    placeholder={t('Search projects…')}
                    leftSection={<Search size={14} />}
                    value={search}
                    onChange={(e) => setSearch(e.currentTarget.value)}
                    style={{ flex: '1 1 200px', minWidth: 0 }}
                  />
                  <Select
                    data={formatOptions}
                    value={formatFilter}
                    onChange={setFormatFilter}
                    placeholder={t('Format')}
                    clearable
                    style={{ flex: '0 1 auto' }}
                    size="sm"
                  />
                  {languageOptions.length > 0 && (
                    <Select
                      data={languageOptions}
                      value={languageFilter}
                      onChange={setLanguageFilter}
                      placeholder={t('Language')}
                      clearable
                      searchable
                      renderOption={renderFlagOption}
                      style={{ flex: '0 1 auto' }}
                      size="sm"
                    />
                  )}
                  <Select
                    data={sortOptions}
                    value={sort}
                    onChange={(v) => setSort((v as SortOption) || 'updated')}
                    style={{ flex: '0 1 auto' }}
                    size="sm"
                    allowDeselect={false}
                  />
                </Group>

                {filtered.length === 0 ? (
                  <Center py={40}>
                    <Text size="sm" c="dimmed">
                      {t('No projects match your search')}
                    </Text>
                  </Center>
                ) : (
                  <div
                    onClick={(e) => {
                      const link = (e.target as HTMLElement).closest('a[href*="/projects/"]');
                      if (link) {
                        const match = link.getAttribute('href')?.match(/\/projects\/([^/]+)/);
                        if (match) {
                          const project = filtered.find((p) => p.id === match[1]);
                          trackEvent('explore_project_opened', {
                            slug: project?.wp_slug ?? project?.name ?? match[1],
                          });
                        }
                      }
                    }}
                  >
                    <ProjectGrid projects={filtered} />
                  </div>
                )}
              </>
            )}
          </AnimatedStateSwitch>
        </MotionDiv>
      </MotionDiv>
    </>
  );
}
