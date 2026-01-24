"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DollarSign, Check, Tent, Truck, Home, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SiteClassRate {
  id: string;
  name: string;
  siteType: string;
  defaultRate: number; // in cents from API
}

interface RateInput {
  siteClassId: string;
  nightlyRate: number; // in dollars for display
}

interface RatesSetupProps {
  siteClasses: SiteClassRate[];
  onSave: (rates: RateInput[]) => Promise<void>;
  onNext: () => void;
  isLoading?: boolean;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

const iconMap: Record<string, React.ElementType> = {
  rv: Truck,
  tent: Tent,
  cabin: Home,
  yurt: Sparkles,
};

export function RatesSetup({ siteClasses, onSave, onNext, isLoading = false }: RatesSetupProps) {
  const prefersReducedMotion = useReducedMotion();
  const [rates, setRates] = useState<Record<string, number>>(() => {
    // Initialize with existing default rates (convert cents to dollars)
    const initial: Record<string, number> = {};
    siteClasses.forEach((sc) => {
      initial[sc.id] = sc.defaultRate > 0 ? sc.defaultRate / 100 : 45; // Default $45 if no rate
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);

  const handleRateChange = (siteClassId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setRates((prev) => ({
      ...prev,
      [siteClassId]: numValue,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const rateInputs: RateInput[] = siteClasses.map((sc) => ({
        siteClassId: sc.id,
        nightlyRate: rates[sc.id] || 0,
      }));
      await onSave(rateInputs);
      onNext();
    } catch (error) {
      console.error("Failed to save rates:", error);
    } finally {
      setSaving(false);
    }
  };

  const allRatesValid = siteClasses.every((sc) => rates[sc.id] > 0);

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
            <DollarSign className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Set Your Rates</h2>
          <p className="text-slate-400">Enter the base nightly rate for each site type</p>
        </motion.div>

        {/* Rate cards */}
        <div className="space-y-4">
          {siteClasses.map((siteClass, i) => {
            const Icon = iconMap[siteClass.siteType] || Tent;
            const rate = rates[siteClass.id] || 0;

            return (
              <motion.div
                key={siteClass.id}
                initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                className="bg-slate-800/30 border border-slate-700 rounded-xl p-5"
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-emerald-400" />
                  </div>

                  {/* Site class name */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white">{siteClass.name}</h3>
                    <p className="text-sm text-slate-500 capitalize">
                      {siteClass.siteType.replace("_", " ")}
                    </p>
                  </div>

                  {/* Rate input */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-lg">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={rate || ""}
                      onChange={(e) => handleRateChange(siteClass.id, e.target.value)}
                      className="w-24 bg-slate-800/50 border-slate-700 text-white text-right text-lg font-medium"
                      placeholder="0.00"
                    />
                    <span className="text-slate-500 text-sm">/night</span>
                  </div>

                  {/* Validation indicator */}
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      rate > 0 ? "bg-emerald-500/20" : "bg-slate-700/50",
                    )}
                  >
                    {rate > 0 && (
                      <motion.div
                        initial={prefersReducedMotion ? {} : { scale: 0 }}
                        animate={prefersReducedMotion ? {} : { scale: 1 }}
                        transition={SPRING_CONFIG}
                      >
                        <Check className="w-4 h-4 text-emerald-400" />
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Info box */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 flex gap-3"
        >
          <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-400">
            <span className="text-slate-300 font-medium">These are your base rates.</span> You can
            add seasonal pricing, weekend rates, and dynamic pricing rules in your dashboard after
            setup.
          </div>
        </motion.div>

        {/* Continue button */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            onClick={handleSave}
            disabled={saving || isLoading || !allRatesValid}
            className={cn(
              "w-full py-6 text-lg font-semibold transition-all",
              "bg-gradient-to-r from-emerald-500 to-teal-500",
              "hover:from-emerald-400 hover:to-teal-400",
              "disabled:opacity-50",
            )}
          >
            {saving ? "Saving..." : "Continue"}
          </Button>

          {!allRatesValid && (
            <p className="text-center text-sm text-amber-400 mt-3">
              Please set a rate for all site types
            </p>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
