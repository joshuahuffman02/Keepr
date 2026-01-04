"use client";

import { useState, useEffect } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * A hydration-safe wrapper around framer-motion's useReducedMotion.
 *
 * The native useReducedMotion hook can return different values on server vs client,
 * causing React hydration errors. This hook returns a consistent value (true) during
 * SSR and initial client render, then updates to the real value after mount.
 *
 * @returns boolean - true if reduced motion is preferred or during SSR, false otherwise
 */
export function useReducedMotionSafe(): boolean {
  const [hasMounted, setHasMounted] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Return true (reduced motion) during SSR and initial hydration
  // This ensures consistent rendering between server and client
  // After mount, use the actual preference
  return hasMounted ? (prefersReducedMotion ?? false) : true;
}

/**
 * Similar to useReducedMotionSafe but returns false as the SSR default.
 * Use this when you want animations to be enabled by default.
 *
 * @returns boolean - true if reduced motion is preferred, false otherwise (including SSR)
 */
export function useReducedMotionSafeWithAnimations(): boolean {
  const [hasMounted, setHasMounted] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Return false (show animations) during SSR and initial hydration
  // After mount, use the actual preference
  return hasMounted ? (prefersReducedMotion ?? false) : false;
}
