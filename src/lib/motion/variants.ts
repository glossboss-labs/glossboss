/**
 * Motion Animation Utilities
 *
 * Reusable animation variants and configurations for Motion (Framer Motion).
 * Provides consistent, spring-based animations throughout the app.
 */

import type { Variants, Transition } from 'motion/react';

// ============================================================================
// TRANSITIONS
// ============================================================================

/** Default spring transition - natural, bouncy feel */
export const springTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

/** Gentle spring for larger elements */
export const gentleSpring: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 35,
};

/** Snappy spring for micro-interactions */
export const snappySpring: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
};

/** Quick fade transition */
export const quickFade: Transition = {
  duration: 0.15,
  ease: 'easeOut',
};

/** Smooth ease transition */
export const smoothEase: Transition = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1],
};

// ============================================================================
// VARIANTS
// ============================================================================

/** Fade in/out */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/** Fade with slight scale */
export const fadeScaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: quickFade,
  },
};

/** Slide up (for modals, notifications) */
export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: gentleSpring,
  },
  exit: {
    opacity: 0,
    y: 10,
    transition: quickFade,
  },
};

/** Slide down (for dropdowns) */
export const slideDownVariants: Variants = {
  hidden: { opacity: 0, y: -10, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.98,
    transition: quickFade,
  },
};

/** Slide from right (for sidebars, panels) */
export const slideRightVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: gentleSpring,
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: quickFade,
  },
};

/** Pop in (for badges, icons) */
export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: snappySpring,
  },
  exit: {
    opacity: 0,
    scale: 0.5,
    transition: quickFade,
  },
};

/** List item stagger animation */
export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    transition: quickFade,
  },
};

/** Container for staggered children */
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
};

/** Table row animation */
export const tableRowVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    x: -10,
    transition: quickFade,
  },
};

/** Shake animation for errors */
export const shakeVariants: Variants = {
  shake: {
    x: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.4 },
  },
};

/** Pulse animation for attention */
export const pulseVariants: Variants = {
  pulse: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 0.3,
      ease: 'easeInOut',
    },
  },
};

// ============================================================================
// HOVER & TAP STATES
// ============================================================================

/** Button hover/tap states - subtle */
export const buttonStates = {
  whileTap: { scale: 0.98 },
  transition: snappySpring,
};

/** Subtle button states (for inline buttons) */
export const subtleButtonStates = {
  whileTap: { scale: 0.99 },
  transition: snappySpring,
};

/** Icon hover state - minimal */
export const iconHoverState = {
  whileTap: { scale: 0.95 },
  transition: snappySpring,
};

/** Card hover state - removed */
export const cardHoverState = {
  transition: gentleSpring,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create stagger delay for list items
 */
export function getStaggerDelay(index: number, baseDelay = 0.03): number {
  return index * baseDelay;
}

/**
 * Create custom spring with specific settings
 */
export function createSpring(stiffness = 400, damping = 30, mass = 1): Transition {
  return {
    type: 'spring',
    stiffness,
    damping,
    mass,
  };
}
