/**
 * AnimatedOutlet — drop-in replacement for <Outlet /> with page crossfade.
 *
 * Uses AnimatePresence initial={false} so the first page load is instant.
 * Only subsequent navigations get the crossfade transition.
 */

import { useLocation, Outlet } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { pageVariants } from '@/lib/motion';

export function AnimatedOutlet() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
