/**
 * SidebarProjectSearch — fuzzy search across recent and all projects.
 *
 * Compact search input for the sidebar. Results are grouped into
 * "Recent" and "All projects" sections. Keyboard navigable.
 */

import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  TextInput,
  Stack,
  Text,
  Group,
  Box,
  UnstyledButton,
  Tooltip,
  ActionIcon,
  ScrollArea,
  Popover,
} from '@mantine/core';
import { Search, FolderOpen, History, X } from 'lucide-react';
import { motion } from 'motion/react';
import { ambientEnter } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { useProjects } from '@/lib/projects/queries';
import { useRecentProjects, type RecentProject } from '@/hooks/use-recent-projects';
import { createFuseSearch, fuzzyFilter } from '@/lib/utils/fuzzy-search';

interface SidebarProjectSearchProps {
  collapsed: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  path: string;
  isRecent: boolean;
}

const RESULT_ITEM_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  borderRadius: 'var(--mantine-radius-sm)',
  width: '100%',
  transition: 'background-color 120ms ease',
  cursor: 'pointer',
} as const;

export function SidebarProjectSearch({ collapsed }: SidebarProjectSearchProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const { recentProjects } = useRecentProjects();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build Fuse instances
  const recentFuse = useMemo(() => createFuseSearch(recentProjects, ['name']), [recentProjects]);

  const allProjectItems = useMemo(
    () =>
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? '',
      })),
    [projects],
  );

  const allFuse = useMemo(
    () => createFuseSearch(allProjectItems, ['name', 'description']),
    [allProjectItems],
  );

  // Compute results
  const results = useMemo((): SearchResult[] => {
    const q = query.trim();

    // Filter recent projects
    const matchedRecent = fuzzyFilter(recentFuse, recentProjects, q, ['name']).map(
      (rp: RecentProject) => ({
        id: rp.id,
        name: rp.name,
        path: rp.path,
        isRecent: true,
      }),
    );

    // Filter all projects, excluding those already in recent results
    const recentIds = new Set(matchedRecent.map((r) => r.id));
    const matchedAll = fuzzyFilter(allFuse, allProjectItems, q, ['name', 'description'])
      .filter((p) => !recentIds.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        path: `/projects/${p.id}`,
        isRecent: false,
      }));

    return [...matchedRecent, ...matchedAll];
  }, [query, recentFuse, recentProjects, allFuse, allProjectItems]);

  const recentResults = results.filter((r) => r.isRecent);
  const allResults = results.filter((r) => !r.isRecent);
  const flatResults = results;

  const handleSelect = useCallback(
    (result: SearchResult) => {
      navigate(result.path);
      setQuery('');
      setOpen(false);
      setActiveIndex(-1);
    },
    [navigate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1));
      } else if (e.key === 'Enter' && activeIndex >= 0 && flatResults[activeIndex]) {
        e.preventDefault();
        handleSelect(flatResults[activeIndex]);
      } else if (e.key === 'Escape') {
        setQuery('');
        setOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
      }
    },
    [flatResults, activeIndex, handleSelect],
  );

  const handleFocus = useCallback(() => setOpen(true), []);
  const handleClear = useCallback(() => {
    setQuery('');
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, []);

  // Collapsed: show search icon that expands
  if (collapsed) {
    return (
      <Tooltip label={t('Search projects')} position="right" withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="md"
          style={{ width: '100%' }}
          onClick={() => {
            // Could expand sidebar here, for now navigate to dashboard
            navigate('/dashboard');
          }}
        >
          <Search size={18} />
        </ActionIcon>
      </Tooltip>
    );
  }

  const hasResults = flatResults.length > 0;
  const showDropdown = open && (query.trim().length > 0 || recentProjects.length > 0);

  return (
    <Popover
      opened={showDropdown}
      onChange={setOpen}
      position="bottom-start"
      width="target"
      withinPortal={false}
      shadow="var(--gb-shadow-menu)"
      offset={4}
    >
      <Popover.Target>
        <TextInput
          ref={inputRef}
          placeholder={t('Search projects...')}
          leftSection={<Search size={14} style={{ color: 'var(--gb-text-tertiary)' }} />}
          rightSection={
            query ? (
              <ActionIcon variant="subtle" color="gray" size="xs" onClick={handleClear}>
                <X size={12} />
              </ActionIcon>
            ) : null
          }
          value={query}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            setActiveIndex(-1);
            if (!open) setOpen(true);
          }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          size="xs"
          styles={{
            input: {
              backgroundColor: 'var(--gb-surface-2)',
              borderColor: 'var(--gb-border-subtle)',
              fontSize: 'var(--mantine-font-size-xs)',
              '&:focus': {
                borderColor: 'var(--gb-border-focus)',
              },
            },
          }}
        />
      </Popover.Target>

      <Popover.Dropdown
        p={0}
        style={{
          backgroundColor: 'var(--gb-surface-1)',
          borderColor: 'var(--gb-border-subtle)',
          overflow: 'hidden',
        }}
      >
        <ScrollArea.Autosize mah={320} type="scroll" scrollbarSize={6}>
          <Stack gap={0} py={4}>
            {!hasResults && query.trim() && (
              <Text size="xs" c="dimmed" ta="center" py="sm">
                {t('No projects found')}
              </Text>
            )}

            {/* Recent matches */}
            {recentResults.length > 0 && (
              <>
                <Group gap={4} px={10} pt={4} pb={2}>
                  <History size={10} style={{ color: 'var(--gb-text-tertiary)' }} />
                  <Text size="xs" c="dimmed" fw={500}>
                    {t('Recent')}
                  </Text>
                </Group>
                {recentResults.map((r, i) => {
                  const globalIdx = i;
                  return (
                    <ResultItem
                      key={`recent-${r.id}`}
                      result={r}
                      active={activeIndex === globalIdx}
                      icon={<History size={14} style={{ color: 'var(--gb-text-tertiary)' }} />}
                      onSelect={handleSelect}
                      index={i}
                    />
                  );
                })}
              </>
            )}

            {/* All project matches */}
            {allResults.length > 0 && (
              <>
                {recentResults.length > 0 && (
                  <Box
                    my={4}
                    style={{
                      height: 1,
                      backgroundColor: 'var(--gb-border-subtle)',
                    }}
                  />
                )}
                <Group gap={4} px={10} pt={4} pb={2}>
                  <FolderOpen size={10} style={{ color: 'var(--gb-text-tertiary)' }} />
                  <Text size="xs" c="dimmed" fw={500}>
                    {t('All projects')}
                  </Text>
                </Group>
                {allResults.slice(0, 8).map((r, i) => {
                  const globalIdx = recentResults.length + i;
                  return (
                    <ResultItem
                      key={`all-${r.id}`}
                      result={r}
                      active={activeIndex === globalIdx}
                      icon={<FolderOpen size={14} style={{ color: 'var(--gb-text-tertiary)' }} />}
                      onSelect={handleSelect}
                      index={i}
                    />
                  );
                })}
              </>
            )}
          </Stack>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}

function ResultItem({
  result,
  active,
  icon,
  onSelect,
  index,
}: {
  result: SearchResult;
  active: boolean;
  icon: React.ReactNode;
  onSelect: (r: SearchResult) => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...ambientEnter, delay: index * 0.02 }}
    >
      <UnstyledButton px={10} py={0} style={{ width: '100%' }} onClick={() => onSelect(result)}>
        <Box
          style={{
            ...RESULT_ITEM_STYLE,
            backgroundColor: active ? 'var(--gb-highlight-row)' : 'transparent',
          }}
        >
          {icon}
          <Text size="xs" truncate style={{ flex: 1 }}>
            {result.name}
          </Text>
        </Box>
      </UnstyledButton>
    </motion.div>
  );
}
