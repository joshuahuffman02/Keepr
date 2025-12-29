"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface TourStep {
  /** Unique identifier for this step */
  id: string;
  /** CSS selector for the target element */
  target: string;
  /** Title of the step */
  title: string;
  /** Description/content of the step */
  content: string;
  /** Where to position the tooltip relative to target */
  placement?: "top" | "bottom" | "left" | "right" | "auto";
  /** Optional action to run when step activates */
  onActivate?: () => void;
  /** Optional action to run when leaving step */
  onDeactivate?: () => void;
  /** Whether to highlight the target element */
  spotlight?: boolean;
  /** Skip this step if condition is false */
  condition?: () => boolean;
}

export interface Tour {
  /** Unique identifier for this tour */
  id: string;
  /** Human-readable name */
  name: string;
  /** Steps in the tour */
  steps: TourStep[];
  /** Run once or every time? */
  runOnce?: boolean;
}

interface UseTourOptions {
  /** The tour to run */
  tour: Tour;
  /** Storage key for tracking completed tours */
  storageKey?: string;
  /** Callback when tour completes */
  onComplete?: () => void;
  /** Callback when tour is skipped */
  onSkip?: () => void;
  /** Delay before showing first step (ms) */
  initialDelay?: number;
}

interface UseTourReturn {
  /** Whether the tour is currently active */
  isActive: boolean;
  /** Current step index */
  currentStepIndex: number;
  /** Current step data */
  currentStep: TourStep | null;
  /** Total number of steps */
  totalSteps: number;
  /** Progress percentage 0-100 */
  progress: number;
  /** Whether on the first step */
  isFirstStep: boolean;
  /** Whether on the last step */
  isLastStep: boolean;
  /** Start the tour */
  start: () => void;
  /** Go to next step */
  next: () => void;
  /** Go to previous step */
  prev: () => void;
  /** Go to a specific step */
  goTo: (index: number) => void;
  /** Skip/cancel the tour */
  skip: () => void;
  /** Complete the tour */
  complete: () => void;
  /** Whether this tour has been completed before */
  hasCompleted: boolean;
  /** Reset completion status */
  reset: () => void;
}

const DEFAULT_STORAGE_KEY = "campreserv:completed-tours";

/**
 * Hook for managing guided onboarding tours.
 * Tracks completion in localStorage and supports multi-step tours.
 *
 * @example
 * const tour = useTour({
 *   tour: DASHBOARD_TOUR,
 *   onComplete: () => console.log("Tour finished!"),
 * });
 *
 * // In your component
 * useEffect(() => {
 *   if (!tour.hasCompleted) {
 *     tour.start();
 *   }
 * }, []);
 */
export function useTour(options: UseTourOptions): UseTourReturn {
  const {
    tour,
    storageKey = DEFAULT_STORAGE_KEY,
    onComplete,
    onSkip,
    initialDelay = 500,
  } = options;

  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const prevStepRef = useRef<TourStep | null>(null);

  // Filter steps by conditions
  const activeSteps = tour.steps.filter((step) => !step.condition || step.condition());
  const totalSteps = activeSteps.length;
  const currentStep = activeSteps[currentStepIndex] || null;
  const progress = totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Load completion status
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const completed: string[] = JSON.parse(stored);
        setHasCompleted(completed.includes(tour.id));
      }
    } catch {
      // Ignore errors
    }
  }, [tour.id, storageKey]);

  // Handle step activation/deactivation
  useEffect(() => {
    if (!isActive) return;

    // Deactivate previous step
    if (prevStepRef.current?.onDeactivate) {
      prevStepRef.current.onDeactivate();
    }

    // Activate current step
    if (currentStep?.onActivate) {
      currentStep.onActivate();
    }

    prevStepRef.current = currentStep;
  }, [isActive, currentStep]);

  // Save completion status
  const markCompleted = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(storageKey);
      const completed: string[] = stored ? JSON.parse(stored) : [];
      if (!completed.includes(tour.id)) {
        completed.push(tour.id);
        localStorage.setItem(storageKey, JSON.stringify(completed));
      }
      setHasCompleted(true);
    } catch {
      // Ignore errors
    }
  }, [tour.id, storageKey]);

  const start = useCallback(() => {
    if (tour.runOnce && hasCompleted) return;

    setCurrentStepIndex(0);
    // Delay to allow DOM to settle
    setTimeout(() => {
      setIsActive(true);
    }, initialDelay);
  }, [tour.runOnce, hasCompleted, initialDelay]);

  const next = useCallback(() => {
    if (isLastStep) {
      // Complete the tour
      setIsActive(false);
      markCompleted();
      onComplete?.();
    } else {
      setCurrentStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
    }
  }, [isLastStep, totalSteps, markCompleted, onComplete]);

  const prev = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalSteps) {
        setCurrentStepIndex(index);
      }
    },
    [totalSteps]
  );

  const skip = useCallback(() => {
    setIsActive(false);
    setCurrentStepIndex(0);
    onSkip?.();
  }, [onSkip]);

  const complete = useCallback(() => {
    setIsActive(false);
    markCompleted();
    onComplete?.();
  }, [markCompleted, onComplete]);

  const reset = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const completed: string[] = JSON.parse(stored);
        const filtered = completed.filter((id) => id !== tour.id);
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      }
      setHasCompleted(false);
      setCurrentStepIndex(0);
    } catch {
      // Ignore errors
    }
  }, [tour.id, storageKey]);

  return {
    isActive,
    currentStepIndex,
    currentStep,
    totalSteps,
    progress,
    isFirstStep,
    isLastStep,
    start,
    next,
    prev,
    goTo,
    skip,
    complete,
    hasCompleted,
    reset,
  };
}

