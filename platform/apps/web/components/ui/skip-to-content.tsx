"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

/**
 * SkipToContent - WCAG 2.4.1 Bypass Blocks
 * Provides a keyboard-accessible link to skip repetitive navigation
 * and jump directly to main content.
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className={cn(
        "sr-only focus:not-sr-only",
        "fixed top-4 left-4 z-[9999]",
        "bg-action-primary text-action-primary-foreground",
        "px-4 py-2 rounded-md",
        "font-semibold text-sm",
        "focus:outline-none focus:ring-4 focus:ring-action-primary focus:ring-offset-2",
        "transition-all",
      )}
    >
      Skip to main content
    </a>
  );
}
