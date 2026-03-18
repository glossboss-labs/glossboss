/**
 * Editor Table Component
 *
 * Translation table with inline editing, animations, and status badges.
 * Thin orchestrator that delegates to focused sub-components.
 */

import {
  useState,
  useCallback,
  useRef,
  type KeyboardEvent,
  useMemo,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Table,
  Text,
  Stack,
  Group,
  Box,
  Paper,
  Tooltip,
  ScrollArea,
  Checkbox,
  Button,
  Divider,
  ActionIcon,
  SegmentedControl,
  useMantineTheme,
} from '@mantine/core';
import { useLocalStorage, useMediaQuery } from '@mantine/hooks';
import { PanelRightOpen, PanelRightClose, X } from 'lucide-react';
import { useEditorStore, useSourceStore } from '@/stores';
import type { POEntry } from '@/lib/po';
import type { ParsedReference } from '@/lib/wp-source';
import { getTranslationStatus } from '@/types';
import type { TargetLanguage, SourceLanguage } from '@/lib/deepl/types';
import type { Glossary } from '@/lib/glossary/types';
import { useDragGhost } from '@/hooks/use-drag-ghost';
import { useCollaborationStore } from '@/stores/collaboration-store';
import { useTranslation } from '@/lib/app-language';
import { createTranslationMemoryScope } from '@/lib/translation-memory';
import { SourceBrowser } from './SourceBrowser';
import { ResizableTh } from './EditorTableHeader';
import { EntryRow, MobileEntryCard, TranslationCell } from './EditorTableRow';
import { EntryDetailsPanel } from './EditorInspector';
import { EditorPagination } from './EditorPagination';
import {
  COLUMN_KEYS,
  DEFAULT_COLUMN_WIDTHS,
  MIN_COLUMN_WIDTH,
  DATA_COLUMN_LABELS,
  NAV_SKIP_TRANSLATED_KEY,
  INSPECTOR_WIDTH_KEY,
  INSPECTOR_OPEN_KEY,
  INSPECTOR_DEFAULT_WIDTH,
  INSPECTOR_MIN_WIDTH,
  INSPECTOR_MAX_WIDTH,
  ROWS_PER_PAGE_KEY,
  COLUMN_WIDTHS_KEY,
  entryNeedsTranslation,
  TranslateSettingsContext,
  RealtimeBroadcastContext,
  ReadOnlyContext,
  type TranslateSettings,
  type RealtimeBroadcast,
  type TableColumnKey,
  type DataColumnKey,
} from './editor-table-utils';

export type { DataColumnKey } from './editor-table-utils';

/**
 * Main editor table component
 */
export interface EditorTableProps {
  targetLang?: TargetLanguage | null;
  sourceLang?: SourceLanguage | null;
  glossary?: Glossary | null;
  deeplGlossaryId?: string | null;
  glossaryEnforcementEnabled?: boolean;
  onEntrySelect?: (sourceText: string) => void;
  speechEnabled?: boolean;
  translateEnabled?: boolean;
  mode?: 'edit' | 'review';
  broadcastEntryUpdate?: (event: {
    entryId: string;
    msgstr?: string;
    msgstrPlural?: string[];
    flags?: string[];
  }) => void;
  broadcastLock?: (entryId: string) => void;
  broadcastUnlock?: (entryId: string) => void;
  readOnly?: boolean;
  broadcastReviewEvent?: (event: {
    entryId: string;
    displayName: string;
    type: 'status-changed' | 'comment-added' | 'comment-resolved';
    data: {
      status?: import('@/lib/review').ReviewStatus;
      comment?: import('@/lib/review').ReviewComment;
      commentId?: string;
      resolved?: boolean;
    };
  }) => void;
}

