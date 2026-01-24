"use client";

import { cn } from "@/lib/utils";
import type { ChatAccent } from "./types";

const ACCENT_STYLES: Record<ChatAccent, { chip: string; hover: string; text: string }> = {
  guest: {
    chip: "border-emerald-200",
    hover: "hover:bg-emerald-50",
    text: "text-emerald-700",
  },
  staff: {
    chip: "border-blue-200",
    hover: "hover:bg-blue-50",
    text: "text-blue-700",
  },
  public: {
    chip: "border-action-primary/30",
    hover: "hover:bg-action-primary/10",
    text: "text-action-primary",
  },
  support: {
    chip: "border-status-info/30",
    hover: "hover:bg-status-info/10",
    text: "text-status-info",
  },
  partner: {
    chip: "border-status-success/30",
    hover: "hover:bg-status-success/10",
    text: "text-status-success",
  },
};

type SuggestedPromptsProps = {
  prompts: string[];
  onSelect: (prompt: string) => void;
  accent?: ChatAccent;
  label?: string;
  align?: "start" | "center";
  className?: string;
};

export function SuggestedPrompts({
  prompts,
  onSelect,
  accent = "staff",
  label = "Try asking:",
  align = "center",
  className,
}: SuggestedPromptsProps) {
  if (prompts.length === 0) return null;
  const styles = ACCENT_STYLES[accent];

  return (
    <div className={cn("space-y-2", className)}>
      <p
        className={cn(
          "text-xs font-medium text-muted-foreground",
          align === "center" ? "text-center" : "text-left",
        )}
      >
        {label}
      </p>
      <div
        className={cn(
          "flex flex-wrap gap-2",
          align === "center" ? "justify-center" : "justify-start",
        )}
      >
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelect(prompt)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
              styles.chip,
              styles.hover,
              styles.text,
            )}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
