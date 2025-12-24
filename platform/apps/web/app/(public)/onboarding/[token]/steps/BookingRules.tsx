"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Calendar, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BookingRulesData {
  advanceBookingDays: number | null; // null = no limit
  minNights: number;
  longTermEnabled: boolean;
  longTermMinNights?: number;
  longTermAutoApply?: boolean;
}

interface BookingRulesProps {
  initialData?: BookingRulesData;
  onSave: (data: BookingRulesData) => Promise<void>;
  onNext: () => void;
  isLoading?: boolean;
}

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

const advanceBookingOptions = [
  {
    days: 30,
    label: "30 Days",
    description: "Great for filling last-minute gaps",
  },
  {
    days: 90,
    label: "90 Days",
    description: "Most common for seasonal planning",
    recommended: true,
  },
  {
    days: 180,
    label: "180 Days",
    description: "Popular for snowbird season",
  },
  {
    days: 365,
    label: "1 Year",
    description: "Maximum advance planning",
  },
  {
    days: null,
    label: "No Limit",
    description: "Accept bookings anytime in the future",
  },
];

const minNightOptions = [1, 2, 3];

export function BookingRules({
  initialData,
  onSave,
  onNext,
  isLoading = false,
}: BookingRulesProps) {
  const prefersReducedMotion = useReducedMotion();
  const [advanceBookingDays, setAdvanceBookingDays] = useState<number | null>(
    initialData?.advanceBookingDays ?? 90
  );
  const [minNights, setMinNights] = useState<number>(
    initialData?.minNights || 1
  );
  const [longTermEnabled, setLongTermEnabled] = useState<boolean>(
    initialData?.longTermEnabled || false
  );
  const [longTermMinNights, setLongTermMinNights] = useState<number>(
    initialData?.longTermMinNights || 28
  );
  const [longTermAutoApply, setLongTermAutoApply] = useState<boolean>(
    initialData?.longTermAutoApply || false
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        advanceBookingDays,
        minNights,
        longTermEnabled,
        longTermMinNights: longTermEnabled ? longTermMinNights : undefined,
        longTermAutoApply: longTermEnabled ? longTermAutoApply : undefined,
      });
      onNext();
    } catch (error) {
      console.error("Failed to save booking rules:", error);
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
            <Calendar className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Booking Rules
          </h2>
          <p className="text-slate-400">
            Control when and how guests can make reservations
          </p>
        </motion.div>

        {/* Advance Booking Window */}
        <div className="space-y-3">
          <motion.h3
            initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="text-sm font-medium text-slate-300"
          >
            How far ahead can guests book?
          </motion.h3>

          <div className="space-y-3">
            {advanceBookingOptions.map((option, i) => {
              const isSelected = advanceBookingDays === option.days;

              return (
                <motion.button
                  key={option.label}
                  onClick={() => setAdvanceBookingDays(option.days)}
                  initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.04 }}
                  whileHover={prefersReducedMotion ? {} : { scale: 1.01 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.99 }}
                  className={cn(
                    "relative w-full p-4 rounded-xl border-2 text-left transition-all",
                    isSelected
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                  )}
                >
                  {/* Recommended badge */}
                  {option.recommended && (
                    <span className="absolute -top-2.5 right-4 bg-emerald-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                      Recommended
                    </span>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4
                          className={cn(
                            "font-semibold",
                            isSelected ? "text-emerald-400" : "text-white"
                          )}
                        >
                          {option.label}
                        </h4>
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">
                        {option.description}
                      </p>
                    </div>

                    {/* Selection indicator */}
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ml-3",
                        isSelected
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-slate-600"
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
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Minimum Nights */}
        <div className="space-y-3">
          <motion.h3
            initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="text-sm font-medium text-slate-300"
          >
            Minimum stay requirement
          </motion.h3>

          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="flex gap-3"
          >
            {minNightOptions.map((nights) => {
              const isSelected = minNights === nights;

              return (
                <motion.button
                  key={nights}
                  onClick={() => setMinNights(nights)}
                  whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                  className={cn(
                    "flex-1 p-4 rounded-xl border-2 transition-all",
                    isSelected
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                  )}
                >
                  <div className="text-center">
                    <div
                      className={cn(
                        "text-2xl font-bold",
                        isSelected ? "text-emerald-400" : "text-white"
                      )}
                    >
                      {nights}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {nights === 1 ? "night" : "nights"}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </div>

        {/* Long-Term Stays Toggle */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          <button
            onClick={() => setLongTermEnabled(!longTermEnabled)}
            className={cn(
              "w-full p-4 rounded-xl border-2 text-left transition-all",
              longTermEnabled
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3
                  className={cn(
                    "font-semibold",
                    longTermEnabled ? "text-emerald-400" : "text-white"
                  )}
                >
                  Enable Long-Term Stays
                </h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  Allow monthly and seasonal bookings
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Toggle indicator */}
                <div
                  className={cn(
                    "relative w-11 h-6 rounded-full transition-colors",
                    longTermEnabled ? "bg-emerald-500" : "bg-slate-600"
                  )}
                >
                  <motion.div
                    layout
                    transition={SPRING_CONFIG}
                    className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full"
                    style={{
                      x: longTermEnabled ? 20 : 0,
                    }}
                  />
                </div>

                {longTermEnabled ? (
                  <ChevronUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </div>
          </button>

          {/* Long-term options (expandable) */}
          {longTermEnabled && (
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
              animate={
                prefersReducedMotion ? {} : { opacity: 1, height: "auto" }
              }
              exit={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3 pl-4 border-l-2 border-emerald-500/30"
            >
              {/* Minimum nights for long-term */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">
                  Minimum nights for long-term stays
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setLongTermMinNights(Math.max(7, longTermMinNights - 7))
                    }
                    className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                  >
                    -
                  </button>
                  <div className="flex-1 text-center">
                    <div className="text-xl font-bold text-white">
                      {longTermMinNights}
                    </div>
                    <div className="text-xs text-slate-400">nights</div>
                  </div>
                  <button
                    onClick={() => setLongTermMinNights(longTermMinNights + 7)}
                    className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Auto-apply long-term rates */}
              <button
                onClick={() => setLongTermAutoApply(!longTermAutoApply)}
                className={cn(
                  "w-full p-3 rounded-lg border transition-all",
                  longTermAutoApply
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">
                    Auto-apply long-term rates
                  </span>
                  <div
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                      longTermAutoApply
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-slate-600"
                    )}
                  >
                    {longTermAutoApply && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                </div>
              </button>
            </motion.div>
          )}
        </motion.div>

        {/* Info */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-slate-800/30 border border-slate-700 rounded-lg p-4"
        >
          <p className="text-sm text-slate-400">
            <span className="text-slate-300 font-medium">
              You can customize this later.
            </span>{" "}
            Set different booking rules per site type, add seasonal minimums,
            and create custom booking windows in your dashboard settings.
          </p>
        </motion.div>

        {/* Continue button */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Button
            onClick={handleSave}
            disabled={saving || isLoading}
            className={cn(
              "w-full py-6 text-lg font-semibold transition-all",
              "bg-gradient-to-r from-emerald-500 to-teal-500",
              "hover:from-emerald-400 hover:to-teal-400",
              "disabled:opacity-50"
            )}
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
