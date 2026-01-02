"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

// Preset colors for rate groups (campground-friendly palette)
const PRESET_COLORS = [
  // Reds/Oranges (Peak/Hot)
  "#ef4444", // red-500
  "#f97316", // orange-500
  "#f59e0b", // amber-500

  // Greens (Shoulder/Nature)
  "#84cc16", // lime-500
  "#22c55e", // green-500
  "#10b981", // emerald-500

  // Blues (Off-peak/Cool)
  "#06b6d4", // cyan-500
  "#3b82f6", // blue-500
  "#6366f1", // indigo-500

  // Purples (Special/Events)
  "#8b5cf6", // violet-500
  "#a855f7", // purple-500
  "#ec4899", // pink-500

  // Neutrals
  "#64748b", // slate-500
  "#78716c", // stone-500
  "#71717a", // zinc-500
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState(value);

  const handlePresetSelect = (color: string) => {
    onChange(color);
    setCustomColor(color);
    setIsOpen(false);
  };

  const handleCustomChange = (color: string) => {
    setCustomColor(color);
    // Only apply valid hex colors
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      onChange(color);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-8 w-8 rounded-lg shadow-sm border-2 border-white",
            "ring-1 ring-border transition-all duration-150",
            "hover:scale-110 hover:ring-2 hover:ring-ring/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
          style={{ backgroundColor: value }}
          aria-label={`Color: ${value}. Click to change.`}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          {/* Preset Colors Grid */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Preset Colors
            </Label>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {PRESET_COLORS.map((color) => {
                const isSelected = color.toLowerCase() === value.toLowerCase();
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handlePresetSelect(color)}
                    className={cn(
                      "h-8 w-8 rounded-lg transition-all duration-150",
                      "hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring",
                      isSelected && "ring-2 ring-offset-2 ring-ring"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                    aria-pressed={isSelected}
                  >
                    {isSelected && (
                      <Check className="h-4 w-4 text-white mx-auto drop-shadow" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Color Input */}
          <div>
            <Label htmlFor="custom-color" className="text-xs text-muted-foreground uppercase tracking-wider">
              Custom Color
            </Label>
            <div className="flex items-center gap-2 mt-2">
              <div
                className="h-8 w-8 rounded-lg border shadow-sm flex-shrink-0"
                style={{ backgroundColor: customColor }}
              />
              <Input
                id="custom-color"
                type="text"
                value={customColor}
                onChange={(e) => handleCustomChange(e.target.value)}
                placeholder="#000000"
                className="font-mono text-sm w-28"
                maxLength={7}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { PRESET_COLORS };
