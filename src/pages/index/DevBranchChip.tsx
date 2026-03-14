import { useEffect, useRef, useState } from 'react';
import { Group, Paper, Text } from '@mantine/core';
import { motion } from 'motion/react';
import { GitBranch } from 'lucide-react';

export interface DevBranchChipProps {
  branch: string;
}

export function DevBranchChip({ branch }: DevBranchChipProps) {
  const [isHidden, setIsHidden] = useState(false);
  const [hiddenOffset, setHiddenOffset] = useState(220);
  const chipRef = useRef<HTMLDivElement | null>(null);
  const isHiddenRef = useRef(false);

  useEffect(() => {
    const chipMargin = 16;
    const hidePadding = 12;
    const revealPadding = 72;
    let rafId: number | null = null;
    let latestPointer: { x: number; y: number } | null = null;

    const measureChip = () => {
      if (!chipRef.current) return;
      setHiddenOffset(chipRef.current.offsetWidth + 40);
    };

    const getAnchorRect = () => {
      const width = chipRef.current?.offsetWidth ?? 0;
      const height = chipRef.current?.offsetHeight ?? 0;

      return {
        left: window.innerWidth - chipMargin - width,
        right: window.innerWidth - chipMargin,
        top: window.innerHeight - chipMargin - height,
        bottom: window.innerHeight - chipMargin,
      };
    };

    const isWithinExpandedRect = (x: number, y: number, padding: number) => {
      const rect = getAnchorRect();

      return (
        x >= rect.left - padding &&
        x <= rect.right + padding &&
        y >= rect.top - padding &&
        y <= rect.bottom + padding
      );
    };

    const updateHiddenState = (x: number, y: number) => {
      if (!isHiddenRef.current && isWithinExpandedRect(x, y, hidePadding)) {
        isHiddenRef.current = true;
        setIsHidden(true);
      } else if (isHiddenRef.current && !isWithinExpandedRect(x, y, revealPadding)) {
        isHiddenRef.current = false;
        setIsHidden(false);
      }
    };

    const flushPointerMove = () => {
      rafId = null;

      if (!latestPointer) return;

      updateHiddenState(latestPointer.x, latestPointer.y);
      latestPointer = null;
    };

    const handlePointerMove = (event: MouseEvent) => {
      latestPointer = { x: event.clientX, y: event.clientY };

      if (rafId === null) {
        rafId = window.requestAnimationFrame(flushPointerMove);
      }
    };

    const handlePointerLeave = () => {
      isHiddenRef.current = false;
      setIsHidden(false);
      latestPointer = null;

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    measureChip();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureChip) : null;

    if (chipRef.current && resizeObserver) {
      resizeObserver.observe(chipRef.current);
    }

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('blur', handlePointerLeave);
    window.addEventListener('mouseleave', handlePointerLeave);
    window.addEventListener('resize', measureChip);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('blur', handlePointerLeave);
      window.removeEventListener('mouseleave', handlePointerLeave);
      window.removeEventListener('resize', measureChip);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <motion.div
      ref={chipRef}
      animate={{
        x: isHidden ? hiddenOffset : 0,
        opacity: isHidden ? 0.22 : 1,
      }}
      transition={{
        x: {
          type: 'spring',
          stiffness: 180,
          damping: 24,
          mass: 0.95,
        },
        opacity: {
          duration: 0.24,
          ease: 'easeOut',
        },
      }}
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 200,
        pointerEvents: isHidden ? 'none' : 'auto',
        willChange: 'transform, opacity',
      }}
    >
      <Paper
        withBorder
        shadow="md"
        radius="xl"
        px="sm"
        py={6}
        style={{
          backdropFilter: 'blur(12px)',
          background: 'color-mix(in srgb, var(--gb-surface-1) 85%, transparent)',
        }}
      >
        <Group gap={6} wrap="nowrap">
          <GitBranch size={14} />
          <Text size="xs" fw={600}>
            {branch}
          </Text>
        </Group>
      </Paper>
    </motion.div>
  );
}
