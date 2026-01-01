"use client";

import { Camera, DollarSign, Zap, Building2, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface TrustBadgesProps {
  variant?: "inline" | "stacked" | "compact";
  className?: string;
  showIcons?: boolean;
}

const badges = [
  {
    icon: Camera,
    text: "Real photos. No surprises.",
    shortText: "Verified photos",
  },
  {
    icon: DollarSign,
    text: "Transparent pricing.",
    shortText: "Clear pricing",
  },
  {
    icon: Zap,
    text: "Instant confirmation.",
    shortText: "Instant booking",
  },
  {
    icon: Building2,
    text: "Book direct.",
    shortText: "Direct booking",
  },
];

export function TrustBadges({ variant = "inline", className, showIcons = true }: TrustBadgesProps) {
  if (variant === "compact") {
    return (
      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 text-sm", className)}>
        {badges.map((badge, i) => (
          <div key={i} className="flex items-center gap-1.5 text-white/90">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            <span>{badge.shortText}</span>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-4", className)}>
        {badges.map((badge, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 flex-shrink-0">
              <badge.icon className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-700">{badge.shortText}</p>
          </div>
        ))}
      </div>
    );
  }

  // Default: inline
  return (
    <div className={cn("flex flex-wrap items-center gap-3 md:gap-6", className)}>
      {badges.map((badge, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1.5 text-sm text-white/90"
        >
          {showIcons && (
            <badge.icon className="h-4 w-4" />
          )}
          <span>{badge.shortText}</span>
        </div>
      ))}
    </div>
  );
}

// Variant for dark backgrounds (hero)
export function TrustBadgesDark({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/80", className)}>
      <span className="flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        Verified photos
      </span>
      <span className="flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        Clear pricing
      </span>
      <span className="flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        Instant confirmation
      </span>
      <span className="flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        Book direct
      </span>
    </div>
  );
}
