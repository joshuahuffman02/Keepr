"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScrollProgressIndicatorProps {
  /** Minimum page height to show indicator (default: 1500) */
  minHeight?: number;
  /** Custom class name */
  className?: string;
}

export function ScrollProgressIndicator({
  minHeight = 1500,
  className,
}: ScrollProgressIndicatorProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [milestone, setMilestone] = useState<25 | 50 | 100 | null>(null);
  const [celebratedMilestones, setCelebratedMilestones] = useState<Set<number>>(new Set());
  const prefersReducedMotion = useReducedMotion();

  const checkMilestone = useCallback((progress: number) => {
    const percentage = Math.round(progress * 100);

    // Check milestones in order
    if (percentage >= 100 && !celebratedMilestones.has(100)) {
      setMilestone(100);
      setCelebratedMilestones(prev => new Set([...prev, 100]));
      setTimeout(() => setMilestone(null), 3000);
    } else if (percentage >= 50 && percentage < 100 && !celebratedMilestones.has(50)) {
      setMilestone(50);
      setCelebratedMilestones(prev => new Set([...prev, 50]));
      setTimeout(() => setMilestone(null), 2500);
    } else if (percentage >= 25 && percentage < 50 && !celebratedMilestones.has(25)) {
      setMilestone(25);
      setCelebratedMilestones(prev => new Set([...prev, 25]));
      setTimeout(() => setMilestone(null), 2000);
    }
  }, [celebratedMilestones]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateProgress = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      const progress = Math.min(1, Math.max(0, scrolled / scrollHeight));

      setScrollProgress(progress);
      setIsVisible(document.documentElement.scrollHeight > minHeight && scrolled > 100);
      checkMilestone(progress);
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [minHeight, checkMilestone]);

  // Don't render for reduced motion or when not visible
  if (prefersReducedMotion || !isVisible) {
    return null;
  }

  const isAtSummit = scrollProgress >= 0.95;
  const percentage = Math.round(scrollProgress * 100);

  // Milestone messages
  const getMilestoneMessage = (m: 25 | 50 | 100) => {
    switch (m) {
      case 25:
        return "Keep exploring!";
      case 50:
        return "Halfway there, adventurer!";
      case 100:
        return "You explored it all!";
    }
  };

  // Hover tooltip message
  const getHoverMessage = () => {
    if (isAtSummit) return "You made it to the summit!";
    if (percentage > 75) return "Almost at the peak!";
    if (percentage > 50) return "Great progress, explorer!";
    if (percentage > 25) return "Keep climbing!";
    return "Keep scrolling, explorer!";
  };

  return (
    <motion.div
      className={cn(
        "fixed bottom-6 right-6 z-40 flex flex-col items-center gap-1.5",
        className
      )}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Milestone celebration message */}
      <AnimatePresence>
        {milestone && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
            className={cn(
              "absolute -top-12 right-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-lg",
              milestone === 100
                ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                : "bg-emerald-500 text-white"
            )}
          >
            {getMilestoneMessage(milestone)}
            {milestone === 100 && (
              <motion.span
                className="ml-1 inline-block"
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.5, repeat: 2 }}
              >
                *
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover tooltip */}
      <AnimatePresence>
        {isHovered && !milestone && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="absolute right-20 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg whitespace-nowrap shadow-lg"
          >
            {getHoverMessage()}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-slate-800 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summit flag - appears at 95%+ */}
      <motion.div
        className="text-amber-500"
        initial={{ opacity: 0, y: 5 }}
        animate={{
          opacity: isAtSummit ? 1 : 0,
          y: isAtSummit ? 0 : 5,
          scale: isAtSummit ? [1, 1.2, 1] : 1,
        }}
        transition={{ duration: 0.4 }}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 21V4h2v1h10l-4 5 4 5H7v6H5z" />
        </svg>
      </motion.div>

      {/* Mountain container - BIGGER (was 48x64, now 64x80) */}
      <motion.div
        className="relative w-16 h-20"
        animate={isAtSummit ? {
          filter: ["drop-shadow(0 0 0px rgba(16,185,129,0))", "drop-shadow(0 0 12px rgba(16,185,129,0.6))", "drop-shadow(0 0 0px rgba(16,185,129,0))"]
        } : {}}
        transition={{ duration: 2, repeat: isAtSummit ? Infinity : 0 }}
      >
        {/* Glow effect at summit */}
        {isAtSummit && (
          <motion.div
            className="absolute inset-0 bg-emerald-400/30 rounded-full blur-xl"
            animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {/* Mountain background (unfilled) */}
        <svg
          className="absolute inset-0 w-full h-full text-slate-200"
          viewBox="0 0 64 80"
          fill="currentColor"
        >
          <path d="M32 4L4 76H60L32 4Z" />
        </svg>

        {/* Mountain fill (progress) with gradient */}
        <div
          className="absolute bottom-0 left-0 right-0 overflow-hidden transition-all duration-150"
          style={{ height: `${scrollProgress * 100}%` }}
        >
          <svg
            className="absolute bottom-0 w-full"
            viewBox="0 0 64 80"
            style={{ height: "80px" }}
          >
            <defs>
              <linearGradient id="mountainGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            <path d="M32 4L4 76H60L32 4Z" fill="url(#mountainGradient)" />
          </svg>
        </div>

        {/* Snow cap on mountain peak */}
        <svg
          className="absolute inset-0 w-full h-full text-white"
          viewBox="0 0 64 80"
          fill="currentColor"
        >
          <path d="M32 4L24 20H40L32 4Z" opacity="0.95" />
        </svg>

        {/* Climbing tent marker - bigger */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 w-5 h-5"
          style={{
            bottom: `${scrollProgress * 85}%`,
          }}
          animate={milestone === 50 ? { rotate: [0, -10, 10, 0] } : {}}
          transition={{ duration: 0.5 }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full drop-shadow-md">
            {/* Tent shape with glow at milestones */}
            <path
              d="M12 6L4 18H20L12 6Z"
              fill={isAtSummit ? "#fbbf24" : "#10b981"}
              stroke={isAtSummit ? "#b45309" : "#065f46"}
              strokeWidth="1"
            />
            <rect x="10" y="14" width="4" height="4" fill={isAtSummit ? "#b45309" : "#065f46"} />
          </svg>
        </motion.div>
      </motion.div>

      {/* Percentage label - bigger and bolder at summit */}
      <motion.span
        className={cn(
          "text-sm font-semibold tabular-nums transition-colors duration-300",
          isAtSummit ? "text-emerald-600" : "text-slate-500"
        )}
        animate={isAtSummit ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.5 }}
      >
        {percentage}%
      </motion.span>
    </motion.div>
  );
}
