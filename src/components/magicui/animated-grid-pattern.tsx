import { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'motion/react';

import { cn } from '@/lib/utils';

interface AnimatedGridPatternProps {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  strokeDasharray?: number;
  numSquares?: number;
  className?: string;
  maxOpacity?: number;
  duration?: number;
  repeatDelay?: number;
}

function getRandomPos(dimW: number, dimH: number, cellW: number, cellH: number): [number, number] {
  return [Math.floor((Math.random() * dimW) / cellW), Math.floor((Math.random() * dimH) / cellH)];
}

function makeSquares(count: number, dimW: number, dimH: number, cellW: number, cellH: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    pos: getRandomPos(dimW, dimH, cellW, cellH),
  }));
}

export function AnimatedGridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = 0,
  numSquares = 50,
  className,
  maxOpacity = 0.5,
  duration = 4,
  repeatDelay = 0.5,
}: AnimatedGridPatternProps) {
  const id = useId();
  const containerRef = useRef<SVGSVGElement>(null);
  const dimensionsRef = useRef({ width: 0, height: 0 });
  const [squares, setSquares] = useState(() => makeSquares(numSquares, 0, 0, width, height));

  // Observe container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        dimensionsRef.current = { width: w, height: h };
        setSquares(makeSquares(numSquares, w, h, width, height));
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [numSquares, width, height]);

  const handleAnimationComplete = (sqId: number) => {
    const { width: dimW, height: dimH } = dimensionsRef.current;
    setSquares((prev) =>
      prev.map((sq) =>
        sq.id === sqId ? { ...sq, pos: getRandomPos(dimW, dimH, width, height) } : sq,
      ),
    );
  };

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full fill-gray-400/30 stroke-gray-400/30',
        className,
      )}
    >
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse" x={x} y={y}>
          <path d={`M.5 ${height}V.5H${width}`} fill="none" strokeDasharray={strokeDasharray} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
      <svg x={x} y={y} className="overflow-visible">
        {squares.map(({ pos: [sqX, sqY], id: sqId }, index) => (
          <motion.rect
            initial={{ opacity: 0 }}
            animate={{ opacity: maxOpacity }}
            transition={{
              duration,
              repeat: 1,
              delay: index * 0.1,
              repeatType: 'reverse',
              repeatDelay,
            }}
            onAnimationComplete={() => handleAnimationComplete(sqId)}
            key={`${sqId}-${sqX}-${sqY}`}
            width={width - 1}
            height={height - 1}
            x={sqX * width + 1}
            y={sqY * height + 1}
            fill="currentColor"
            strokeWidth="0"
          />
        ))}
      </svg>
    </svg>
  );
}
