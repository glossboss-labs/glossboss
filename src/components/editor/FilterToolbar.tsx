/**
 * Filter Toolbar Component
 *
 * Unified toolbar with search, tri-state filter chips, and progress indicator.
 * Filter chips cycle through: neutral -> show only -> don't show -> neutral
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import {
  TextInput,
  Group,
  Badge,
  ActionIcon,
  Paper,
  Text,
  Tooltip,
  Box,
  Progress,
  Stack,
  Menu,
  Button,
  Checkbox,
  Select,
} from '@mantine/core';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  X,
  FileQuestion,
  CheckCircle,
  AlertTriangle,
  Pencil,
  Bot,
  Edit3,
  SlidersHorizontal,
  Columns3,
  ArrowUpDown,
  GripVertical,
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
import type { UsageStats } from '@/lib/deepl/types';
import { popVariants, springTransition } from '@/lib/motion';
import { useDragGhost } from '@/hooks/use-drag-ghost';

const MotionDiv = motion.div;

/** Filter configuration */
interface FilterConfig {
  id: FilterType;
  label: string;
  icon: typeof FileQuestion;
  color: string;
}

const FILTERS: FilterConfig[] = [
  { id: 'untranslated', label: 'Untranslated', icon: FileQuestion, color: 'red' },
  { id: 'translated', label: 'Translated', icon: CheckCircle, color: 'green' },
  { id: 'fuzzy', label: 'Fuzzy', icon: AlertTriangle, color: 'yellow' },
  { id: 'modified', label: 'Modified', icon: Pencil, color: 'orange' },
];

