/**
 * Column header with drag handle for resizing.
 */

import {
  useCallback,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Table } from '@mantine/core';
import type { DataColumnKey } from './editor-table-utils';

export function ResizableTh({
  children,
  widthPercent,
  onResize,
  isLast,
  onCellPointerDown,
  dataColumnKey,
  isDragging = false,
  dropIndicatorPosition,
  align = 'left',
  padding = '12px 8px',
}: {
  children: React.ReactNode;
  widthPercent: string;
  onResize?: (deltaX: number) => void;
  isLast: boolean;
  onCellPointerDown?: (e: ReactPointerEvent<HTMLTableCellElement>) => void;
  dataColumnKey?: DataColumnKey;
  isDragging?: boolean;
  dropIndicatorPosition?: 'before' | 'after';
  align?: 'left' | 'center';
  padding?: CSSProperties['padding'];
}) {
  const handleRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      startXRef.current = e.clientX;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const onPointerMove = (ev: globalThis.PointerEvent) => {
        const delta = ev.clientX - startXRef.current;
        if (delta !== 0) {
          onResize?.(delta);
          startXRef.current = ev.clientX;
        }
      };

      const onPointerUp = () => {
        target.removeEventListener('pointermove', onPointerMove);
        target.removeEventListener('pointerup', onPointerUp);
      };

      target.addEventListener('pointermove', onPointerMove);
      target.addEventListener('pointerup', onPointerUp);
    },
    [onResize],
  );

  return (
    <Table.Th
      onPointerDown={onCellPointerDown}
      data-column-key={dataColumnKey}
      style={{
        width: widthPercent,
        padding,
        position: 'relative',
        userSelect: 'none',
        textAlign: align,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        opacity: isDragging ? 0.3 : 1,
        background: isDragging ? 'var(--gb-surface-3)' : undefined,
        transition: 'opacity 140ms ease, background 140ms ease',
      }}
    >
      {children}
      {dropIndicatorPosition && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 2,
            bottom: 2,
            width: 2,
            backgroundColor: 'var(--mantine-color-blue-6)',
            left: dropIndicatorPosition === 'before' ? -1 : undefined,
            right: dropIndicatorPosition === 'after' ? -1 : undefined,
            zIndex: 12,
            pointerEvents: 'none',
            borderRadius: 999,
            boxShadow:
              '0 0 0 1px var(--mantine-color-blue-5), 0 0 16px color-mix(in srgb, var(--mantine-color-blue-4) 45%, transparent)',
            transition: 'left 140ms ease, right 140ms ease',
          }}
        />
      )}
      {!isLast && (
        <div
          ref={handleRef}
          onPointerDown={onPointerDown}
          style={{
            position: 'absolute',
            right: -3,
            top: 0,
            bottom: 0,
            width: 6,
            cursor: 'col-resize',
            zIndex: 11,
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResize?.(Infinity); // sentinel for reset
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--gb-glow-focus)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        />
      )}
    </Table.Th>
  );
}
