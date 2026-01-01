"use client";

import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Heart, Sparkles, TreePine, HandHeart, Users } from "lucide-react";
import Image from "next/image";
import { apiClient } from "@/lib/api-client";

// Animated counter hook with "growing" feel
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

      // Ease out cubic for satisfying "growth" deceleration
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

// Calculate equivalent trees (one tree = ~$5 donation)
function calculateTrees(cents: number): number {
  return Math.floor(cents / 500);
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

  // Parallax effect for background
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });
  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

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

  const animatedTrees = useAnimatedCounter(
    calculateTrees(displayStats.totalAmountCents),
    2000,
    isInView && !isLoading
  );

  const animatedDonors = useAnimatedCounter(
    displayStats.donorCount,
    1800,
    isInView && !isLoading
  );

  if (variant === "compact") {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        className="bg-gradient-to-r from-rose-50 to-amber-50 rounded-2xl p-6 border border-rose-100"
      >
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            className="relative w-10 h-10"
            animate={!prefersReducedMotion ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Heart className="w-10 h-10 text-rose-500 fill-rose-500" />
          </motion.div>
          <div>
            <h3 className="font-semibold text-slate-900">Community Giving</h3>
            <p className="text-sm text-slate-600">Together we make a difference</p>
          </div>
        </div>
        <div className="text-center">
          <div className="text-4xl font-bold text-rose-600">
            {isLoading ? "..." : formatDollars(animatedTotal)}
          </div>
          <p className="text-sm text-slate-600 mt-1">raised for charity</p>
        </div>
      </motion.div>
    );
  }

  return (
    <section ref={ref} className="relative py-20 overflow-hidden">
      {/* Parallax background with forest silhouette */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-b from-emerald-900 via-emerald-800 to-teal-900"
        style={{ y: prefersReducedMotion ? 0 : backgroundY }}
      >
        {/* Forest silhouette */}
        <svg
          className="absolute bottom-0 left-0 right-0 text-emerald-950/50"
          viewBox="0 0 1440 200"
          preserveAspectRatio="none"
        >
          <path
            fill="currentColor"
            d="M0,150 L60,120 L120,150 L180,100 L240,140 L300,80 L360,130 L420,90 L480,150 L540,70 L600,120 L660,150 L720,100 L780,140 L840,60 L900,130 L960,90 L1020,150 L1080,80 L1140,120 L1200,150 L1260,100 L1320,140 L1380,90 L1440,150 L1440,200 L0,200 Z"
          />
        </svg>
        {/* Stars/sparkles background */}
        <div className="absolute inset-0 opacity-20">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 60}%`,
              }}
              animate={!prefersReducedMotion ? {
                opacity: [0.3, 1, 0.3],
                scale: [1, 1.5, 1],
              } : {}}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </motion.div>

      <div className="relative max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          {/* Emotional Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="mb-12"
          >
            {/* Pulsing heart icon */}
            <motion.div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/20 mb-6"
              animate={!prefersReducedMotion ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Heart className="w-8 h-8 text-rose-400 fill-rose-400" />
            </motion.div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              Together, We're Making Magic
              <span className="block text-2xl md:text-3xl lg:text-4xl mt-2 bg-gradient-to-r from-amber-300 to-rose-300 bg-clip-text text-transparent">
                Beyond the Campfire
              </span>
            </h2>
            <p className="text-lg md:text-xl text-emerald-100/80 max-w-2xl mx-auto">
              Every booking at Camp Everyday helps protect the wild places we love.
              Your adventures are planting seeds of change.
            </p>
          </motion.div>

          {/* Impact Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.4 }}
            className="grid md:grid-cols-3 gap-6 mb-12"
          >
            {/* Trees Planted */}
            <motion.div
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20"
              whileHover={!prefersReducedMotion ? { scale: 1.02, y: -5 } : {}}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <motion.div
                className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center"
                animate={isInView && !prefersReducedMotion ? { rotate: [0, 5, -5, 0] } : {}}
                transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
              >
                <TreePine className="w-8 h-8 text-emerald-400" />
              </motion.div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                {isLoading ? "..." : animatedTrees.toLocaleString()}
              </div>
              <div className="text-emerald-200 font-medium mb-1">Trees Planted</div>
              <p className="text-sm text-emerald-100/60">
                Every booking helps a forest grow
              </p>
            </motion.div>

            {/* Total Donated */}
            <motion.div
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20"
              whileHover={!prefersReducedMotion ? { scale: 1.02, y: -5 } : {}}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <motion.div
                className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center"
                animate={isInView && !prefersReducedMotion ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <HandHeart className="w-8 h-8 text-amber-400" />
              </motion.div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                {isLoading ? "..." : formatDollars(animatedTotal)}
              </div>
              <div className="text-amber-200 font-medium mb-1">Donated to Conservation</div>
              <p className="text-sm text-amber-100/60">
                Your adventures fund wild places
              </p>
            </motion.div>

            {/* Adventurers Giving Back */}
            <motion.div
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20"
              whileHover={!prefersReducedMotion ? { scale: 1.02, y: -5 } : {}}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <motion.div
                className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/20 flex items-center justify-center"
                animate={isInView && !prefersReducedMotion ? { y: [0, -3, 0] } : {}}
                transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}
              >
                <Users className="w-8 h-8 text-rose-400" />
              </motion.div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                {isLoading ? "..." : animatedDonors.toLocaleString()}
              </div>
              <div className="text-rose-200 font-medium mb-1">Generous Adventurers</div>
              <p className="text-sm text-rose-100/60">
                A community that cares
              </p>
            </motion.div>
          </motion.div>

          {/* Emotional Story Block */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.6 }}
            className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 md:p-12 border border-white/10 mb-12"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span className="text-amber-300 font-medium">The Magic of Giving</span>
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <blockquote className="text-xl md:text-2xl text-white/90 italic max-w-3xl mx-auto leading-relaxed">
              "When you round up your reservation for charity, you're not just adding a few cents.
              You're joining thousands of fellow adventurers in protecting the trails,
              forests, and wild spaces that make camping magical."
            </blockquote>
            <p className="text-emerald-200/80 mt-4">
              - The Camp Everyday Team
            </p>
          </motion.div>

          {/* CTA */}
          {showCTA && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.8 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <a
                href="/about/charity"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-emerald-800 font-semibold hover:bg-emerald-50 transition-colors shadow-lg"
              >
                <Heart className="w-5 h-5 text-rose-500" />
                See Where Your Impact Goes
              </a>
              <a
                href="/campgrounds"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-white/30 text-white font-semibold hover:bg-white/10 transition-colors"
              >
                <Sparkles className="w-5 h-5" />
                Book Your Next Adventure
              </a>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
