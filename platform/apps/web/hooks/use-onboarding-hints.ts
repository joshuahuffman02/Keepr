"use client";

import { useState, useEffect, useCallback } from "react";

type OnboardingHintState = {
  [hintId: string]: boolean;
};

export function useOnboardingHints() {
  const [dismissedHints, setDismissedHints] = useState<OnboardingHintState>({});
  const [isLoaded, setIsLoaded] = useState(false);

  const STORAGE_KEY = "campreserv:onboarding:hints";

  useEffect(() => {
    // Load dismissed hints from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setDismissedHints(JSON.parse(stored));
      } catch {
        setDismissedHints({});
      }
    }
    setIsLoaded(true);
  }, []);

  const isDismissed = useCallback(
    (hintId: string): boolean => {
      return dismissedHints[hintId] === true;
    },
    [dismissedHints],
  );

  const dismissHint = useCallback(
    (hintId: string) => {
      const updated = { ...dismissedHints, [hintId]: true };
      setDismissedHints(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    },
    [dismissedHints],
  );

  const resetHint = useCallback(
    (hintId: string) => {
      const updated = { ...dismissedHints };
      delete updated[hintId];
      setDismissedHints(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    },
    [dismissedHints],
  );

  const resetAllHints = useCallback(() => {
    setDismissedHints({});
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    isDismissed,
    dismissHint,
    resetHint,
    resetAllHints,
    isLoaded,
  };
}

export function useOnboardingHint(hintId: string) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const storageKey = `campreserv:onboarding:hint:${hintId}`;

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (dismissed === "true") {
      setIsDismissed(true);
      setIsVisible(false);
    } else {
      setIsVisible(true);
    }
  }, [hintId, storageKey]);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem(storageKey, "true");
  }, [storageKey]);

  const reset = useCallback(() => {
    setIsVisible(true);
    setIsDismissed(false);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    isVisible,
    isDismissed,
    dismiss,
    reset,
  };
}
