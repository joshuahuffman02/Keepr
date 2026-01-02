"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Truck,
  Bus,
  Container,
  Tent,
  CheckCircle2,
  Car,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

export type EquipmentType =
  | "class_a"
  | "class_b"
  | "class_c"
  | "fifth_wheel"
  | "travel_trailer"
  | "toy_hauler"
  | "pop_up"
  | "van_camper"
  | "tent"
  | "any";

interface EquipmentOption {
  id: EquipmentType;
  label: string;
  icon: LucideIcon;
}

const equipmentOptions: EquipmentOption[] = [
  { id: "class_a", label: "Class A", icon: Bus },
  { id: "class_b", label: "Class B", icon: Car },
  { id: "class_c", label: "Class C", icon: Truck },
  { id: "fifth_wheel", label: "5th Wheel", icon: Truck },
  { id: "travel_trailer", label: "Travel Trailer", icon: Container },
  { id: "toy_hauler", label: "Toy Hauler", icon: Container },
  { id: "pop_up", label: "Pop-Up Camper", icon: Tent },
  { id: "van_camper", label: "Van/Truck Camper", icon: Car },
  { id: "tent", label: "Tent", icon: Tent },
  { id: "any", label: "Any/All", icon: CheckCircle2 },
];

interface EquipmentTypePickerProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export function EquipmentTypePicker({
  selected,
  onChange,
  disabled = false,
}: EquipmentTypePickerProps) {
  const prefersReducedMotion = useReducedMotion();

  const toggleEquipmentType = (id: string) => {
    if (disabled) return;

    // If "any" is clicked
    if (id === "any") {
      // If "any" is already selected, deselect all
      if (selected.includes("any")) {
        onChange([]);
      } else {
        // Select all equipment types
        onChange(equipmentOptions.map((opt) => opt.id));
      }
      return;
    }

    // Toggle individual type
    if (selected.includes(id)) {
      // Deselecting - also remove "any" if present
      onChange(selected.filter((s) => s !== id && s !== "any"));
    } else {
      const newSelected = [...selected.filter((s) => s !== "any"), id];

      // Check if all non-"any" types are now selected
      const allTypesExceptAny = equipmentOptions
        .filter((opt) => opt.id !== "any")
        .map((opt) => opt.id);

      const allSelected = allTypesExceptAny.every((typeId) =>
        newSelected.includes(typeId)
      );

      // If all are selected, also add "any"
      if (allSelected) {
        onChange([...newSelected, "any"]);
      } else {
        onChange(newSelected);
      }
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {equipmentOptions.map((equipment, index) => {
        const isSelected = selected.includes(equipment.id);
        const Icon = equipment.icon;
        const isAnyOption = equipment.id === "any";

        return (
          <motion.button
            key={equipment.id}
            type="button"
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => toggleEquipmentType(equipment.id)}
            disabled={disabled}
            className={cn(
              "relative p-4 rounded-xl border-2 transition-all duration-200",
              "flex flex-col items-center justify-center gap-2",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background",
              !disabled && "hover:border-emerald-500/50",
              disabled && "opacity-50 cursor-not-allowed",
              isSelected
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-border bg-muted/50",
              isAnyOption && "sm:col-span-3 lg:col-span-1"
            )}
          >
            {/* Icon */}
            <div
              className={cn(
                "p-2 rounded-lg transition-colors",
                isSelected
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="w-6 h-6" />
            </div>

            {/* Label */}
            <span
              className={cn(
                "text-sm font-medium text-center transition-colors",
                isSelected ? "text-emerald-400" : "text-muted-foreground"
              )}
            >
              {equipment.label}
            </span>

            {/* Selected indicator */}
            {isSelected && (
              <motion.div
                initial={prefersReducedMotion ? {} : { scale: 0 }}
                animate={prefersReducedMotion ? {} : { scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg"
              >
                <Check className="w-4 h-4 text-white" />
              </motion.div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
