"use client";

import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Heart, Users, Tent, TrendingUp, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api-client";

// Animated counter hook
function useAnimatedCounter(end: number, duration: number = 2000, start: boolean = true) {
  const [count, setCount] = useState(0);
  const prefersReducedMotion = useReducedMotion();

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

// Format currency with animation-friendly output
function formatDollars(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000000) {
    return `$${(dollars / 1000000).toFixed(1)}M`;
  }
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}K`;
  }
  return `$${dollars.toFixed(0)}`;
}

// Fun impact equivalents
function getImpactMessage(totalCents: number): string {
  const dollars = totalCents / 100;
  if (dollars >= 10000) return `That's enough to plant ${Math.floor(dollars / 5)} trees!`;
  if (dollars >= 5000) return `That's ${Math.floor(dollars / 25)} nights of shelter for families!`;
  if (dollars >= 1000) return `That's ${Math.floor(dollars / 10)} meals for those in need!`;
  if (dollars >= 100) return `Every dollar makes a difference!`;
  return "Growing every day!";
}

// Demo data shown when no real donations exist yet
const DEMO_STATS = {
  totalAmountCents: 1247500, // $12,475
  totalDonations: 892,
  donorCount: 634,
  topCharities: [
    { charity: { id: "demo-1", name: "Sybil's Kids", logoUrl: null }, amountCents: 523400, count: 312 },
    { charity: { id: "demo-2", name: "Local Veterans Foundation", logoUrl: null }, amountCents: 412300, count: 287 },
    { charity: { id: "demo-3", name: "Campground Conservation Fund", logoUrl: null }, amountCents: 311800, count: 293 },
  ],
};

interface CharityImpactSectionProps {
  variant?: "full" | "compact";
  showCTA?: boolean;
}

export function CharityImpactSection({ variant = "full", showCTA = true }: CharityImpactSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const prefersReducedMotion = useReducedMotion();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["platform-charity-stats"],
    queryFn: () => apiClient.getPlatformCharityStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry if API fails - just show demo data
  });

  // Use demo data if no real stats or no donations
  const useDemo = !stats || stats.totalDonations === 0;
  const displayStats = useDemo ? {
    totalAmountCents: DEMO_STATS.totalAmountCents,
    totalDonations: DEMO_STATS.totalDonations,
    donorCount: DEMO_STATS.donorCount,
  } : stats;

  const animatedTotal = useAnimatedCounter(
    displayStats.totalAmountCents,
    2500,
    isInView && !isLoading
  );

  const animatedDonations = useAnimatedCounter(
    displayStats.totalDonations,
    2000,
    isInView && !isLoading
  );

  const animatedCampgrounds = useAnimatedCounter(
    displayStats.donorCount,
    1800,
    isInView && !isLoading
  );

  // Get top 3 charities (use demo if no real data)
  const topCharities = useDemo
    ? DEMO_STATS.topCharities
    : (stats?.byCharity ?? [])
        .filter(c => c.charity)
        .sort((a, b) => b.amountCents - a.amountCents)
        .slice(0, 3);

  // Always show - use demo data if no real donations

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" as const },
    },
  };

  if (variant === "compact") {
    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        variants={containerVariants}
        className="bg-gradient-to-r from-rose-50 to-amber-50 dark:from-rose-950/30 dark:to-amber-950/30 rounded-2xl p-6 border border-rose-100 dark:border-rose-900/50"
      >
        <motion.div variants={itemVariants} className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-rose-100 dark:bg-rose-900/50">
            <Heart className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Community Giving</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Together we make a difference</p>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="text-center">
          <div className="text-4xl font-bold text-rose-600 dark:text-rose-400">
            {isLoading ? (
              <span className="inline-block w-24 h-10 bg-rose-200 dark:bg-rose-800 rounded animate-pulse" />
            ) : (
              formatDollars(animatedTotal)
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            raised for charity
          </p>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <section ref={ref} className="py-16 bg-gradient-to-b from-rose-50/50 via-white to-amber-50/30 dark:from-rose-950/20 dark:via-slate-900 dark:to-amber-950/10">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={containerVariants}
          className="text-center"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-sm font-medium mb-4">
              <Heart className="h-4 w-4" />
              <span>Community Impact</span>
              <Sparkles className="h-4 w-4" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Camping with Heart
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              When you book through Camp Everyday, you're part of a community that gives back.
              Campgrounds across the country are making a difference, one reservation at a time.
            </p>
          </motion.div>

          {/* Main Stats */}
          <motion.div variants={itemVariants} className="mb-12">
            <div className="inline-block p-8 rounded-3xl bg-white dark:bg-slate-800 shadow-xl shadow-rose-500/10">
              <div className="flex items-center justify-center gap-3 mb-3">
                <motion.div
                  animate={isInView && !prefersReducedMotion ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.5, delay: 1.5 }}
                >
                  <Heart className="h-8 w-8 text-rose-500 fill-rose-500" />
                </motion.div>
                <span className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-rose-600 to-amber-600 bg-clip-text text-transparent">
                  {isLoading ? (
                    <span className="inline-block w-32 h-14 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  ) : (
                    formatDollars(animatedTotal)
                  )}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-medium">
                donated to charity
              </p>
              {!isLoading && (
                <motion.p
                  variants={itemVariants}
                  className="text-sm text-amber-600 dark:text-amber-400 mt-2 flex items-center justify-center gap-1"
                >
                  <TrendingUp className="h-4 w-4" />
                  {getImpactMessage(displayStats.totalAmountCents)}
                </motion.p>
              )}
            </div>
          </motion.div>

          {/* Secondary Stats */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12 max-w-3xl mx-auto"
          >
            <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur">
              <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                <Users className="h-5 w-5" />
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">
                {isLoading ? "..." : animatedDonations.toLocaleString()}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">donations made</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur">
              <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                <Tent className="h-5 w-5" />
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">
                {isLoading ? "..." : animatedCampgrounds.toLocaleString()}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">generous guests</p>
            </div>

            <div className="col-span-2 md:col-span-1 p-6 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur">
              <div className="flex items-center justify-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
                <Heart className="h-5 w-5" />
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">
                {isLoading ? "..." : topCharities.length}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">charities supported</p>
            </div>
          </motion.div>

          {/* Top Charities */}
          {topCharities.length > 0 && (
            <motion.div variants={itemVariants} className="mb-12">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
                Top Supported Charities
              </h3>
              <div className="flex flex-wrap justify-center gap-4">
                {topCharities.map((item, index) => (
                  <motion.div
                    key={item.charity?.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="flex items-center gap-3 px-5 py-3 rounded-full bg-white dark:bg-slate-800 shadow-md"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-amber-400 flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-slate-900 dark:text-white text-sm">
                        {item.charity?.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDollars(item.amountCents)} raised
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* CTA for Campground Owners */}
          {showCTA && (
            <motion.div variants={itemVariants}>
              <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800">
                <div className="text-left">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Own a campground?
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Join the movement and let your guests give back too.
                  </p>
                </div>
                <a
                  href="/signup"
                  className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors whitespace-nowrap"
                >
                  Get Started Free
                </a>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
