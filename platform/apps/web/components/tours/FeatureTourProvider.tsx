"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  getTour,
  isTourCompleted,
  markTourCompleted,
  getFirstLoginTours,
  type FeatureTour,
  type TourStep
} from "@/lib/tours/feature-tours";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  SkipForward
} from "lucide-react";

interface TourContextValue {
  isActive: boolean;
  currentStep: TourStep | null;
  currentStepIndex: number;
  totalSteps: number;
  tour: FeatureTour | null;
  startTour: (tourId: string, force?: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  endTour: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within FeatureTourProvider");
  }
  return context;
}

interface FeatureTourProviderProps {
  children: ReactNode;
  autoStartFirstLogin?: boolean;
}

export function FeatureTourProvider({
  children,
  autoStartFirstLogin = true
}: FeatureTourProviderProps) {
  const [tour, setTour] = useState<FeatureTour | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const currentStep = tour?.steps[currentStepIndex] ?? null;
  const totalSteps = tour?.steps.length ?? 0;

  const startTour = useCallback((tourId: string, force = false) => {
    const tourData = getTour(tourId);
    if (!tourData) {
      console.warn(`Tour "${tourId}" not found`);
      return;
    }

    if (!force && isTourCompleted(tourId)) {
      return;
    }

    setTour(tourData);
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    if (!tour) return;

    if (currentStepIndex < tour.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      markTourCompleted(tour.id);
      setIsActive(false);
      setTour(null);
      setCurrentStepIndex(0);
      setHighlightRect(null);
    }
  }, [tour, currentStepIndex]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const skipTour = useCallback(() => {
    if (tour) {
      markTourCompleted(tour.id);
    }
    setIsActive(false);
    setTour(null);
    setCurrentStepIndex(0);
    setHighlightRect(null);
  }, [tour]);

  const endTour = useCallback(() => {
    if (tour) {
      markTourCompleted(tour.id);
    }
    setIsActive(false);
    setTour(null);
    setCurrentStepIndex(0);
    setHighlightRect(null);
  }, [tour]);

  // Update highlight position when step changes
  useEffect(() => {
    if (!isActive || !currentStep?.target) {
      setHighlightRect(null);
      return;
    }

    const updateHighlight = () => {
      const element = document.querySelector(currentStep.target!);
      if (element) {
        const rect = element.getBoundingClientRect();
        setHighlightRect(rect);
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setHighlightRect(null);
      }
    };

    // Initial update
    updateHighlight();

    // Update on scroll/resize
    window.addEventListener("scroll", updateHighlight, true);
    window.addEventListener("resize", updateHighlight);

    return () => {
      window.removeEventListener("scroll", updateHighlight, true);
      window.removeEventListener("resize", updateHighlight);
    };
  }, [isActive, currentStep]);

  // Auto-start first login tour
  useEffect(() => {
    if (!autoStartFirstLogin) return;

    const hasCompletedWelcome = isTourCompleted("dashboard-welcome");
    if (!hasCompletedWelcome) {
      const timer = setTimeout(() => {
        startTour("dashboard-welcome");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoStartFirstLogin, startTour]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        skipTour();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        nextStep();
      } else if (e.key === "ArrowLeft") {
        prevStep();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, nextStep, prevStep, skipTour]);

  const value: TourContextValue = {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    tour,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    endTour
  };

  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (!currentStep) return { top: "50%", left: "50%" };

    if (currentStep.placement === "center" || !highlightRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)"
      };
    }

    const padding = 16;
    const tooltipWidth = 360;
    const tooltipHeight = 200;

    switch (currentStep.placement) {
      case "top":
        return {
          top: highlightRect.top - tooltipHeight - padding,
          left: highlightRect.left + highlightRect.width / 2 - tooltipWidth / 2
        };
      case "bottom":
        return {
          top: highlightRect.bottom + padding,
          left: highlightRect.left + highlightRect.width / 2 - tooltipWidth / 2
        };
      case "left":
        return {
          top: highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2,
          left: highlightRect.left - tooltipWidth - padding
        };
      case "right":
        return {
          top: highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2,
          left: highlightRect.right + padding
        };
      default:
        return {
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)"
        };
    }
  };

  return (
    <TourContext.Provider value={value}>
      {children}

      <AnimatePresence>
        {isActive && currentStep && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] pointer-events-auto"
              onClick={skipTour}
            >
              {/* Semi-transparent backdrop with cutout */}
              <svg className="w-full h-full">
                <defs>
                  <mask id="tour-mask">
                    <rect x="0" y="0" width="100%" height="100%" fill="white" />
                    {highlightRect && (
                      <rect
                        x={highlightRect.left - 8}
                        y={highlightRect.top - 8}
                        width={highlightRect.width + 16}
                        height={highlightRect.height + 16}
                        rx="8"
                        fill="black"
                      />
                    )}
                  </mask>
                </defs>
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill="rgba(0, 0, 0, 0.6)"
                  mask="url(#tour-mask)"
                />
              </svg>

              {/* Highlight border */}
              {highlightRect && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute rounded-lg border-2 border-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.2)] pointer-events-none"
                  style={{
                    top: highlightRect.top - 8,
                    left: highlightRect.left - 8,
                    width: highlightRect.width + 16,
                    height: highlightRect.height + 16
                  }}
                />
              )}
            </motion.div>

            {/* Tooltip */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="fixed z-[9999] w-[360px] bg-white rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
              style={getTooltipPosition()}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-white" />
                    <span className="text-white/90 text-sm font-medium">
                      {tour?.name}
                    </span>
                  </div>
                  <button
                    onClick={skipTour}
                    className="text-white/70 hover:text-white transition-colors"
                    aria-label="Close tour"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {currentStep.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-4">
                  {currentStep.content}
                </p>

                {/* Action button if specified */}
                {currentStep.action && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mb-4"
                    onClick={() => {
                      if (currentStep.action?.href) {
                        window.location.href = currentStep.action.href;
                      }
                      currentStep.action?.onClick?.();
                    }}
                  >
                    {currentStep.action.label}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}

                {/* Progress and navigation */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  {/* Progress dots */}
                  <div className="flex items-center gap-1.5">
                    {tour?.steps.map((_, idx) => (
                      <div
                        key={idx}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          idx === currentStepIndex
                            ? "bg-emerald-500"
                            : idx < currentStepIndex
                            ? "bg-emerald-200"
                            : "bg-slate-200"
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-xs text-slate-500">
                      {currentStepIndex + 1} of {totalSteps}
                    </span>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center gap-2">
                    {currentStepIndex > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={prevStep}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back
                      </Button>
                    )}
                    {currentStepIndex === 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={skipTour}
                        className="text-slate-500"
                      >
                        <SkipForward className="h-4 w-4 mr-1" />
                        Skip
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={nextStep}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {currentStepIndex === totalSteps - 1 ? (
                        "Finish"
                      ) : (
                        <>
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </TourContext.Provider>
  );
}
