import { type ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

interface MarqueeProps extends ComponentPropsWithoutRef<'div'> {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children: React.ReactNode;
  vertical?: boolean;
  repeat?: number;
  duration?: string;
  gap?: string;
}

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  duration = '40s',
  gap = '1rem',
  ...props
}: MarqueeProps) {
  return (
    <div
      {...props}
      className={cn('group flex overflow-hidden', vertical ? 'flex-col' : 'flex-row', className)}
      style={{ gap }}
    >
      {Array(repeat)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex shrink-0 justify-around',
              vertical ? 'flex-col' : 'flex-row',
              pauseOnHover && 'group-hover:[animation-play-state:paused]',
            )}
            style={{
              gap,
              animation: `${vertical ? 'marquee-vertical' : 'marquee'} ${duration} linear infinite${reverse ? ' reverse' : ''}`,
            }}
          >
            {children}
          </div>
        ))}
    </div>
  );
}
