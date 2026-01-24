"use client";

import { useState, useCallback, useEffect } from "react";
import {
  getTour,
  isTourCompleted,
  markTourCompleted,
  type FeatureTour,
  type TourStep,
} from "@/lib/tours/feature-tours";

interface UseFeatureTourReturn {
  // State
  isActive: boolean;
  currentStep: TourStep | null;
  currentStepIndex: number;
  totalSteps: number;
  tour: FeatureTour | null;

  // Actions
  startTour: (tourId: string, force?: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  endTour: () => void;
  goToStep: (index: number) => void;
}

export function useFeatureTour(): UseFeatureTourReturn {
  const [tour, setTour] = useState<FeatureTour | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const currentStep = tour?.steps[currentStepIndex] ?? null;
  const totalSteps = tour?.steps.length ?? 0;

  /**
   * Start a tour by ID
   * @param tourId The tour to start
   * @param force If true, start even if previously completed
   */
  const startTour = useCallback((tourId: string, force = false) => {
    const tourData = getTour(tourId);
    if (!tourData) {
      console.warn(`Tour "${tourId}" not found`);
      return;
    }

    // Check if already completed (unless forced)
    if (!force && isTourCompleted(tourId)) {
      return;
    }

    setTour(tourData);
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  /**
   * Move to next step
   */
  const nextStep = useCallback(() => {
    if (!tour) return;

    if (currentStepIndex < tour.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Tour complete
      markTourCompleted(tour.id);
      setIsActive(false);
      setTour(null);
      setCurrentStepIndex(0);
    }
  }, [tour, currentStepIndex]);

  /**
   * Move to previous step
   */
  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  /**
   * Skip the tour without marking complete
   */
  const skipTour = useCallback(() => {
    if (tour) {
      // Mark as completed so it doesn't show again
      markTourCompleted(tour.id);
    }
    setIsActive(false);
    setTour(null);
    setCurrentStepIndex(0);
  }, [tour]);

  /**
   * End tour and mark as complete
   */
  const endTour = useCallback(() => {
    if (tour) {
      markTourCompleted(tour.id);
    }
    setIsActive(false);
    setTour(null);
    setCurrentStepIndex(0);
  }, [tour]);

  /**
   * Jump to specific step
   */
  const goToStep = useCallback(
    (index: number) => {
      if (!tour) return;
      if (index >= 0 && index < tour.steps.length) {
        setCurrentStepIndex(index);
      }
    },
    [tour],
  );

  // Scroll target element into view when step changes
  useEffect(() => {
    if (!isActive || !currentStep?.target) return;

    const element = document.querySelector(currentStep.target);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isActive, currentStep]);

  return {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    tour,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    endTour,
    goToStep,
  };
}

/**
 * Hook to check and auto-start first login tours
 */
export function useFirstLoginTour(): void {
  const { startTour } = useFeatureTour();

  useEffect(() => {
    // Check if this is first login (no tours completed)
    const hasCompletedAnyTour = localStorage.getItem("campreserv:tour:dashboard-welcome");

    if (!hasCompletedAnyTour) {
      // Delay to let the page render first
      const timer = setTimeout(() => {
        startTour("dashboard-welcome");
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [startTour]);
}
