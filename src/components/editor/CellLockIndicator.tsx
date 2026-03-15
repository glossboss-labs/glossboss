/**
 * CellLockIndicator — visual overlay when a remote user has locked a cell.
 *
 * Shows a small colored badge with the lock owner's name.
 */

import { Badge, Box } from '@mantine/core';
import { Lock } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import type { CellLock } from '@/lib/realtime';

interface CellLockIndicatorProps {
  lock: CellLock;
}

export function CellLockIndicator({ lock }: CellLockIndicatorProps) {
  const { t } = useTranslation();

  return (
    <Box
      style={{
        position: 'absolute',
        top: 2,
        right: 2,
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <Badge
        size="xs"
        variant="light"
        leftSection={<Lock size={10} />}
        style={{
          backgroundColor: `${lock.color}20`,
          color: lock.color,
          borderColor: `${lock.color}40`,
          border: '1px solid',
        }}
      >
        {t('Locked by {{name}}', { name: lock.displayName })}
      </Badge>
    </Box>
  );
}
