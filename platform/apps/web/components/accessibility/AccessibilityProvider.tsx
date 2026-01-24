"use client";

import * as React from "react";

/**
 * AccessibilityProvider - Global accessibility context
 * Manages accessibility preferences and provides utilities
 */
interface AccessibilityContextValue {
  prefersReducedMotion: boolean;
  announceMessage: (message: string, priority?: "polite" | "assertive") => void;
}

const AccessibilityContext = React.createContext<AccessibilityContextValue | null>(null);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const announcerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Detect reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const announceMessage = React.useCallback(
    (message: string, priority: "polite" | "assertive" = "polite") => {
      if (announcerRef.current) {
        announcerRef.current.textContent = "";
        // Small delay to ensure screen readers pick up the change
        setTimeout(() => {
          if (announcerRef.current) {
            announcerRef.current.setAttribute("aria-live", priority);
            announcerRef.current.textContent = message;
          }
        }, 100);
      }
    },
    [],
  );

  const value = React.useMemo(
    () => ({
      prefersReducedMotion,
      announceMessage,
    }),
    [prefersReducedMotion, announceMessage],
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
      {/* Screen reader announcement region */}
      <div
        ref={announcerRef}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      />
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = React.useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within AccessibilityProvider");
  }
  return context;
}
