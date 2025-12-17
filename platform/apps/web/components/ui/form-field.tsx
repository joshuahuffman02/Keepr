"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { Label } from "./label";
import { Check } from "lucide-react";

export interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  showSuccess?: boolean;
}

const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ className, label, error, showSuccess, id, ...props }, ref) => {
    const fieldId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const hasError = !!error;
    const isValid = showSuccess && !hasError && props.value;

    return (
      <div className="space-y-1">
        {label && <Label htmlFor={fieldId}>{label}</Label>}
        <div className="relative">
          <input
            id={fieldId}
            ref={ref}
            className={cn(
              "flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
              hasError
                ? "border-red-500 focus-visible:ring-red-500"
                : isValid
                ? "border-green-500 focus-visible:ring-green-500"
                : "border-slate-200 focus-visible:ring-slate-950",
              isValid && "pr-10",
              className
            )}
            {...props}
          />
          {isValid && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
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
  }
);

FormField.displayName = "FormField";

export { FormField };
