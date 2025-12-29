"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Calendar,
  Plus,
  Trash2,
  X,
  Check,
  Info,
  ChevronRight,
  Edit2,
  Sun,
  Cloud,
  Snowflake,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface DateRange {
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string; // ISO date string (YYYY-MM-DD)
}

export interface RatePeriod {
  id: string;
  name: string;
  icon?: string; // emoji
  dateRanges: DateRange[];
  isDefault?: boolean; // "Off Season" catches all unspecified dates
}

interface RatePeriodsProps {
  periods: RatePeriod[];
  onChange: (periods: RatePeriod[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

// Default periods to help users get started
const DEFAULT_PERIODS: Omit<RatePeriod, "id">[] = [
  {
    name: "Peak Season",
    icon: "sun",
    dateRanges: [
      { startDate: "2025-05-25", endDate: "2025-09-02" },
    ],
    isDefault: false,
  },
  {
    name: "Shoulder Season",
    icon: "leaf",
    dateRanges: [
      { startDate: "2025-04-15", endDate: "2025-05-24" },
      { startDate: "2025-09-03", endDate: "2025-10-15" },
    ],
    isDefault: false,
  },
  {
    name: "Holidays",
    icon: "gift",
    dateRanges: [
      { startDate: "2025-11-27", endDate: "2025-11-30" }, // Thanksgiving
      { startDate: "2025-12-20", endDate: "2026-01-02" }, // Christmas/New Year
      { startDate: "2025-07-03", endDate: "2025-07-06" }, // July 4th
      { startDate: "2025-05-24", endDate: "2025-05-26" }, // Memorial Day
      { startDate: "2025-08-30", endDate: "2025-09-01" }, // Labor Day
    ],
    isDefault: false,
  },
  {
    name: "Off Season",
    icon: "snowflake",
    dateRanges: [],
    isDefault: true,
  },
];

// Generate unique ID
function generateId(): string {
  return `period_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Date Range Editor Component
function DateRangeEditor({
  range,
  onChange,
  onRemove,
  canRemove,
}: {
  range: DateRange;
  onChange: (range: DateRange) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
      exit={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
      className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg"
    >
      <div className="flex-1 grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">Start Date</Label>
          <Input
            type="date"
            value={range.startDate}
            onChange={(e) => onChange({ ...range, startDate: e.target.value })}
            className="bg-slate-800/50 border-slate-600 text-white text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">End Date</Label>
          <Input
            type="date"
            value={range.endDate}
            onChange={(e) => onChange({ ...range, endDate: e.target.value })}
            className="bg-slate-800/50 border-slate-600 text-white text-sm"
          />
        </div>
      </div>
      {canRemove && (
        <button
          onClick={onRemove}
          className="p-2 text-slate-500 hover:text-red-400 transition-colors self-end"
          aria-label="Remove date range"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}

// Period Card Component
function PeriodCard({
  period,
  onUpdate,
  onRemove,
  canRemove,
}: {
  period: RatePeriod;
  onUpdate: (period: RatePeriod) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(period.name);

  const handleNameSave = () => {
    if (editedName.trim()) {
      onUpdate({ ...period, name: editedName.trim() });
      setIsEditing(false);
    }
  };

  const handleNameCancel = () => {
    setEditedName(period.name);
    setIsEditing(false);
  };

  const addDateRange = () => {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    onUpdate({
      ...period,
      dateRanges: [...period.dateRanges, { startDate: today, endDate: tomorrow }],
    });
  };

  const updateDateRange = (index: number, newRange: DateRange) => {
    const newRanges = [...period.dateRanges];
    newRanges[index] = newRange;
    onUpdate({ ...period, dateRanges: newRanges });
  };

  const removeDateRange = (index: number) => {
    onUpdate({
      ...period,
      dateRanges: period.dateRanges.filter((_, i) => i !== index),
    });
  };

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
      transition={SPRING_CONFIG}
      className="bg-slate-800/30 border border-slate-700 rounded-xl p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="text-2xl">
            {period.icon === "sun" && <Sun className="w-6 h-6 text-amber-500" />}
            {period.icon === "leaf" && <Cloud className="w-6 h-6 text-orange-500" />}
            {period.icon === "snowflake" && <Snowflake className="w-6 h-6 text-blue-400" />}
            {period.icon === "gift" && <Sparkles className="w-6 h-6 text-purple-500" />}
            {!period.icon && <Calendar className="w-6 h-6 text-slate-400" />}
          </div>
          {isEditing ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNameSave();
                  if (e.key === "Escape") handleNameCancel();
                }}
                className="bg-slate-800/50 border-slate-600 text-white font-medium"
                autoFocus
              />
              <Button
                size="sm"
                onClick={handleNameSave}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleNameCancel}
                className="border-slate-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-lg">{period.name}</h3>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Edit period name"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        {canRemove && !period.isDefault && (
          <button
            onClick={onRemove}
            className="p-2 text-slate-500 hover:text-red-400 transition-colors"
            aria-label="Delete period"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Default period indicator */}
      {period.isDefault && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <p className="text-sm text-blue-300">
            This is your default period. It automatically applies to all dates not covered by other periods.
          </p>
        </div>
      )}

      {/* Date ranges */}
      {!period.isDefault && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-slate-400">
              Date Ranges ({period.dateRanges.length})
            </Label>
            <Button
              size="sm"
              variant="outline"
              onClick={addDateRange}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Range
            </Button>
          </div>

          <AnimatePresence mode="popLayout">
            {period.dateRanges.length > 0 ? (
              period.dateRanges.map((range, index) => (
                <DateRangeEditor
                  key={`${period.id}-range-${index}`}
                  range={range}
                  onChange={(newRange) => updateDateRange(index, newRange)}
                  onRemove={() => removeDateRange(index)}
                  canRemove={period.dateRanges.length > 1}
                />
              ))
            ) : (
              <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0 }}
                animate={prefersReducedMotion ? {} : { opacity: 1 }}
                className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-700 rounded-lg"
              >
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No date ranges yet</p>
                <p className="text-xs">Click "Add Range" to define dates for this period</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

// Add New Period Form
function AddPeriodForm({
  onAdd,
  onCancel,
}: {
  onAdd: (period: Omit<RatePeriod, "id">) => void;
  onCancel: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("calendar");

  const handleAdd = () => {
    if (name.trim()) {
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      onAdd({
        name: name.trim(),
        icon,
        dateRanges: [{ startDate: today, endDate: tomorrow }],
        isDefault: false,
      });
      setName("");
      setIcon("calendar");
    }
  };

  const iconOptions = ["calendar", "sun", "leaf", "snowflake", "gift"];

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? {} : { opacity: 0, y: -10 }}
      className="bg-slate-800/30 border border-slate-700 rounded-xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-white">Add New Period</h3>
        <button
          onClick={onCancel}
          className="p-1 text-slate-500 hover:text-slate-300"
          aria-label="Cancel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm text-slate-300">Period Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Holiday Weekends, Spring Break"
            className="bg-slate-800/50 border-slate-700 text-white"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-slate-300">Icon</Label>
          <div className="flex gap-2 flex-wrap">
            {iconOptions.map((iconName) => (
              <button
                key={iconName}
                onClick={() => setIcon(iconName)}
                className={cn(
                  "w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center",
                  icon === iconName
                    ? "border-emerald-500 bg-emerald-500/20"
                    : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                )}
              >
                {iconName === "calendar" && <Calendar className="w-5 h-5 text-slate-300" />}
                {iconName === "sun" && <Sun className="w-5 h-5 text-amber-400" />}
                {iconName === "leaf" && <Cloud className="w-5 h-5 text-orange-400" />}
                {iconName === "snowflake" && <Snowflake className="w-5 h-5 text-blue-400" />}
                {iconName === "gift" && <Sparkles className="w-5 h-5 text-purple-400" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1 border-slate-700 text-slate-300"
        >
          Cancel
        </Button>
        <Button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Period
        </Button>
      </div>
    </motion.div>
  );
}

export function RatePeriods({
  periods: initialPeriods,
  onChange,
  onNext,
  onBack,
}: RatePeriodsProps) {
  const prefersReducedMotion = useReducedMotion();
  const [periods, setPeriods] = useState<RatePeriod[]>(() => {
    // Initialize with default periods if none provided
    if (initialPeriods.length === 0) {
      return DEFAULT_PERIODS.map((p) => ({ ...p, id: generateId() }));
    }
    return initialPeriods;
  });
  const [showAddForm, setShowAddForm] = useState(false);

  const handlePeriodUpdate = (id: string, updatedPeriod: RatePeriod) => {
    const newPeriods = periods.map((p) => (p.id === id ? updatedPeriod : p));
    setPeriods(newPeriods);
    onChange(newPeriods);
  };

  const handlePeriodRemove = (id: string) => {
    const newPeriods = periods.filter((p) => p.id !== id);
    setPeriods(newPeriods);
    onChange(newPeriods);
  };

  const handlePeriodAdd = (newPeriod: Omit<RatePeriod, "id">) => {
    const periodWithId = { ...newPeriod, id: generateId() };
    const newPeriods = [...periods, periodWithId];
    setPeriods(newPeriods);
    onChange(newPeriods);
    setShowAddForm(false);
  };

  const handleSkip = () => {
    // Clear all non-default periods when skipping
    const defaultOnly = periods.filter((p) => p.isDefault);
    if (defaultOnly.length === 0) {
      // Ensure at least one default period exists
      const offSeasonPeriod: RatePeriod = {
        id: generateId(),
        name: "Standard Rate",
        icon: "calendar",
        dateRanges: [],
        isDefault: true,
      };
      onChange([offSeasonPeriod]);
    } else {
      onChange(defaultOnly);
    }
    onNext();
  };

  const handleContinue = () => {
    onChange(periods);
    onNext();
  };

  // Count non-default periods
  const customPeriodsCount = periods.filter((p) => !p.isDefault).length;
  const hasCustomPeriods = customPeriodsCount > 0;

  return (
    <div className="max-w-3xl">
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/20 mb-4">
            <Calendar className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Rate Periods & Seasons
          </h2>
          <p className="text-slate-400">
            Define pricing seasons like Peak, Shoulder, and Off-Season
          </p>
        </motion.div>

        {/* Info box */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 flex gap-3"
        >
          <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-400">
            <span className="text-slate-300 font-medium">
              How it works:
            </span>{" "}
            Create seasonal periods (like Peak Season) and set different rates for each.
            Any dates not covered by specific periods will use your default rate.
          </div>
        </motion.div>

        {/* Periods List */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <Label className="text-sm text-slate-400">
              Your Periods ({periods.length})
            </Label>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {periods.map((period) => (
                <PeriodCard
                  key={period.id}
                  period={period}
                  onUpdate={(updated) => handlePeriodUpdate(period.id, updated)}
                  onRemove={() => handlePeriodRemove(period.id)}
                  canRemove={!period.isDefault}
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Add New Period */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <AnimatePresence mode="wait">
            {!showAddForm ? (
              <motion.button
                key="add-button"
                onClick={() => setShowAddForm(true)}
                initial={prefersReducedMotion ? {} : { opacity: 0 }}
                animate={prefersReducedMotion ? {} : { opacity: 1 }}
                exit={prefersReducedMotion ? {} : { opacity: 0 }}
                className="w-full p-4 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-slate-300 hover:border-slate-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Custom Period
              </motion.button>
            ) : (
              <AddPeriodForm
                key="add-form"
                onAdd={handlePeriodAdd}
                onCancel={() => setShowAddForm(false)}
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3 pt-4"
        >
          <Button
            onClick={handleContinue}
            className={cn(
              "w-full py-6 text-lg font-semibold transition-all",
              "bg-gradient-to-r from-emerald-500 to-teal-500",
              "hover:from-emerald-400 hover:to-teal-400"
            )}
          >
            {hasCustomPeriods
              ? `Continue with ${customPeriodsCount} Period${customPeriodsCount > 1 ? "s" : ""}`
              : "Continue with Default Rate"}
          </Button>

          <div className="flex gap-3">
            <Button
              onClick={onBack}
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Back
            </Button>
            <Button
              onClick={handleSkip}
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Skip for Now
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {hasCustomPeriods && (
            <p className="text-center text-xs text-slate-500">
              You can adjust rates for each period in the next step
            </p>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
