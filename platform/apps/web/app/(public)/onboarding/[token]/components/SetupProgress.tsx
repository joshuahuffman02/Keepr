"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Circle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  onboardingSteps,
  phaseLabels,
  OnboardingStepKey,
  OnboardingPhase,
} from "@/lib/onboarding";

interface SetupProgressProps {
  currentStep: OnboardingStepKey;
  completedSteps: OnboardingStepKey[];
  inventoryPath?: "import" | "manual" | null;
  onStepClick?: (step: OnboardingStepKey) => void;
}

export function SetupProgress({
  currentStep,
  completedSteps,
  inventoryPath,
  onStepClick,
}: SetupProgressProps) {
  const prefersReducedMotion = useReducedMotion();
  const completedSet = new Set(completedSteps);

  // Group steps by phase
  const phases: OnboardingPhase[] = ["foundation", "inventory", "pricing", "rules", "launch"];

  // Filter steps based on inventory path
  const getVisibleSteps = () => {
    return onboardingSteps.filter((step) => {
      // Always show steps that aren't path-specific
      if (!["data_import", "site_classes", "sites_builder"].includes(step.key)) {
        return true;
      }
      // If no path chosen yet, only show inventory_choice
      if (!inventoryPath) {
        return step.key === "inventory_choice";
      }
      // Show import-specific steps only if import path
      if (step.key === "data_import") {
        return inventoryPath === "import";
      }
      // Show manual-specific steps only if manual path
      if (step.key === "site_classes" || step.key === "sites_builder") {
        return inventoryPath === "manual";
      }
      return true;
    });
  };

  const visibleSteps = getVisibleSteps();

  const isStepAccessible = (stepKey: OnboardingStepKey) => {
    // Current step is always accessible
    if (stepKey === currentStep) return true;
    // Completed steps are accessible
    if (completedSet.has(stepKey)) return true;
    // Can't jump ahead
    return false;
  };

  const getStepStatus = (stepKey: OnboardingStepKey): "completed" | "current" | "upcoming" => {
    if (completedSet.has(stepKey)) return "completed";
    if (stepKey === currentStep) return "current";
    return "upcoming";
  };

  return (
    <div className="w-72 bg-slate-900 border-r border-slate-800 p-6 flex flex-col h-full">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-1">Setup Wizard</h2>
        <p className="text-sm text-slate-400">
          {completedSteps.length} of {visibleSteps.filter(s => s.required || completedSet.has(s.key)).length} steps complete
        </p>
      </div>

      {/* Progress phases */}
      <div className="flex-1 space-y-6 overflow-y-auto">
        {phases.map((phase) => {
          const phaseSteps = visibleSteps.filter((s) => s.phase === phase);
          if (phaseSteps.length === 0) return null;

          const phaseComplete = phaseSteps.every(
            (s) => completedSet.has(s.key) || !s.required
          );

          return (
            <div key={phase}>
              {/* Phase header */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    phaseComplete ? "bg-emerald-500" : "bg-slate-600"
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-medium uppercase tracking-wider transition-colors",
                    phaseComplete ? "text-emerald-400" : "text-slate-500"
                  )}
                >
                  {phaseLabels[phase]}
                </span>
              </div>

              {/* Steps in phase */}
              <div className="space-y-1 pl-4 border-l border-slate-800">
                {phaseSteps.map((step, index) => {
                  const status = getStepStatus(step.key);
                  const accessible = isStepAccessible(step.key);

                  return (
                    <motion.button
                      key={step.key}
                      onClick={() => accessible && onStepClick?.(step.key)}
                      disabled={!accessible}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-3 group",
                        status === "current" &&
                          "bg-emerald-500/10 border border-emerald-500/30",
                        status === "completed" &&
                          "hover:bg-slate-800/50 cursor-pointer",
                        status === "upcoming" &&
                          "opacity-50 cursor-not-allowed"
                      )}
                      initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
                      animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      {/* Status icon */}
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                          status === "completed" && "bg-emerald-500",
                          status === "current" && "bg-emerald-500/20 border-2 border-emerald-500",
                          status === "upcoming" && "bg-slate-700"
                        )}
                      >
                        {status === "completed" ? (
                          <motion.div
                            initial={prefersReducedMotion ? {} : { scale: 0 }}
                            animate={prefersReducedMotion ? {} : { scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                          >
                            <Check className="w-4 h-4 text-white" />
                          </motion.div>
                        ) : status === "current" ? (
                          <motion.div
                            animate={prefersReducedMotion ? {} : { scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <Circle className="w-3 h-3 fill-emerald-500 text-emerald-500" />
                          </motion.div>
                        ) : (
                          <Circle className="w-3 h-3 text-slate-500" />
                        )}
                      </div>

                      {/* Step info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium truncate transition-colors",
                            status === "current" && "text-emerald-400",
                            status === "completed" && "text-slate-300 group-hover:text-white",
                            status === "upcoming" && "text-slate-500"
                          )}
                        >
                          {step.title}
                        </p>
                        {status === "current" && (
                          <p className="text-xs text-slate-400 truncate">
                            {step.description}
                          </p>
                        )}
                      </div>

                      {/* Arrow for current */}
                      {status === "current" && (
                        <ChevronRight className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      )}

                      {/* Optional badge */}
                      {!step.required && status === "upcoming" && (
                        <span className="text-xs text-slate-600 flex-shrink-0">
                          optional
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer with auto-save indicator */}
      <div className="mt-6 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Progress auto-saved
        </div>
      </div>
    </div>
  );
}
