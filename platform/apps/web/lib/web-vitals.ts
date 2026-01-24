/**
 * Web Vitals Monitoring
 * Tracks Core Web Vitals for SEO and performance optimization
 */

import type { Metric } from "web-vitals";

type MetricName = "CLS" | "FCP" | "FID" | "INP" | "LCP" | "TTFB";

/**
 * Web Vitals thresholds (Good/Needs Improvement/Poor)
 */
export const WEB_VITALS_THRESHOLDS: Record<MetricName, { good: number; poor: number }> = {
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  FID: { good: 100, poor: 300 },
  INP: { good: 200, poor: 500 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
};

/**
 * Get rating for a metric value
 */
export function getMetricRating(
  name: MetricName,
  value: number,
): "good" | "needs-improvement" | "poor" {
  const thresholds = WEB_VITALS_THRESHOLDS[name];
  if (value <= thresholds.good) return "good";
  if (value <= thresholds.poor) return "needs-improvement";
  return "poor";
}

/**
 * Format metric value for display
 */
export function formatMetricValue(name: string, value: number): string {
  switch (name) {
    case "CLS":
      return value.toFixed(3);
    case "FCP":
    case "LCP":
    case "FID":
    case "INP":
    case "TTFB":
      return `${Math.round(value)}ms`;
    default:
      return value.toString();
  }
}

/**
 * Report Web Vitals to analytics
 */
export function reportWebVitals(metric: Metric) {
  const { name, value, id, rating } = metric;

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    const color =
      rating === "good"
        ? "\x1b[32m" // green
        : rating === "needs-improvement"
          ? "\x1b[33m" // yellow
          : "\x1b[31m"; // red
    const reset = "\x1b[0m";

    console.log(
      `${color}[Web Vitals]${reset} ${name}: ${formatMetricValue(name, value)} (${rating})`,
    );
  }

  // Send to analytics endpoint
  if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
    const body = JSON.stringify({
      name,
      value,
      id,
      rating,
      page: window.location.pathname,
      timestamp: Date.now(),
    });

    // Use sendBeacon for reliable delivery
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/vitals", body);
    } else {
      fetch("/api/analytics/vitals", {
        method: "POST",
        body,
        keepalive: true,
        headers: { "Content-Type": "application/json" },
      }).catch(() => {
        // Silently fail - vitals are non-critical
      });
    }

    // Also send to Google Analytics if available
    if (typeof window.gtag === "function") {
      window.gtag("event", name, {
        event_category: "Web Vitals",
        event_label: id,
        value: Math.round(name === "CLS" ? value * 1000 : value),
        non_interaction: true,
      });
    }
  }
}

/**
 * Initialize Web Vitals monitoring
 * Call this in your app's entry point
 */
export async function initWebVitals() {
  if (typeof window === "undefined") return;

  try {
    const { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } = await import("web-vitals");

    onCLS(reportWebVitals);
    onFCP(reportWebVitals);
    onFID(reportWebVitals);
    onINP(reportWebVitals);
    onLCP(reportWebVitals);
    onTTFB(reportWebVitals);
  } catch {
    // web-vitals not available
  }
}

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