// Pre-defined tours

export const DASHBOARD_TOUR: Tour = {
  id: "dashboard-intro",
  name: "Dashboard Introduction",
  runOnce: true,
  steps: [
    {
      id: "welcome",
      target: "[data-tour='dashboard-header']",
      title: "Welcome to Your Dashboard",
      content: "This is your command center for managing your campground. Let's take a quick tour of the key features.",
      placement: "bottom",
      spotlight: true,
    },
    {
      id: "quick-stats",
      target: "[data-tour='quick-stats']",
      title: "Quick Stats",
      content: "See your key metrics at a glance: today's arrivals, departures, occupancy, and revenue.",
      placement: "bottom",
      spotlight: true,
    },
    {
      id: "calendar",
      target: "[data-tour='calendar-link']",
      title: "Reservation Calendar",
      content: "Click here to view and manage all your reservations on a visual calendar.",
      placement: "right",
      spotlight: true,
    },
    {
      id: "guests",
      target: "[data-tour='guests-link']",
      title: "Guest Management",
      content: "Access your guest database, view stay history, and manage loyalty profiles.",
      placement: "right",
      spotlight: true,
    },
    {
      id: "settings",
      target: "[data-tour='settings-link']",
      title: "Settings",
      content: "Configure your campground settings, pricing, policies, and integrations here.",
      placement: "right",
      spotlight: true,
    },
    {
      id: "help",
      target: "[data-tour='help-button']",
      title: "Need Help?",
      content: "Click here anytime to access documentation, tutorials, and support.",
      placement: "left",
      spotlight: true,
    },
  ],
};

export const POS_TOUR: Tour = {
  id: "pos-intro",
  name: "Point of Sale Introduction",
  runOnce: true,
  steps: [
    {
      id: "products",
      target: "[data-tour='product-grid']",
      title: "Product Grid",
      content: "Browse and select products to add to the current transaction.",
      placement: "right",
      spotlight: true,
    },
    {
      id: "cart",
      target: "[data-tour='cart']",
      title: "Shopping Cart",
      content: "Items you add will appear here. You can adjust quantities or remove items.",
      placement: "left",
      spotlight: true,
    },
    {
      id: "payment",
      target: "[data-tour='checkout-button']",
      title: "Checkout",
      content: "When ready, click here to process payment via card, cash, or guest folio.",
      placement: "top",
      spotlight: true,
    },
  ],
};

export const CALENDAR_TOUR: Tour = {
  id: "calendar-intro",
  name: "Calendar Introduction",
  runOnce: true,
  steps: [
    {
      id: "view-toggle",
      target: "[data-tour='view-toggle']",
      title: "Change View",
      content: "Switch between day, week, and month views to see your reservations differently.",
      placement: "bottom",
      spotlight: true,
    },
    {
      id: "new-reservation",
      target: "[data-tour='new-reservation']",
      title: "Create Reservation",
      content: "Click here or drag on the calendar to create a new reservation.",
      placement: "bottom",
      spotlight: true,
    },
    {
      id: "site-filter",
      target: "[data-tour='site-filter']",
      title: "Filter Sites",
      content: "Filter the calendar to show only specific site types or zones.",
      placement: "right",
      spotlight: true,
    },
  ],
};
