"use client";

import { useState, useCallback, useEffect } from "react";
import { AchievementType, ACHIEVEMENTS } from "@/components/ui/achievement-celebration";

interface AchievementData {
  type: AchievementType;
  title: string;
  subtitle?: string;
  badge?: string;
}

interface UseAchievementOptions {
  /** Duration in ms before auto-dismiss (default: 3000) */
  duration?: number;
  /** Storage key prefix for tracking unlocked achievements */
  storageKey?: string;
  /** Whether to persist unlocked achievements */
  persist?: boolean;
}

interface UseAchievementReturn {
  /** Whether celebration is showing */
  isShowing: boolean;
  /** Current achievement data */
  currentAchievement: AchievementData | null;
  /** Show a celebration */
  celebrate: (achievement: AchievementData) => void;
  /** Dismiss the celebration */
  dismiss: () => void;
  /** Check if achievement was already unlocked */
  isUnlocked: (achievementId: string) => boolean;
  /** Unlock and celebrate if not already unlocked */
  unlockOnce: (achievementId: string, achievement: AchievementData) => boolean;
  /** Get all unlocked achievement IDs */
  getUnlocked: () => string[];
  /** Reset all unlocked achievements (for testing) */
  resetAll: () => void;
}

const STORAGE_KEY_DEFAULT = "campreserv:achievements";

/**
 * Hook for managing achievement celebrations.
 * Tracks unlocked achievements in localStorage to prevent duplicate celebrations.
 *
 * @example
 * const { celebrate, unlockOnce } = useAchievement();
 *
 * // Show celebration immediately
 * celebrate(ACHIEVEMENTS.FIRST_BOOKING);
 *
 * // Only show if not already unlocked
 * unlockOnce("first-booking", ACHIEVEMENTS.FIRST_BOOKING);
 */
export function useAchievement(options: UseAchievementOptions = {}): UseAchievementReturn {
  const {
    duration = 3000,
    storageKey = STORAGE_KEY_DEFAULT,
    persist = true,
  } = options;

  const [isShowing, setIsShowing] = useState(false);
  const [currentAchievement, setCurrentAchievement] = useState<AchievementData | null>(null);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());

  // Load unlocked achievements from storage
  useEffect(() => {
    if (typeof window === "undefined" || !persist) return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setUnlockedIds(new Set(parsed));
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }, [storageKey, persist]);

  // Save unlocked achievements to storage
  const saveUnlocked = useCallback((ids: Set<string>) => {
    if (typeof window === "undefined" || !persist) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(ids)));
    } catch {
      // Ignore storage errors
    }
  }, [storageKey, persist]);

  const celebrate = useCallback((achievement: AchievementData) => {
    setCurrentAchievement(achievement);
    setIsShowing(true);
  }, []);

  const dismiss = useCallback(() => {
    setIsShowing(false);
    // Small delay before clearing data for exit animation
    setTimeout(() => setCurrentAchievement(null), 200);
  }, []);

  const isUnlocked = useCallback((achievementId: string) => {
    return unlockedIds.has(achievementId);
  }, [unlockedIds]);

  const unlockOnce = useCallback((achievementId: string, achievement: AchievementData): boolean => {
    if (unlockedIds.has(achievementId)) {
      return false; // Already unlocked
    }

    // Mark as unlocked
    const newUnlocked = new Set(unlockedIds);
    newUnlocked.add(achievementId);
    setUnlockedIds(newUnlocked);
    saveUnlocked(newUnlocked);

    // Show celebration
    celebrate(achievement);
    return true;
  }, [unlockedIds, celebrate, saveUnlocked]);

  const getUnlocked = useCallback(() => {
    return Array.from(unlockedIds);
  }, [unlockedIds]);

  const resetAll = useCallback(() => {
    setUnlockedIds(new Set());
    if (typeof window !== "undefined" && persist) {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, persist]);

  return {
    isShowing,
    currentAchievement,
    celebrate,
    dismiss,
    isUnlocked,
    unlockOnce,
    getUnlocked,
    resetAll,
  };
}

// Milestone checker helpers
export function getBookingMilestone(count: number): AchievementData | null {
  if (count === 1) return ACHIEVEMENTS.FIRST_BOOKING;
  if (count === 10) return ACHIEVEMENTS.TEN_BOOKINGS;
  if (count === 50) return ACHIEVEMENTS.FIFTY_BOOKINGS;
  if (count === 100) return ACHIEVEMENTS.HUNDRED_BOOKINGS;
  if (count === 500) return ACHIEVEMENTS.FIVE_HUNDRED_BOOKINGS;
  return null;
}

export function getRevenueMilestone(amountCents: number): AchievementData | null {
  const amount = amountCents / 100;
  if (amount >= 1000 && amount < 1100) {
    return {
      type: "revenue_goal",
      title: "$1,000 Revenue!",
      subtitle: "You've hit your first thousand",
      badge: "Revenue",
    };
  }
  if (amount >= 10000 && amount < 10100) {
    return {
      type: "revenue_goal",
      title: "$10,000 Revenue!",
      subtitle: "Five figures achieved",
      badge: "Revenue Milestone",
    };
  }
  if (amount >= 100000 && amount < 100100) {
    return {
      type: "revenue_goal",
      title: "$100,000 Revenue!",
      subtitle: "You're in the big leagues now",
      badge: "Major Revenue",
    };
  }
  return null;
}
