"use client";

import { Calendar, Sun, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export type RentalType = "transient" | "seasonal" | "flexible";

interface RentalTypeOption {
  type: RentalType;
  label: string;
  description: string;
  icon: React.ElementType;
}

const rentalTypes: RentalTypeOption[] = [
  {
    type: "transient",
    label: "Nightly Rentals",
    description: "Standard short-term stays. Guests book by the night.",
    icon: Calendar,
  },
  {
    type: "seasonal",
    label: "Seasonal/Monthly",
    description: "Long-term sites with monthly rates. For seasonal campers.",
    icon: Sun,
  },
  {
    type: "flexible",
    label: "Flexible",
    description: "Accept both nightly and long-term stays. Set rates for each.",
    icon: ArrowLeftRight,
  },
];

interface RentalTypeSelectorProps {
  value: RentalType;
  onChange: (value: RentalType) => void;
  disabled?: boolean;
}

export function RentalTypeSelector({ value, onChange, disabled = false }: RentalTypeSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {rentalTypes.map((rentalType, index) => {
        const Icon = rentalType.icon;
        const isSelected = value === rentalType.type;

        return (
          <motion.button
            key={rentalType.type}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => !disabled && onChange(rentalType.type)}
            disabled={disabled}
            className={cn(
              "relative p-6 rounded-xl border-2 text-left transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background",
              disabled
                ? "cursor-not-allowed opacity-50"
                : "hover:border-emerald-500/50 hover:bg-muted/50",
              isSelected ? "border-emerald-500 bg-emerald-500/10" : "border-border bg-muted/30",
            )}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div
                className={cn(
                  "p-4 rounded-lg",
                  isSelected
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4
                  className={cn(
                    "font-semibold text-lg",
                    isSelected ? "text-emerald-400" : "text-muted-foreground",
                  )}
                >
                  {rentalType.label}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {rentalType.description}
                </p>
              </div>
            </div>
            {isSelected && (
              <motion.div
                layoutId="selected-indicator"
                className="absolute top-3 right-3 w-3 h-3 rounded-full bg-emerald-500"
                initial={false}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
