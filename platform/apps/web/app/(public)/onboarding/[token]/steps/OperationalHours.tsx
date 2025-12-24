"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface OperationalHoursData {
  checkInTime: string; // HH:mm format
  checkOutTime: string; // HH:mm format
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  checkInWindowEnabled: boolean;
  checkInWindowStart?: string;
  checkInWindowEnd?: string;
}

interface OperationalHoursProps {
  initialData?: OperationalHoursData;
  onSave: (data: OperationalHoursData) => Promise<void>;
  onNext: () => void;
  isLoading?: boolean;
}

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

// Generate time options for check-in (12:00 PM - 8:00 PM)
const generateCheckInTimes = () => {
  const times: { value: string; label: string }[] = [];
  for (let hour = 12; hour <= 20; hour++) {
    for (let min of [0, 30]) {
      const hourStr = hour.toString().padStart(2, "0");
      const minStr = min.toString().padStart(2, "0");
      const value = `${hourStr}:${minStr}`;

      const displayHour = hour > 12 ? hour - 12 : hour;
      const period = hour >= 12 ? "PM" : "AM";
      const label = `${displayHour}:${minStr} ${period}`;

      times.push({ value, label });

      if (hour === 20 && min === 0) break; // Stop at 8:00 PM
    }
  }
  return times;
};

// Generate time options for check-out (8:00 AM - 2:00 PM)
const generateCheckOutTimes = () => {
  const times: { value: string; label: string }[] = [];
  for (let hour = 8; hour <= 14; hour++) {
    for (let min of [0, 30]) {
      const hourStr = hour.toString().padStart(2, "0");
      const minStr = min.toString().padStart(2, "0");
      const value = `${hourStr}:${minStr}`;

      const displayHour = hour > 12 ? hour - 12 : hour;
      const period = hour >= 12 ? "PM" : "AM";
      const label = `${displayHour}:${minStr} ${period}`;

      times.push({ value, label });

      if (hour === 14 && min === 0) break; // Stop at 2:00 PM
    }
  }
  return times;
};

// Generate time options for quiet hours and check-in window (all day)
const generateAllDayTimes = () => {
  const times: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min of [0, 30]) {
      const hourStr = hour.toString().padStart(2, "0");
      const minStr = min.toString().padStart(2, "0");
      const value = `${hourStr}:${minStr}`;

      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const period = hour >= 12 ? "PM" : "AM";
      const label = `${displayHour}:${minStr} ${period}`;

      times.push({ value, label });
    }
  }
  return times;
};

const checkInTimes = generateCheckInTimes();
const checkOutTimes = generateCheckOutTimes();
const allDayTimes = generateAllDayTimes();

