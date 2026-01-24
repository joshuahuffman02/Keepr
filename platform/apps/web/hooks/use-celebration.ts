"use client";

import { useCallback } from "react";
import { useReducedMotion } from "framer-motion";
import { launchCelebration, type CelebrationType } from "../lib/celebrations/celebration-types";

interface UseCelebrationReturn {
  /** Launch a celebration animation */
  celebrate: (type: CelebrationType) => void;
  /** Launch confetti (booking confirmed) */
  celebrateBooking: () => void;
  /** Launch stars (first review) */
  celebrateReview: () => void;
  /** Launch fireworks (loyalty milestone) */
  celebrateMilestone: () => void;
  /** Launch hearts (charity donation) */
  celebrateDonation: () => void;
  /** Launch sparkles (general success) */
  celebrateSuccess: () => void;
  /** Whether animations are disabled */
  isReducedMotion: boolean | null;
}

/**
 * Hook for triggering celebration animations.
 * Respects user's reduced motion preference.
 */
export function useCelebration(): UseCelebrationReturn {
  const prefersReducedMotion = useReducedMotion();

  const celebrate = useCallback(
    (type: CelebrationType) => {
      if (prefersReducedMotion) return;
      launchCelebration(type);
    },
    [prefersReducedMotion],
  );

  const celebrateBooking = useCallback(() => {
    celebrate("confetti");
  }, [celebrate]);

  const celebrateReview = useCallback(() => {
    celebrate("stars");
  }, [celebrate]);

  const celebrateMilestone = useCallback(() => {
    celebrate("fireworks");
  }, [celebrate]);

  const celebrateDonation = useCallback(() => {
    celebrate("hearts");
  }, [celebrate]);

  const celebrateSuccess = useCallback(() => {
    celebrate("sparkles");
  }, [celebrate]);

  return {
    celebrate,
    celebrateBooking,
    celebrateReview,
    celebrateMilestone,
    celebrateDonation,
    celebrateSuccess,
    isReducedMotion: prefersReducedMotion,
  };
}
