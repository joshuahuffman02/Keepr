"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Calendar, MapPin, Users, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

export type BookingStep = 1 | 2 | 3 | 4;

interface BookingProgressIndicatorProps {
  currentStep: BookingStep;
  className?: string;
}

const steps = [
  { num: 1, label: "Dates", sublabel: "Pick your dates", icon: Calendar },
  { num: 2, label: "Site", sublabel: "Choose your spot", icon: MapPin },
  { num: 3, label: "Details", sublabel: "Tell us about you", icon: Users },
  { num: 4, label: "Payment", sublabel: "Secure checkout", icon: CreditCard },
];

export function BookingProgressIndicator({
  currentStep,
  className
}: BookingProgressIndicatorProps) {
  const prefersReducedMotion = useReducedMotion();

  // Calculate progress percentage for the bar
  const progressPercent = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className={cn("w-full", className)}>
      {/* Mobile: Compact horizontal with progress bar */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            Step {currentStep} of {steps.length}
          </span>
          <span className="text-sm text-emerald-600 font-medium">
            {steps[currentStep - 1].label}
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={prefersReducedMotion ? { duration: 0 } : {
              type: "spring",
              stiffness: 100,
              damping: 20
            }}
          />
        </div>

        {/* Step dots */}
        <div className="flex justify-between mt-2">
          {steps.map((step) => (
            <motion.div
              key={step.num}
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                step.num < currentStep && "bg-emerald-500 text-white",
                step.num === currentStep && "bg-emerald-500 text-white ring-2 ring-emerald-200",
                step.num > currentStep && "bg-muted text-muted-foreground"
              )}
              initial={prefersReducedMotion ? {} : { scale: 0.8 }}
              animate={prefersReducedMotion ? {} : {
                scale: step.num === currentStep ? 1.1 : 1
              }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {step.num < currentStep ? (
                <Check className="h-3 w-3" />
              ) : (
                step.num
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Desktop: Full horizontal stepper */}
      <div className="hidden sm:block">
        <div className="flex items-center justify-center">
          {steps.map((step, idx) => {
            const StepIcon = step.icon;
            const isComplete = step.num < currentStep;
            const isCurrent = step.num === currentStep;
            const isFuture = step.num > currentStep;

            return (
              <div key={step.num} className="flex items-center">
                {/* Step circle with icon */}
                <div className="flex flex-col items-center">
                  <motion.div
                    className={cn(
                      "relative flex items-center justify-center w-12 h-12 rounded-full text-sm font-semibold transition-colors",
                      isComplete && "bg-emerald-500 text-white",
                      isCurrent && "bg-emerald-500 text-white",
                      isFuture && "bg-muted text-muted-foreground border-2 border-border"
                    )}
                    initial={prefersReducedMotion ? {} : { scale: 0.9 }}
                    animate={prefersReducedMotion ? {} : {
                      scale: isCurrent ? 1 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {/* Pulse ring for current step */}
                    {isCurrent && !prefersReducedMotion && (
                      <motion.div
                        className="absolute inset-0 rounded-full bg-emerald-500"
                        animate={{
                          scale: [1, 1.15, 1],
                          opacity: [0.5, 0, 0.5]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    )}

                    {/* Icon or checkmark */}
                    {isComplete ? (
                      <motion.div
                        initial={prefersReducedMotion ? {} : { scale: 0, rotate: -90 }}
                        animate={prefersReducedMotion ? {} : { scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <Check className="h-5 w-5" strokeWidth={3} />
                      </motion.div>
                    ) : (
                      <StepIcon className={cn(
                        "h-5 w-5 relative z-10",
                        isCurrent && "text-white",
                        isFuture && "text-muted-foreground"
                      )} />
                    )}
                  </motion.div>

                  {/* Labels */}
                  <div className="mt-2 text-center">
                    <span className={cn(
                      "block text-sm font-medium",
                      (isComplete || isCurrent) ? "text-emerald-600" : "text-muted-foreground"
                    )}>
                      {step.label}
                    </span>
                    <span className={cn(
                      "block text-xs mt-0.5",
                      isCurrent ? "text-muted-foreground" : "text-muted-foreground"
                    )}>
                      {step.sublabel}
                    </span>
                  </div>
                </div>

                {/* Connector line */}
                {idx < steps.length - 1 && (
                  <div className="relative w-16 lg:w-24 h-0.5 mx-3 -mt-8">
                    <div className="absolute inset-0 bg-muted rounded-full" />
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{
                        width: step.num < currentStep ? "100%" : "0%"
                      }}
                      transition={prefersReducedMotion ? { duration: 0 } : {
                        type: "spring",
                        stiffness: 100,
                        damping: 20
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Estimated time remaining */}
      <motion.div
        className="text-center mt-4 sm:mt-6"
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 5 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <span className="text-xs text-muted-foreground">
          {currentStep === 1 && "About 3 minutes to complete"}
          {currentStep === 2 && "Almost there - 2 minutes left"}
          {currentStep === 3 && "Just a minute more"}
          {currentStep === 4 && "Final step - secure checkout"}
        </span>
      </motion.div>
    </div>
  );
}
