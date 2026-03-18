/**
 * Pagination controls for the editor table.
 */

import { Group, Pagination, Select, Text } from '@mantine/core';
import { useTranslation } from '@/lib/app-language';
import { ROWS_PER_PAGE_OPTIONS } from './editor-table-utils';

export interface EditorPaginationProps {
  rowsPerPage: string;
  onRowsPerPageChange: (value: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
  startItem: number;
  endItem: number;
  totalItems: number;
  isMobile: boolean;
}

export function EditorPagination({
  rowsPerPage,
  onRowsPerPageChange,
  currentPage,
  onPageChange,
  totalPages,
  startItem,
  endItem,
  totalItems,
  isMobile,
}: EditorPaginationProps) {
  const { t } = useTranslation();

  return (
    <Group justify="space-between" align="center" mt="xs" wrap="wrap">
      <Group gap="sm">
        <Select
          value={rowsPerPage}
          onChange={(value) => value && onRowsPerPageChange(value)}
          data={ROWS_PER_PAGE_OPTIONS.map((opt) => ({ ...opt, label: t(opt.label) }))}
          size="xs"
          w={120}
          aria-label={t('Rows per page')}
        />
        {!isMobile && (
          <Text size="sm" c="dimmed">
            {t('Showing {{start}}--{{end}} of {{total}} entries', {
              start: startItem,
              end: endItem,
              total: totalItems,
            })}
          </Text>
        )}
      </Group>

      {totalPages > 1 && (
        <Pagination
          value={currentPage}
          onChange={onPageChange}
          total={totalPages}
          size={isMobile ? 'xs' : 'sm'}
          withEdges
        />
      )}
    </Group>
  );
}
