"use client";

import { MapPin, Users, Star, Receipt } from "lucide-react";
import { cn } from "../../lib/utils";

interface Stat {
  value: string;
  label: string;
  icon: typeof MapPin;
  suffix?: string;
}

const defaultStats: Stat[] = [
  { value: "500+", label: "Campgrounds", icon: MapPin },
  { value: "50K+", label: "Happy Campers", icon: Users },
  { value: "4.8", label: "Average Rating", icon: Star, suffix: "★" },
  { value: "$0", label: "Booking Fees", icon: Receipt },
];

interface SocialProofStripProps {
  stats?: Stat[];
  className?: string;
  variant?: "light" | "dark" | "gradient";
}

export function SocialProofStrip({
  stats = defaultStats,
  className,
  variant = "light"
}: SocialProofStripProps) {
  const variantStyles = {
    light: "bg-white border-y border-slate-100",
    dark: "bg-slate-900 text-white",
    gradient: "bg-gradient-to-r from-emerald-50 to-teal-50 border-y border-emerald-100",
  };

  const textStyles = {
    light: {
      value: "text-slate-900",
      label: "text-slate-600",
      icon: "text-emerald-600",
    },
    dark: {
      value: "text-white",
      label: "text-slate-400",
      icon: "text-emerald-400",
    },
    gradient: {
      value: "text-slate-900",
      label: "text-slate-600",
      icon: "text-emerald-600",
    },
  };

  const styles = textStyles[variant];

  return (
    <div className={cn(variantStyles[variant], "py-6 md:py-8", className)}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <stat.icon className={cn("h-5 w-5", styles.icon)} />
                <span className={cn("text-2xl md:text-3xl font-bold", styles.value)}>
                  {stat.value}{stat.suffix}
                </span>
              </div>
              <p className={cn("text-sm", styles.label)}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Compact inline version for hero area
export function SocialProofInline({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm", className)}>
      <span className="text-white/90">
        <strong className="text-white">500+</strong> campgrounds
      </span>
      <span className="text-white/40">•</span>
      <span className="text-white/90">
        <strong className="text-white">50K+</strong> happy campers
      </span>
      <span className="text-white/40">•</span>
      <span className="text-white/90">
        <strong className="text-white">4.8★</strong> avg rating
      </span>
    </div>
  );
}
