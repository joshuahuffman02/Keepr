"use client";

import { cn } from "@/lib/utils";

export type StatusValue = "active" | "inactive" | "all";

interface StatusFilterProps {
  value: StatusValue;
  onChange: (value: StatusValue) => void;
  className?: string;
}

const options: { value: StatusValue; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
];

export function StatusFilter({ value, onChange, className }: StatusFilterProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Filter by status"
      className={cn("flex rounded-lg border p-1 bg-card", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
            value === option.value
              ? "bg-status-success-bg text-status-success-text"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
