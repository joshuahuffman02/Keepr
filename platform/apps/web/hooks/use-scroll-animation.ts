"use client";

import { useRef, useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

interface UseScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

/**
 * Hook for triggering animations when element enters viewport
 * Uses Intersection Observer for performance (not scroll events)
 */
export function useScrollAnimation(options: UseScrollAnimationOptions = {}) {
  const { threshold = 0.1, rootMargin = "-50px", once = true } = options;
  const ref = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Skip animations if user prefers reduced motion
    if (prefersReducedMotion) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (once) {
            observer.unobserve(element);
          }
        } else if (!once) {
          setIsInView(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once, prefersReducedMotion]);

  return { ref, isInView, prefersReducedMotion };
}

/**
 * Animation variants for common scroll-triggered effects
 */
export const scrollAnimationVariants = {
  // Fade up - most common entrance animation
  fadeUp: {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
  },

  // Fade in from sides
  fadeLeft: {
    hidden: { opacity: 0, x: -30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
  },

  fadeRight: {
    hidden: { opacity: 0, x: 30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
  },

  // Scale in - good for cards
  scaleIn: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
  },

  // Stagger container for child animations
  staggerContainer: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  },

  // Fast stagger for grids
  fastStaggerContainer: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.05,
      },
    },
  },

  // Pop in - playful entrance
  popIn: {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 25,
      },
    },
  },

  // Subtle slide - minimal movement
  subtleSlide: {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" },
    },
  },
};

/**
 * Get delay for staggered animations based on index
 */
export function getStaggerDelay(index: number, baseDelay = 0.05): number {
  return index * baseDelay;
}

/**
 * Creates a custom stagger variant with specified delay
 */
export function createStaggerVariant(staggerDelay = 0.08, initialDelay = 0.1) {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: initialDelay,
      },
    },
  };
}
