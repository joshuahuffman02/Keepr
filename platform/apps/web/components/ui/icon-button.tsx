"use client";

import * as React from "react";
import { Button, ButtonProps } from "./button";
import { VisuallyHidden } from "./visually-hidden";

/**
 * IconButton - Accessible button component for icon-only buttons
 *
 * Ensures icon-only buttons have proper accessible labels
 * WCAG: 4.1.2 Name, Role, Value (Level A)
 */
export interface IconButtonProps extends Omit<ButtonProps, "children"> {
  /**
   * Accessible label for screen readers
   * Required for icon-only buttons
   */
  ariaLabel: string;
  /**
   * The icon component to display
   */
  icon: React.ReactNode;
  /**
   * Optional tooltip text (if different from aria-label)
   */
  tooltip?: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ ariaLabel, icon, tooltip, ...props }, ref) => {
    return (
      <Button ref={ref} size="icon" aria-label={ariaLabel} title={tooltip || ariaLabel} {...props}>
        {icon}
        <VisuallyHidden>{ariaLabel}</VisuallyHidden>
      </Button>
    );
  },
);

IconButton.displayName = "IconButton";
