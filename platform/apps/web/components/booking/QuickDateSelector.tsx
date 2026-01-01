"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Calendar, Sun, Sunrise, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickDateSelectorProps {
  onSelectDates: (arrivalDate: string, departureDate: string) => void;
  selectedArrival?: string;
  selectedDeparture?: string;
  className?: string;
}

interface QuickOption {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  getArrival: () => Date;
  getDeparture: () => Date;
  highlight?: boolean;
}

// Helper functions
function getNextFriday(from: Date = new Date()): Date {
  const date = new Date(from);
  const day = date.getDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilFriday);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getNextSaturday(from: Date = new Date()): Date {
  const date = new Date(from);
  const day = date.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilSaturday);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function QuickDateSelector({
  onSelectDates,
  selectedArrival,
  selectedDeparture,
  className
}: QuickDateSelectorProps) {
  const prefersReducedMotion = useReducedMotion();

  const options = useMemo<QuickOption[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = addDays(today, 1);
    const thisFriday = getNextFriday(today);
    const thisSaturday = getNextSaturday(today);
    const nextFriday = getNextFriday(addDays(thisFriday, 1));
    const nextSaturday = getNextSaturday(addDays(thisSaturday, 1));

    // Check if this weekend is still available (today is before Friday)
    const isWeekendAvailable = today < thisFriday;

    return [
      // Tonight (if before 2pm)
      ...(today.getHours() < 14
        ? [
            {
              id: "tonight",
              label: "Tonight",
              sublabel: `${formatShortDate(today)} - ${formatShortDate(tomorrow)}`,
              icon: <Sunrise className="h-4 w-4" />,
              getArrival: () => today,
              getDeparture: () => tomorrow,
              highlight: true,
            },
          ]
        : []),

      // This Weekend
      ...(isWeekendAvailable
        ? [
            {
              id: "this-weekend",
              label: "This Weekend",
              sublabel: `${formatShortDate(thisFriday)} - ${formatShortDate(addDays(thisFriday, 2))}`,
              icon: <Sun className="h-4 w-4" />,
              getArrival: () => thisFriday,
              getDeparture: () => addDays(thisFriday, 2),
              highlight: true,
            },
          ]
        : []),

      // Next Weekend
      {
        id: "next-weekend",
        label: isWeekendAvailable ? "Next Weekend" : "This Weekend",
        sublabel: `${formatShortDate(isWeekendAvailable ? nextFriday : thisFriday)} - ${formatShortDate(
          addDays(isWeekendAvailable ? nextFriday : thisFriday, 2)
        )}`,
        icon: <Calendar className="h-4 w-4" />,
        getArrival: () => (isWeekendAvailable ? nextFriday : thisFriday),
        getDeparture: () => addDays(isWeekendAvailable ? nextFriday : thisFriday, 2),
      },

      // Week-long trip
      {
        id: "week-trip",
        label: "Full Week",
        sublabel: `${formatShortDate(thisSaturday)} - ${formatShortDate(addDays(thisSaturday, 7))}`,
        icon: <Sparkles className="h-4 w-4" />,
        getArrival: () => thisSaturday,
        getDeparture: () => addDays(thisSaturday, 7),
      },

      // 3-day weekend
      {
        id: "long-weekend",
        label: "Long Weekend",
        sublabel: `${formatShortDate(thisFriday)} - ${formatShortDate(addDays(thisFriday, 3))}`,
        icon: <Clock className="h-4 w-4" />,
        getArrival: () => thisFriday,
        getDeparture: () => addDays(thisFriday, 3),
      },
    ];
  }, []);

  const handleSelect = (option: QuickOption) => {
    const arrival = option.getArrival();
    const departure = option.getDeparture();
    onSelectDates(formatDateISO(arrival), formatDateISO(departure));
  };

  const isSelected = (option: QuickOption) => {
    const arrival = formatDateISO(option.getArrival());
    const departure = formatDateISO(option.getDeparture());
    return selectedArrival === arrival && selectedDeparture === departure;
  };

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-sm font-medium text-slate-700">Quick Select</p>

      <div className="flex flex-wrap gap-2">
        {options.map((option, idx) => (
          <motion.button
            key={option.id}
            type="button"
            onClick={() => handleSelect(option)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
              isSelected(option)
                ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                : option.highlight
                ? "bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400"
                : "bg-white border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            )}
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
          >
            <span
              className={cn(
                isSelected(option)
                  ? "text-emerald-600"
                  : option.highlight
                  ? "text-amber-600"
                  : "text-slate-400"
              )}
            >
              {option.icon}
            </span>
            <span>{option.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Show selected dates preview */}
      {selectedArrival && selectedDeparture && (
        <motion.div
          className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg"
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
        >
          <Calendar className="h-4 w-4 text-emerald-600" />
          <span>
            {new Date(selectedArrival + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
            {" - "}
            {new Date(selectedDeparture + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="text-slate-400">
            ({Math.ceil((new Date(selectedDeparture).getTime() - new Date(selectedArrival).getTime()) / (1000 * 60 * 60 * 24))} nights)
          </span>
        </motion.div>
      )}
    </div>
  );
}

// Compact version for inline use
export function QuickDateButtons({
  onSelectDates,
  className
}: {
  onSelectDates: (arrivalDate: string, departureDate: string) => void;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  const quickOptions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisFriday = getNextFriday(today);
    const nextFriday = getNextFriday(addDays(thisFriday, 1));
    const isWeekendAvailable = today < thisFriday;

    return [
      {
        label: "This Weekend",
        arrival: isWeekendAvailable ? thisFriday : nextFriday,
        nights: 2,
      },
      {
        label: "Next Weekend",
        arrival: isWeekendAvailable ? nextFriday : getNextFriday(addDays(nextFriday, 1)),
        nights: 2,
      },
      {
        label: "Week Trip",
        arrival: getNextSaturday(today),
        nights: 7,
      },
    ];
  }, []);

  return (
    <div className={cn("flex gap-2 flex-wrap", className)}>
      {quickOptions.map((option, idx) => (
        <motion.button
          key={option.label}
          type="button"
          onClick={() =>
            onSelectDates(
              formatDateISO(option.arrival),
              formatDateISO(addDays(option.arrival, option.nights))
            )
          }
          className="px-2 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: idx * 0.05 }}
        >
          {option.label}
        </motion.button>
      ))}
    </div>
  );
}
