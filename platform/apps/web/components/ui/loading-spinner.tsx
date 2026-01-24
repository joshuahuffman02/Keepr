"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * LoadingSpinner - Accessible loading indicator
 *
 * Includes proper ARIA attributes for screen readers
 * WCAG: 4.1.3 Status Messages (Level AA)
 */
export interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Size of the spinner
   */
  size?: "sm" | "md" | "lg";
  /**
   * Accessible label for the loading state
   */
  label?: string;
}

export function LoadingSpinner({
  size = "md",
  label = "Loading",
  className,
  ...props
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-3",
    lg: "h-12 w-12 border-4",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("flex items-center justify-center", className)}
      {...props}
    >
      <div
        className={cn(
          "animate-spin rounded-full border-border border-t-action-primary",
          sizeClasses[size],
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
