"use client";

import { Label } from "@/components/ui/label";
import {
  ToggleLeft,
  Type,
  Hash,
  List,
  CheckSquare,
  Calendar,
  Clock,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type FieldType =
  | "yes_no"
  | "text"
  | "number"
  | "dropdown"
  | "multi_select"
  | "date"
  | "time";

interface FieldTypeOption {
  value: FieldType;
  label: string;
  description: string;
  icon: LucideIcon;
}

const fieldTypes: FieldTypeOption[] = [
  {
    value: "yes_no",
    label: "Yes/No",
    description: "Simple toggle question",
    icon: ToggleLeft,
  },
  {
    value: "text",
    label: "Text",
    description: "Short text answer",
    icon: Type,
  },
  {
    value: "number",
    label: "Number",
    description: "Numeric value",
    icon: Hash,
  },
  {
    value: "dropdown",
    label: "Dropdown",
    description: "Select one option",
    icon: List,
  },
  {
    value: "multi_select",
    label: "Multi-select",
    description: "Select multiple options",
    icon: CheckSquare,
  },
  {
    value: "date",
    label: "Date",
    description: "Date picker",
    icon: Calendar,
  },
  {
    value: "time",
    label: "Time",
    description: "Time picker",
    icon: Clock,
  },
];

interface FieldTypeSelectorProps {
  value: FieldType;
  onChange: (type: FieldType) => void;
  className?: string;
}

export function FieldTypeSelector({ value, onChange, className }: FieldTypeSelectorProps) {
  return (
    <div className={className}>
      <Label className="text-sm font-medium">Answer Type</Label>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {fieldTypes.map((type) => {
          const isSelected = type.value === value;
          const Icon = type.icon;

          return (
            <button
              key={type.value}
              type="button"
              onClick={() => onChange(type.value)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                isSelected
                  ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                  : "border-border hover:border-border hover:bg-muted",
              )}
            >
              <div className={cn("p-2 rounded-lg", isSelected ? "bg-emerald-100" : "bg-muted")}>
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isSelected ? "text-emerald-600" : "text-muted-foreground",
                  )}
                />
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "font-medium text-sm",
                    isSelected ? "text-emerald-900" : "text-foreground",
                  )}
                >
                  {type.label}
                </p>
                <p className="text-xs text-muted-foreground truncate">{type.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { fieldTypes };
