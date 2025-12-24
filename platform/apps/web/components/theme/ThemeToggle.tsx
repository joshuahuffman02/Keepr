"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

type ThemeOption = "light" | "dark" | "system";

const themes: { value: ThemeOption; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "Auto" },
];

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 h-9 w-[106px]" />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-lg p-1",
        "bg-slate-100 dark:bg-slate-800/80",
        "border border-slate-200 dark:border-slate-700"
      )}
    >
      {themes.map(({ value, icon: Icon, label }) => {
        const isActive = theme === value;

        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              "relative flex items-center justify-center rounded-md p-1.5 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              isActive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            )}
            title={label}
            aria-label={`Switch to ${label} theme`}
          >
            {isActive && (
              <motion.div
                layoutId="theme-indicator"
                className={cn(
                  "absolute inset-0 rounded-md",
                  "bg-white dark:bg-slate-700",
                  "shadow-sm"
                )}
                transition={prefersReducedMotion ? { duration: 0 } : SPRING_CONFIG}
              />
            )}
            <Icon className="relative h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

// Dropdown variant for mobile or menus
export function ThemeToggleDropdown() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="space-y-1">
      <div className="px-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        Theme
      </div>
      {themes.map(({ value, icon: Icon, label }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              isActive
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {isActive && (
              <span className="ml-auto text-emerald-500">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
