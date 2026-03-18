/**
 * Motion Animation System
 *
 * Two-tier hybrid: ambient tween for content + interactive spring for feedback.
 * All animations use consistent patterns — no random pop/bounce.
 *
 * Easing: expo-out [0.16, 1, 0.3, 1] — sharp attack, smooth deceleration.
 * Inspired by Linear, Vercel, Raycast animation systems.
 */

import type { Variants, Transition } from 'motion/react';

// ============================================================================
// TRANSITIONS (Two-tier system)
// ============================================================================

/** Expo-out easing — responsive attack, smooth deceleration */
const expoOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Ambient enter — tween for content appearing */
export const ambientEnter: Transition = {
  duration: 0.3,
  ease: expoOut,
};

/** Ambient exit — faster than enter */
export const ambientExit: Transition = {
  duration: 0.18,
  ease: expoOut,
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

/** Route-level page crossfade */
export const pageVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.15, ease: expoOut },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1, ease: expoOut },
  },
};

/** Tab panel content switches */
export const tabPanelVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: expoOut },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15, ease: expoOut },
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

/** Page-level stagger — orchestrates major sections */
export const staggerPageVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

/** Groups of 3+ items — container orchestrates, children animate */
export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.02,
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
// CONSTANTS
// ============================================================================

/** Sidebar collapse/expand CSS transition */
export const SIDEBAR_TRANSITION = 'width 200ms cubic-bezier(0.16, 1, 0.3, 1)';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create stagger delay for list items (capped to prevent long cascades)
 */
export function getStaggerDelay(index: number, baseDelay = 0.04, maxItems = 10): number {
  return Math.min(index, maxItems) * baseDelay;
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
