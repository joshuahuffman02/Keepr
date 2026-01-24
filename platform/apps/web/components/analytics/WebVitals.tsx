"use client";

import { useEffect } from "react";
import { initWebVitals } from "@/lib/web-vitals";

/**
 * Web Vitals monitoring component
 * Include this in your root layout to track Core Web Vitals
 */
export function WebVitals() {
  useEffect(() => {
    initWebVitals();
  }, []);

  return null;
}

/**
 * Performance mark utilities for custom timing
 */
export function usePerformanceMark(name: string) {
  useEffect(() => {
    if (typeof window !== "undefined" && window.performance) {
      // Mark component mount
      performance.mark(`${name}-start`);

      return () => {
        // Mark component unmount and measure
        performance.mark(`${name}-end`);
        try {
          performance.measure(name, `${name}-start`, `${name}-end`);
        } catch {
          // Measure might fail if marks don't exist
        }
      };
    }
  }, [name]);
}

/**
 * Track long tasks for INP debugging
 */
export function useLongTaskMonitor() {
  useEffect(() => {
    if (typeof window === "undefined" || !("PerformanceObserver" in window)) {
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Log long tasks (>50ms) in development
          if (process.env.NODE_ENV === "development" && entry.duration > 50) {
            console.warn(`[Long Task] Duration: ${entry.duration.toFixed(1)}ms`, entry);
          }
        }
      });

      observer.observe({ entryTypes: ["longtask"] });

      return () => observer.disconnect();
    } catch {
      // PerformanceObserver might not support longtask
    }
  }, []);
}
