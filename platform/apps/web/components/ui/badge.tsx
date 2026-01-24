import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        // Semantic status variants
        success: "border-status-success-border bg-status-success-bg text-status-success",
        warning: "border-status-warning-border bg-status-warning-bg text-status-warning-foreground",
        error: "border-status-error-border bg-status-error-bg text-status-error",
        info: "border-status-info-border bg-status-info-bg text-status-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  /**
   * Screen reader text for the badge. If not provided, uses children.
   * Use this to provide context beyond just color (WCAG 1.4.1)
   */
  srText?: string;
  /**
   * Status text that appears alongside the badge for non-color indicators
   */
  statusText?: string;
}

function Badge({ className, variant, srText, statusText, children, ...props }: BadgeProps) {
  const content = statusText || children;
  const ariaLabel = srText || (typeof content === "string" ? content : undefined);

  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      role="status"
      aria-label={ariaLabel}
      {...props}
    >
      {content}
      {srText && typeof content !== "string" && <span className="sr-only">{srText}</span>}
    </div>
  );
}

export { Badge, badgeVariants };
