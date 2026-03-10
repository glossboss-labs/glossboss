/**
 * Motion Animation System
 *
 * Two-tier hybrid: ambient tween for content + interactive spring for feedback.
 * All animations use consistent patterns — no random pop/bounce.
 */

import type { Variants, Transition } from 'motion/react';

// ============================================================================
// TRANSITIONS (Two-tier system)
// ============================================================================

/** Ambient enter — tween for content appearing */
export const ambientEnter: Transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1.0],
};

/** Ambient exit — 30% faster than enter */
export const ambientExit: Transition = {
  duration: 0.14,
  ease: [0.25, 0.1, 0.25, 1.0],
};

/** Interactive spring — for button/badge feedback */
export const interactiveSpring: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
  mass: 0.8,
};

// ============================================================================
// VARIANTS
// ============================================================================

/** Content appearing — modals, alerts, panels, toolbar items */
export const contentVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: ambientEnter,
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: ambientExit,
  },
};

/** Dropdowns, menus, popovers */
export const dropdownVariants: Variants = {
  hidden: { opacity: 0, y: -4, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: ambientEnter,
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    transition: ambientExit,
  },
};

/** Side panels, source browser */
export const panelVariants: Variants = {
  hidden: { opacity: 0, x: 12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: ambientEnter,
  },
  exit: {
    opacity: 0,
    x: 12,
    transition: ambientExit,
  },
};

/** Opacity-only content swaps */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: ambientEnter,
  },
  exit: {
    opacity: 0,
    transition: ambientExit,
  },
};

/** Editor sections appearing */
export const sectionVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: ambientEnter,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: ambientExit,
  },
};

/** Filter badges, status chips (spring-based) */
export const badgeVariants: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: interactiveSpring,
  },
  exit: {
    opacity: 0,
    scale: 0.85,
    transition: ambientExit,
  },
};

/** Groups of 3+ items */
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

/** Shake animation for errors (reduced) */
export const shakeVariants: Variants = {
  shake: {
    x: [0, -6, 6, -6, 6, 0],
    transition: { duration: 0.35 },
  },
};

/** Pulse animation for attention */
export const pulseVariants: Variants = {
  pulse: {
    scale: [1, 1.03, 1],
    transition: {
      duration: 0.25,
      ease: 'easeInOut',
    },
  },
};

// ============================================================================
// HOVER & TAP STATES
// ============================================================================

/** Button hover/tap states */
export const buttonStates = {
  whileTap: { scale: 0.97 },
  transition: interactiveSpring,
};

/** Subtle button states (for inline buttons) */
export const subtleButtonStates = {
  whileTap: { scale: 0.98 },
  transition: interactiveSpring,
};

/** Icon states */
export const iconStates = {
  whileTap: { scale: 0.92 },
  transition: interactiveSpring,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create stagger delay for list items
 */
export function getStaggerDelay(index: number, baseDelay = 0.06): number {
  return index * baseDelay;
}

/**
 * Create custom spring with specific settings
 */
export function createSpring(stiffness = 500, damping = 30, mass = 0.8): Transition {
  return {
    type: 'spring',
    stiffness,
    damping,
    mass,
  };
}
