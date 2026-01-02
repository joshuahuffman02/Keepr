"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AmenityOption } from "@/lib/amenities";

interface AmenityPickerProps {
  options: AmenityOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  columns?: 3 | 4 | 5;
  size?: "sm" | "md";
}

export function AmenityPicker({
  options,
  selected,
  onChange,
  columns = 4,
  size = "md",
}: AmenityPickerProps) {
  const prefersReducedMotion = useReducedMotion();

  const toggleAmenity = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const gridCols = {
    3: "grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-5",
  };

  const sizeClasses = {
    sm: "p-2 gap-1.5",
    md: "p-3 gap-2",
  };

  const iconSize = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
  };

  const textSize = {
    sm: "text-xs",
    md: "text-sm",
  };

  return (
    <div className={cn("grid gap-2", gridCols[columns])}>
      {options.map((amenity, index) => {
        const isSelected = selected.includes(amenity.id);
        const Icon = amenity.icon;

        return (
          <motion.button
            key={amenity.id}
            type="button"
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            onClick={() => toggleAmenity(amenity.id)}
            className={cn(
              "relative flex flex-col items-center rounded-lg border transition-all",
              sizeClasses[size],
              isSelected
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                : "border-border bg-muted/50 text-muted-foreground hover:border-border hover:bg-muted"
            )}
          >
            {isSelected && (
              <motion.div
                initial={prefersReducedMotion ? {} : { scale: 0 }}
                animate={prefersReducedMotion ? {} : { scale: 1 }}
                className="absolute top-1 right-1"
              >
                <Check className="w-3 h-3 text-emerald-400" />
              </motion.div>
            )}
            <Icon className={cn(iconSize[size], isSelected ? "text-emerald-400" : "text-muted-foreground")} />
            <span className={cn("mt-1 text-center leading-tight", textSize[size])}>
              {amenity.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
