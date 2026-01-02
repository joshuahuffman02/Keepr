"use client";

import { Truck, Tent, Home, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export type SiteBaseType = "rv" | "tent" | "cabin" | "glamping";

interface SiteTypeOption {
  type: SiteBaseType;
  label: string;
  description: string;
  icon: React.ElementType;
}

const siteTypes: SiteTypeOption[] = [
  {
    type: "rv",
    label: "RV Site",
    description: "Back-in or pull-through sites for RVs and trailers",
    icon: Truck,
  },
  {
    type: "tent",
    label: "Tent Site",
    description: "Primitive or improved tent camping spots",
    icon: Tent,
  },
  {
    type: "cabin",
    label: "Cabin",
    description: "Rustic or modern cabins with beds",
    icon: Home,
  },
  {
    type: "glamping",
    label: "Glamping",
    description: "Yurts, safari tents, domes, or unique stays",
    icon: Sparkles,
  },
];

interface SiteTypeSelectorProps {
  selected: SiteBaseType | null;
  onSelect: (type: SiteBaseType) => void;
}

export function SiteTypeSelector({ selected, onSelect }: SiteTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-muted-foreground">What type of site is this?</h3>
      <div className="grid grid-cols-2 gap-4">
        {siteTypes.map((siteType, index) => {
          const Icon = siteType.icon;
          const isSelected = selected === siteType.type;

          return (
            <motion.button
              key={siteType.type}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onSelect(siteType.type)}
              className={cn(
                "relative p-6 rounded-xl border-2 text-left transition-all duration-200",
                "hover:border-emerald-500/50 hover:bg-muted/50",
                "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background",
                isSelected
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-border bg-muted/30"
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "p-3 rounded-lg",
                    isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className={cn(
                    "font-medium",
                    isSelected ? "text-emerald-400" : "text-muted-foreground"
                  )}>
                    {siteType.label}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">{siteType.description}</p>
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
    </div>
  );
}