/** Get tooltip text based on current filter state */
function getTooltipText(label: string, state: FilterState | null): string {
  if (state === 'include') {
    return `Showing only ${label.toLowerCase()} • Click to exclude`;
  }
  if (state === 'exclude') {
    return `Hiding ${label.toLowerCase()} • Click to clear filter`;
  }
  return `Click to show only ${label.toLowerCase()}`;
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

export function FilterToolbar() {
  const {
    filterQuery,
    activeFilters,
    visibleColumns,
    columnOrder,
    sortField,
    sortDirection,
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
  const hasActiveFilters = activeFilters.size > 0 || filterQuery.trim().length > 0;

  // DeepL usage stats
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const apiKeyConfigured = hasUserApiKey();

  // Pointer-based column reordering state for menu items
  const [draggingColumn, setDraggingColumn] = useState<TableColumn | null>(null);
  const [dropTargetColumn, setDropTargetColumn] = useState<TableColumn | null>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);
  const dragPointerId = useRef<number | null>(null);
  const dragGhost = useDragGhost();

  useEffect(() => {
    if (!apiKeyConfigured) return;
    const fetchUsage = () => {
      getDeepLClient()
        .getUsage()
        .then(setUsage)
        .catch(() => {});
    };
    fetchUsage();
    // Listen for refresh events from TranslateToolbar
    window.addEventListener('deepl-usage-refresh', fetchUsage);
    return () => window.removeEventListener('deepl-usage-refresh', fetchUsage);
  }, [apiKeyConfigured]);

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
  const visibleColumnCount = visibleColumns.size;

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
      default:
        return 0;
    }
  };

  const sortValue = `${sortField}:${sortDirection}`;
  const sortOptions = [
    { value: 'default:asc', label: 'File order' },
    { value: 'source:asc', label: 'Source A-Z' },
    { value: 'source:desc', label: 'Source Z-A' },
    { value: 'translation:asc', label: 'Translation A-Z' },
    { value: 'translation:desc', label: 'Translation Z-A' },
    { value: 'status:asc', label: 'Status: untranslated first' },
    { value: 'status:desc', label: 'Status: translated first' },
  ];

  const handleSortChange = (value: string | null) => {
    if (!value) return;

    const [field, direction] = value.split(':') as [SortField, SortDirection];
    setSort(field, direction);
  };

  const columnLabels: Record<TableColumn, string> = {
    status: 'Status',
    source: 'Source string',
    translation: 'Translated string',
    signals: 'Signals',
  };

  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <SlidersHorizontal size={14} />
            <Text size="sm" fw={600}>
              Filter Strings
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            {filteredCount} visible of {stats.total}
          </Text>
        </Group>

        {/* Row 1: Search + Progress */}
        <Group justify="space-between" align="center" wrap="wrap">
          <TextInput
            placeholder="Search source, translation, context..."
            leftSection={<Search size={16} />}
            rightSection={
              localQuery ? (
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </ActionIcon>
              ) : null
            }
            value={localQuery}
            onChange={(e) => setLocalQuery(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 260, maxWidth: 420 }}
          />

          {/* Progress indicator */}
          <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" c="dimmed">
                {stats.total} entries
              </Text>
              <Text size="sm" c="dimmed">
                •
              </Text>
              <motion.span
                key={percentage}
                initial={{ scale: 1.2, color: 'var(--mantine-color-blue-filled)' }}
                animate={{
                  scale: 1,
                  color: percentage === 100 ? 'var(--mantine-color-green-filled)' : 'inherit',
                }}
                transition={springTransition}
              >
                <Text size="sm" fw={500} component="span">
                  {percentage}% translated
                </Text>
              </motion.span>
            </Group>
            <Box style={{ width: 100 }}>
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ originX: 0 }}>
                <Progress
                  value={percentage}
                  size="sm"
                  radius="xl"
                  color={percentage === 100 ? 'green' : percentage > 50 ? 'blue' : 'orange'}
                  animated={percentage < 100}
                />
              </motion.div>
            </Box>
          </Group>
        </Group>

        {/* DeepL token usage */}
        {usage && (
          <Text size="xs" c="dimmed" ta="right">
            DeepL usage: {usage.characterCount.toLocaleString()} /{' '}
            {usage.characterLimit.toLocaleString()}
          </Text>
        )}

        {/* Row 2: Filter chips */}
        <Group gap="xs" justify="space-between" align="center" wrap="wrap">
          <Group gap="xs" wrap="nowrap" style={{ overflow: 'auto', minWidth: 0, flex: 1 }}>
            <AnimatePresence mode="popLayout">
              {FILTERS.map((filter) => {
                const filterState = activeFilters.get(filter.id) ?? null;
                const count = getFilterCount(filter.id);
                const Icon = filter.icon;
                const badgeStyle = getBadgeStyle(filterState);

                // Don't show modified filter if count is 0
                if (filter.id === 'modified' && count === 0) {
                  return null;
                }

                return (
                  <MotionDiv
                    key={filter.id}
                    layout
                    variants={popVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Tooltip
                      label={getTooltipText(filter.label, filterState)}
                      position="bottom"
                      openDelay={400}
                    >
                      <Badge
                        variant={badgeStyle.variant}
                        color={filter.color}
                        size="lg"
                        leftSection={<Icon size={14} />}
                        style={badgeStyle.style}
                        onClick={() => toggleFilter(filter.id)}
                      >
                        {count} {filter.label}
                      </Badge>
                    </Tooltip>
                  </MotionDiv>
                );
              })}
            </AnimatePresence>

            {/* MT count badge - clickable filter */}
            <AnimatePresence>
              {stats.machineTranslated > 0 && (
                <MotionDiv variants={popVariants} initial="hidden" animate="visible" exit="exit">
                  {(() => {
                    const filterState = activeFilters.get('machine-translated') ?? null;
                    const badgeStyle = getBadgeStyle(filterState);
                    return (
                      <Tooltip label={getTooltipText('Machine translated', filterState)}>
                        <Badge
                          variant={badgeStyle.variant}
                          color="blue"
                          size="lg"
                          leftSection={<Bot size={14} />}
                          style={badgeStyle.style}
                          onClick={() => toggleFilter('machine-translated')}
                        >
                          {stats.machineTranslated} MT
                        </Badge>
                      </Tooltip>
                    );
                  })()}
                </MotionDiv>
              )}
            </AnimatePresence>

            {/* Manual edits badge - clickable filter */}
            <AnimatePresence>
              {stats.manualEdits > 0 && (
                <MotionDiv variants={popVariants} initial="hidden" animate="visible" exit="exit">
                  {(() => {
                    const filterState = activeFilters.get('manual-edit') ?? null;
                    const badgeStyle = getBadgeStyle(filterState);
                    return (
                      <Tooltip label={getTooltipText('Manual edits', filterState)}>
                        <Badge
                          variant={badgeStyle.variant}
                          color="grape"
                          size="lg"
                          leftSection={<Edit3 size={14} />}
                          style={badgeStyle.style}
                          onClick={() => toggleFilter('manual-edit')}
                        >
                          {stats.manualEdits} Manual
                        </Badge>
                      </Tooltip>
                    );
                  })()}
                </MotionDiv>
              )}
            </AnimatePresence>
          </Group>

          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
            <Menu position="bottom-end" shadow="sm" withArrow>
              <Menu.Target>
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<Columns3 size={14} />}
                  aria-label="Choose visible columns"
                >
                  Columns
                </Button>
              </Menu.Target>
              <Menu.Dropdown ref={menuDropdownRef}>
                {columnOrder.map((column) => {
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
                            aria-label={`Drag ${columnLabels[column]}`}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              dragPointerId.current = e.pointerId;
                              e.currentTarget.setPointerCapture(e.pointerId);
                              setDraggingColumn(column);
                              setDropTargetColumn(null);
                              const menuItem = e.currentTarget.closest(
                                '[data-column]',
                              ) as HTMLElement;
                              if (menuItem) dragGhost.show(menuItem, e.clientX, e.clientY);
                            }}
                            onPointerMove={(e) => {
                              if (dragPointerId.current !== e.pointerId) return;
                              dragGhost.move(e.clientX, e.clientY);
                              if (!menuDropdownRef.current) return;

                              const items =
                                menuDropdownRef.current.querySelectorAll('[data-column]');
                              for (const item of items) {
                                const rect = item.getBoundingClientRect();
                                if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                                  const col = item.getAttribute('data-column') as TableColumn;
                                  if (col && col !== column) {
                                    setDropTargetColumn(col);
                                  }
                                  return;
                                }
                              }
                              setDropTargetColumn(null);
                            }}
                            onPointerUp={(e) => {
                              if (dragPointerId.current !== e.pointerId) return;
                              dragPointerId.current = null;

                              if (dropTargetColumn && dropTargetColumn !== column) {
                                const targetIndex = columnOrder.indexOf(dropTargetColumn);
                                if (targetIndex !== -1) {
                                  moveColumnToIndex(column, targetIndex);
                                }
                              }
                              setDraggingColumn(null);
                              setDropTargetColumn(null);
                              dragGhost.hide();
                            }}
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

            <Select
              size="xs"
              value={sortValue}
              onChange={handleSortChange}
              data={sortOptions}
              leftSection={<ArrowUpDown size={14} />}
              w={220}
              aria-label="Sort entries"
            />

            {/* Clear filters link */}
            <AnimatePresence>
              {hasActiveFilters && (
                <MotionDiv
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                >
                  <Text
                    size="sm"
                    c="blue"
                    style={{ cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                    onClick={clearFilters}
                  >
                    Clear filters
                    {hasActiveFilters && filteredCount !== stats.total && (
                      <Text span c="dimmed" size="sm">
                        {' '}
                        ({filteredCount} shown)
                      </Text>
                    )}
                  </Text>
                </MotionDiv>
              )}
            </AnimatePresence>
          </Group>
        </Group>
      </Stack>
    </Paper>
  );
}
