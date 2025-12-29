"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TourStep } from "@/hooks/use-onboarding-tour";

interface TourOverlayProps {
  /** Whether the tour is active */
  isActive: boolean;
  /** Current step data */
  currentStep: TourStep | null;
  /** Current step index (0-based) */
  currentStepIndex: number;
  /** Total number of steps */
  totalSteps: number;
  /** Whether on first step */
  isFirstStep: boolean;
  /** Whether on last step */
  isLastStep: boolean;
  /** Go to next step */
  onNext: () => void;
  /** Go to previous step */
  onPrev: () => void;
  /** Skip/dismiss the tour */
  onSkip: () => void;
}

interface TooltipPosition {
  top: number;
  left: number;
  arrowPosition: "top" | "bottom" | "left" | "right";
}

/**
 * Visual overlay component for guided tours.
 * Shows spotlight on target element and tooltip with step content.
 */
export function TourOverlay({
  isActive,
  currentStep,
  currentStepIndex,
  totalSteps,
  isFirstStep,
  isLastStep,
  onNext,
  onPrev,
  onSkip,
}: TourOverlayProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Find and measure target element
  useEffect(() => {
    if (!isActive || !currentStep) {
      setTargetRect(null);
      return;
    }

    const updateTarget = () => {
      const element = document.querySelector(currentStep.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);

        // Scroll element into view if needed
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setTargetRect(null);
      }
    };

    // Initial update
    updateTarget();

    // Update on resize/scroll
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget);

    return () => {
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget);
    };
  }, [isActive, currentStep]);

  // Calculate tooltip position
  useEffect(() => {
    if (!targetRect || !tooltipRef.current || !currentStep) {
      setTooltipPosition(null);
      return;
    }

    const tooltip = tooltipRef.current.getBoundingClientRect();
    const padding = 16;
    const arrowOffset = 12;

    let top = 0;
    let left = 0;
    let arrowPosition: "top" | "bottom" | "left" | "right" = "top";

    const placement = currentStep.placement || "auto";

    // Calculate based on placement
    if (placement === "bottom" || placement === "auto") {
      top = targetRect.bottom + arrowOffset;
      left = targetRect.left + targetRect.width / 2 - tooltip.width / 2;
      arrowPosition = "top";

      // If goes off bottom, flip to top
      if (top + tooltip.height > window.innerHeight - padding) {
        top = targetRect.top - tooltip.height - arrowOffset;
        arrowPosition = "bottom";
      }
    } else if (placement === "top") {
      top = targetRect.top - tooltip.height - arrowOffset;
      left = targetRect.left + targetRect.width / 2 - tooltip.width / 2;
      arrowPosition = "bottom";
    } else if (placement === "left") {
      top = targetRect.top + targetRect.height / 2 - tooltip.height / 2;
      left = targetRect.left - tooltip.width - arrowOffset;
      arrowPosition = "right";
    } else if (placement === "right") {
      top = targetRect.top + targetRect.height / 2 - tooltip.height / 2;
      left = targetRect.right + arrowOffset;
      arrowPosition = "left";
    }

    // Keep within viewport
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltip.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltip.height - padding));

    setTooltipPosition({ top, left, arrowPosition });
  }, [targetRect, currentStep]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onSkip();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        onNext();
      } else if (e.key === "ArrowLeft") {
        onPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, onNext, onPrev, onSkip]);

  return (
    <AnimatePresence>
      {isActive && currentStep && (
        <>
          {/* Backdrop with spotlight cutout */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] pointer-events-none"
            style={{
              background: targetRect && currentStep.spotlight !== false
                ? `radial-gradient(ellipse ${targetRect.width + 40}px ${targetRect.height + 40}px at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent 0%, rgba(0, 0, 0, 0.75) 100%)`
                : "rgba(0, 0, 0, 0.75)",
            }}
          />

          {/* Clickable overlay to skip */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={onSkip}
            aria-hidden="true"
          />

          {/* Spotlight ring around target */}
          {targetRect && currentStep.spotlight !== false && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed z-[9999] pointer-events-none rounded-lg ring-4 ring-emerald-500/50"
              style={{
                top: targetRect.top - 4,
                left: targetRect.left - 4,
                width: targetRect.width + 8,
                height: targetRect.height + 8,
              }}
            >
              {/* Pulsing animation */}
              <motion.div
                className="absolute inset-0 rounded-lg ring-2 ring-emerald-400"
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.8, 0.4, 0.8],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </motion.div>
          )}

          {/* Tooltip */}
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed z-[10000] w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700"
            style={{
              top: tooltipPosition?.top ?? 0,
              left: tooltipPosition?.left ?? 0,
              visibility: tooltipPosition ? "visible" : "hidden",
            }}
          >
            {/* Arrow */}
            {tooltipPosition && (
              <div
                className={cn(
                  "absolute w-3 h-3 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rotate-45",
                  tooltipPosition.arrowPosition === "top" && "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-l border-t",
                  tooltipPosition.arrowPosition === "bottom" && "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-r border-b",
                  tooltipPosition.arrowPosition === "left" && "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 border-l border-b",
                  tooltipPosition.arrowPosition === "right" && "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 border-r border-t"
                )}
              />
            )}

            {/* Header */}
            <div className="flex items-start justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-500" />
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {currentStep.title}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-slate-600"
                onClick={onSkip}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="px-4 pb-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {currentStep.content}
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-b-xl border-t border-slate-100 dark:border-slate-700">
              {/* Progress dots */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      i === currentStepIndex
                        ? "bg-emerald-500"
                        : i < currentStepIndex
                        ? "bg-emerald-300"
                        : "bg-slate-300 dark:bg-slate-600"
                    )}
                  />
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-2">
                {!isFirstStep && (
                  <Button variant="ghost" size="sm" onClick={onPrev}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
                <Button size="sm" onClick={onNext}>
                  {isLastStep ? "Finish" : "Next"}
                  {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
