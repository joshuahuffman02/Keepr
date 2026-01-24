"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface CampfireSpinnerProps {
  size?: "sm" | "md" | "lg";
  message?: string;
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

const textSizes = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export function CampfireSpinner({
  size = "md",
  message = "Loading...",
  className,
}: CampfireSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className={cn("relative", sizeClasses[size])}>
        {/* Campfire icon with flicker animation */}
        <div className="animate-campfire-flicker">
          <Image
            src="/images/icons/campfire.png"
            alt="Loading"
            fill
            className="object-contain"
            sizes={size === "lg" ? "64px" : size === "md" ? "48px" : "32px"}
          />
        </div>

        {/* Glow effect behind campfire */}
        <div
          className="absolute inset-0 -z-10 animate-campfire-flicker rounded-full blur-md"
          style={{
            background: "radial-gradient(circle, rgba(251, 146, 60, 0.4) 0%, transparent 70%)",
            transform: "scale(1.5)",
          }}
        />
      </div>

      {message && (
        <p className={cn("text-muted-foreground animate-pulse", textSizes[size])}>{message}</p>
      )}
    </div>
  );
}

// Static version for reduced motion users
export function CampfireSpinnerStatic({
  size = "md",
  message = "Loading...",
  className,
}: CampfireSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className={cn("relative", sizeClasses[size])}>
        <Image
          src="/images/icons/campfire.png"
          alt="Loading"
          fill
          className="object-contain"
          sizes={size === "lg" ? "64px" : size === "md" ? "48px" : "32px"}
        />
      </div>
      {message && <p className={cn("text-muted-foreground", textSizes[size])}>{message}</p>}
    </div>
  );
}