export function EditorTable({
  targetLang = null,
  sourceLang = null,
  glossary = null,
  deeplGlossaryId = null,
  glossaryEnforcementEnabled = false,
  onEntrySelect,
  speechEnabled = true,
  translateEnabled = true,
  mode = 'edit',
  broadcastEntryUpdate,
  broadcastLock,
  broadcastUnlock,
  readOnly = false,
  broadcastReviewEvent,
}: EditorTableProps) {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const entries = useEditorStore((state) => state.entries);
  const filename = useEditorStore((state) => state.filename);
  const selectedEntryId = useEditorStore((state) => state.selectedEntryId);
  const dirtyEntryIds = useEditorStore((state) => state.dirtyEntryIds);
  const machineTranslatedIds = useEditorStore((state) => state.machineTranslatedIds);
  const header = useEditorStore((state) => state.header);
  const projectName = useEditorStore((state) => state.projectName);
  const getQaReport = useEditorStore((state) => state.getQaReport);
  const getReviewEntry = useEditorStore((state) => state.getReviewEntry);
  const selectEntry = useEditorStore((state) => state.selectEntry);
  const selectedEntryIds = useEditorStore((state) => state.selectedEntryIds);
  const setEntrySelection = useEditorStore((state) => state.setEntrySelection);
  const setSelectedEntries = useEditorStore((state) => state.setSelectedEntries);
  const getFilteredEntries = useEditorStore((state) => state.getFilteredEntries);
  const visibleColumns = useEditorStore((state) => state.visibleColumns);
  const columnOrder = useEditorStore((state) => state.columnOrder);
  const moveColumnToIndex = useEditorStore((state) => state.moveColumnToIndex);
  const sortField = useEditorStore((state) => state.sortField);
  const sortDirection = useEditorStore((state) => state.sortDirection);
  const activeReference = useSourceStore((state) => state.activeReference);
  const setActiveReference = useSourceStore((state) => state.setActiveReference);
  const activeFiltersKey = useEditorStore((state) =>
    JSON.stringify(Array.from(state.activeFilters.entries())),
  );
  const filterQuery = useEditorStore((state) => state.filterQuery);

  const filteredEntries = useMemo(() => {
    return getFilteredEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFilteredEntries, activeFiltersKey, filterQuery, entries, sortField, sortDirection]);

  const [skipTranslated] = useLocalStorage<boolean>({
    key: NAV_SKIP_TRANSLATED_KEY,
    defaultValue: true,
  });

  const [pendingFocusEntryId, setPendingFocusEntryId] = useState<string | null>(null);
  const [expandedMobileEntryIds, setExpandedMobileEntryIds] = useState<Set<string>>(new Set());
  const [inspectorMode, setInspectorMode] = useState<'context' | 'browse'>('context');

  const navRef = useRef({
    filteredEntries,
    skipTranslated,
    currentPage: 1,
    rowsPerPageNum: 50,
    onEntrySelect,
  });
  navRef.current.filteredEntries = filteredEntries;
  navRef.current.skipTranslated = skipTranslated;
  navRef.current.onEntrySelect = onEntrySelect;

  // Column widths
  const [columnWidths, setColumnWidths] = useLocalStorage<number[]>({
    key: COLUMN_WIDTHS_KEY,
    defaultValue: DEFAULT_COLUMN_WIDTHS,
  });

  const safeWidths =
    columnWidths.length === COLUMN_KEYS.length ? columnWidths : DEFAULT_COLUMN_WIDTHS;
  const widthByKey = useMemo(
    () =>
      COLUMN_KEYS.reduce(
        (acc, key, index) => {
          acc[key] = safeWidths[index];
          return acc;
        },
        {} as Record<TableColumnKey, number>,
      ),
    [safeWidths],
  );
  const visibleColumnKeys = useMemo(() => {
    const dataColumns = columnOrder.filter(
      (column) => visibleColumns.has(column) && column !== 'approve',
    );
    return ['select', ...dataColumns] as TableColumnKey[];
  }, [columnOrder, visibleColumns]);
  const visibleDataColumns = useMemo(
    () => visibleColumnKeys.filter((column): column is DataColumnKey => column !== 'select'),
    [visibleColumnKeys],
  );
  const visibleTotalWidth = visibleColumnKeys.reduce((sum, key) => sum + widthByKey[key], 0);
  const columnPercentByKey = useMemo(
    () =>
      visibleColumnKeys.reduce(
        (acc, key) => {
          acc[key] = `${((widthByKey[key] / visibleTotalWidth) * 100).toFixed(2)}%`;
          return acc;
        },
        {} as Record<TableColumnKey, string>,
      ),
    [visibleColumnKeys, visibleTotalWidth, widthByKey],
  );
  const tableRef = useRef<HTMLTableElement>(null);

  const handleColumnResize = useCallback(
    (leftKey: TableColumnKey, rightKey: TableColumnKey, deltaX: number) => {
      if (!isFinite(deltaX)) {
        setColumnWidths(DEFAULT_COLUMN_WIDTHS);
        return;
      }

      setColumnWidths((prev) => {
        const widths = [...(prev.length === COLUMN_KEYS.length ? prev : DEFAULT_COLUMN_WIDTHS)];
        const tableWidth = tableRef.current?.offsetWidth ?? 1000;
        const visibleTotal = visibleColumnKeys.reduce(
          (sum, key) => sum + widths[COLUMN_KEYS.indexOf(key)],
          0,
        );
        const proportionDelta = (deltaX / tableWidth) * visibleTotal;

        const leftIndex = COLUMN_KEYS.indexOf(leftKey);
        const rightIndex = COLUMN_KEYS.indexOf(rightKey);
        const newLeft = widths[leftIndex] + proportionDelta;
        const newRight = widths[rightIndex] - proportionDelta;

        if (newLeft < MIN_COLUMN_WIDTH || newRight < MIN_COLUMN_WIDTH) {
          return prev;
        }

        widths[leftIndex] = newLeft;
        widths[rightIndex] = newRight;
        return widths;
      });
    },
    [setColumnWidths, visibleColumnKeys],
  );

  // Column header drag-and-drop
  const [draggingHeaderColumn, setDraggingHeaderColumn] = useState<DataColumnKey | null>(null);
  const [headerDropTarget, setHeaderDropTarget] = useState<{
    column: DataColumnKey;
    position: 'before' | 'after';
  } | null>(null);
  const headerDragPointerId = useRef<number | null>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const headerDragGhost = useDragGhost();

  const handleHeaderPointerDown = useCallback(
    (columnKey: DataColumnKey) => (e: ReactPointerEvent<HTMLTableCellElement>) => {
      if (e.button !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (e.clientX > rect.right - 8) return;

      headerDragPointerId.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraggingHeaderColumn(columnKey);
      setHeaderDropTarget(null);
      headerDragGhost.show(e.currentTarget, e.clientX, e.clientY, t(DATA_COLUMN_LABELS[columnKey]));
    },
    [headerDragGhost, t],
  );

  const handleHeaderPointerMove = useCallback(
    (e: React.PointerEvent<HTMLTableSectionElement>) => {
      if (headerDragPointerId.current !== e.pointerId || !draggingHeaderColumn) return;
      headerDragGhost.move(e.clientX, e.clientY);
      if (!theadRef.current) return;

      const cells = theadRef.current.querySelectorAll<HTMLTableCellElement>('[data-column-key]');
      for (const cell of cells) {
        const col = cell.getAttribute('data-column-key') as DataColumnKey;
        if (!col) continue;
        const rect = cell.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          if (col === draggingHeaderColumn) {
            setHeaderDropTarget(null);
          } else {
            const midX = rect.left + rect.width / 2;
            setHeaderDropTarget({
              column: col,
              position: e.clientX < midX ? 'before' : 'after',
            });
          }
          return;
        }
      }
      setHeaderDropTarget(null);
    },
    [draggingHeaderColumn, headerDragGhost],
  );

  const finishHeaderDrag = useCallback(
    (pointerId: number, shouldCommit: boolean) => {
      if (headerDragPointerId.current !== pointerId) return;
      headerDragPointerId.current = null;

      if (shouldCommit && draggingHeaderColumn && headerDropTarget) {
        const targetIdx = columnOrder.indexOf(headerDropTarget.column);
        if (targetIdx !== -1) {
          const fromIdx = columnOrder.indexOf(draggingHeaderColumn);
          const finalIdx =
            headerDropTarget.position === 'after'
              ? fromIdx < targetIdx
                ? targetIdx
                : targetIdx + 1
              : fromIdx > targetIdx
                ? targetIdx
                : targetIdx - 1;
          moveColumnToIndex(draggingHeaderColumn, finalIdx);
        }
      }
      setDraggingHeaderColumn(null);
      setHeaderDropTarget(null);
      headerDragGhost.hide();
    },
    [draggingHeaderColumn, headerDropTarget, columnOrder, moveColumnToIndex, headerDragGhost],
  );

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useLocalStorage<string>({
    key: ROWS_PER_PAGE_KEY,
    defaultValue: '50',
  });
  const [inspectorWidth, setInspectorWidth] = useLocalStorage<number>({
    key: INSPECTOR_WIDTH_KEY,
    defaultValue: INSPECTOR_DEFAULT_WIDTH,
  });
  const [inspectorOpen, setInspectorOpen] = useLocalStorage<boolean>({
    key: INSPECTOR_OPEN_KEY,
    defaultValue: true,
  });
  const [currentPage, setCurrentPage] = useState(1);

  const rowsPerPageNum = parseInt(rowsPerPage, 10);
  const totalPages = Math.ceil(filteredEntries.length / rowsPerPageNum);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredEntries.length, rowsPerPage]);

  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPageNum;
    const endIndex = startIndex + rowsPerPageNum;
    return filteredEntries.slice(startIndex, endIndex);
  }, [filteredEntries, currentPage, rowsPerPageNum]);

  const selectedEntry = useMemo(() => {
    if (selectedEntryId) {
      const fromFiltered = filteredEntries.find((entry) => entry.id === selectedEntryId);
      if (fromFiltered) return fromFiltered;
    }
    return filteredEntries[0] ?? null;
  }, [filteredEntries, selectedEntryId]);

  const filteredEntryIds = useMemo(
    () => filteredEntries.map((entry) => entry.id),
    [filteredEntries],
  );
  const filteredEntryIdSet = useMemo(() => new Set(filteredEntryIds), [filteredEntryIds]);
  const selectedFilteredCount = useMemo(
    () => filteredEntryIds.filter((id) => selectedEntryIds.has(id)).length,
    [filteredEntryIds, selectedEntryIds],
  );
  const allFilteredSelected =
    filteredEntryIds.length > 0 && selectedFilteredCount === filteredEntryIds.length;
  const someFilteredSelected = selectedFilteredCount > 0 && !allFilteredSelected;

  const handleSelectAllFiltered = useCallback(
    (checked: boolean) => {
      if (checked) {
        const merged = new Set(selectedEntryIds);
        filteredEntryIds.forEach((id) => merged.add(id));
        setSelectedEntries(Array.from(merged));
        return;
      }

      const remaining = Array.from(selectedEntryIds).filter((id) => !filteredEntryIdSet.has(id));
      setSelectedEntries(remaining);
    },
    [selectedEntryIds, filteredEntryIds, filteredEntryIdSet, setSelectedEntries],
  );

  const handleInspectorResizeStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = inspectorWidth;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const onPointerMove = (ev: globalThis.PointerEvent) => {
        const delta = ev.clientX - startX;
        const viewportMax = Math.max(INSPECTOR_MIN_WIDTH, window.innerWidth - 300);
        const maxWidth = Math.min(INSPECTOR_MAX_WIDTH, viewportMax);
        const nextWidth = Math.min(maxWidth, Math.max(INSPECTOR_MIN_WIDTH, startWidth - delta));
        setInspectorWidth(nextWidth);
      };

      const onPointerUp = () => {
        target.removeEventListener('pointermove', onPointerMove);
        target.removeEventListener('pointerup', onPointerUp);
      };

      target.addEventListener('pointermove', onPointerMove);
      target.addEventListener('pointerup', onPointerUp);
    },
    [inspectorWidth, setInspectorWidth],
  );

  const toggleMobileDetails = useCallback((entryId: string) => {
    setExpandedMobileEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isMobile || !selectedEntryId) return;
    setExpandedMobileEntryIds((prev) => {
      if (prev.has(selectedEntryId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(selectedEntryId);
      return next;
    });
  }, [isMobile, selectedEntryId]);

  useEffect(() => {
    if (!selectedEntryId && filteredEntries.length > 0) {
      selectEntry(filteredEntries[0].id);
    }
  }, [filteredEntries, selectedEntryId, selectEntry]);

  navRef.current.currentPage = currentPage;
  navRef.current.rowsPerPageNum = rowsPerPageNum;

  const translateSettings: TranslateSettings = useMemo(
    () => ({
      targetLang,
      sourceLang,
      glossary,
      deeplGlossaryId,
      glossaryEnforcementEnabled,
      speechEnabled,
      translateEnabled,
    }),
    [
      targetLang,
      sourceLang,
      glossary,
      deeplGlossaryId,
      glossaryEnforcementEnabled,
      speechEnabled,
      translateEnabled,
    ],
  );
  const targetLanguageForMemory = header?.language ?? targetLang ?? null;
  const translationMemoryScope = useMemo(
    () =>
      targetLanguageForMemory
        ? createTranslationMemoryScope(projectName, targetLanguageForMemory, sourceLang ?? null)
        : null,
    [projectName, sourceLang, targetLanguageForMemory],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>, fieldId: string) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const {
          filteredEntries: allEntries,
          skipTranslated: skip,
          rowsPerPageNum: rpp,
        } = navRef.current;

        const currentEntryId = fieldId.replace(/-(singular|plural-\d+)$/, '');
        const curIdx = allEntries.findIndex((entry) => entry.id === currentEntryId);
        if (curIdx === -1) return;

        let nextEntry: POEntry | null = null;
        const len = allEntries.length;
        for (let offset = 1; offset < len; offset++) {
          const candidate = allEntries[(curIdx + offset) % len];
          if (!skip || entryNeedsTranslation(candidate)) {
            nextEntry = candidate;
            break;
          }
        }
        if (!nextEntry) return;

        selectEntry(nextEntry.id);
        navRef.current.onEntrySelect?.(nextEntry.msgid);
        const nextIndex = allEntries.indexOf(nextEntry);
        const targetPage = Math.floor(nextIndex / rpp) + 1;
        if (targetPage !== navRef.current.currentPage) {
          setCurrentPage(targetPage);
        }
        setPendingFocusEntryId(nextEntry.id);
        return;
      }

      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        const allFields = document.querySelectorAll('[data-field-id]');
        const fieldArray = Array.from(allFields);
        const currentIndex = fieldArray.findIndex(
          (el) => el.getAttribute('data-field-id') === fieldId,
        );
        if (currentIndex === -1) return;

        let nextIndex: number;
        if (e.key === 'Tab' && e.shiftKey) {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : fieldArray.length - 1;
        } else {
          nextIndex = currentIndex < fieldArray.length - 1 ? currentIndex + 1 : 0;
        }

        const nextField = fieldArray[nextIndex] as HTMLElement;
        if (nextField) {
          const wrapper = nextField.closest('.editable-text-wrapper');
          if (wrapper) {
            (wrapper as HTMLElement).click();
          } else {
            nextField.focus();
          }
          nextField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    },
    [selectEntry, setCurrentPage],
  );

  // Focus pending entry after page change
  useEffect(() => {
    if (!pendingFocusEntryId) return;
    const raf = requestAnimationFrame(() => {
      const fieldSelector = `[data-entry-id="${pendingFocusEntryId}"][data-field-id]`;
      const field = document.querySelector(fieldSelector) as HTMLElement | null;

      if (field) {
        const wrapper = field.classList.contains('editable-text-wrapper')
          ? field
          : (field.closest('.editable-text-wrapper') as HTMLElement | null);

        if (wrapper) {
          wrapper.click();
          wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          field.focus();
          field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        const row = document.querySelector(`tr[data-entry-id="${pendingFocusEntryId}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      setPendingFocusEntryId(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [pendingFocusEntryId, paginatedEntries]);

  const handleInspectorReference = useCallback(
    (ref: ParsedReference) => {
      if (selectedEntry) {
        selectEntry(selectedEntry.id);
        onEntrySelect?.(selectedEntry.msgid);
      }
      setActiveReference(ref);
    },
    [onEntrySelect, selectEntry, selectedEntry, setActiveReference],
  );

  const realtimeBroadcast = useMemo<RealtimeBroadcast>(
    () => ({ broadcastEntryUpdate, broadcastLock, broadcastUnlock, broadcastReviewEvent }),
    [broadcastEntryUpdate, broadcastLock, broadcastUnlock, broadcastReviewEvent],
  );

  const selectedRemoteLock = useCollaborationStore((s) =>
    selectedEntryId ? Boolean(s.cellLocks.get(selectedEntryId)) : false,
  );

  if (!filename) {
    return null;
  }

  const startItem = filteredEntries.length === 0 ? 0 : (currentPage - 1) * rowsPerPageNum + 1;
  const endItem = Math.min(currentPage * rowsPerPageNum, filteredEntries.length);
  const selectedStatus = selectedEntry
    ? getTranslationStatus(selectedEntry.msgstr, selectedEntry.flags, selectedEntry.msgstrPlural)
    : null;
  const selectedIsModified = selectedEntry ? dirtyEntryIds.has(selectedEntry.id) : false;
  const selectedIsMT = selectedEntry ? machineTranslatedIds.has(selectedEntry.id) : false;
  const selectedQaReport = selectedEntry ? (getQaReport(selectedEntry.id) ?? null) : null;
  const selectedReviewEntry = selectedEntry ? getReviewEntry(selectedEntry.id) : null;
  const selectedInspectorLabel = (() => {
    if (!selectedEntry) return t('No selection');

    const linePart = selectedEntry.lineNumber
      ? t('Line {{lineNumber}}', { lineNumber: selectedEntry.lineNumber })
      : '';
    const sourcePreview =
      selectedEntry.msgid.trim() || selectedEntry.msgctxt?.trim() || t('Selected string');

    return linePart ? `${linePart} · ${sourcePreview}` : sourcePreview;
  })();

  return (
    <ReadOnlyContext.Provider value={readOnly}>
      <RealtimeBroadcastContext.Provider value={realtimeBroadcast}>
        <TranslateSettingsContext.Provider value={translateSettings}>
          {isMobile ? (
            <Stack gap="sm" data-testid="mobile-entry-card-list">
              {paginatedEntries.map((entry) => (
                <MobileEntryCard
                  key={entry.id}
                  entry={entry}
                  isChecked={selectedEntryIds.has(entry.id)}
                  detailsExpanded={expandedMobileEntryIds.has(entry.id)}
                  onToggleDetails={() => toggleMobileDetails(entry.id)}
                  onToggleSelection={(checked) => setEntrySelection(entry.id, checked)}
                  onKeyDown={handleKeyDown}
                  onSelect={onEntrySelect}
                  translationMemoryScope={translationMemoryScope}
                  mode={mode}
                />
              ))}
            </Stack>
          ) : (
            <Stack gap="xs">
              <Group justify="flex-end">
                <Button
                  variant={inspectorOpen ? 'light' : 'subtle'}
                  size="xs"
                  leftSection={
                    inspectorOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />
                  }
                  onClick={() => setInspectorOpen(!inspectorOpen)}
                  data-testid="toggle-inspector-btn"
                >
                  {inspectorOpen ? t('Hide info') : t('More info')}
                </Button>
              </Group>
              <Box style={{ display: 'flex', alignItems: 'flex-start' }}>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Table
                    ref={tableRef}
                    striped
                    highlightOnHover
                    verticalSpacing="md"
                    style={{ tableLayout: 'fixed' }}
                    data-testid="editor-table-desktop"
                  >
                    <Table.Thead
                      ref={theadRef}
                      onPointerMove={handleHeaderPointerMove}
                      onPointerUp={(e) => finishHeaderDrag(e.pointerId, true)}
                      onPointerCancel={(e) => finishHeaderDrag(e.pointerId, false)}
                      onLostPointerCapture={(e) => finishHeaderDrag(e.pointerId, false)}
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        background: 'var(--gb-surface-2)',
                        touchAction: 'none',
                      }}
                    >
                      <Table.Tr>
                        {visibleColumnKeys.map((columnKey, i) => {
                          const nextColumn = visibleColumnKeys[i + 1];
                          const isDataColumn = columnKey !== 'select';
                          const label =
                            columnKey === 'select' ? (
                              <Checkbox
                                key="select-all-checkbox-input"
                                checked={allFilteredSelected}
                                indeterminate={someFilteredSelected}
                                onChange={(e) => handleSelectAllFiltered(e.currentTarget.checked)}
                                aria-label={t('Select all filtered entries')}
                                data-testid="select-all-checkbox"
                              />
                            ) : (
                              t(DATA_COLUMN_LABELS[columnKey])
                            );

                          const dropIndicator =
                            isDataColumn && headerDropTarget?.column === columnKey
                              ? headerDropTarget.position
                              : undefined;

                          return (
                            <ResizableTh
                              key={columnKey}
                              widthPercent={columnPercentByKey[columnKey]}
                              isLast={!nextColumn}
                              onResize={
                                nextColumn
                                  ? (delta) => handleColumnResize(columnKey, nextColumn, delta)
                                  : undefined
                              }
                              align={columnKey === 'select' ? 'center' : 'left'}
                              padding={columnKey === 'select' ? '8px 4px' : undefined}
                              dataColumnKey={isDataColumn ? columnKey : undefined}
                              onCellPointerDown={
                                isDataColumn ? handleHeaderPointerDown(columnKey) : undefined
                              }
                              isDragging={draggingHeaderColumn === columnKey}
                              dropIndicatorPosition={dropIndicator}
                            >
                              {typeof label === 'string' ? (
                                label
                              ) : (
                                <Box
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                  }}
                                >
                                  {label}
                                </Box>
                              )}
                            </ResizableTh>
                          );
                        })}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {paginatedEntries.map((entry) => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          isChecked={selectedEntryIds.has(entry.id)}
                          visibleDataColumns={visibleDataColumns}
                          onToggleSelection={(checked) => setEntrySelection(entry.id, checked)}
                          onSelect={onEntrySelect}
                          onKeyDown={handleKeyDown}
                        />
                      ))}
                    </Table.Tbody>
                  </Table>
                </Box>

                {inspectorOpen && (
                  <Box
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--mantine-spacing-md)',
                      flexShrink: 0,
                      width: inspectorWidth + 24,
                      marginLeft: 'var(--mantine-spacing-md)',
                      position: 'sticky',
                      top: 0,
                      height: '100vh',
                      maxHeight: '100vh',
                      alignSelf: 'flex-start',
                    }}
                  >
                    <Box
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={t('Resize inspector')}
                      onPointerDown={handleInspectorResizeStart}
                      onDoubleClick={() => setInspectorWidth(INSPECTOR_DEFAULT_WIDTH)}
                      style={{
                        width: 8,
                        flexShrink: 0,
                        alignSelf: 'stretch',
                        cursor: 'col-resize',
                        borderRadius: 6,
                        backgroundColor: 'var(--mantine-color-default-border)',
                        opacity: 0.35,
                        transition: 'opacity 120ms ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.35';
                      }}
                    />

                    <Paper
                      withBorder
                      p="sm"
                      w={inspectorWidth}
                      style={{
                        flexShrink: 0,
                        height: '100%',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <Stack gap="sm" pt={2} style={{ height: '100%', minHeight: 0 }}>
                        <Group justify="space-between" align="center">
                          <Text fw={600} size="sm">
                            {t('String inspector')}
                          </Text>
                          <Tooltip
                            label={selectedInspectorLabel}
                            disabled={!selectedEntry}
                            position="bottom"
                          >
                            <Text size="xs" c="dimmed" maw="58%" ta="right" truncate="end">
                              {selectedInspectorLabel}
                            </Text>
                          </Tooltip>
                        </Group>

                        <Group justify="space-between" align="center">
                          <SegmentedControl
                            size="xs"
                            value={inspectorMode}
                            onChange={(value) => setInspectorMode(value as 'context' | 'browse')}
                            data={[
                              { label: t('Context'), value: 'context' },
                              { label: t('Browse'), value: 'browse' },
                            ]}
                          />

                          {inspectorMode === 'context' && activeReference && (
                            <Tooltip label={t('Clear active source reference')}>
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                onClick={() => setActiveReference(null)}
                              >
                                <X size={14} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>

                        <Divider />

                        <Box style={{ flex: 1, minHeight: 0 }}>
                          {inspectorMode === 'browse' ? (
                            <Paper
                              withBorder
                              radius="md"
                              style={{ overflow: 'hidden', height: '100%' }}
                            >
                              <SourceBrowser listingMaxHeight={420} viewerMaxHeight={420} />
                            </Paper>
                          ) : (
                            <ScrollArea h="100%" type="auto" offsetScrollbars="y">
                              {selectedEntry && selectedStatus ? (
                                <Stack gap="sm">
                                  <Stack gap={6}>
                                    <Text size="xs" fw={600} c="dimmed">
                                      {t('Translation')}
                                    </Text>
                                    <TranslationCell
                                      entry={selectedEntry}
                                      onKeyDown={handleKeyDown}
                                      translateButtonSize="md"
                                      translateButtonDisplay="icon"
                                    />
                                  </Stack>

                                  <Divider />

                                  <EntryDetailsPanel
                                    entry={selectedEntry}
                                    status={selectedStatus}
                                    isModified={selectedIsModified}
                                    isMT={selectedIsMT}
                                    qaReport={selectedQaReport}
                                    reviewEntry={
                                      selectedReviewEntry ?? {
                                        status: 'draft',
                                        comments: [],
                                        history: [],
                                      }
                                    }
                                    translationMemoryScope={translationMemoryScope}
                                    onActivateReference={handleInspectorReference}
                                    mode={mode}
                                    isRemoteLocked={selectedRemoteLock}
                                  />
                                </Stack>
                              ) : (
                                <Text size="sm" c="dimmed">
                                  {t('Select a row to inspect context and metadata.')}
                                </Text>
                              )}
                            </ScrollArea>
                          )}
                        </Box>
                      </Stack>
                    </Paper>
                  </Box>
                )}
              </Box>

              {/* Pagination controls */}
              {filteredEntries.length > 0 && (
                <EditorPagination
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={setRowsPerPage}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  totalPages={totalPages}
                  startItem={startItem}
                  endItem={endItem}
                  totalItems={filteredEntries.length}
                  isMobile={Boolean(isMobile)}
                />
              )}
            </Stack>
          )}

          {/* Empty state for filtered results */}
          {filteredEntries.length === 0 && entries.length > 0 && (
            <Paper p="xl" withBorder radius="md" mt="md">
              <Stack align="center" gap="sm">
                <Text c="dimmed" ta="center">
                  {t('No entries match the current filters.')}
                </Text>
                <Text size="sm" c="dimmed">
                  {t('Try adjusting your search or clearing some filters.')}
                </Text>
              </Stack>
            </Paper>
          )}
        </TranslateSettingsContext.Provider>
      </RealtimeBroadcastContext.Provider>
    </ReadOnlyContext.Provider>
  );
}
