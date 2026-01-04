"use client";

import { useState, useEffect, useMemo } from "react";
import { useReducedMotion } from "framer-motion";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export type Season = "spring" | "summer" | "fall" | "winter";

export interface TemporalContext {
  timeOfDay: TimeOfDay;
  season: Season;
  hour: number;
  isReducedMotion: boolean;
}

// SSR-safe defaults to prevent hydration mismatch
const SSR_DEFAULTS = {
  hour: 12,
  month: 6, // July - summer
};

/**
 * Hook for detecting time of day, season, and motion preferences.
 * Used for time-aware greetings, seasonal effects, and accessibility.
 *
 * IMPORTANT: Uses SSR-safe defaults to prevent hydration mismatch.
 * Real values are set after mount.
 */
export function useTemporalContext(): TemporalContext {
  // Track if component has mounted to prevent hydration mismatch
  const [hasMounted, setHasMounted] = useState(false);
  const [hour, setHour] = useState<number>(SSR_DEFAULTS.hour);
  const [month, setMonth] = useState<number>(SSR_DEFAULTS.month);

  const prefersReducedMotionValue = useReducedMotion();
  // Use consistent value before mount to prevent hydration mismatch
  const prefersReducedMotion = hasMounted ? prefersReducedMotionValue : false;

  useEffect(() => {
    // Set real values only after mount
    setHasMounted(true);
    setHour(new Date().getHours());
    setMonth(new Date().getMonth());

    // Update hour every minute
    const interval = setInterval(() => {
      setHour(new Date().getHours());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const timeOfDay = useMemo((): TimeOfDay => {
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
  }, [hour]);

  const season = useMemo((): Season => {
    // Spring: March (2) - May (4)
    if (month >= 2 && month <= 4) return "spring";
    // Summer: June (5) - August (7)
    if (month >= 5 && month <= 7) return "summer";
    // Fall: September (8) - November (10)
    if (month >= 8 && month <= 10) return "fall";
    // Winter: December (11) - February (1)
    return "winter";
  }, [month]);

  return {
    timeOfDay,
    season,
    hour,
    isReducedMotion: prefersReducedMotion ?? false,
  };
}
