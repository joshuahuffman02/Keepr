"use client";

import { ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { OnboardingStepKey, onboardingSteps } from "@/lib/onboarding";

interface StepContainerProps {
  currentStep: OnboardingStepKey;
  children: ReactNode;
  direction?: "forward" | "backward";
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 200,
  damping: 20,
};

export function StepContainer({
  currentStep,
  children,
  direction = "forward",
}: StepContainerProps) {
  const prefersReducedMotion = useReducedMotion();
  const stepInfo = onboardingSteps.find((s) => s.key === currentStep);

  const variants = {
    enter: (direction: "forward" | "backward") => ({
      x: direction === "forward" ? 50 : -50,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: "forward" | "backward") => ({
      x: direction === "forward" ? -50 : 50,
      opacity: 0,
    }),
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Step header */}
      <div className="px-8 pt-8 pb-4">
        <motion.div
          key={`header-${currentStep}`}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0.15 } : SPRING_CONFIG}
        >
          <h1 className="text-2xl font-bold text-white mb-1">{stepInfo?.title}</h1>
          <p className="text-slate-400">{stepInfo?.description}</p>
        </motion.div>
      </div>

      {/* Step content with animation */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={prefersReducedMotion ? undefined : variants}
            initial={prefersReducedMotion ? { opacity: 0 } : "enter"}
            animate={prefersReducedMotion ? { opacity: 1 } : "center"}
            exit={prefersReducedMotion ? { opacity: 0 } : "exit"}
            transition={prefersReducedMotion ? { duration: 0.15 } : SPRING_CONFIG}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
