"use client";

import { useCallback, useEffect, useState } from "react";

type HapticPattern = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "selection" | number | number[];

interface UseHapticOptions {
  /** Whether haptic feedback is enabled (respects user preference) */
  enabled?: boolean;
  /** Storage key for user preference */
  storageKey?: string;
}

interface UseHapticReturn {
  /** Trigger a haptic vibration */
  trigger: (pattern?: HapticPattern) => void;
  /** Whether the device supports haptic feedback */
  isSupported: boolean;
  /** Whether haptic is currently enabled */
  isEnabled: boolean;
  /** Toggle haptic feedback on/off */
  toggle: () => void;
  /** Enable haptic feedback */
  enable: () => void;
  /** Disable haptic feedback */
  disable: () => void;
}

// Vibration patterns in milliseconds
const PATTERNS: Record<string, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],       // Quick double tap
  warning: [25, 50, 25, 50],   // Two medium taps
  error: [50, 100, 50],        // Strong double tap
  selection: 5,                // Ultra-light for selections
};

const DEFAULT_STORAGE_KEY = "campreserv:haptic-enabled";

/**
 * Hook for haptic feedback on mobile devices.
 * Uses the Vibration API to provide tactile feedback.
 *
 * @example
 * const { trigger, isSupported, isEnabled, toggle } = useHaptic();
 *
 * // In a button click handler
 * const handleClick = () => {
 *   trigger("success");
 *   doSomething();
 * };
 *
 * // Toggle haptic in settings
 * <Switch checked={isEnabled} onCheckedChange={toggle} />
 */
export function useHaptic(options: UseHapticOptions = {}): UseHapticReturn {
  const { enabled: initialEnabled = true, storageKey = DEFAULT_STORAGE_KEY } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(initialEnabled);

  // Check support and load preference
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if Vibration API is supported
    const supported = "vibrate" in navigator;
    setIsSupported(supported);

    // Load user preference from storage
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        setIsEnabled(stored === "true");
      }
    } catch {
      // Ignore storage errors
    }
  }, [storageKey]);

  // Save preference to storage
  const savePreference = useCallback(
    (enabled: boolean) => {
      if (typeof window === "undefined") return;
      try {
        localStorage.setItem(storageKey, String(enabled));
      } catch {
        // Ignore storage errors
      }
    },
    [storageKey]
  );

  const trigger = useCallback(
    (pattern: HapticPattern = "medium") => {
      if (!isSupported || !isEnabled) return;

      try {
        let vibrationPattern: number | number[];

        if (typeof pattern === "number") {
          vibrationPattern = pattern;
        } else if (Array.isArray(pattern)) {
          vibrationPattern = pattern;
        } else {
          vibrationPattern = PATTERNS[pattern] || PATTERNS.medium;
        }

        navigator.vibrate(vibrationPattern);
      } catch {
        // Ignore errors (e.g., user hasn't interacted yet)
      }
    },
    [isSupported, isEnabled]
  );

  const toggle = useCallback(() => {
    setIsEnabled((prev) => {
      const newValue = !prev;
      savePreference(newValue);
      // Give feedback when enabling
      if (newValue && isSupported) {
        navigator.vibrate(PATTERNS.selection);
      }
      return newValue;
    });
  }, [isSupported, savePreference]);

  const enable = useCallback(() => {
    setIsEnabled(true);
    savePreference(true);
    if (isSupported) {
      navigator.vibrate(PATTERNS.selection);
    }
  }, [isSupported, savePreference]);

  const disable = useCallback(() => {
    setIsEnabled(false);
    savePreference(false);
  }, [savePreference]);

  return {
    trigger,
    isSupported,
    isEnabled,
    toggle,
    enable,
    disable,
  };
}

// Convenience functions for direct use without hook
export const haptic = {
  /**
   * Trigger haptic feedback if supported and user preference allows.
   * Safe to call without checking support.
   */
  trigger: (pattern: HapticPattern = "medium") => {
    if (typeof window === "undefined" || !("vibrate" in navigator)) return;

    // Check user preference
    try {
      const stored = localStorage.getItem(DEFAULT_STORAGE_KEY);
      if (stored === "false") return;
    } catch {
      // Continue if storage fails
    }

    try {
      let vibrationPattern: number | number[];

      if (typeof pattern === "number") {
        vibrationPattern = pattern;
      } else if (Array.isArray(pattern)) {
        vibrationPattern = pattern;
      } else {
        vibrationPattern = PATTERNS[pattern] || PATTERNS.medium;
      }

      navigator.vibrate(vibrationPattern);
    } catch {
      // Ignore errors
    }
  },

  /** Light tap for selections */
  light: () => haptic.trigger("light"),

  /** Medium tap for button presses */
  medium: () => haptic.trigger("medium"),

  /** Heavy tap for important actions */
  heavy: () => haptic.trigger("heavy"),

  /** Success pattern for confirmations */
  success: () => haptic.trigger("success"),

  /** Warning pattern for alerts */
  warning: () => haptic.trigger("warning"),

  /** Error pattern for failures */
  error: () => haptic.trigger("error"),

  /** Ultra-light for subtle selections */
  selection: () => haptic.trigger("selection"),
};
