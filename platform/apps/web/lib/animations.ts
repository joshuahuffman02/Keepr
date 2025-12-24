/**
 * Centralized animation configurations matching the onboarding UI patterns.
 * Used across the dashboard and other pages for consistent motion design.
 */

// Spring animation config - smooth, natural feeling motion
export const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 200,
  damping: 20,
};

// Faster spring for micro-interactions
export const SPRING_FAST = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

// Slower spring for larger elements
export const SPRING_SLOW = {
  type: "spring" as const,
  stiffness: 150,
  damping: 20,
};

// Stagger delay between items in a list
export const STAGGER_DELAY = 0.05;

// Fade in from bottom - common entrance animation
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

// Fade in from right - for directional navigation
export const fadeInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

// Scale in - for modals, cards, icons
export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

// Simple fade - for subtle transitions
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// Staggered container for child animations
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: STAGGER_DELAY,
    },
  },
};

// Staggered child - use with staggerContainer
export const staggerChild = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// Hover scale effect for interactive cards
export const hoverScale = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
};

// Pulse animation for attention-grabbing elements
export const pulse = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
  },
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

// Glow pulse for status indicators
export const glowPulse = {
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(16, 185, 129, 0)",
      "0 0 0 8px rgba(16, 185, 129, 0.2)",
      "0 0 0 0 rgba(16, 185, 129, 0)",
    ],
  },
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

/**
 * Helper to create staggered delay based on index
 */
export function getStaggerDelay(index: number, baseDelay = 0): number {
  return baseDelay + index * STAGGER_DELAY;
}

/**
 * Reduced motion variants - use when prefersReducedMotion is true
 */
export const reducedMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
};
