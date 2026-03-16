/**
 * Filter Toolbar Component
 *
 * Single-row toolbar: search, filter dropdown, sort, columns, and progress.
 * Filters are collapsed into a Popover to reduce visual noise.
 * Filter chips cycle through: neutral -> show only -> don't show -> neutral
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import {
  TextInput,
  Group,
  Badge,
  ActionIcon,
  Text,
  Tooltip,
  Box,
  Progress,
  Stack,
  Menu,
  Button,
  Checkbox,
  Select,
  UnstyledButton,
  Popover,
  Divider,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  X,
  FileQuestion,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Pencil,
  Bot,
  Edit3,
  Columns3,
  ArrowUpDown,
  GripVertical,
  RefreshCw,
  Filter,
} from 'lucide-react';
import {
  useEditorStore,
  type FilterType,
  type FilterState,
  type SortDirection,
  type SortField,
  type TableColumn,
} from '@/stores/editor-store';
import { getDeepLClient, hasUserApiKey } from '@/lib/deepl';
import { msgid, useTranslation } from '@/lib/app-language';
import type { UsageStats } from '@/lib/deepl/types';
import {
  getActiveTranslationProvider,
  getTranslationProviderLabel,
  getTranslationUsage,
  hasActiveProviderCredentials,
  TRANSLATION_USAGE_REFRESH_EVENT,
} from '@/lib/translation';
import { contentVariants, interactiveSpring } from '@/lib/motion';
import { useDragGhost } from '@/hooks/use-drag-ghost';

const MotionDiv = motion.div;

/** Filter configuration */
interface FilterConfig {
  id: FilterType;
  label: string;
  icon: typeof FileQuestion;
  color: string;
}

const TRANSLATION_FILTERS: FilterConfig[] = [
  { id: 'untranslated', label: msgid('Untranslated'), icon: FileQuestion, color: 'red' },
  { id: 'translated', label: msgid('Translated'), icon: CheckCircle, color: 'green' },
  { id: 'fuzzy', label: msgid('Fuzzy'), icon: AlertTriangle, color: 'yellow' },
  { id: 'modified', label: msgid('Modified'), icon: Pencil, color: 'orange' },
  { id: 'qa-error', label: msgid('QA errors'), icon: ShieldAlert, color: 'red' },
  { id: 'qa-warning', label: msgid('QA warnings'), icon: AlertTriangle, color: 'orange' },
  { id: 'upstream-delta', label: msgid('Upstream delta'), icon: RefreshCw, color: 'violet' },
];

const REVIEW_FILTERS: FilterConfig[] = [
  { id: 'review-draft', label: msgid('Review: draft'), icon: FileQuestion, color: 'gray' },
  { id: 'review-in-review', label: msgid('Review: in review'), icon: Edit3, color: 'blue' },
  { id: 'review-approved', label: msgid('Review: approved'), icon: CheckCircle, color: 'green' },
  {
    id: 'review-needs-changes',
    label: msgid('Review: needs changes'),
    icon: AlertTriangle,
    color: 'orange',
  },
  {
    id: 'review-unresolved',
    label: msgid('Unresolved comments'),
    icon: Pencil,
    color: 'red',
  },
  { id: 'review-changed', label: msgid('Changed strings'), icon: Pencil, color: 'violet' },
];

/** Get tooltip text based on current filter state */
function getFilterStateLabel(
  label: string,
  state: FilterState | null,
  t: (key: string, vars?: Record<string, unknown>) => string,
): string {
  if (state === 'include') {
    return t('Showing only {{label}} \u2022 Click to exclude', { label: label.toLowerCase() });
  }
  if (state === 'exclude') {
    return t('Hiding {{label}} \u2022 Click to clear filter', { label: label.toLowerCase() });
  }
  return t('Click to show only {{label}}', { label: label.toLowerCase() });
}

