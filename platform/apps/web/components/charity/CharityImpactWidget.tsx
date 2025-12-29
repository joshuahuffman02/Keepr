"use client";

import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, TrendingUp, Users, Sparkles, Settings } from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";

// Animated counter hook
function useAnimatedCounter(end: number, duration: number = 1500, start: boolean = true) {
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

function formatDollars(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}K`;
  }
  return `$${dollars.toFixed(2)}`;
}

// Encouraging messages based on stats
function getEncouragingMessage(totalCents: number, optInRate: number): string {
  if (totalCents === 0) return "Start making a difference today!";
  if (optInRate >= 50) return "Your guests love giving back!";
  if (optInRate >= 25) return "Growing generosity every day!";
  if (totalCents >= 50000) return "Amazing impact!";
  if (totalCents >= 10000) return "You're making waves!";
  return "Every dollar counts!";
}

interface CharityImpactWidgetProps {
  campgroundId: string;
}

export function CharityImpactWidget({ campgroundId }: CharityImpactWidgetProps) {
  const prefersReducedMotion = useReducedMotion();
  const [hasAnimated, setHasAnimated] = useState(false);

  // Get campground charity settings
  const { data: charitySettings, isLoading: loadingSettings } = useQuery({
    queryKey: ["campground-charity", campgroundId],
    queryFn: () => apiClient.getCampgroundCharity(campgroundId),
    enabled: !!campgroundId,
    staleTime: 30000, // 30 seconds - reduce refetch frequency
    placeholderData: keepPreviousData, // Keep showing old data while refetching
  });

  // Get donation stats
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["campground-charity-stats", campgroundId],
    queryFn: () => apiClient.getCampgroundCharityStats(campgroundId),
    enabled: !!campgroundId,
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  // Trigger animation after stats load (don't block on settings)
  useEffect(() => {
    if (!loadingStats && stats) {
      setHasAnimated(true);
    }
  }, [loadingStats, stats]);

  const animatedTotal = useAnimatedCounter(
    stats?.totalAmountCents ?? 0,
    1800,
    hasAnimated
  );

  const animatedDonations = useAnimatedCounter(
    stats?.totalDonations ?? 0,
    1500,
    hasAnimated
  );

  // Only show full skeleton while initial settings load
  if (loadingSettings && !charitySettings) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-950/30 dark:to-amber-950/20 border border-rose-100 dark:border-rose-900/50 p-6">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-rose-200 dark:bg-rose-800" />
            <div className="flex-1">
              <div className="h-5 w-32 bg-rose-200 dark:bg-rose-800 rounded" />
              <div className="h-4 w-24 bg-rose-100 dark:bg-rose-900 rounded mt-1" />
            </div>
          </div>
          <div className="h-16 bg-rose-100 dark:bg-rose-900 rounded-xl" />
        </div>
      </div>
    );
  }

  // If charity is not enabled, show setup prompt
  if (!charitySettings || !charitySettings.isEnabled) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-950/30 dark:to-amber-950/20 border border-rose-100 dark:border-rose-900/50 p-6"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/50">
            <Heart className="h-6 w-6 text-rose-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
              Give Back with Round-Up
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Let your guests round up payments to donate to a charity of your choice.
              It's a small gesture with a big impact!
            </p>
            <Link
              href="/dashboard/settings/charity"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium transition-colors"
            >
              <Settings className="h-4 w-4" />
              Set Up Charity
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  const charityName = charitySettings?.charity?.name ?? "Charity";
  const optInRate = stats?.optInRate ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-950/30 dark:to-amber-950/20 border border-rose-100 dark:border-rose-900/50 p-6 relative overflow-hidden"
    >
      {/* Decorative sparkle */}
      <motion.div
        className="absolute top-4 right-4"
        animate={!prefersReducedMotion ? { rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
      >
        <Sparkles className="h-5 w-5 text-amber-400" />
      </motion.div>

      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <motion.div
          className="p-3 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 shadow-lg shadow-rose-500/25"
          animate={!prefersReducedMotion && hasAnimated ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.5, delay: 1.5 }}
        >
          <Heart className="h-6 w-6 text-white fill-white" />
        </motion.div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Your Impact
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Donations to {charityName}
          </p>
        </div>
        <Link
          href="/dashboard/settings/charity"
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          title="Charity settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>

      {/* Main Stat */}
      <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl p-4 mb-4">
        {loadingStats && !stats ? (
          <div className="animate-pulse">
            <div className="h-4 w-20 bg-rose-100 dark:bg-rose-900 rounded mb-2" />
            <div className="h-8 w-24 bg-rose-200 dark:bg-rose-800 rounded" />
          </div>
        ) : (
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Raised</p>
              <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">
                {formatDollars(animatedTotal)}
              </p>
            </div>
            {stats && stats.totalDonations > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-medium"
              >
                <TrendingUp className="h-4 w-4" />
                {getEncouragingMessage(stats.totalAmountCents, optInRate)}
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/40 dark:bg-slate-800/40 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 mb-1">
            <Users className="h-4 w-4" />
          </div>
          {loadingStats && !stats ? (
            <div className="animate-pulse">
              <div className="h-6 w-8 bg-slate-200 dark:bg-slate-700 rounded mx-auto mb-1" />
              <div className="h-3 w-12 bg-slate-100 dark:bg-slate-800 rounded mx-auto" />
            </div>
          ) : (
            <>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {animatedDonations}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">donations</p>
            </>
          )}
        </div>

        <div className="bg-white/40 dark:bg-slate-800/40 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-purple-600 dark:text-purple-400 mb-1">
            <Heart className="h-4 w-4" />
          </div>
          {loadingStats && !stats ? (
            <div className="animate-pulse">
              <div className="h-6 w-10 bg-slate-200 dark:bg-slate-700 rounded mx-auto mb-1" />
              <div className="h-3 w-14 bg-slate-100 dark:bg-slate-800 rounded mx-auto" />
            </div>
          ) : (
            <>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {optInRate.toFixed(0)}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">opt-in rate</p>
            </>
          )}
        </div>
      </div>

      {/* Milestone celebration (shown at key thresholds) */}
      {stats && stats.totalAmountCents >= 10000 && stats.totalAmountCents < 10100 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 p-3 rounded-lg bg-gradient-to-r from-amber-100 to-rose-100 dark:from-amber-900/30 dark:to-rose-900/30 text-center"
        >
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            You just crossed $100 in donations!
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
