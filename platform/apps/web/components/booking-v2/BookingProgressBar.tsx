"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Tent, Users, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

export type BookingStepV2 = 1 | 2 | 3;

interface BookingProgressBarProps {
  currentStep: BookingStepV2;
  className?: string;
}

const steps = [
  {
    number: 1,
    label: "Accommodation",
    shortLabel: "Select",
    icon: Tent,
  },
  {
    number: 2,
    label: "Your Details",
    shortLabel: "Details",
    icon: Users,
  },
  {
    number: 3,
    label: "Payment",
    shortLabel: "Pay",
    icon: CreditCard,
  },
];

export function BookingProgressBar({
  currentStep,
  className,
}: BookingProgressBarProps) {
  const prefersReducedMotion = useReducedMotion();
  const progressPercent = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Mobile: Simple progress bar */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-900">
            Step {currentStep} of {steps.length}
          </span>
          <span className="text-sm text-emerald-600 font-medium">
            {steps[currentStep - 1].label}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-emerald-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={prefersReducedMotion ? {} : { duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Desktop: Full step indicator */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between relative">
          {/* Progress line background */}
          <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-200" />

          {/* Progress line filled */}
          <motion.div
            className="absolute top-5 left-8 h-0.5 bg-emerald-500"
            initial={{ width: 0 }}
            animate={{
              width: `calc(${progressPercent}% - ${progressPercent === 100 ? "0" : "32"}px)`,
            }}
            transition={prefersReducedMotion ? {} : { duration: 0.5, ease: "easeOut" }}
          />

          {/* Steps */}
          {steps.map((step) => {
            const isComplete = currentStep > step.number;
            const isCurrent = currentStep === step.number;
            const Icon = step.icon;

            return (
              <div
                key={step.number}
                className="relative flex flex-col items-center z-10"
              >
                {/* Circle */}
                <motion.div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                    isComplete
                      ? "bg-emerald-500"
                      : isCurrent
                      ? "bg-emerald-500"
                      : "bg-white border-2 border-slate-200"
                  )}
                  initial={false}
                  animate={
                    isCurrent && !prefersReducedMotion
                      ? {
                          boxShadow: [
                            "0 0 0 0 rgba(16, 185, 129, 0)",
                            "0 0 0 8px rgba(16, 185, 129, 0.2)",
                            "0 0 0 0 rgba(16, 185, 129, 0)",
                          ],
                        }
                      : {}
                  }
                  transition={{
                    repeat: isCurrent ? Infinity : 0,
                    duration: 2,
                  }}
                >
                  {isComplete ? (
                    <Check className="h-5 w-5 text-white" />
                  ) : (
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        isCurrent ? "text-white" : "text-slate-400"
                      )}
                    />
                  )}
                </motion.div>

                {/* Label */}
                <span
                  className={cn(
                    "mt-2 text-sm font-medium",
                    isComplete || isCurrent
                      ? "text-slate-900"
                      : "text-slate-400"
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Minimal inline progress for tight spaces
 */
export function BookingProgressInline({
  currentStep,
  className,
}: BookingProgressBarProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {steps.map((step, idx) => {
        const isComplete = currentStep > step.number;
        const isCurrent = currentStep === step.number;

        return (
          <div key={step.number} className="flex items-center gap-2">
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                isComplete
                  ? "bg-emerald-500 text-white"
                  : isCurrent
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-200 text-slate-500"
              )}
            >
              {isComplete ? (
                <Check className="h-3 w-3" />
              ) : (
                step.number
              )}
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "w-8 h-0.5",
                  isComplete ? "bg-emerald-500" : "bg-slate-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Back button with step context
 */
export function BookingBackButton({
  currentStep,
  onBack,
  className,
}: {
  currentStep: BookingStepV2;
  onBack: () => void;
  className?: string;
}) {
  if (currentStep === 1) return null;

  const previousStep = steps[currentStep - 2];

  return (
    <button
      onClick={onBack}
      className={cn(
        "flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors",
        className
      )}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 19l-7-7 7-7"
        />
      </svg>
      Back to {previousStep.label}
    </button>
  );
}