/** Get badge variant and style based on filter state */
function getBadgeStyle(state: FilterState | null): {
  variant: 'filled' | 'light' | 'outline';
  style: React.CSSProperties;
} {
  const base: React.CSSProperties = {
    cursor: 'pointer',
    userSelect: 'none',
    flexShrink: 0,
  };
  if (state === 'include') {
    return {
      variant: 'light',
      style: { ...base, borderWidth: 2, borderStyle: 'solid', borderColor: 'currentColor' },
    };
  }
  if (state === 'exclude') {
    return { variant: 'light', style: { ...base, opacity: 0.45, textDecoration: 'line-through' } };
  }
  return { variant: 'light', style: base };
}

/** Clickable filter badge used inside the filter dropdown */
function FilterBadge({
  filter,
  count,
  state,
  onToggle,
  t,
}: {
  filter: FilterConfig;
  count: number;
  state: FilterState | null;
  onToggle: () => void;
  t: (key: string, vars?: Record<string, unknown>) => string;
}) {
  const Icon = filter.icon;
  const badgeStyle = getBadgeStyle(state);

  return (
    <Tooltip
      label={getFilterStateLabel(t(filter.label), state, t)}
      position="right"
      openDelay={400}
    >
      <Badge
        variant={badgeStyle.variant}
        color={filter.color}
        size="lg"
        leftSection={<Icon size={14} />}
        style={badgeStyle.style}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        {count} {t(filter.label)}
      </Badge>
    </Tooltip>
  );
}

