/**
 * CellLockIndicator — visual overlay when a remote user has locked a cell.
 *
 * Shows a small colored badge with the lock owner's name.
 */

import { Badge, Box } from '@mantine/core';
import { Lock } from 'lucide-react';
import type { CellLock } from '@/lib/realtime';

interface CellLockIndicatorProps {
  lock: CellLock;
}

export function CellLockIndicator({ lock }: CellLockIndicatorProps) {
  return (
    <Box
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <Badge
        size="xs"
        variant="filled"
        leftSection={<Lock size={10} />}
        style={{
          backgroundColor: lock.color,
          color: '#fff',
        }}
      >
        {lock.displayName}
      </Badge>
    </Box>
  );
}
