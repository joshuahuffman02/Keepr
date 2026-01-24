"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, ThumbsUp, ThumbsDown, Minus, Zap, type LucideIcon } from "lucide-react";

type Sentiment = "positive" | "neutral" | "negative" | null | undefined;
type UrgencyLevel = "low" | "normal" | "high" | "critical" | null | undefined;

interface SentimentBadgeProps {
  sentiment: Sentiment;
  urgencyLevel?: UrgencyLevel;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

type SentimentKey = Exclude<Sentiment, null | undefined>;
type UrgencyKey = Exclude<UrgencyLevel, null | undefined>;

const sentimentConfig: Record<
  SentimentKey,
  { icon: LucideIcon; label: string; bg: string; border: string; text: string; iconColor: string }
> = {
  positive: {
    icon: ThumbsUp,
    label: "Positive",
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    iconColor: "text-green-500",
  },
  neutral: {
    icon: Minus,
    label: "Neutral",
    bg: "bg-muted",
    border: "border-border",
    text: "text-muted-foreground",
    iconColor: "text-muted-foreground",
  },
  negative: {
    icon: ThumbsDown,
    label: "Negative",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    iconColor: "text-red-500",
  },
};

const urgencyConfig: Record<
  Extract<UrgencyKey, "critical" | "high">,
  {
    icon: LucideIcon;
    label: string;
    bg: string;
    border: string;
    text: string;
    iconColor: string;
    pulse: boolean;
  }
> = {
  critical: {
    icon: AlertTriangle,
    label: "Critical",
    bg: "bg-red-100",
    border: "border-red-300",
    text: "text-red-800",
    iconColor: "text-red-600",
    pulse: true,
  },
  high: {
    icon: Zap,
    label: "High Priority",
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    iconColor: "text-amber-600",
    pulse: false,
  },
};

const sizeConfig: Record<
  NonNullable<SentimentBadgeProps["size"]>,
  { badge: string; icon: string }
> = {
  sm: { badge: "px-1.5 py-0.5 text-xs gap-1", icon: "h-3 w-3" },
  md: { badge: "px-2 py-1 text-xs gap-1.5", icon: "h-3.5 w-3.5" },
  lg: { badge: "px-2.5 py-1.5 text-sm gap-2", icon: "h-4 w-4" },
};

export function SentimentBadge({
  sentiment,
  urgencyLevel,
  showLabel = true,
  size = "sm",
  className,
}: SentimentBadgeProps) {
  // Show urgency badge if critical or high
  if (urgencyLevel === "critical" || urgencyLevel === "high") {
    const config = urgencyConfig[urgencyLevel];
    const Icon = config.icon;
    const sizeStyles = sizeConfig[size];

    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border font-medium",
          config.bg,
          config.border,
          config.text,
          sizeStyles.badge,
          config.pulse && "animate-pulse",
          className,
        )}
        title={config.label}
      >
        <Icon className={cn(sizeStyles.icon, config.iconColor)} />
        {showLabel && <span>{config.label}</span>}
      </span>
    );
  }

  // Show sentiment badge
  if (!sentiment || !sentimentConfig[sentiment]) {
    return null;
  }

  const config = sentimentConfig[sentiment];
  const Icon = config.icon;
  const sizeStyles = sizeConfig[size];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        config.bg,
        config.border,
        config.text,
        sizeStyles.badge,
        className,
      )}
      title={config.label}
    >
      <Icon className={cn(sizeStyles.icon, config.iconColor)} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

/**
 * Sentiment score indicator - shows a colored bar
 */
interface SentimentScoreProps {
  score: number; // -1.0 to 1.0
  size?: "sm" | "md";
  className?: string;
}

export function SentimentScore({ score, size = "sm", className }: SentimentScoreProps) {
  // Normalize score to 0-100 for positioning
  const position = Math.round(((score + 1) / 2) * 100);

  // Determine color based on score
  let bgColor = "bg-muted";
  if (score > 0.3) bgColor = "bg-status-success";
  else if (score < -0.3) bgColor = "bg-status-error";
  else if (score > 0) bgColor = "bg-status-success/60";
  else if (score < 0) bgColor = "bg-status-error/60";

  const height = size === "sm" ? "h-1.5" : "h-2";
  const width = size === "sm" ? "w-16" : "w-24";

  return (
    <div
      className={cn(
        "relative",
        width,
        height,
        "bg-muted rounded-full border border-border",
        className,
      )}
    >
      {/* Indicator dot */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-white shadow",
          bgColor,
        )}
        style={{ left: `calc(${position}% - 4px)` }}
      />
    </div>
  );
}

/**
 * Summary card for sentiment stats
 */
interface SentimentSummaryProps {
  stats: {
    total: number;
    breakdown: { positive: number; neutral: number; negative: number };
    percentages: { positive: number; neutral: number; negative: number };
    urgency: { critical: number; high: number };
  };
  className?: string;
}

export function SentimentSummary({ stats, className }: SentimentSummaryProps) {
  return (
    <div className={cn("flex items-center gap-4 text-sm", className)}>
      {/* Sentiment breakdown */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-status-success-text">
          <ThumbsUp className="h-3.5 w-3.5" />
          {stats.percentages.positive}%
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Minus className="h-3.5 w-3.5" />
          {stats.percentages.neutral}%
        </span>
        <span className="flex items-center gap-1 text-status-error-text">
          <ThumbsDown className="h-3.5 w-3.5" />
          {stats.percentages.negative}%
        </span>
      </div>

      {/* Urgency indicators */}
      {(stats.urgency.critical > 0 || stats.urgency.high > 0) && (
        <div className="flex items-center gap-2 border-l border-border pl-4">
          {stats.urgency.critical > 0 && (
            <span className="flex items-center gap-1 text-red-600 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              {stats.urgency.critical}
            </span>
          )}
          {stats.urgency.high > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <Zap className="h-3.5 w-3.5" />
              {stats.urgency.high}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
