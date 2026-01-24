"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  RotateCcw,
  Plus,
  Trash2,
  DollarSign,
  Percent,
  Moon,
  Ban,
  X,
  Check,
  Info,
  ChevronRight,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type PresetIcon = typeof Sparkles;

export interface CancellationRule {
  id: string;
  daysBeforeArrival: number; // threshold
  feeType: "flat" | "percent" | "nights" | "full";
  feeAmount: number; // cents for flat, percentage for percent, nights count for nights
  appliesTo?: string[]; // site class IDs, or empty for all
}

interface CancellationRulesProps {
  rules: CancellationRule[];
  onChange: (rules: CancellationRule[]) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  siteClasses?: { id: string; name: string }[];
  isLoading?: boolean;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

// Preset cancellation policies
const POLICY_PRESETS: Array<{
  id: string;
  name: string;
  description: string;
  icon: PresetIcon;
  color: string;
  recommended?: boolean;
  rules: CancellationRule[];
}> = [
  {
    id: "flexible",
    name: "Flexible",
    description: "Full refund up to 24 hours before arrival",
    icon: Sparkles,
    color: "emerald",
    rules: [
      {
        id: crypto.randomUUID(),
        daysBeforeArrival: 1,
        feeType: "flat",
        feeAmount: 0,
      },
      {
        id: crypto.randomUUID(),
        daysBeforeArrival: 0,
        feeType: "full",
        feeAmount: 0,
      },
    ],
  },
  {
    id: "moderate",
    name: "Moderate",
    description: "Full refund 7+ days, 50% within 7 days",
    icon: Moon,
    color: "blue",
    recommended: true,
    rules: [
      {
        id: crypto.randomUUID(),
        daysBeforeArrival: 7,
        feeType: "flat",
        feeAmount: 0,
      },
      {
        id: crypto.randomUUID(),
        daysBeforeArrival: 0,
        feeType: "percent",
        feeAmount: 50,
      },
    ],
  },
  {
    id: "strict",
    name: "Strict",
    description: "Full refund 30+ days, first night 7-30 days, no refund under 7",
    icon: Ban,
    color: "amber",
    rules: [
      {
        id: crypto.randomUUID(),
        daysBeforeArrival: 30,
        feeType: "flat",
        feeAmount: 0,
      },
      {
        id: crypto.randomUUID(),
        daysBeforeArrival: 7,
        feeType: "nights",
        feeAmount: 1,
      },
      {
        id: crypto.randomUUID(),
        daysBeforeArrival: 0,
        feeType: "full",
        feeAmount: 0,
      },
    ],
  },
];

const FEE_TYPE_LABELS: Record<CancellationRule["feeType"], string> = {
  flat: "Flat Fee",
  percent: "Percentage",
  nights: "Nights Forfeited",
  full: "No Refund",
};

const FEE_TYPE_ICONS: Record<CancellationRule["feeType"], PresetIcon> = {
  flat: DollarSign,
  percent: Percent,
  nights: Moon,
  full: Ban,
};

const feeTypeValues: CancellationRule["feeType"][] = ["flat", "percent", "nights", "full"];

const isFeeType = (value: string): value is CancellationRule["feeType"] =>
  feeTypeValues.some((option) => option === value);

export function CancellationRules({
  rules,
  onChange,
  onNext,
  onBack,
  onSkip,
  siteClasses = [],
  isLoading = false,
}: CancellationRulesProps) {
  const prefersReducedMotion = useReducedMotion();
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [isCustom, setIsCustom] = useState(rules.length > 0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  // New rule form state
  const [newDays, setNewDays] = useState("");
  const [newFeeType, setNewFeeType] = useState<CancellationRule["feeType"]>("percent");
  const [newFeeAmount, setNewFeeAmount] = useState("");
  const [newAppliesTo, setNewAppliesTo] = useState<string[]>([]);

  const handlePresetSelect = (presetId: string) => {
    const preset = POLICY_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setSelectedPreset(presetId);
    setIsCustom(false);
    onChange(preset.rules);
  };

  const handleCustomize = () => {
    setIsCustom(true);
    setSelectedPreset(null);
    if (rules.length === 0) {
      // Start with moderate preset as template
      const moderate = POLICY_PRESETS.find((p) => p.id === "moderate");
      if (moderate) {
        onChange(moderate.rules);
      }
    }
  };

  const addCustomRule = () => {
    if (!newDays) return;

    const newRule: CancellationRule = {
      id: crypto.randomUUID(),
      daysBeforeArrival: parseInt(newDays),
      feeType: newFeeType,
      feeAmount:
        newFeeType === "full"
          ? 0
          : newFeeType === "flat"
            ? Math.round(parseFloat(newFeeAmount || "0") * 100) // Convert to cents
            : parseFloat(newFeeAmount || "0"),
      appliesTo: newAppliesTo.length > 0 ? newAppliesTo : undefined,
    };

    onChange([...rules, newRule].sort((a, b) => b.daysBeforeArrival - a.daysBeforeArrival));

    // Reset form
    setNewDays("");
    setNewFeeType("percent");
    setNewFeeAmount("");
    setNewAppliesTo([]);
    setShowAddForm(false);
  };

  const removeRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
  };

  const updateRule = (id: string, updates: Partial<CancellationRule>) => {
    onChange(
      rules
        .map((rule) => (rule.id === id ? { ...rule, ...updates } : rule))
        .sort((a, b) => b.daysBeforeArrival - a.daysBeforeArrival),
    );
  };

  const formatFeeDisplay = (rule: CancellationRule) => {
    switch (rule.feeType) {
      case "flat":
        return `$${(rule.feeAmount / 100).toFixed(2)} fee`;
      case "percent":
        return `${rule.feeAmount}% refund`;
      case "nights":
        return `${rule.feeAmount} night${rule.feeAmount > 1 ? "s" : ""} forfeited`;
      case "full":
        return "No refund";
      default:
        return "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validation done, proceed
      await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate save
      onNext();
    } catch (error) {
      console.error("Failed to save cancellation rules:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onNext();
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/20 mb-4">
            <RotateCcw className="w-8 h-8 text-rose-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Cancellation Policy</h2>
          <p className="text-slate-400">Set tiered refund rules based on cancellation timing</p>
        </motion.div>

        {/* Preset selection */}
        {!isCustom && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="space-y-3"
          >
            <Label className="text-sm text-slate-400">Choose a Policy</Label>
            <div className="space-y-3">
              {POLICY_PRESETS.map((preset, i) => {
                const isSelected = selectedPreset === preset.id;
                const Icon = preset.icon;

                return (
                  <motion.button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset.id)}
                    initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
                    animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
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
                    {preset.recommended && (
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
                          className={cn(
                            "w-6 h-6",
                            isSelected ? "text-emerald-400" : "text-slate-400",
                          )}
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
                            {preset.name}
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

                        <p className="text-slate-400 mt-1">{preset.description}</p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <button
              onClick={handleCustomize}
              className="w-full mt-3 p-3 border border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-slate-300 hover:border-slate-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Build Custom Policy
            </button>
          </motion.div>
        )}

        {/* Custom policy builder */}
        {isCustom && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm text-slate-400">
                Your Cancellation Tiers ({rules.length})
              </Label>
              {rules.length > 0 && (
                <button
                  onClick={() => {
                    setIsCustom(false);
                    onChange([]);
                    setSelectedPreset(null);
                  }}
                  className="text-sm text-slate-500 hover:text-slate-300"
                >
                  Switch to presets
                </button>
              )}
            </div>

            {/* Current tiers */}
            {rules.length > 0 && (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {rules.map((rule, index) => {
                    const Icon = FEE_TYPE_ICONS[rule.feeType];
                    return (
                      <motion.div
                        key={rule.id}
                        initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
                        animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
                        exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
                        className="p-4 bg-slate-800/30 border border-slate-700 rounded-lg space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-rose-400" />
                          </div>

                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-white">
                                  {rule.daysBeforeArrival === 0
                                    ? "Less than 1 day before arrival"
                                    : rule.daysBeforeArrival === 1
                                      ? "1 day before arrival"
                                      : `${rule.daysBeforeArrival}+ days before arrival`}
                                </p>
                                <p className="text-sm text-slate-400 mt-0.5">
                                  {formatFeeDisplay(rule)}
                                </p>
                              </div>
                              <button
                                onClick={() => removeRule(rule.id)}
                                className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Editable fields */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Days Before</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={rule.daysBeforeArrival}
                                  onChange={(e) =>
                                    updateRule(rule.id, {
                                      daysBeforeArrival: parseInt(e.target.value) || 0,
                                    })
                                  }
                                  className="bg-slate-800/50 border-slate-700 text-white h-9"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Fee Type</Label>
                                <Select
                                  value={rule.feeType}
                                  onValueChange={(v) =>
                                    updateRule(rule.id, {
                                      feeType: isFeeType(v) ? v : rule.feeType,
                                      feeAmount: v === "full" ? 0 : rule.feeAmount,
                                    })
                                  }
                                >
                                  <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="flat">Flat Fee ($)</SelectItem>
                                    <SelectItem value="percent">Percentage (%)</SelectItem>
                                    <SelectItem value="nights">Nights Forfeited</SelectItem>
                                    <SelectItem value="full">No Refund</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {rule.feeType !== "full" && (
                                <div className="col-span-2 space-y-1.5">
                                  <Label className="text-xs text-slate-400">
                                    {rule.feeType === "flat"
                                      ? "Amount ($)"
                                      : rule.feeType === "percent"
                                        ? "Percentage"
                                        : "Number of Nights"}
                                  </Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step={rule.feeType === "flat" ? "0.01" : "1"}
                                    value={
                                      rule.feeType === "flat"
                                        ? (rule.feeAmount / 100).toFixed(2)
                                        : rule.feeAmount
                                    }
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      updateRule(rule.id, {
                                        feeAmount:
                                          rule.feeType === "flat" ? Math.round(val * 100) : val,
                                      });
                                    }}
                                    className="bg-slate-800/50 border-slate-700 text-white h-9"
                                  />
                                </div>
                              )}
                            </div>

                            {rule.appliesTo && rule.appliesTo.length > 0 && (
                              <div className="text-xs text-slate-500">
                                Applies to:{" "}
                                {rule.appliesTo
                                  .map(
                                    (id) =>
                                      siteClasses.find((sc) => sc.id === id)?.name || "Unknown",
                                  )
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {/* Add tier button/form */}
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
                  Add Tier
                </motion.button>
              ) : (
                <motion.div
                  key="add-form"
                  initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? {} : { opacity: 0, y: -10 }}
                  className="bg-slate-800/30 border border-slate-700 rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-white">Add Cancellation Tier</h3>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="p-1 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-300">Days Before Arrival</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newDays}
                        onChange={(e) => setNewDays(e.target.value)}
                        placeholder="e.g., 7"
                        className="bg-slate-800/50 border-slate-700 text-white"
                      />
                      <p className="text-xs text-slate-500">Minimum days before check-in</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-slate-300">Fee Type</Label>
                      <Select
                        value={newFeeType}
                        onValueChange={(v) => {
                          if (isFeeType(v)) {
                            setNewFeeType(v);
                          }
                          if (v === "full") setNewFeeAmount("0");
                        }}
                      >
                        <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Flat Fee ($)</SelectItem>
                          <SelectItem value="percent">Percentage (%)</SelectItem>
                          <SelectItem value="nights">Nights Forfeited</SelectItem>
                          <SelectItem value="full">No Refund</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {newFeeType !== "full" && (
                      <div className="col-span-2 space-y-2">
                        <Label className="text-sm text-slate-300">
                          {newFeeType === "flat"
                            ? "Fee Amount ($)"
                            : newFeeType === "percent"
                              ? "Refund Percentage (%)"
                              : "Number of Nights"}
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step={newFeeType === "flat" ? "0.01" : "1"}
                          value={newFeeAmount}
                          onChange={(e) => setNewFeeAmount(e.target.value)}
                          placeholder={
                            newFeeType === "flat" ? "25.00" : newFeeType === "percent" ? "50" : "1"
                          }
                          className="bg-slate-800/50 border-slate-700 text-white"
                        />
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={addCustomRule}
                    disabled={!newDays || (newFeeType !== "full" && !newFeeAmount)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Tier
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Advanced: Different rules per site type */}
        {isCustom && siteClasses.length > 0 && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700 rounded-lg text-left hover:border-slate-600 transition-colors"
            >
              <div>
                <p className="font-medium text-white">Advanced Options</p>
                <p className="text-sm text-slate-500">Set different rules per site type</p>
              </div>
              <ChevronDown
                className={cn(
                  "w-5 h-5 text-slate-400 transition-transform",
                  showAdvanced && "rotate-180",
                )}
              />
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 p-4 bg-slate-800/30 border border-slate-700 rounded-lg space-y-4">
                    <p className="text-sm text-slate-400">
                      Apply site-specific rules by selecting which site types each tier applies to.
                      Leave all unchecked to apply to all sites.
                    </p>

                    {rules.map((rule) => (
                      <div key={rule.id} className="border-t border-slate-700 pt-3">
                        <p className="text-sm font-medium text-white mb-2">
                          {rule.daysBeforeArrival}+ days: {formatFeeDisplay(rule)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {siteClasses.map((sc) => {
                            const isApplied = rule.appliesTo?.includes(sc.id) ?? false;
                            return (
                              <button
                                key={sc.id}
                                type="button"
                                onClick={() => {
                                  const current = rule.appliesTo || [];
                                  const newAppliesTo = isApplied
                                    ? current.filter((id) => id !== sc.id)
                                    : [...current, sc.id];
                                  updateRule(rule.id, {
                                    appliesTo: newAppliesTo.length > 0 ? newAppliesTo : undefined,
                                  });
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                                  isApplied
                                    ? "bg-rose-500 text-white"
                                    : "bg-slate-700 text-slate-300 hover:bg-slate-600",
                                )}
                              >
                                {sc.name}
                              </button>
                            );
                          })}
                        </div>
                        {(!rule.appliesTo || rule.appliesTo.length === 0) && (
                          <p className="text-xs text-slate-500 mt-1">Applies to all site types</p>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Info box */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 flex gap-3"
        >
          <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-400">
            <span className="text-slate-300 font-medium">How tiers work:</span> Rules apply based on
            when the guest cancels. The system automatically selects the appropriate tier based on
            days remaining until check-in.
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          {rules.length > 0 ? (
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
              {saving ? "Saving..." : "Save Cancellation Policy"}
            </Button>
          ) : (
            <Button
              onClick={handleSkip}
              variant="outline"
              className="w-full py-6 text-lg font-medium border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Skip for Now
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          )}

          {rules.length > 0 && onSkip && (
            <button
              onClick={handleSkip}
              className="w-full text-center text-sm text-slate-500 hover:text-slate-400 transition-colors"
            >
              Skip for now
            </button>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
