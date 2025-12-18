"use client";

import { motion, useReducedMotion } from "framer-motion";

interface ProgressBarProps {
  progress: number;
  steps?: string[];
}

export function ProgressBar({ progress, steps = ["Choose Tier", "Details", "Confirm"] }: ProgressBarProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="w-full mb-8">
      <div className="relative h-2 bg-slate-700/50 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.5, ease: "easeOut" }
          }
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-slate-500">
        {steps.map((step, i) => {
          const stepProgress = ((i + 1) / steps.length) * 100;
          const isActive = progress >= stepProgress - 10;
          return (
            <span
              key={step}
              className={isActive ? "text-emerald-400" : "text-slate-500"}
            >
              {step}
            </span>
          );
        })}
      </div>
    </div>
  );
}
