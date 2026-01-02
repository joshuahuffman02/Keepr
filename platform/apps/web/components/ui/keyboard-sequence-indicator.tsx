"use client";

import React, { useEffect, useState } from "react";
import { Command } from "lucide-react";

/**
 * Visual indicator shown when user presses 'G' for sequential shortcuts
 * Shows "Press D for Dashboard, C for Calendar..." etc.
 */
export function KeyboardSequenceIndicator() {
  const [isPrimed, setIsPrimed] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (isTyping) return;

      const key = e.key.toLowerCase();
      const hasModifier = e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;

      if (key === "g" && !hasModifier) {
        setIsPrimed(true);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          setIsPrimed(false);
        }, 1000);
      } else if (isPrimed) {
        // Any other key press clears the indicator
        setIsPrimed(false);
        if (timer) clearTimeout(timer);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (timer) clearTimeout(timer);
    };
  }, [isPrimed]);

  if (!isPrimed) return null;

  const shortcuts = [
    { key: "D", label: "Dashboard" },
    { key: "C", label: "Calendar" },
    { key: "R", label: "Reservations" },
    { key: "G", label: "Guests" },
    { key: "P", label: "POS" },
    { key: "M", label: "Messages" },
    { key: "S", label: "Settings" },
  ];

  return (
    <div className="fixed bottom-8 right-8 z-[90] animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="bg-muted text-foreground rounded-xl shadow-2xl border border-border p-4 min-w-[280px]">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
          <Command className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-400">
            Sequential Navigation Active
          </span>
        </div>

        <div className="space-y-1.5">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between text-xs hover:bg-muted px-2 py-1 rounded transition-colors"
            >
              <span className="text-muted-foreground">{shortcut.label}</span>
              <kbd className="px-2 py-0.5 bg-muted border border-border rounded text-foreground font-mono min-w-[24px] text-center">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-2 border-t border-border text-[10px] text-muted-foreground text-center">
          Press any key or wait 1 second to cancel
        </div>
      </div>
    </div>
  );
}
