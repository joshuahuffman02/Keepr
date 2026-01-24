"use client";

import { useEffect, useState, useCallback } from "react";

const KONAMI_SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

interface UseKonamiCodeOptions {
  /** Callback when code is entered successfully */
  onSuccess: () => void;
  /** Time allowed between keystrokes in ms (default: 2000) */
  timeout?: number;
  /** Whether to track the code (default: true) */
  enabled?: boolean;
}

/**
 * Hook for detecting the Konami code sequence.
 * Triggers a callback when the user enters: Up Up Down Down Left Right Left Right B A
 */
export function useKonamiCode({ onSuccess, timeout = 2000, enabled = true }: UseKonamiCodeOptions) {
  const [position, setPosition] = useState(0);
  const [lastKeyTime, setLastKeyTime] = useState(0);

  const resetSequence = useCallback(() => {
    setPosition(0);
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't track when typing in inputs
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const now = Date.now();
      const key = e.key.toLowerCase();
      const expectedKey = KONAMI_SEQUENCE[position]?.toLowerCase();

      // Reset if too much time has passed
      if (now - lastKeyTime > timeout && position > 0) {
        setPosition(0);
        return;
      }

      setLastKeyTime(now);

      if (key === expectedKey) {
        const newPosition = position + 1;
        setPosition(newPosition);

        if (newPosition === KONAMI_SEQUENCE.length) {
          onSuccess();
          setPosition(0);
        }
      } else {
        // Wrong key - reset
        setPosition(0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, position, lastKeyTime, timeout, onSuccess]);

  return { position, total: KONAMI_SEQUENCE.length, reset: resetSequence };
}
