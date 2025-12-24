"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronUp, Users, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GuestPricingPanelProps {
  occupantsIncluded: number;
  extraAdultFee: number | null; // in dollars
  extraChildFee: number | null; // in dollars
  onChange: (data: { occupantsIncluded: number; extraAdultFee: number | null; extraChildFee: number | null }) => void;
  disabled?: boolean;
}

export function GuestPricingPanel({
  occupantsIncluded,
  extraAdultFee,
  extraChildFee,
  onChange,
  disabled = false,
}: GuestPricingPanelProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleOccupantsChange = (value: string) => {
    const num = parseInt(value) || 0;
    onChange({
      occupantsIncluded: Math.max(0, num),
      extraAdultFee,
      extraChildFee,
    });
  };

  const handleExtraAdultFeeChange = (value: string) => {
    const num = parseFloat(value);
    onChange({
      occupantsIncluded,
      extraAdultFee: value === "" || isNaN(num) ? null : Math.max(0, num),
      extraChildFee,
    });
  };

  const handleExtraChildFeeChange = (value: string) => {
    const num = parseFloat(value);
    onChange({
      occupantsIncluded,
      extraAdultFee,
      extraChildFee: value === "" || isNaN(num) ? null : Math.max(0, num),
    });
  };

  const getSummaryText = () => {
    const parts: string[] = [];
    if (occupantsIncluded > 0) {
      parts.push(`${occupantsIncluded} guest${occupantsIncluded !== 1 ? "s" : ""} included`);
    }
    if (extraAdultFee !== null && extraAdultFee > 0) {
      parts.push(`$${extraAdultFee.toFixed(2)} per extra adult`);
    }
    if (extraChildFee !== null && extraChildFee > 0) {
      parts.push(`$${extraChildFee.toFixed(2)} per extra child`);
    }
    return parts.length > 0 ? parts.join(" • ") : "Not configured";
  };

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      className="border-t border-slate-700 pt-6"
    >
      {/* Header - Always visible */}
      <button
        type="button"
        onClick={() => !disabled && setIsExpanded(!isExpanded)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between text-left",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Guest Pricing</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {getSummaryText()}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, height: "auto" }}
            exit={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-6 space-y-4 pl-[52px]">
              {/* Occupants Included */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" />
                  Occupants Included in Base Rate
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={occupantsIncluded || ""}
                  onChange={(e) => handleOccupantsChange(e.target.value)}
                  placeholder="2"
                  disabled={disabled}
                  className={cn(
                    "bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500",
                    "transition-all duration-200",
                    "focus:bg-slate-800 focus:border-emerald-500/50 focus:shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]",
                    disabled && "cursor-not-allowed opacity-50"
                  )}
                />
                <p className="text-xs text-slate-500">
                  Number of guests included in your base nightly rate
                </p>
              </div>

              {/* Extra Adult Fee */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-300 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-slate-500" />
                  Extra Adult Fee (per night)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    $
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={extraAdultFee ?? ""}
                    onChange={(e) => handleExtraAdultFeeChange(e.target.value)}
                    placeholder="0.00"
                    disabled={disabled}
                    className={cn(
                      "bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pl-7",
                      "transition-all duration-200",
                      "focus:bg-slate-800 focus:border-emerald-500/50 focus:shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]",
                      disabled && "cursor-not-allowed opacity-50"
                    )}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Optional fee for each adult beyond the base occupancy
                </p>
              </div>

              {/* Extra Child Fee */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-300 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-slate-500" />
                  Extra Child Fee (per night)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    $
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={extraChildFee ?? ""}
                    onChange={(e) => handleExtraChildFeeChange(e.target.value)}
                    placeholder="0.00"
                    disabled={disabled}
                    className={cn(
                      "bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pl-7",
                      "transition-all duration-200",
                      "focus:bg-slate-800 focus:border-emerald-500/50 focus:shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]",
                      disabled && "cursor-not-allowed opacity-50"
                    )}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Optional fee for each child beyond the base occupancy
                </p>
              </div>

              {/* Info box */}
              <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700">
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-300">Example:</strong> If you set 2 occupants included
                  with a $10 extra adult fee, a reservation for 4 adults would add $20 to the base rate.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
