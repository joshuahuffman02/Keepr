"use client";

import { useRef, useCallback, useState } from "react";

interface UseLogoClicksOptions {
  /** Number of clicks required to trigger (default: 5) */
  clicksRequired?: number;
  /** Time window in ms for clicks to count (default: 3000) */
  timeout?: number;
  /** Callback when click threshold is reached */
  onThreshold: () => void;
}

/**
 * Hook for tracking rapid clicks on an element (like a logo).
 * Triggers a callback when the user clicks the required number of times within the timeout.
 */
export function useLogoClicks({
  clicksRequired = 5,
  timeout = 3000,
  onThreshold,
}: UseLogoClicksOptions) {
  const clickTimestamps = useRef<number[]>([]);
  const [clickCount, setClickCount] = useState(0);

  const handleClick = useCallback(() => {
    const now = Date.now();

    // Filter out old clicks outside the timeout window
    clickTimestamps.current = clickTimestamps.current.filter((t) => now - t < timeout);

    // Add current click
    clickTimestamps.current.push(now);
    setClickCount(clickTimestamps.current.length);

    // Check if we've reached the threshold
    if (clickTimestamps.current.length >= clicksRequired) {
      onThreshold();
      // Reset after triggering
      clickTimestamps.current = [];
      setClickCount(0);
    }
  }, [clicksRequired, timeout, onThreshold]);

  const reset = useCallback(() => {
    clickTimestamps.current = [];
    setClickCount(0);
  }, []);

  return { handleClick, clickCount, reset };
}
