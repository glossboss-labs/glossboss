/**
 * AnimatedStateSwitch — crossfade between content states.
 *
 * Wraps conditional content (loading/error/empty/data) in AnimatePresence
 * so state transitions get a smooth opacity crossfade instead of an instant swap.
 *
 * initial={false} ensures the first render is instant — only state changes animate.
 */

import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { fadeVariants } from '@/lib/motion';

interface AnimatedStateSwitchProps {
  stateKey: string;
  children: ReactNode;
}

export function AnimatedStateSwitch({ stateKey, children }: AnimatedStateSwitchProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stateKey}
        variants={fadeVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
