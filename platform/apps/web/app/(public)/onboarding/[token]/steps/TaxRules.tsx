"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Receipt,
  Plus,
  Trash2,
  Percent,
  DollarSign,
  X,
  Check,
  Info,
  ChevronRight,
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

export interface TaxRuleInput {
  name: string;
  type: "percentage" | "flat";
  rate: number;
}

interface TaxRulesProps {
  initialRules?: TaxRuleInput[];
  onSave: (rules: TaxRuleInput[]) => Promise<void>;
  onSkip: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

// Common tax presets
const TAX_PRESETS: TaxRuleInput[] = [
  { name: "State Lodging Tax", type: "percentage", rate: 6 },
  { name: "Local Tourism Tax", type: "percentage", rate: 2 },
  { name: "County Tax", type: "percentage", rate: 1.5 },
  { name: "Resort Fee", type: "flat", rate: 5 },
];

const taxTypeValues: TaxRuleInput["type"][] = ["percentage", "flat"];

const isTaxType = (value: string): value is TaxRuleInput["type"] =>
  taxTypeValues.some((option) => option === value);

export function TaxRules({
  initialRules = [],
  onSave,
  onSkip,
  onNext,
  isLoading = false,
}: TaxRulesProps) {
  const prefersReducedMotion = useReducedMotion();
  const [rules, setRules] = useState<TaxRuleInput[]>(initialRules);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // New rule form state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"percentage" | "flat">("percentage");
  const [newRate, setNewRate] = useState("");

  const addPreset = (preset: TaxRuleInput) => {
    // Don't add duplicates
    if (rules.some((r) => r.name === preset.name)) return;
    setRules((prev) => [...prev, preset]);
  };

  const addCustomRule = () => {
    if (!newName.trim() || !newRate) return;
    setRules((prev) => [
      ...prev,
      {
        name: newName.trim(),
        type: newType,
        rate: parseFloat(newRate),
      },
    ]);
    // Reset form
    setNewName("");
    setNewType("percentage");
    setNewRate("");
    setShowAddForm(false);
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRuleRate = (index: number, newRate: number) => {
    setRules((prev) => prev.map((rule, i) => (i === index ? { ...rule, rate: newRate } : rule)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(rules);
      onNext();
    } catch (error) {
      console.error("Failed to save tax rules:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    onSkip();
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/20 mb-4">
            <Receipt className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Tax Configuration</h2>
          <p className="text-slate-400">Add lodging taxes that apply to reservations</p>
        </motion.div>

        {/* Quick add presets */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="space-y-3"
        >
          <Label className="text-sm text-slate-400">Quick Add</Label>
          <div className="flex flex-wrap gap-2">
            {TAX_PRESETS.map((preset) => {
              const isAdded = rules.some((r) => r.name === preset.name);
              return (
                <button
                  key={preset.name}
                  onClick={() => addPreset(preset)}
                  disabled={isAdded}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    "border",
                    isAdded
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800",
                  )}
                >
                  {isAdded ? (
                    <Check className="w-3.5 h-3.5 inline-block mr-1.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 inline-block mr-1.5" />
                  )}
                  {preset.name} (
                  {preset.type === "percentage" ? `${preset.rate}%` : `$${preset.rate}`})
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Current rules */}
        {rules.length > 0 && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1 }}
            className="space-y-3"
          >
            <Label className="text-sm text-slate-400">Your Tax Rules ({rules.length})</Label>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {rules.map((rule, index) => (
                  <motion.div
                    key={`${rule.name}-${index}`}
                    initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
                    animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
                    exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-3 p-3 bg-slate-800/30 border border-slate-700 rounded-lg"
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        rule.type === "percentage" ? "bg-blue-500/20" : "bg-green-500/20",
                      )}
                    >
                      {rule.type === "percentage" ? (
                        <Percent className="w-4 h-4 text-blue-400" />
                      ) : (
                        <DollarSign className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">{rule.name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {rule.type === "flat" && <span className="text-slate-400">$</span>}
                      <input
                        type="number"
                        min="0"
                        step={rule.type === "percentage" ? "0.1" : "0.01"}
                        value={rule.rate}
                        onChange={(e) => updateRuleRate(index, parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-right font-medium text-white bg-slate-700/50 border border-slate-600 rounded focus:border-emerald-500 focus:outline-none"
                      />
                      {rule.type === "percentage" && <span className="text-slate-400">%</span>}
                    </div>
                    <button
                      onClick={() => removeRule(index)}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Add custom rule */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.25 }}
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
                Add Custom Tax Rule
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
                  <h3 className="font-medium text-white">Add Custom Tax</h3>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="p-1 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label className="text-sm text-slate-300">Tax Name</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g., City Occupancy Tax"
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-slate-300">Type</Label>
                    <Select
                      value={newType}
                      onValueChange={(v) => {
                        if (isTaxType(v)) {
                          setNewType(v);
                        }
                      }}
                    >
                      <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="flat">Flat Amount ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-slate-300">
                      {newType === "percentage" ? "Rate (%)" : "Amount ($)"}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step={newType === "percentage" ? "0.1" : "0.01"}
                      value={newRate}
                      onChange={(e) => setNewRate(e.target.value)}
                      placeholder={newType === "percentage" ? "7.5" : "5.00"}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <Button
                  onClick={addCustomRule}
                  disabled={!newName.trim() || !newRate}
                  className="w-full bg-emerald-600 hover:bg-emerald-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tax Rule
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Info box */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 flex gap-3"
        >
          <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-400">
            <span className="text-slate-300 font-medium">No taxes? That's okay!</span> You can skip
            this step and add tax rules later. Advanced options like long-stay exemptions are
            available in your dashboard.
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
              {saving ? "Saving..." : `Save ${rules.length} Tax Rule${rules.length > 1 ? "s" : ""}`}
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

          {rules.length > 0 && (
            <button
              onClick={handleSkip}
              className="w-full text-center text-sm text-slate-500 hover:text-slate-400 transition-colors"
            >
              Skip and add these later
            </button>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
