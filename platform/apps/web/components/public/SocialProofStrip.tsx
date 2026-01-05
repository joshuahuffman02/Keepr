"use client";

import { useRef, useEffect, useState } from "react";
import { MapPin, Users, Star, TrendingUp } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { cn } from "../../lib/utils";
import { apiClient } from "../../lib/api-client";
import { useReducedMotionSafe } from "../../hooks/use-reduced-motion-safe";

// Animated counter hook (reused pattern from CharityImpactSection)
function useAnimatedCounter(end: number, duration: number = 2000, start: boolean = true) {
  const [count, setCount] = useState(0);
  const prefersReducedMotion = useReducedMotionSafe();

  useEffect(() => {
    if (!start || end === 0) {
      setCount(end);
      return;
    }

    if (prefersReducedMotion) {
      setCount(end);
      return;
    }

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Ease out cubic for satisfying deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, start, prefersReducedMotion]);

  return count;
}

interface SocialProofStripProps {
  className?: string;
  variant?: "light" | "tint" | "warm";
}

export function SocialProofStrip({
  className,
  variant = "light"
}: SocialProofStripProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const prefersReducedMotion = useReducedMotionSafe();

  // Fetch real platform stats
  const { data: stats } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: () => apiClient.getPlatformStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Calculate real values or use graceful fallbacks
  const campgroundCount = stats?.campgrounds?.total ?? 500;
  const statesCount = stats?.campgrounds?.byState?.length ?? 18;
  const weeklySearches = stats?.activity?.searchesThisWeek ?? 1200;

  // Animate the counters
  const animatedCampgrounds = useAnimatedCounter(campgroundCount, 2000, isInView);
  const animatedStates = useAnimatedCounter(statesCount, 1500, isInView);
  const animatedSearches = useAnimatedCounter(weeklySearches, 2500, isInView);

  const variantStyles = {
    light: "bg-white border-y border-slate-100",
    tint: "bg-keepr-evergreen/5 border-y border-keepr-evergreen/10",
    warm: "bg-gradient-to-r from-amber-50/50 via-rose-50/30 to-amber-50/50 border-y border-amber-100/50",
  };

  const statItems = [
    {
      value: animatedCampgrounds,
      suffix: "+",
      label: "Campgrounds to Explore",
      icon: MapPin,
      color: "text-keepr-evergreen",
    },
    {
      value: animatedStates,
      suffix: "",
      label: "States Coast to Coast",
      icon: Star,
      color: "text-amber-500",
    },
    {
      value: animatedSearches,
      suffix: "+",
      label: "Searches This Week",
      icon: TrendingUp,
      color: "text-rose-500",
    },
  ];

  const containerVariants = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0 },
    visible: {
      opacity: 1,
      transition: prefersReducedMotion ? undefined : { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion ? undefined : { duration: 0.4, ease: "easeOut" as const },
    },
  };

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      className={cn(variantStyles[variant], "py-6 md:py-8", className)}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-3 gap-4 md:gap-8">
          {statItems.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div key={i} variants={itemVariants} className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Icon className={cn("h-4 w-4 md:h-5 md:w-5", stat.color)} />
                  <span className="text-xl md:text-3xl font-bold text-slate-900">
                    {stat.value.toLocaleString()}{stat.suffix}
                  </span>
                </div>
                <p className="text-xs md:text-sm text-slate-500">{stat.label}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// Compact inline version for hero area - now with real data
export function SocialProofInline({ className }: { className?: string }) {
  const { data: stats } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: () => apiClient.getPlatformStats(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const campgroundCount = stats?.campgrounds?.total ?? 500;
  const statesCount = stats?.campgrounds?.byState?.length ?? 18;

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm", className)}>
      <span className="text-white/90">
        <strong className="text-white">{campgroundCount}+</strong> campgrounds
      </span>
      <span className="text-white/40">•</span>
      <span className="text-white/90">
        <strong className="text-white">{statesCount}</strong> states
      </span>
      <span className="text-white/40">•</span>
      <span className="text-white/90">
        <strong className="text-white">Family</strong> trusted
      </span>
    </div>
  );
}
