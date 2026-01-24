"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { Label } from "./label";
import { Check } from "lucide-react";

export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  showSuccess?: boolean;
}

const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ className, label, error, showSuccess, id, ...props }, ref) => {
    const fieldId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const hasError = !!error;
    const isValid = showSuccess && !hasError && props.value;

    return (
      <div className="space-y-1">
        {label && <Label htmlFor={fieldId}>{label}</Label>}
        <div className="relative">
          <textarea
            id={fieldId}
            ref={ref}
            className={cn(
              "flex min-h-[80px] w-full rounded-md border bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
              hasError
                ? "border-red-500 focus-visible:ring-red-500"
                : isValid
                  ? "border-green-500 focus-visible:ring-green-500"
                  : "border-border focus-visible:ring-ring",
              className,
            )}
            {...props}
          />
          {isValid && (
            <div className="absolute right-3 top-3">
              <Check className="h-4 w-4 text-green-600" />
            </div>
          )}
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

FormTextarea.displayName = "FormTextarea";

export { FormTextarea };
