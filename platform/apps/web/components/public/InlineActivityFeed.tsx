"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { apiClient } from "@/lib/api-client";

interface ActivityMessage {
  highlight: string;
  rest: string;
  priority: number; // Lower = higher priority
}

interface InlineActivityFeedProps {
  className?: string;
}

export function InlineActivityFeed({ className }: InlineActivityFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Fetch real platform stats
  const { data: stats } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: () => apiClient.getPlatformStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Build dynamic messages based on real data
  const messages = useMemo<ActivityMessage[]>(() => {
    const result: ActivityMessage[] = [];

    if (stats) {
      // Campground count (always show this one)
      if (stats.campgrounds.total > 0) {
        result.push({
          highlight: `${stats.campgrounds.total.toLocaleString()} campgrounds`,
          rest: "ready to explore",
          priority: 1,
        });
      }

      // Recent activity - "Someone just viewed X campground"
      const recentView = stats.recentActivity.find(
        (a) => a.type === "page_view" && a.campgroundName
      );
      if (recentView && recentView.campgroundName) {
        const timeText =
          recentView.minutesAgo === 0
            ? "just now"
            : recentView.minutesAgo === 1
            ? "1 minute ago"
            : `${recentView.minutesAgo} minutes ago`;
        result.push({
          highlight: `Someone viewed ${recentView.campgroundName}`,
          rest: timeText,
          priority: 2,
        });
      }

      // Recent search activity
      const recentSearch = stats.recentActivity.find(
        (a) => a.type === "search" && a.state
      );
      if (recentSearch && recentSearch.state) {
        result.push({
          highlight: `Camper searching for sites`,
          rest: `in ${recentSearch.state}`,
          priority: 3,
        });
      }

      // Today's activity
      if (stats.activity.pageViewsToday > 10) {
        result.push({
          highlight: `${stats.activity.pageViewsToday.toLocaleString()} explorers today`,
          rest: "finding their next adventure",
          priority: 4,
        });
      }

      // Unique visitors
      if (stats.activity.uniqueVisitorsToday > 5) {
        result.push({
          highlight: `${stats.activity.uniqueVisitorsToday.toLocaleString()} adventurers`,
          rest: "browsing campgrounds right now",
          priority: 5,
        });
      }

      // Weekly activity
      if (stats.activity.searchesThisWeek > 50) {
        result.push({
          highlight: `${stats.activity.searchesThisWeek.toLocaleString()} searches this week`,
          rest: "for the perfect campsite",
          priority: 6,
        });
      }

      // Top region
      if (stats.topRegions.length > 0 && stats.topRegions[0].activityCount > 10) {
        result.push({
          highlight: `${stats.topRegions[0].state} is trending`,
          rest: "this week",
          priority: 7,
        });
      }

      // States coverage
      if (stats.campgrounds.byState.length > 40) {
        result.push({
          highlight: `Campgrounds in ${stats.campgrounds.byState.length} states`,
          rest: "from coast to coast",
          priority: 8,
        });
      }
    }

    // Fallback messages if no real data available
    if (result.length === 0) {
      result.push(
        { highlight: "Campgrounds nationwide", rest: "waiting to be discovered", priority: 99 },
        { highlight: "Plan your next adventure", rest: "with real-time availability", priority: 100 }
      );
    }

    // Sort by priority and return
    return result.sort((a, b) => a.priority - b.priority);
  }, [stats]);

  useEffect(() => {
    // Show after a short delay
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 2000);

    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!isVisible || messages.length === 0) return;

    // Rotate through messages
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isVisible, messages.length]);

  if (prefersReducedMotion || !isVisible) {
    return null;
  }

  const message = messages[currentIndex] || messages[0];
  if (!message) return null;

  return (
    <motion.div
      className={`w-full py-4 bg-gradient-to-r from-slate-50 via-white to-slate-50 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-center gap-3">
          {/* Pulsing dot */}
          <motion.div
            className="w-2 h-2 rounded-full bg-emerald-500"
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* Message text */}
          <AnimatePresence mode="wait">
            <motion.p
              key={`${currentIndex}-${message.highlight}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-sm text-slate-600"
            >
              <span className="font-semibold text-slate-800">{message.highlight}</span>
              {" "}{message.rest}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
