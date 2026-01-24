"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FadeInSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  once?: boolean;
  amount?: "some" | "all" | number;
}

/**
 * Wraps content with scroll-triggered fade-in animation.
 * Respects reduced motion preferences.
 */
export function FadeInSection({
  children,
  className,
  delay = 0,
  direction = "up",
  once = true,
  amount = 0.3,
}: FadeInSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, amount });
  const prefersReducedMotion = useReducedMotion();

  // Direction-based initial position
  const getInitialOffset = () => {
    if (prefersReducedMotion) return { x: 0, y: 0 };
    switch (direction) {
      case "up":
        return { x: 0, y: 30 };
      case "down":
        return { x: 0, y: -30 };
      case "left":
        return { x: 30, y: 0 };
      case "right":
        return { x: -30, y: 0 };
      case "none":
      default:
        return { x: 0, y: 0 };
    }
  };

  const offset = getInitialOffset();

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: offset.x, y: offset.y }}
      animate={
        isInView
          ? { opacity: 1, x: 0, y: 0 }
          : prefersReducedMotion
            ? { opacity: 1 }
            : { opacity: 0, x: offset.x, y: offset.y }
      }
      transition={{
        duration: prefersReducedMotion ? 0 : 0.6,
        delay: prefersReducedMotion ? 0 : delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Wrapper for staggered children animations.
 */
interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
}: StaggerContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: prefersReducedMotion ? 0 : staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.21, 0.47, 0.32, 0.98],
    },
  },
};
