"use client";

import { useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  removable?: boolean;
  icon?: React.ReactNode;
  count?: number;
  className?: string;
  variant?: "default" | "outline" | "subtle";
}

export function FilterChip({
  label,
  selected = false,
  onToggle,
  onRemove,
  removable = false,
  icon,
  count,
  className,
  variant = "default",
}: FilterChipProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const handleClick = useCallback(() => {
    if (onToggle) {
      // Trigger bounce animation
      if (!prefersReducedMotion) {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 400);
      }
      onToggle();
    }
  }, [onToggle, prefersReducedMotion]);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onRemove) {
        onRemove();
      }
    },
    [onRemove]
  );

  const variantStyles = {
    default: selected
      ? "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600"
      : "bg-card text-foreground border-border hover:border-emerald-300 hover:bg-emerald-50",
    outline: selected
      ? "bg-emerald-50 text-emerald-700 border-emerald-500"
      : "bg-transparent text-muted-foreground border-border hover:border-emerald-400",
    subtle: selected
      ? "bg-emerald-100 text-emerald-800 border-transparent"
      : "bg-muted text-muted-foreground border-transparent hover:bg-muted",
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
        variantStyles[variant],
        className
      )}
      animate={
        isAnimating && !prefersReducedMotion
          ? { scale: [1, 1.15, 0.95, 1.05, 1] }
          : {}
      }
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            "ml-0.5 text-xs px-1.5 py-0.5 rounded-full",
            selected
              ? "bg-card/20 text-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      )}
      {removable && selected && (
        <button
          type="button"
          onClick={handleRemove}
          className={cn(
            "ml-0.5 p-0.5 rounded-full transition-colors",
            selected
              ? "hover:bg-card/20 text-foreground"
              : "hover:bg-muted text-muted-foreground"
          )}
          aria-label={`Remove ${label} filter`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </motion.button>
  );
}

// Group of filter chips with selection management
interface FilterChipGroupProps {
  options: Array<{
    value: string;
    label: string;
    icon?: React.ReactNode;
    count?: number;
  }>;
  selected: string[];
  onChange: (selected: string[]) => void;
  multiSelect?: boolean;
  className?: string;
}

export function FilterChipGroup({
  options,
  selected,
  onChange,
  multiSelect = true,
  className,
}: FilterChipGroupProps) {
  const handleToggle = useCallback(
    (value: string) => {
      if (multiSelect) {
        if (selected.includes(value)) {
          onChange(selected.filter((v) => v !== value));
        } else {
          onChange([...selected, value]);
        }
      } else {
        onChange(selected.includes(value) ? [] : [value]);
      }
    },
    [selected, onChange, multiSelect]
  );

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => (
        <FilterChip
          key={option.value}
          label={option.label}
          icon={option.icon}
          count={option.count}
          selected={selected.includes(option.value)}
          onToggle={() => handleToggle(option.value)}
        />
      ))}
    </div>
  );
}
