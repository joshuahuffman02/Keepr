"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Zap, Droplets, Trash2, ChevronDown, Info, Gauge } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type MeteredType = "power" | "water" | "sewer";
export type MeteredBillingMode = "per_reading" | "cycle" | "manual";

interface MeteredUtilitiesPanelProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  type: MeteredType | null;
  onTypeChange: (type: MeteredType) => void;
  billingMode: MeteredBillingMode | null;
  onBillingModeChange: (mode: MeteredBillingMode) => void;
  className?: string;
}

const UTILITY_TYPES: { value: MeteredType; label: string; icon: React.ElementType; description: string }[] = [
  { value: "power", label: "Electric Power", icon: Zap, description: "Bill by kWh usage" },
  { value: "water", label: "Water", icon: Droplets, description: "Bill by gallon usage" },
  { value: "sewer", label: "Sewer", icon: Trash2, description: "Bill by usage or flat fee" },
];

const BILLING_MODES: { value: MeteredBillingMode; label: string; description: string }[] = [
  { value: "per_reading", label: "Per Reading", description: "Generate invoice when meter is read" },
  { value: "cycle", label: "Billing Cycle", description: "Bill monthly or at checkout" },
  { value: "manual", label: "Manual", description: "Bill only when you trigger it" },
];

export function MeteredUtilitiesPanel({
  enabled,
  onEnabledChange,
  type,
  onTypeChange,
  billingMode,
  onBillingModeChange,
  className,
}: MeteredUtilitiesPanelProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toggle */}
      <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-slate-800/30 border border-slate-700">
        <div className="flex items-center gap-3">
          <Gauge className="w-5 h-5 text-yellow-400" />
          <div>
            <span className="text-slate-300">Metered Utilities</span>
            <p className="text-xs text-slate-500">Bill guests based on actual usage</p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>

      {/* Expanded options */}
      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, height: "auto" }}
            exit={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden"
          >
            {/* Utility Type Selection */}
            <div className="space-y-3">
              <Label className="text-sm text-slate-300">What utility is metered?</Label>
              <div className="grid grid-cols-3 gap-2">
                {UTILITY_TYPES.map((utilityType) => {
                  const Icon = utilityType.icon;
                  const isSelected = type === utilityType.value;
                  return (
                    <button
                      key={utilityType.value}
                      onClick={() => onTypeChange(utilityType.value)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                        isSelected
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                          : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                      )}
                    >
                      <Icon className={cn("w-5 h-5", isSelected ? "text-emerald-400" : "text-slate-500")} />
                      <span className="text-xs font-medium">{utilityType.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Billing Mode */}
            <div className="space-y-2">
              <Label className="text-sm text-slate-300">How do you bill?</Label>
              <Select
                value={billingMode || "per_reading"}
                onValueChange={(value) => onBillingModeChange(value as MeteredBillingMode)}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                  <SelectValue placeholder="Select billing mode" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {BILLING_MODES.map((mode) => (
                    <SelectItem
                      key={mode.value}
                      value={mode.value}
                      className="text-white hover:bg-slate-700"
                    >
                      <div className="flex flex-col">
                        <span>{mode.label}</span>
                        <span className="text-xs text-slate-500">{mode.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Info note */}
            <div className="flex gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300">
                You'll set up individual meters for each site after launching.
                This just enables metered billing for this site type.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
