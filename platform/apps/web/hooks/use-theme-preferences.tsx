"use client";

import { useState, useCallback, useEffect, createContext, useContext, ReactNode } from "react";

export type ColorMode = "light" | "dark" | "system";
export type AccentColor = "emerald" | "blue" | "violet" | "rose" | "amber" | "cyan" | "indigo";

interface ThemePreferences {
  colorMode: ColorMode;
  accentColor: AccentColor;
  reducedMotion: boolean;
  highContrast: boolean;
}

interface UseThemePreferencesReturn extends ThemePreferences {
  /** The actual color mode after resolving "system" */
  resolvedColorMode: "light" | "dark";
  /** Set the color mode preference */
  setColorMode: (mode: ColorMode) => void;
  /** Set the accent color */
  setAccentColor: (color: AccentColor) => void;
  /** Toggle reduced motion preference */
  toggleReducedMotion: () => void;
  /** Toggle high contrast mode */
  toggleHighContrast: () => void;
  /** Reset to default preferences */
  resetPreferences: () => void;
}

const STORAGE_KEY = "campreserv:theme-preferences";

const DEFAULT_PREFERENCES: ThemePreferences = {
  colorMode: "light",
  accentColor: "emerald",
  reducedMotion: false,
  highContrast: false,
};

// Accent color CSS variable mappings
export const ACCENT_COLORS: Record<AccentColor, { primary: string; hover: string; light: string; ring: string }> = {
  emerald: {
    primary: "16 185 129",   // emerald-500
    hover: "5 150 105",      // emerald-600
    light: "209 250 229",    // emerald-100
    ring: "52 211 153",      // emerald-400
  },
  blue: {
    primary: "59 130 246",   // blue-500
    hover: "37 99 235",      // blue-600
    light: "219 234 254",    // blue-100
    ring: "96 165 250",      // blue-400
  },
  violet: {
    primary: "139 92 246",   // violet-500
    hover: "124 58 237",     // violet-600
    light: "237 233 254",    // violet-100
    ring: "167 139 250",     // violet-400
  },
  rose: {
    primary: "244 63 94",    // rose-500
    hover: "225 29 72",      // rose-600
    light: "255 228 230",    // rose-100
    ring: "251 113 133",     // rose-400
  },
  amber: {
    primary: "245 158 11",   // amber-500
    hover: "217 119 6",      // amber-600
    light: "254 243 199",    // amber-100
    ring: "251 191 36",      // amber-400
  },
  cyan: {
    primary: "6 182 212",    // cyan-500
    hover: "8 145 178",      // cyan-600
    light: "207 250 254",    // cyan-100
    ring: "34 211 238",      // cyan-400
  },
  indigo: {
    primary: "99 102 241",   // indigo-500
    hover: "79 70 229",      // indigo-600
    light: "224 231 255",    // indigo-100
    ring: "129 140 248",     // indigo-400
  },
};

/**
 * Hook for managing user theme preferences.
 * Color mode is locked to light; accent colors and accessibility options remain configurable.
 *
 * @example
 * const { colorMode, setColorMode, accentColor, setAccentColor } = useThemePreferences();
 *
 * // In a settings UI
 * <Select value={accentColor} onValueChange={setAccentColor}>
 *   <SelectItem value="emerald">Emerald</SelectItem>
 *   <SelectItem value="blue">Blue</SelectItem>
 * </Select>
 */
export function useThemePreferences(): UseThemePreferencesReturn {
  const [preferences, setPreferences] = useState<ThemePreferences>(DEFAULT_PREFERENCES);
  const [mounted, setMounted] = useState(false);
  const resolvedColorMode: "light" | "dark" = "light";

  // Load preferences from storage
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed, colorMode: "light" });
      }
    } catch {
      // Ignore parsing errors
    }

    setMounted(true);
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (typeof window === "undefined" || !mounted) return;

    const root = document.documentElement;

    // Apply color mode
    root.classList.remove("light", "dark");
    root.classList.add(resolvedColorMode);

    // Apply accent color CSS variables
    const accent = ACCENT_COLORS[preferences.accentColor];
    root.style.setProperty("--accent-primary", accent.primary);
    root.style.setProperty("--accent-hover", accent.hover);
    root.style.setProperty("--accent-light", accent.light);
    root.style.setProperty("--accent-ring", accent.ring);

    // Apply accessibility preferences
    if (preferences.reducedMotion) {
      root.classList.add("motion-reduce");
    } else {
      root.classList.remove("motion-reduce");
    }

    if (preferences.highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }
  }, [resolvedColorMode, preferences.accentColor, preferences.reducedMotion, preferences.highContrast, mounted]);

  // Save preferences
  const savePreferences = useCallback((newPrefs: ThemePreferences) => {
    const normalized = { ...newPrefs, colorMode: "light" as const };
    setPreferences(normalized);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      } catch {
        // Ignore storage errors
      }
    }
  }, []);

  const setColorMode = useCallback(
    (_mode: ColorMode) => {
      savePreferences({ ...preferences, colorMode: "light" });
    },
    [preferences, savePreferences]
  );

  const setAccentColor = useCallback(
    (color: AccentColor) => {
      savePreferences({ ...preferences, accentColor: color });
    },
    [preferences, savePreferences]
  );

  const toggleReducedMotion = useCallback(() => {
    savePreferences({ ...preferences, reducedMotion: !preferences.reducedMotion });
  }, [preferences, savePreferences]);

  const toggleHighContrast = useCallback(() => {
    savePreferences({ ...preferences, highContrast: !preferences.highContrast });
  }, [preferences, savePreferences]);

  const resetPreferences = useCallback(() => {
    savePreferences(DEFAULT_PREFERENCES);
  }, [savePreferences]);

  return {
    ...preferences,
    resolvedColorMode,
    setColorMode,
    setAccentColor,
    toggleReducedMotion,
    toggleHighContrast,
    resetPreferences,
  };
}

// Context for sharing theme preferences
const ThemePreferencesContext = createContext<UseThemePreferencesReturn | null>(null);

export function ThemePreferencesProvider({ children }: { children: ReactNode }) {
  const themePreferences = useThemePreferences();

  return (
    <ThemePreferencesContext.Provider value={themePreferences}>
      {children}
    </ThemePreferencesContext.Provider>
  );
}

export function useThemePreferencesContext(): UseThemePreferencesReturn {
  const context = useContext(ThemePreferencesContext);
  if (!context) {
    throw new Error("useThemePreferencesContext must be used within ThemePreferencesProvider");
  }
  return context;
}
