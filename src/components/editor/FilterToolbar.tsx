/**
 * Filter Toolbar Component
 * 
 * Unified toolbar with search, tri-state filter chips, and progress indicator.
 * Filter chips cycle through: neutral -> show only -> don't show -> neutral
 */

import { useCallback, useState, useEffect } from 'react';
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
} from '@mantine/core';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, FileQuestion, CheckCircle, AlertTriangle, Pencil, Bot, Edit3 } from 'lucide-react';
import { useEditorStore, type FilterType, type FilterState } from '@/stores/editor-store';
import { popVariants, springTransition } from '@/lib/motion';

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
function getBadgeStyle(state: FilterState | null, _color: string): {
  variant: 'filled' | 'light' | 'outline';
  style: React.CSSProperties;
} {
  const base: React.CSSProperties = {
    cursor: 'pointer',
    userSelect: 'none',
    flexShrink: 0,
  };
  if (state === 'include') {
    return { variant: 'light', style: { ...base, borderWidth: 2, borderStyle: 'solid', borderColor: 'currentColor' } };
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
    setFilterQuery,
    toggleFilter,
    clearFilters,
    getStats,
    getFilteredEntries,
  } = useEditorStore();

  const stats = getStats();
  const filteredCount = getFilteredEntries().length;
  const hasActiveFilters = activeFilters.size > 0 || filterQuery.trim().length > 0;
  
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
  
  const percentage = stats.total > 0 
    ? Math.round((stats.translated / stats.total) * 100) 
    : 0;

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

  return (
    <Paper
      p="md"
      withBorder
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'var(--mantine-color-body)',
      }}
    >
      <Stack gap="sm">
        {/* Row 1: Search + Progress */}
        <Group justify="space-between" align="center" wrap="nowrap">
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
            style={{ flex: 1, maxWidth: 320 }}
          />
          
          {/* Progress indicator */}
          <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" c="dimmed">{stats.total} entries</Text>
              <Text size="sm" c="dimmed">•</Text>
              <motion.span
                key={percentage}
                initial={{ scale: 1.2, color: 'var(--mantine-color-blue-filled)' }}
                animate={{ scale: 1, color: percentage === 100 ? 'var(--mantine-color-green-filled)' : 'inherit' }}
                transition={springTransition}
              >
                <Text size="sm" fw={500} component="span">
                  {percentage}% translated
                </Text>
              </motion.span>
            </Group>
            <Box style={{ width: 100 }}>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                style={{ originX: 0 }}
              >
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

        {/* Row 2: Filter chips */}
        <Group gap="xs" justify="space-between" align="center" wrap="nowrap">
          <Group gap="xs" wrap="nowrap" style={{ overflow: 'auto' }}>
            <AnimatePresence mode="popLayout">
              {FILTERS.map((filter) => {
                const filterState = activeFilters.get(filter.id) ?? null;
                const count = getFilterCount(filter.id);
                const Icon = filter.icon;
                const badgeStyle = getBadgeStyle(filterState, filter.color);

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
                <MotionDiv
                  variants={popVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  {(() => {
                    const filterState = activeFilters.get('machine-translated') ?? null;
                    const badgeStyle = getBadgeStyle(filterState, 'blue');
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
                <MotionDiv
                  variants={popVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  {(() => {
                    const filterState = activeFilters.get('manual-edit') ?? null;
                    const badgeStyle = getBadgeStyle(filterState, 'grape');
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
                    <Text span c="dimmed" size="sm"> ({filteredCount} shown)</Text>
                  )}
                </Text>
              </MotionDiv>
            )}
          </AnimatePresence>
        </Group>
      </Stack>
    </Paper>
  );
}
