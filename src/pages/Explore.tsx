/**
 * Explore — public discovery page listing all public projects.
 */

import { useEffect, useMemo, useState } from 'react';
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
} from '@mantine/core';
import { motion } from 'motion/react';
import { AlertCircle, Search, Globe } from 'lucide-react';
import { sectionVariants, contentVariants, fadeVariants } from '@/lib/motion';
import { useTranslation, msgid } from '@/lib/app-language';
import { trackEvent } from '@/lib/analytics';
import { listPublicProjects } from '@/lib/projects/api';
import { ProjectGrid } from '@/components/projects/ProjectGrid';
import type { ProjectWithLanguages } from '@/lib/projects/types';

const MotionDiv = motion.div;

type SortOption = 'updated' | 'name' | 'most-strings' | 'least-complete' | 'most-complete';

const SORT_LABELS: Record<SortOption, string> = {
  updated: msgid('Last updated'),
  name: msgid('Name A\u2013Z'),
  'most-strings': msgid('Most strings'),
  'most-complete': msgid('Most complete'),
  'least-complete': msgid('Least complete'),
};

function sortProjects(projects: ProjectWithLanguages[], sort: SortOption): ProjectWithLanguages[] {
  const sorted = [...projects];
  switch (sort) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'most-strings':
      return sorted.sort((a, b) => b.stats_total - a.stats_total);
    case 'most-complete': {
      const pct = (p: ProjectWithLanguages) =>
        p.stats_total > 0 ? p.stats_translated / p.stats_total : 0;
      return sorted.sort((a, b) => pct(b) - pct(a));
    }
    case 'least-complete': {
      const pct = (p: ProjectWithLanguages) =>
        p.stats_total > 0 ? p.stats_translated / p.stats_total : 0;
      return sorted.sort((a, b) => pct(a) - pct(b));
    }
    case 'updated':
    default:
      return sorted.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
  }
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

  const filtered = useMemo(() => {
    let result = projects;

    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.wp_slug && p.wp_slug.toLowerCase().includes(q)),
      );
    }

    if (formatFilter) {
      result = result.filter((p) => p.source_format === formatFilter);
    }

    if (languageFilter) {
      result = result.filter((p) => p.project_languages?.some((l) => l.locale === languageFilter));
    }

    return sortProjects(result, sort);
  }, [projects, search, sort, formatFilter, languageFilter]);

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
    return [...locales].sort().map((l) => ({ value: l, label: l }));
  }, [projects]);

  return (
    <>
      <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
        <Group justify="space-between" mb="xl">
          <div>
            <Title order={2}>{t('Explore')}</Title>
            <Text size="sm" mt={4} c="dimmed">
              {t('Public translation projects')}
            </Text>
          </div>
        </Group>

        {loading && (
          <MotionDiv variants={fadeVariants} initial="hidden" animate="visible">
            <Center py={80}>
              <Loader size="lg" />
            </Center>
          </MotionDiv>
        )}

        {error && (
          <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
            <Alert icon={<AlertCircle size={16} />} color="red" variant="light" mb="md">
              {error}
            </Alert>
          </MotionDiv>
        )}

        {!loading && !error && projects.length === 0 && (
          <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
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
          </MotionDiv>
        )}

        {!loading && projects.length > 0 && (
          <>
            <Text size="sm" mb="sm" c="dimmed">
              {t('{{projects}} projects', { projects: projects.length })}
            </Text>

            {projects.length >= 3 && (
              <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
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
              </MotionDiv>
            )}

            {filtered.length === 0 ? (
              <MotionDiv variants={contentVariants} initial="hidden" animate="visible">
                <Center py={40}>
                  <Text size="sm" c="dimmed">
                    {t('No projects match your search')}
                  </Text>
                </Center>
              </MotionDiv>
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
      </MotionDiv>
    </>
  );
}
