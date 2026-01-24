"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Shield, Check, DollarSign, Percent, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DepositPolicyData {
  strategy: "first_night" | "percent" | "full";
  percentValue?: number;
}

interface DepositPolicyProps {
  initialData?: DepositPolicyData;
  onSave: (data: DepositPolicyData) => Promise<void>;
  onNext: () => void;
  isLoading?: boolean;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

const policies: Array<{
  id: DepositPolicyData["strategy"];
  title: string;
  description: string;
  icon: typeof Moon;
  example: string;
  color: string;
  recommended?: boolean;
}> = [
  {
    id: "first_night",
    title: "First Night",
    description: "Collect the first night as deposit",
    icon: Moon,
    example: "Guest books 3 nights at $50 → $50 deposit",
    color: "violet",
  },
  {
    id: "percent",
    title: "50% Deposit",
    description: "Collect half the total upfront",
    icon: Percent,
    example: "Guest books 3 nights at $50 → $75 deposit",
    color: "emerald",
    recommended: true,
  },
  {
    id: "full",
    title: "Full Payment",
    description: "Collect everything at booking",
    icon: DollarSign,
    example: "Guest books 3 nights at $50 → $150 paid",
    color: "amber",
  },
];

export function DepositPolicy({
  initialData,
  onSave,
  onNext,
  isLoading = false,
}: DepositPolicyProps) {
  const prefersReducedMotion = useReducedMotion();
  const [selected, setSelected] = useState<DepositPolicyData["strategy"]>(
    initialData?.strategy || "percent",
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        strategy: selected,
        percentValue: selected === "percent" ? 50 : undefined,
      });
      onNext();
    } catch (error) {
      console.error("Failed to save deposit policy:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 mb-4">
            <Shield className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">How should deposits work?</h2>
          <p className="text-slate-400">Choose how much to collect when guests book</p>
        </motion.div>

        {/* Policy options */}
        <div className="space-y-4">
          {policies.map((policy, i) => {
            const isSelected = selected === policy.id;
            const Icon = policy.icon;

            return (
              <motion.button
                key={policy.id}
                onClick={() => setSelected(policy.id)}
                initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                className={cn(
                  "relative w-full p-5 rounded-xl border-2 text-left transition-all",
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-800/30 hover:border-slate-600",
                )}
              >
                {/* Recommended badge */}
                {policy.recommended && (
                  <span className="absolute -top-2.5 right-4 bg-emerald-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                )}

                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                      isSelected ? "bg-emerald-500/20" : "bg-slate-700",
                    )}
                  >
                    <Icon
                      className={cn("w-6 h-6", isSelected ? "text-emerald-400" : "text-slate-400")}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3
                        className={cn(
                          "font-semibold text-lg",
                          isSelected ? "text-emerald-400" : "text-white",
                        )}
                      >
                        {policy.title}
                      </h3>

                      {/* Selection indicator */}
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                          isSelected ? "border-emerald-500 bg-emerald-500" : "border-slate-600",
                        )}
                      >
                        {isSelected && (
                          <motion.div
                            initial={prefersReducedMotion ? {} : { scale: 0 }}
                            animate={prefersReducedMotion ? {} : { scale: 1 }}
                            transition={SPRING_CONFIG}
                          >
                            <Check className="w-4 h-4 text-white" />
                          </motion.div>
                        )}
                      </div>
                    </div>

                    <p className="text-slate-400 mt-1">{policy.description}</p>

                    {/* Example */}
                    <div className="mt-3 text-sm text-slate-500 bg-slate-900/50 rounded-lg px-3 py-2">
                      {policy.example}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Info */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800/30 border border-slate-700 rounded-lg p-4"
        >
          <p className="text-sm text-slate-400">
            <span className="text-slate-300 font-medium">You can customize this later.</span> Set
            different deposit rules per site type, add cancellation fees, and more in your dashboard
            settings.
          </p>
        </motion.div>

        {/* Continue button */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            onClick={handleSave}
            disabled={saving || isLoading}
            className={cn(
              "w-full py-6 text-lg font-semibold transition-all",
              "bg-gradient-to-r from-emerald-500 to-teal-500",
              "hover:from-emerald-400 hover:to-teal-400",
              "disabled:opacity-50",
            )}
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
