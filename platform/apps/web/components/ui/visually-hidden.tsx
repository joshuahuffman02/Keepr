import * as React from "react";

/**
 * VisuallyHidden - Component for screen reader-only content
 *
 * Uses the .sr-only utility class to hide content visually while
 * keeping it accessible to screen readers. This is useful for:
 * - Additional context for icon-only buttons
 * - Descriptive text for status indicators
 * - Skip links and navigation aids
 *
 * WCAG: 1.3.1 Info and Relationships (Level A)
 */
export interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export function VisuallyHidden({ children, ...props }: VisuallyHiddenProps) {
  return (
    <span className="sr-only" {...props}>
      {children}
    </span>
  );
}
