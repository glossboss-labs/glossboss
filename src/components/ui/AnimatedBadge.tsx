/**
 * Animated Badge Component
 * 
 * Status badges with pop-in animations.
 */

import { Badge, type BadgeProps } from '@mantine/core';
import { motion } from 'motion/react';
import { popVariants } from '@/lib/motion';

const MotionBadge = motion.create(Badge);

export interface AnimatedBadgeProps extends BadgeProps {
  /** Whether to animate on mount */
  animate?: boolean;
  /** Delay before animation starts */
  delay?: number;
}

export function AnimatedBadge({ 
  animate = true, 
  delay = 0,
  children,
  ...props 
}: AnimatedBadgeProps) {
  if (!animate) {
    return <Badge {...props}>{children}</Badge>;
  }

  return (
    <MotionBadge
      {...props}
      variants={popVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ delay }}
    >
      {children}
    </MotionBadge>
  );
}