export function OperationalHours({
  initialData,
  onSave,
  onNext,
  isLoading = false,
}: OperationalHoursProps) {
  const prefersReducedMotion = useReducedMotion();

  const [checkInTime, setCheckInTime] = useState(
    initialData?.checkInTime || "15:00"
  );
  const [checkOutTime, setCheckOutTime] = useState(
    initialData?.checkOutTime || "11:00"
  );

  const [quietHoursEnabled, setQuietHoursEnabled] = useState(
    initialData?.quietHoursEnabled || false
  );
  const [quietHoursStart, setQuietHoursStart] = useState(
    initialData?.quietHoursStart || "22:00"
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(
    initialData?.quietHoursEnd || "07:00"
  );

  const [checkInWindowEnabled, setCheckInWindowEnabled] = useState(
    initialData?.checkInWindowEnabled || false
  );
  const [checkInWindowStart, setCheckInWindowStart] = useState(
    initialData?.checkInWindowStart || "12:00"
  );
  const [checkInWindowEnd, setCheckInWindowEnd] = useState(
    initialData?.checkInWindowEnd || "18:00"
  );

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: OperationalHoursData = {
        checkInTime,
        checkOutTime,
        quietHoursEnabled,
        quietHoursStart: quietHoursEnabled ? quietHoursStart : undefined,
        quietHoursEnd: quietHoursEnabled ? quietHoursEnd : undefined,
        checkInWindowEnabled,
        checkInWindowStart: checkInWindowEnabled ? checkInWindowStart : undefined,
        checkInWindowEnd: checkInWindowEnabled ? checkInWindowEnd : undefined,
      };
      await onSave(data);
      onNext();
    } catch (error) {
      console.error("Failed to save operational hours:", error);
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
            <Clock className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Set Your Hours
          </h2>
          <p className="text-slate-400">
            When can guests arrive and when do they need to leave?
          </p>
        </motion.div>

        {/* Main check-in/check-out times */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* Check-in time */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Check-in Time
            </label>
            <div className="relative">
              <select
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border-2",
                  "bg-slate-800/50 border-slate-700",
                  "text-white font-medium",
                  "focus:border-emerald-500 focus:outline-none",
                  "appearance-none cursor-pointer",
                  "transition-colors"
                )}
              >
                {checkInTimes.map((time) => (
                  <option key={time.value} value={time.value}>
                    {time.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Check-out time */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Check-out Time
            </label>
            <div className="relative">
              <select
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border-2",
                  "bg-slate-800/50 border-slate-700",
                  "text-white font-medium",
                  "focus:border-emerald-500 focus:outline-none",
                  "appearance-none cursor-pointer",
                  "transition-colors"
                )}
              >
                {checkOutTimes.map((time) => (
                  <option key={time.value} value={time.value}>
                    {time.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </motion.div>

        {/* Quiet Hours (optional) */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {/* Toggle */}
          <label className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-700 bg-slate-800/30 cursor-pointer hover:border-slate-600 transition-colors">
            <div>
              <h3 className="font-semibold text-white">Quiet Hours</h3>
              <p className="text-sm text-slate-400">
                Set specific hours when noise should be minimized
              </p>
            </div>
            <button
              type="button"
              onClick={() => setQuietHoursEnabled(!quietHoursEnabled)}
              className={cn(
                "relative w-12 h-7 rounded-full transition-colors",
                quietHoursEnabled ? "bg-emerald-500" : "bg-slate-600"
              )}
            >
              <motion.div
                layout
                transition={SPRING_CONFIG}
                className={cn(
                  "absolute top-1 w-5 h-5 rounded-full bg-white",
                  quietHoursEnabled ? "left-6" : "left-1"
                )}
              />
            </button>
          </label>

          {/* Collapsible content */}
          <motion.div
            initial={false}
            animate={{
              height: quietHoursEnabled ? "auto" : 0,
              opacity: quietHoursEnabled ? 1 : 0,
            }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Start Time
                </label>
                <div className="relative">
                  <select
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                    disabled={!quietHoursEnabled}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border-2",
                      "bg-slate-800/50 border-slate-700",
                      "text-white font-medium",
                      "focus:border-emerald-500 focus:outline-none",
                      "appearance-none cursor-pointer",
                      "transition-colors",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {allDayTimes.map((time) => (
                      <option key={time.value} value={time.value}>
                        {time.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  End Time
                </label>
                <div className="relative">
                  <select
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                    disabled={!quietHoursEnabled}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border-2",
                      "bg-slate-800/50 border-slate-700",
                      "text-white font-medium",
                      "focus:border-emerald-500 focus:outline-none",
                      "appearance-none cursor-pointer",
                      "transition-colors",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {allDayTimes.map((time) => (
                      <option key={time.value} value={time.value}>
                        {time.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Check-in Window (optional) */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-4"
        >
          {/* Toggle */}
          <label className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-700 bg-slate-800/30 cursor-pointer hover:border-slate-600 transition-colors">
            <div>
              <h3 className="font-semibold text-white">Check-in Window</h3>
              <p className="text-sm text-slate-400">
                Limit when guests can arrive on check-in day
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCheckInWindowEnabled(!checkInWindowEnabled)}
              className={cn(
                "relative w-12 h-7 rounded-full transition-colors",
                checkInWindowEnabled ? "bg-emerald-500" : "bg-slate-600"
              )}
            >
              <motion.div
                layout
                transition={SPRING_CONFIG}
                className={cn(
                  "absolute top-1 w-5 h-5 rounded-full bg-white",
                  checkInWindowEnabled ? "left-6" : "left-1"
                )}
              />
            </button>
          </label>

          {/* Collapsible content */}
          <motion.div
            initial={false}
            animate={{
              height: checkInWindowEnabled ? "auto" : 0,
              opacity: checkInWindowEnabled ? 1 : 0,
            }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Earliest Arrival
                </label>
                <div className="relative">
                  <select
                    value={checkInWindowStart}
                    onChange={(e) => setCheckInWindowStart(e.target.value)}
                    disabled={!checkInWindowEnabled}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border-2",
                      "bg-slate-800/50 border-slate-700",
                      "text-white font-medium",
                      "focus:border-emerald-500 focus:outline-none",
                      "appearance-none cursor-pointer",
                      "transition-colors",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {allDayTimes.map((time) => (
                      <option key={time.value} value={time.value}>
                        {time.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Latest Arrival
                </label>
                <div className="relative">
                  <select
                    value={checkInWindowEnd}
                    onChange={(e) => setCheckInWindowEnd(e.target.value)}
                    disabled={!checkInWindowEnabled}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border-2",
                      "bg-slate-800/50 border-slate-700",
                      "text-white font-medium",
                      "focus:border-emerald-500 focus:outline-none",
                      "appearance-none cursor-pointer",
                      "transition-colors",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {allDayTimes.map((time) => (
                      <option key={time.value} value={time.value}>
                        {time.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Info */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/30 border border-slate-700 rounded-lg p-4"
        >
          <p className="text-sm text-slate-400">
            <span className="text-slate-300 font-medium">
              You can change these later in settings.
            </span>{" "}
            These hours will be displayed to guests and help manage their
            expectations during the booking process.
          </p>
        </motion.div>

        {/* Continue button */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
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
