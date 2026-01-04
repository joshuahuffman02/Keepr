"use client";

import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView } from "framer-motion";
import { TrendingUp } from "lucide-react";
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

// Fun impact equivalents
function getImpactMessage(totalCents: number): string {
  const dollars = totalCents / 100;
  if (dollars >= 10000) return `That's enough to help ${Math.floor(dollars / 50)} families!`;
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
  const prefersReducedMotion = useReducedMotionSafe();

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
        className="bg-gradient-to-r from-rose-50 to-amber-50 rounded-2xl p-6 border border-rose-100"
      >
        <motion.div variants={itemVariants} className="flex items-center gap-3 mb-4">
          <div className="relative w-10 h-10">
            <Image src="/images/icons/giving-heart.png" alt="Heart" fill className="object-contain" sizes="40px" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Community Giving</h3>
            <p className="text-sm text-muted-foreground">Together we make a difference</p>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="text-center">
          <div className="text-4xl font-bold text-rose-600">
            {isLoading ? (
              <span className="inline-block w-24 h-10 bg-rose-200 rounded animate-pulse" />
            ) : (
              formatDollars(animatedTotal)
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            raised for charity
          </p>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <section ref={ref} className="py-16 bg-gradient-to-b from-rose-50/50 via-white to-amber-50/30">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={containerVariants}
          className="text-center"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-100 text-rose-700 text-sm font-medium mb-4">
              <Image src="/images/icons/giving-heart.png" alt="Heart" width={20} height={20} className="object-contain" />
              <span>Community Impact</span>
              <Image src="/images/icons/community-circle.png" alt="Community" width={20} height={20} className="object-contain" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Camping with Heart
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              When you book through Keepr, you're part of a community that gives back.
              Campgrounds across the country are making a difference, one reservation at a time.
            </p>
          </motion.div>

          {/* Main Stats */}
          <motion.div variants={itemVariants} className="mb-12">
            <div className="inline-block p-8 rounded-3xl bg-card shadow-xl shadow-rose-500/10">
              <div className="flex items-center justify-center gap-3 mb-3">
                <motion.div
                  animate={isInView && !prefersReducedMotion ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.5, delay: 1.5 }}
                  className="relative w-12 h-12"
                >
                  <Image src="/images/icons/giving-heart.png" alt="Heart" fill className="object-contain" sizes="48px" />
                </motion.div>
                <span className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-rose-600 to-amber-600 bg-clip-text text-transparent">
                  {isLoading ? (
                    <span className="inline-block w-32 h-14 bg-muted rounded animate-pulse" />
                  ) : (
                    formatDollars(animatedTotal)
                  )}
                </span>
              </div>
              <p className="text-muted-foreground font-medium">
                donated to charity
              </p>
              {!isLoading && (
                <motion.p
                  variants={itemVariants}
                  className="text-sm text-amber-600 mt-2 flex items-center justify-center gap-1"
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
            <div className="p-6 rounded-2xl bg-card/80 backdrop-blur">
              <div className="flex items-center justify-center mb-2">
                <Image src="/images/icons/donation-box.png" alt="Donations" width={32} height={32} className="object-contain" />
              </div>
              <div className="text-3xl font-bold text-foreground">
                {isLoading ? "..." : animatedDonations.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">donations made</p>
            </div>

            <div className="p-6 rounded-2xl bg-card/80 backdrop-blur">
              <div className="flex items-center justify-center mb-2">
                <Image src="/images/icons/community-circle.png" alt="Guests" width={32} height={32} className="object-contain" />
              </div>
              <div className="text-3xl font-bold text-foreground">
                {isLoading ? "..." : animatedCampgrounds.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">generous guests</p>
            </div>

            <div className="col-span-2 md:col-span-1 p-6 rounded-2xl bg-card/80 backdrop-blur">
              <div className="flex items-center justify-center mb-2">
                <Image src="/images/icons/giving-heart.png" alt="Charities" width={32} height={32} className="object-contain" />
              </div>
              <div className="text-3xl font-bold text-foreground">
                {isLoading ? "..." : topCharities.length}
              </div>
              <p className="text-sm text-muted-foreground">charities supported</p>
            </div>
          </motion.div>

          {/* Top Charities */}
          {topCharities.length > 0 && (
            <motion.div variants={itemVariants} className="mb-12">
              <h3 className="text-lg font-semibold text-foreground mb-6">
                Top Supported Charities
              </h3>
              <div className="flex flex-wrap justify-center gap-4">
                {topCharities.map((item, index) => (
                  <motion.div
                    key={item.charity?.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="flex items-center gap-3 px-5 py-3 rounded-full bg-card shadow-md"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-amber-400 flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-foreground text-sm">
                        {item.charity?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
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
              <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
                <div className="text-left">
                  <p className="font-semibold text-foreground">
                    Own a campground?
                  </p>
                  <p className="text-sm text-muted-foreground">
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
