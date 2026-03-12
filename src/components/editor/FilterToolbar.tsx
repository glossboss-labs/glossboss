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
} from '@/lib/translation';
import { badgeVariants, contentVariants, interactiveSpring } from '@/lib/motion';
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
  { id: 'untranslated', label: msgid('Untranslated'), icon: FileQuestion, color: 'red' },
  { id: 'translated', label: msgid('Translated'), icon: CheckCircle, color: 'green' },
  { id: 'fuzzy', label: msgid('Fuzzy'), icon: AlertTriangle, color: 'yellow' },
  { id: 'modified', label: msgid('Modified'), icon: Pencil, color: 'orange' },
  { id: 'qa-error', label: msgid('QA errors'), icon: ShieldAlert, color: 'red' },
  { id: 'qa-warning', label: msgid('QA warnings'), icon: AlertTriangle, color: 'orange' },
];

/** Get tooltip text based on current filter state */
function getTooltipText(
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

export function FilterToolbar() {
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
        const fromIndex = columnOrder.indexOf(column);
        const rawTargetIndex = columnOrder.indexOf(dropTargetColumn);

        if (fromIndex !== -1 && rawTargetIndex !== -1) {
          const adjustedTargetIndex =
            rawTargetIndex > fromIndex ? rawTargetIndex - 1 : rawTargetIndex;
          moveColumnToIndex(column, adjustedTargetIndex);
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
    window.addEventListener('translation-usage-refresh', fetchDeeplUsage);
    return () => window.removeEventListener('translation-usage-refresh', fetchDeeplUsage);
  }, [deeplKeyConfigured]);

  useEffect(() => {
    if (!providerConfigured) return;
    const refreshLocalUsage = () => {
      setLocalCharCount(getTranslationUsage(activeProvider).characterCount);
    };
    refreshLocalUsage();
    window.addEventListener('translation-usage-refresh', refreshLocalUsage);
    return () => window.removeEventListener('translation-usage-refresh', refreshLocalUsage);
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
      case 'qa-error':
        return stats.qaErrors;
      case 'qa-warning':
        return stats.qaWarnings;
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
    approve: t('Approve'),
    source: t('Source string'),
    translation: t('Translated string'),
    signals: t('Signals'),
  };

  return (
    <Stack gap="sm">
      {/* Row 1: Search + Progress */}
      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 260 }}>
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
            style={{ flex: 1, minWidth: 260, maxWidth: 420 }}
          />

          {/* Clear filters - next to search */}
          <AnimatePresence>
            {hasActiveFilters && (
              <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
                <UnstyledButton
                  onClick={clearFilters}
                  style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  <Text size="sm" c="blue">
                    {t('Clear filters')}
                    {filteredCount !== stats.total && (
                      <Text span c="dimmed" size="sm">
                        {' '}
                        ({t('{{count}} shown', { count: filteredCount })})
                      </Text>
                    )}
                  </Text>
                </UnstyledButton>
              </MotionDiv>
            )}
          </AnimatePresence>
        </Group>

        {/* Progress indicator */}
        <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" c="dimmed">
              {t('{{filtered}} of {{total}}', { filtered: filteredCount, total: stats.total })}
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
              transition={interactiveSpring}
            >
              <Text size="sm" fw={500} component="span">
                {t('{{percentage}}% translated', { percentage })}
              </Text>
            </motion.span>
          </Group>
          {!isMobile && (
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
          )}
        </Group>
      </Group>

      {/* Translation provider usage */}
      {activeProvider === 'deepl' && deeplUsage && (
        <Text size="xs" c="dimmed" ta="right">
          {t('DeepL usage:')} {deeplUsage.characterCount.toLocaleString()} /{' '}
          {deeplUsage.characterLimit.toLocaleString()}
        </Text>
      )}
      {activeProvider !== 'deepl' && providerConfigured && localCharCount > 0 && (
        <Text size="xs" c="dimmed" ta="right">
          {t('{{provider}} session usage: {{count}} characters', {
            provider: getTranslationProviderLabel(activeProvider),
            count: localCharCount.toLocaleString(),
          })}
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
                  variants={badgeVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Tooltip
                    label={getTooltipText(t(filter.label), filterState, t)}
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
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleFilter(filter.id);
                        }
                      }}
                    >
                      {count} {t(filter.label)}
                    </Badge>
                  </Tooltip>
                </MotionDiv>
              );
            })}
          </AnimatePresence>

          {/* MT count badge - clickable filter */}
          <AnimatePresence>
            {stats.machineTranslated > 0 && (
              <MotionDiv variants={badgeVariants} initial="hidden" animate="visible" exit="exit">
                {(() => {
                  const filterState = activeFilters.get('machine-translated') ?? null;
                  const badgeStyle = getBadgeStyle(filterState);
                  return (
                    <Tooltip label={getTooltipText(t('Machine translated'), filterState, t)}>
                      <Badge
                        variant={badgeStyle.variant}
                        color="blue"
                        size="lg"
                        leftSection={<Bot size={14} />}
                        style={badgeStyle.style}
                        onClick={() => toggleFilter('machine-translated')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleFilter('machine-translated');
                          }
                        }}
                      >
                        {t('{{count}} MT', { count: stats.machineTranslated })}
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
              <MotionDiv variants={badgeVariants} initial="hidden" animate="visible" exit="exit">
                {(() => {
                  const filterState = activeFilters.get('manual-edit') ?? null;
                  const badgeStyle = getBadgeStyle(filterState);
                  return (
                    <Tooltip label={getTooltipText(t('Manual edits'), filterState, t)}>
                      <Badge
                        variant={badgeStyle.variant}
                        color="grape"
                        size="lg"
                        leftSection={<Edit3 size={14} />}
                        style={badgeStyle.style}
                        onClick={() => toggleFilter('manual-edit')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleFilter('manual-edit');
                          }
                        }}
                      >
                        {t('{{count}} Manual', { count: stats.manualEdits })}
                      </Badge>
                    </Tooltip>
                  );
                })()}
              </MotionDiv>
            )}
          </AnimatePresence>
        </Group>

        <Group
          gap="xs"
          wrap={isMobile ? 'wrap' : 'nowrap'}
          style={{
            flexShrink: isMobile ? undefined : 0,
            ...(isMobile && { width: '100%' }),
          }}
        >
          <Menu position="bottom-end" shadow="sm" withArrow>
            <Menu.Target>
              <Button
                size="xs"
                variant="subtle"
                leftSection={<Columns3 size={14} />}
                aria-label={t('Choose visible columns')}
                style={isMobile ? { flex: '1 1 100%' } : undefined}
              >
                {t('Columns')}
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
                            const menuItem = e.currentTarget.closest(
                              '[data-column]',
                            ) as HTMLElement;
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

                                if (col) {
                                  setDropTargetColumn(col);
                                }
                                return;
                              }
                            }
                            setDropTargetColumn(null);
                          }}
                          onPointerUp={(e) => {
                            finishColumnDrag(e.pointerId, column, true);
                          }}
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

          <Select
            size="xs"
            value={sortValue}
            onChange={handleSortChange}
            data={sortOptions}
            leftSection={<ArrowUpDown size={14} />}
            w={isMobile ? undefined : 220}
            style={isMobile ? { flex: 1, minWidth: 0 } : undefined}
            aria-label={t('Sort entries')}
          />
        </Group>
      </Group>
    </Stack>
  );
}
