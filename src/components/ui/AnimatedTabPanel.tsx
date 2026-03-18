/**
 * AnimatedTabPanel — animated wrapper for tab content.
 *
 * Wrap tab panel content in this component, keyed on the active tab value.
 * Old content fades down, new content fades up.
 *
 * initial={false} ensures the first tab render is instant — only tab switches animate.
 */

import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { tabPanelVariants } from '@/lib/motion';

interface AnimatedTabPanelProps {
  tabKey: string;
  children: ReactNode;
}

export function AnimatedTabPanel({ tabKey, children }: AnimatedTabPanelProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={tabKey}
        variants={tabPanelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
