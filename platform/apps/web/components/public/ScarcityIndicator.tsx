"use client";

import { Flame, Clock, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";

interface ScarcityIndicatorProps {
  sitesLeft: number;
  totalSites?: number;
  dateRange?: string;
  variant?: "badge" | "banner" | "inline";
  className?: string;
}

export function ScarcityIndicator({
  sitesLeft,
  totalSites,
  dateRange,
  variant = "badge",
  className,
}: ScarcityIndicatorProps) {
  // Don't show if plenty of availability
  if (sitesLeft > 10) return null;

  // Determine urgency level
  let urgency: "critical" | "high" | "medium" | "low";
  let message: string;
  let Icon = Clock;

  if (sitesLeft <= 2) {
    urgency = "critical";
    message = sitesLeft === 1 ? "Only 1 site left!" : `Only ${sitesLeft} sites left!`;
    Icon = Flame;
  } else if (sitesLeft <= 5) {
    urgency = "high";
    message = `${sitesLeft} sites remaining`;
    Icon = AlertTriangle;
  } else if (sitesLeft <= 10) {
    urgency = "medium";
    message = "Limited availability";
    Icon = Clock;
  } else {
    urgency = "low";
    message = "Good availability";
  }

  const urgencyStyles = {
    critical: {
      bg: "bg-status-error-bg border-status-error-border",
      text: "text-status-error-text",
      icon: "text-status-error",
      dot: "bg-status-error",
    },
    high: {
      bg: "bg-keepr-clay/10 border-keepr-clay/30",
      text: "text-keepr-clay",
      icon: "text-keepr-clay",
      dot: "bg-keepr-clay",
    },
    medium: {
      bg: "bg-keepr-charcoal/5 border-keepr-charcoal/15",
      text: "text-keepr-charcoal",
      icon: "text-keepr-charcoal",
      dot: "bg-keepr-charcoal",
    },
    low: {
      bg: "bg-keepr-evergreen/10 border-keepr-evergreen/20",
      text: "text-keepr-evergreen",
      icon: "text-keepr-evergreen",
      dot: "bg-keepr-evergreen",
    },
  };

  const styles = urgencyStyles[urgency];

  if (variant === "banner") {
    return (
      <div
        className={cn("rounded-lg border px-4 py-3 flex items-center gap-3", styles.bg, className)}
      >
        <div className={cn("flex-shrink-0", styles.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className={cn("font-semibold", styles.text)}>{message}</p>
          {dateRange && <p className={cn("text-sm opacity-80", styles.text)}>for {dateRange}</p>}
        </div>
        {totalSites && (
          <div className={cn("text-sm", styles.text)}>
            {sitesLeft}/{totalSites} available
          </div>
        )}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-sm", styles.text, className)}>
        <span className={cn("h-2 w-2 rounded-full animate-pulse", styles.dot)} />
        {message}
      </span>
    );
  }

  // Default: badge
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        styles.bg,
        styles.text,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {message}
    </span>
  );
}

// Simple text-only version for card overlays
export function ScarcityBadge({ sitesLeft, className }: { sitesLeft: number; className?: string }) {
  if (sitesLeft > 5) return null;

  const isCritical = sitesLeft <= 2;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        isCritical ? "bg-status-error text-white" : "bg-keepr-clay text-white",
        className,
      )}
    >
      <Flame className="h-3 w-3" />
      {sitesLeft === 1 ? "Last site!" : `${sitesLeft} left`}
    </span>
  );
}
