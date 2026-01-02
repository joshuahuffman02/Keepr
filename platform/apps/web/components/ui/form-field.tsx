"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { Label } from "./label";
import { Check } from "lucide-react";

export interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  showSuccess?: boolean;
  helperText?: string;
  hideLabel?: boolean;
}

const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ className, label, error, showSuccess, helperText, hideLabel, id, ...props }, ref) => {
    const generatedId = React.useId();
    const fieldId = id || generatedId;
    const hasError = !!error;
    const isValid = showSuccess && !hasError && props.value;
    const errorId = hasError ? `${fieldId}-error` : undefined;
    const helperId = helperText ? `${fieldId}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(" ");

    return (
      <div className="space-y-1">
        {label && (
          <Label
            htmlFor={fieldId}
            className={cn(hideLabel && "sr-only")}
          >
            {label}
            {props.required && <span aria-label="required" className="text-status-error ml-1">*</span>}
          </Label>
        )}
        <div className="relative">
          <input
            id={fieldId}
            ref={ref}
            className={cn(
              "flex h-10 w-full rounded-md border bg-card px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
              hasError
                ? "border-status-error focus-visible:ring-status-error/50"
                : isValid
                ? "border-status-success focus-visible:ring-status-success/50"
                : "border-border focus-visible:ring-ring/20",
              isValid && "pr-10",
              className
            )}
            aria-invalid={hasError ? "true" : "false"}
            aria-describedby={describedBy || undefined}
            aria-required={props.required}
            {...props}
          />
          {isValid && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true">
              <Check className="h-4 w-4 text-green-600" />
            </div>
          )}
        </div>
        {error && (
          <p
            id={errorId}
            className="text-sm text-status-error"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            id={helperId}
            className="text-sm text-muted-foreground"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = "FormField";

export { FormField };
