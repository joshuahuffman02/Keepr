"use client";

import { motion, Variants, TargetAndTransition } from "framer-motion";
import { ReactNode, Children } from "react";
import { cn } from "@/lib/utils";

interface StaggeredListProps {
  children: ReactNode;
  /** Delay between each item in seconds (default: 0.05) */
  staggerDelay?: number;
  /** Initial delay before first item animates (default: 0) */
  initialDelay?: number;
  /** Animation variant (default: "fadeUp") */
  variant?: "fadeUp" | "fadeIn" | "slideLeft" | "slideRight" | "scale";
  /** Custom class for the container */
  className?: string;
  /** Whether to animate (respects prefers-reduced-motion by default) */
  animate?: boolean;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants: Record<string, Variants> = {
  fadeUp: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24,
      },
    },
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.3,
      },
    },
  },
  slideLeft: {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24,
      },
    },
  },
  slideRight: {
    hidden: { opacity: 0, x: 20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24,
      },
    },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 24,
      },
    },
  },
};

/**
 * A container component that staggers the entrance animation of its children.
 * Respects prefers-reduced-motion by default.
 *
 * @example
 * <StaggeredList variant="fadeUp" staggerDelay={0.1}>
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 *   <Card>Item 3</Card>
 * </StaggeredList>
 */
export function StaggeredList({
  children,
  staggerDelay = 0.05,
  initialDelay = 0,
  variant = "fadeUp",
  className,
  animate = true,
}: StaggeredListProps) {
  const childArray = Children.toArray(children);

  // Create container variants with custom stagger timing
  const customContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: initialDelay,
        staggerChildren: staggerDelay,
      },
    },
  };

  if (!animate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn("motion-safe:animate-in", className)}
      variants={customContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {childArray.map((child, index) => (
        <motion.div key={index} variants={itemVariants[variant]}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

interface StaggeredItemProps {
  children: ReactNode;
  /** Custom class for the item wrapper */
  className?: string;
  /** Delay for this specific item (overrides parent stagger) */
  delay?: number;
  /** Animation variant (default uses parent) */
  variant?: "fadeUp" | "fadeIn" | "slideLeft" | "slideRight" | "scale";
}

/**
 * Individual staggered item for more control.
 * Use with index-based delay for manual staggering.
 *
 * @example
 * {items.map((item, index) => (
 *   <StaggeredItem key={item.id} delay={index * 0.05}>
 *     <Card>{item.name}</Card>
 *   </StaggeredItem>
 * ))}
 */
export function StaggeredItem({
  children,
  className,
  delay = 0,
  variant = "fadeUp",
}: StaggeredItemProps) {
  const variantConfig = itemVariants[variant];
  const hiddenState = variantConfig.hidden as TargetAndTransition;
  const visibleState = variantConfig.visible as TargetAndTransition;
  const visibleTransition = visibleState.transition || {};

  return (
    <motion.div
      className={cn("motion-safe:animate-in", className)}
      initial={hiddenState}
      animate={visibleState}
      transition={{
        ...visibleTransition,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Table row with stagger animation support.
 * For use in tables where we can't wrap in div.
 */
export function StaggeredTableRow({
  children,
  index = 0,
  staggerDelay = 0.03,
  className,
  ...props
}: {
  children: ReactNode;
  index?: number;
  staggerDelay?: number;
  className?: string;
  [key: string]: any;
}) {
  return (
    <motion.tr
      className={cn("motion-safe:animate-in", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 24,
        delay: index * staggerDelay,
      }}
      {...props}
    >
      {children}
    </motion.tr>
  );
}
