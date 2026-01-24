"use client";

import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView } from "framer-motion";
import { Heart, Star, TrendingUp, Users, Sparkles } from "lucide-react";
import Image from "next/image";
import { apiClient } from "@/lib/api-client";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

// Animated counter hook
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

// Demo data shown when no real donations exist yet
const DEMO_STATS = {
  totalAmountCents: 1247500, // $12,475
  totalDonations: 892,
  donorCount: 634,
  topCharities: [
    {
      charity: { id: "demo-1", name: "Sybil's Kids", logoUrl: null },
      amountCents: 523400,
      count: 312,
    },
    {
      charity: { id: "demo-2", name: "Local Veterans Foundation", logoUrl: null },
      amountCents: 412300,
      count: 287,
    },
    {
      charity: { id: "demo-3", name: "Campground Conservation Fund", logoUrl: null },
      amountCents: 311800,
      count: 293,
    },
  ],
};

interface CharityImpactSectionProps {
  variant?: "full" | "compact";
  showCTA?: boolean;
}

export function CharityImpactSection({
  variant = "full",
  showCTA = true,
}: CharityImpactSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const prefersReducedMotion = useReducedMotionSafe();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["platform-charity-stats"],
    queryFn: () => apiClient.getPlatformCharityStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry if API fails - just show demo data
  });

  // Use demo data if no real stats or no donations
  const useDemo = !stats || stats.totalDonations === 0;
  const displayStats = useDemo
    ? {
        totalAmountCents: DEMO_STATS.totalAmountCents,
        totalDonations: DEMO_STATS.totalDonations,
        donorCount: DEMO_STATS.donorCount,
      }
    : stats;

  const animatedTotal = useAnimatedCounter(
    displayStats.totalAmountCents,
    2500,
    isInView && !isLoading,
  );

  const animatedDonations = useAnimatedCounter(
    displayStats.totalDonations,
    2000,
    isInView && !isLoading,
  );

  const animatedGuests = useAnimatedCounter(displayStats.donorCount, 1800, isInView && !isLoading);

  // Get charities - Sybil's Kids is always first (featured)
  const allCharities = useDemo
    ? DEMO_STATS.topCharities
    : (stats?.byCharity ?? [])
        .filter((c) => c.charity)
        .sort((a, b) => b.amountCents - a.amountCents)
        .slice(0, 3);

  // Sybil's Kids is the featured charity
  const sybilsKids =
    allCharities.find((c) => c.charity?.name === "Sybil's Kids") || allCharities[0];
  const otherCharities = allCharities
    .filter((c) => c.charity?.id !== sybilsKids?.charity?.id)
    .slice(0, 2);

  const fadeUp = prefersReducedMotion
    ? { initial: {}, animate: {}, transition: {} }
    : {
        initial: { opacity: 0, y: 30 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6 },
      };

  const fadeIn = prefersReducedMotion
    ? { initial: {}, animate: {}, transition: {} }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.8 },
      };

  // Compact variant for sidebars or smaller spaces
  if (variant === "compact") {
    return (
      <motion.div
        ref={ref}
        initial="initial"
        animate={isInView ? "animate" : "initial"}
        className="bg-gradient-to-br from-amber-50 via-orange-50/50 to-rose-50/30 rounded-2xl p-6 border border-amber-100"
      >
        <motion.div {...fadeUp} className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Camping with Heart</h3>
            <p className="text-sm text-slate-600">Together we give back</p>
          </div>
        </motion.div>

        <motion.div {...fadeUp} className="text-center">
          <div className="text-4xl font-bold text-rose-600">
            {isLoading ? (
              <span className="inline-block w-24 h-10 bg-rose-200 rounded animate-pulse" />
            ) : (
              formatDollars(animatedTotal)
            )}
          </div>
          <p className="text-sm text-slate-600 mt-1">raised for charity</p>
        </motion.div>
      </motion.div>
    );
  }

  // Full variant - Split hero layout
  return (
    <section
      ref={ref}
      id="charity"
      className="py-20 bg-gradient-to-br from-amber-50 via-orange-50/30 to-rose-50/20 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Side - Emotive Image */}
          <motion.div {...fadeIn} transition={{ duration: 0.8, delay: 0.2 }} className="relative">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl shadow-amber-900/10">
              <Image
                src="https://images.unsplash.com/photo-1475483768296-6163e08872a1?w=1200&h=900&fit=crop"
                alt="Family enjoying camping together"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              {/* Warm overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-amber-900/30 via-transparent to-transparent" />

              {/* Floating hearts decoration */}
              <motion.div
                animate={
                  isInView && !prefersReducedMotion
                    ? {
                        y: [0, -10, 0],
                        opacity: [0.6, 1, 0.6],
                      }
                    : {}
                }
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute top-6 right-6 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
              >
                <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
              </motion.div>
            </div>

            {/* Stats overlay card */}
            <motion.div
              {...fadeUp}
              transition={{ delay: 0.4 }}
              className="absolute -bottom-6 -right-4 lg:-right-8 bg-white rounded-2xl shadow-xl p-5 border border-amber-100"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {isLoading ? "..." : animatedGuests.toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-600">generous guests</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Side - Content */}
          <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="space-y-8">
            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-100 text-rose-700 rounded-full text-sm font-medium mb-4">
                <Heart className="w-4 h-4 fill-rose-500" />
                <span>Camping with Heart</span>
              </div>

              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight mb-4">
                Every booking plants a{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-amber-500">
                  seed of kindness
                </span>
              </h2>

              <p className="text-lg text-slate-600 leading-relaxed">
                When you book through Keepr, you're part of something bigger. Together, our
                community is making a real difference in the lives of those who need it most.
              </p>
            </div>

            {/* Main Stat */}
            <motion.div {...fadeUp} transition={{ delay: 0.5 }} className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-amber-500">
                  {isLoading ? (
                    <span className="inline-block w-32 h-14 bg-rose-200 rounded animate-pulse" />
                  ) : (
                    formatDollars(animatedTotal)
                  )}
                </span>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <p className="text-slate-900 font-semibold">raised for charity</p>
                <p className="text-sm text-amber-600 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  {animatedDonations.toLocaleString()} donations
                </p>
              </div>
            </motion.div>

            {/* Sybil's Kids - Featured Charity Card */}
            {sybilsKids && (
              <motion.div {...fadeUp} transition={{ delay: 0.6 }} className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-rose-400 to-amber-400 rounded-2xl blur-lg opacity-20" />
                <div className="relative bg-white rounded-2xl border border-rose-100 p-6 shadow-lg">
                  <div className="flex items-start gap-4">
                    {/* Charity Icon/Logo */}
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-gradient-to-br from-rose-100 to-amber-100 rounded-xl flex items-center justify-center">
                        <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Featured Badge */}
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold mb-2">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        Our Featured Charity
                      </div>

                      <h3 className="text-xl font-bold text-slate-900 mb-1">
                        {sybilsKids.charity?.name || "Sybil's Kids"}
                      </h3>

                      <p className="text-slate-600 text-sm mb-3">
                        Helping children and families in need through outdoor experiences and
                        community support. This is the default charity for all Keepr campgrounds.
                      </p>

                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-semibold text-rose-600">
                          {formatDollars(sybilsKids.amountCents)} raised
                        </span>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-600">{sybilsKids.count} donations</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Other Charities */}
            {otherCharities.length > 0 && (
              <motion.div {...fadeUp} transition={{ delay: 0.7 }}>
                <p className="text-sm font-medium text-slate-500 mb-3">Also supporting</p>
                <div className="flex flex-wrap gap-3">
                  {otherCharities.map((item) => (
                    <div
                      key={item.charity?.id}
                      className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm"
                    >
                      <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center">
                        <Heart className="w-3 h-3 text-slate-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">
                        {item.charity?.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatDollars(item.amountCents)}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* CTA for Campground Owners */}
            {showCTA && (
              <motion.div {...fadeUp} transition={{ delay: 0.8 }}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 bg-gradient-to-r from-keepr-evergreen/10 to-teal-50 rounded-xl border border-keepr-evergreen/20">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 mb-1">Own a campground?</p>
                    <p className="text-sm text-slate-600">
                      Join the movement and let your guests give back too.
                    </p>
                  </div>
                  <a
                    href="/signup"
                    className="flex items-center gap-2 px-5 py-2.5 bg-keepr-evergreen hover:bg-keepr-evergreen/90 text-white font-medium rounded-lg transition-colors whitespace-nowrap shadow-lg shadow-keepr-evergreen/20"
                  >
                    <Sparkles className="w-4 h-4" />
                    Get Started Free
                  </a>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