export function FilterToolbar({ mode = 'edit' }: { mode?: 'edit' | 'review' }) {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const {
    filterQuery,
    activeFilters,
    visibleColumns,
    columnOrder,
    sortField,
    sortDirection,
    upstreamDeltaEntryIds,
    setFilterQuery,
    toggleFilter,
    clearFilters,
    toggleColumnVisibility,
    moveColumnToIndex,
    setSort,
    getStats,
    getFilteredEntries,
  } = useEditorStore();

  const stats = getStats();
  const filteredCount = getFilteredEntries().length;
  const activeFilterCount = activeFilters.size;
  const hasActiveFilters = activeFilterCount > 0 || filterQuery.trim().length > 0;

  // DeepL usage stats (server-side)
  const [deeplUsage, setDeeplUsage] = useState<UsageStats | null>(null);
  const deeplKeyConfigured = hasUserApiKey();
  // Local session usage for all providers
  const [localCharCount, setLocalCharCount] = useState(0);
  const activeProvider = getActiveTranslationProvider();
  const providerConfigured = hasActiveProviderCredentials();

  // Pointer-based column reordering state for menu items
  const [draggingColumn, setDraggingColumn] = useState<TableColumn | null>(null);
  const [dropTargetColumn, setDropTargetColumn] = useState<TableColumn | null>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);
  const dragPointerId = useRef<number | null>(null);
  const dragGhost = useDragGhost();

  const finishColumnDrag = useCallback(
    (pointerId: number, column: TableColumn, shouldCommit: boolean) => {
      if (dragPointerId.current !== pointerId) return;
      dragPointerId.current = null;

      if (shouldCommit && dropTargetColumn && dropTargetColumn !== column) {
        const visible = columnOrder.filter((c) => c !== 'approve');
        const visibleFrom = visible.indexOf(column);
        const visibleTarget = visible.indexOf(dropTargetColumn);

        if (visibleFrom !== -1 && visibleTarget !== -1) {
          const targetColumnInOrder = columnOrder.indexOf(dropTargetColumn);
          if (targetColumnInOrder !== -1) {
            const adjustedTargetIndex =
              visibleTarget > visibleFrom ? targetColumnInOrder - 1 : targetColumnInOrder;
            moveColumnToIndex(column, adjustedTargetIndex);
          }
        }
      }

      setDraggingColumn(null);
      setDropTargetColumn(null);
      dragGhost.hide();
    },
    [columnOrder, dragGhost, dropTargetColumn, moveColumnToIndex],
  );

  useEffect(() => {
    if (!deeplKeyConfigured) return;
    const fetchDeeplUsage = () => {
      getDeepLClient()
        .getUsage()
        .then(setDeeplUsage)
        .catch(() => {});
    };
    fetchDeeplUsage();
    window.addEventListener(TRANSLATION_USAGE_REFRESH_EVENT, fetchDeeplUsage);
    return () => window.removeEventListener(TRANSLATION_USAGE_REFRESH_EVENT, fetchDeeplUsage);
  }, [deeplKeyConfigured]);

  useEffect(() => {
    if (!providerConfigured) return;
    const refreshLocalUsage = () => {
      setLocalCharCount(getTranslationUsage(activeProvider).characterCount);
    };
    refreshLocalUsage();
    window.addEventListener(TRANSLATION_USAGE_REFRESH_EVENT, refreshLocalUsage);
    return () => window.removeEventListener(TRANSLATION_USAGE_REFRESH_EVENT, refreshLocalUsage);
  }, [activeProvider, providerConfigured]);

  // Debounced search
  const [localQuery, setLocalQuery] = useState(filterQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilterQuery(localQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [localQuery, setFilterQuery]);

  // Sync local state with store
  useEffect(() => {
    setLocalQuery(filterQuery);
  }, [filterQuery]);

  const percentage = stats.total > 0 ? Math.round((stats.translated / stats.total) * 100) : 0;
  const availableColumns = columnOrder.filter((column) => column !== 'approve');
  const visibleColumnCount = availableColumns.filter((column) => visibleColumns.has(column)).length;
  const visibleFilters = mode === 'review' ? REVIEW_FILTERS : TRANSLATION_FILTERS;

  const handleClearSearch = useCallback(() => {
    setLocalQuery('');
    setFilterQuery('');
  }, [setFilterQuery]);

  const getFilterCount = (filter: FilterType): number => {
    switch (filter) {
      case 'untranslated':
        return stats.untranslated;
      case 'translated':
        return stats.translated;
      case 'fuzzy':
        return stats.fuzzy;
      case 'modified':
        return stats.modified;
      case 'qa-error':
        return stats.qaErrors;
      case 'qa-warning':
        return stats.qaWarnings;
      case 'upstream-delta':
        return upstreamDeltaEntryIds.size;
      case 'review-draft':
        return stats.reviewDraft;
      case 'review-in-review':
        return stats.reviewInReview;
      case 'review-approved':
        return stats.reviewApproved;
      case 'review-needs-changes':
        return stats.reviewNeedsChanges;
      case 'review-unresolved':
        return stats.reviewUnresolved;
      case 'review-changed':
        return stats.reviewChanged;
      default:
        return 0;
    }
  };

  const sortValue = `${sortField}:${sortDirection}`;
  const sortOptions = [
    { value: 'default:asc', label: t('File order') },
    { value: 'source:asc', label: t('Source A-Z') },
    { value: 'source:desc', label: t('Source Z-A') },
    { value: 'translation:asc', label: t('Translation A-Z') },
    { value: 'translation:desc', label: t('Translation Z-A') },
    { value: 'status:asc', label: t('Status: untranslated first') },
    { value: 'status:desc', label: t('Status: translated first') },
  ];

  const handleSortChange = (value: string | null) => {
    if (!value) return;
    const [field, direction] = value.split(':') as [SortField, SortDirection];
    setSort(field, direction);
  };

  const columnLabels: Record<TableColumn, string> = {
    status: t('Status'),
    approve: t('Review'),
    source: t('Source string'),
    translation: t('Translated string'),
    signals: t('Signals'),
  };

  // Usage tooltip text
  const usageTooltip =
    activeProvider === 'deepl' && deeplUsage
      ? `${t('DeepL usage:')} ${deeplUsage.characterCount.toLocaleString()} / ${deeplUsage.characterLimit.toLocaleString()}`
      : activeProvider !== 'deepl' && providerConfigured && localCharCount > 0
        ? t('{{provider}} session usage: {{count}} characters', {
            provider: getTranslationProviderLabel(activeProvider),
            count: localCharCount.toLocaleString(),
          })
        : null;

  return (
    <Group justify="space-between" align="center" wrap="wrap" gap="sm">
      {/* Left: Search + Clear */}
      <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 200 }}>
        <TextInput
          aria-label={t('Search source, translation, context...')}
          placeholder={t('Search source, translation, context...')}
          leftSection={<Search size={16} />}
          rightSection={
            localQuery ? (
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={handleClearSearch}
                aria-label={t('Clear search')}
              >
                <X size={14} />
              </ActionIcon>
            ) : null
          }
          value={localQuery}
          onChange={(e) => setLocalQuery(e.currentTarget.value)}
          style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
        />

        <AnimatePresence>
          {hasActiveFilters && (
            <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
              <UnstyledButton
                onClick={clearFilters}
                style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                <Text size="xs" c="blue">
                  {t('Clear filters')}
                </Text>
              </UnstyledButton>
            </MotionDiv>
          )}
        </AnimatePresence>
      </Group>

      {/* Right: Filters + Sort + Columns + Progress */}
      <Group
        gap="xs"
        wrap={isMobile ? 'wrap' : 'nowrap'}
        style={{ flexShrink: isMobile ? undefined : 0, ...(isMobile && { width: '100%' }) }}
      >
        {/* Filters dropdown */}
        <Popover position="bottom-start" shadow="md" width={320} withArrow>
          <Popover.Target>
            <Button
              size="xs"
              variant={activeFilterCount > 0 ? 'light' : 'subtle'}
              leftSection={<Filter size={14} />}
              rightSection={
                activeFilterCount > 0 ? (
                  <Badge size="xs" variant="filled" color="blue" circle>
                    {activeFilterCount}
                  </Badge>
                ) : null
              }
            >
              {t('Filters')}
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                  {mode === 'review' ? t('Review') : t('Translation')}
                </Text>
                {activeFilterCount > 0 && (
                  <UnstyledButton onClick={clearFilters}>
                    <Text size="xs" c="blue">
                      {t('Clear all')}
                    </Text>
                  </UnstyledButton>
                )}
              </Group>

              <Group gap={6} wrap="wrap">
                {visibleFilters.map((filter) => {
                  const filterState = activeFilters.get(filter.id) ?? null;
                  const count = getFilterCount(filter.id);
                  if (filter.id === 'modified' && count === 0) return null;
                  return (
                    <FilterBadge
                      key={filter.id}
                      filter={filter}
                      count={count}
                      state={filterState}
                      onToggle={() => toggleFilter(filter.id)}
                      t={t}
                    />
                  );
                })}
              </Group>

              {/* Dynamic filters: MT + Manual edits */}
              {(stats.machineTranslated > 0 || stats.manualEdits > 0) && (
                <>
                  <Divider />
                  <Group gap={6} wrap="wrap">
                    {stats.machineTranslated > 0 && (
                      <FilterBadge
                        filter={{
                          id: 'machine-translated',
                          label: msgid('Machine translated'),
                          icon: Bot,
                          color: 'blue',
                        }}
                        count={stats.machineTranslated}
                        state={activeFilters.get('machine-translated') ?? null}
                        onToggle={() => toggleFilter('machine-translated')}
                        t={t}
                      />
                    )}
                    {stats.manualEdits > 0 && (
                      <FilterBadge
                        filter={{
                          id: 'manual-edit',
                          label: msgid('Manual edits'),
                          icon: Edit3,
                          color: 'gray',
                        }}
                        count={stats.manualEdits}
                        state={activeFilters.get('manual-edit') ?? null}
                        onToggle={() => toggleFilter('manual-edit')}
                        t={t}
                      />
                    )}
                  </Group>
                </>
              )}
            </Stack>
          </Popover.Dropdown>
        </Popover>

        {/* Columns menu */}
        <Menu position="bottom-end" shadow="sm" withArrow>
          <Menu.Target>
            <Button
              size="xs"
              variant="subtle"
              leftSection={<Columns3 size={14} />}
              aria-label={t('Choose visible columns')}
            >
              {t('Columns')}
            </Button>
          </Menu.Target>
          <Menu.Dropdown ref={menuDropdownRef}>
            {availableColumns.map((column) => {
              const isVisible = visibleColumns.has(column);
              const disableToggleOff = isVisible && visibleColumnCount === 1;
              const isDropTarget = dropTargetColumn === column && draggingColumn !== column;
              return (
                <Menu.Item
                  key={column}
                  closeMenuOnClick={false}
                  data-column={column}
                  style={{
                    backgroundColor: isDropTarget
                      ? 'var(--mantine-color-blue-light)'
                      : draggingColumn === column
                        ? 'var(--mantine-color-gray-light)'
                        : undefined,
                    opacity: draggingColumn === column ? 0.3 : 1,
                    transition: 'background-color 100ms ease, opacity 100ms ease',
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Checkbox
                      checked={isVisible}
                      label={columnLabels[column]}
                      onChange={() => toggleColumnVisibility(column)}
                      disabled={disableToggleOff}
                    />
                    <Group gap={2} wrap="nowrap">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="gray"
                        aria-label={t('Drag {{columnLabel}}', {
                          columnLabel: columnLabels[column],
                        })}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dragPointerId.current = e.pointerId;
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setDraggingColumn(column);
                          setDropTargetColumn(null);
                          const menuItem = e.currentTarget.closest('[data-column]') as HTMLElement;
                          if (menuItem) {
                            dragGhost.show(menuItem, e.clientX, e.clientY, columnLabels[column]);
                          }
                        }}
                        onPointerMove={(e) => {
                          if (dragPointerId.current !== e.pointerId) return;
                          dragGhost.move(e.clientX, e.clientY);
                          if (!menuDropdownRef.current) return;
                          const items = menuDropdownRef.current.querySelectorAll('[data-column]');
                          for (const item of items) {
                            const rect = item.getBoundingClientRect();
                            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                              const col = item.getAttribute('data-column') as TableColumn;
                              if (col === column) {
                                setDropTargetColumn(null);
                                return;
                              }
                              if (col) setDropTargetColumn(col);
                              return;
                            }
                          }
                          setDropTargetColumn(null);
                        }}
                        onPointerUp={(e) => finishColumnDrag(e.pointerId, column, true)}
                        onPointerCancel={(e) => finishColumnDrag(e.pointerId, column, false)}
                        onLostPointerCapture={(e) => finishColumnDrag(e.pointerId, column, false)}
                        style={{
                          cursor: draggingColumn === column ? 'grabbing' : 'grab',
                          touchAction: 'none',
                        }}
                      >
                        <GripVertical size={12} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Menu.Item>
              );
            })}
          </Menu.Dropdown>
        </Menu>

        {/* Sort */}
        <Select
          size="xs"
          value={sortValue}
          onChange={handleSortChange}
          data={sortOptions}
          leftSection={<ArrowUpDown size={14} />}
          w={isMobile ? undefined : 200}
          style={isMobile ? { flex: 1, minWidth: 0 } : undefined}
          aria-label={t('Sort entries')}
        />

        {/* Progress */}
        <Tooltip label={usageTooltip} disabled={!usageTooltip}>
          <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
            <Text size="xs" c="dimmed" className="gb-tabular-nums">
              {filteredCount}/{stats.total}
            </Text>
            {!isMobile && (
              <Box style={{ width: 60 }}>
                <Progress
                  value={percentage}
                  size="xs"
                  radius="xl"
                  color={percentage === 100 ? 'green' : percentage > 50 ? 'blue' : 'orange'}
                />
              </Box>
            )}
            <motion.span
              key={percentage}
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              transition={interactiveSpring}
            >
              <Text
                size="xs"
                fw={500}
                component="span"
                c={percentage === 100 ? 'green' : undefined}
                className="gb-tabular-nums"
              >
                {percentage}%
              </Text>
            </motion.span>
          </Group>
        </Tooltip>
      </Group>
    </Group>
  );
}
