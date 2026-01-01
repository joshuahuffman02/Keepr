"use client";

import React, { useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface ValidatedFormFieldProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  value: string;
  error?: string;
  showSuccess?: boolean;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  inputClassName?: string;
  hint?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  transform?: (value: string) => string;
}

export function ValidatedFormField({
  label,
  name,
  type = "text",
  placeholder,
  value,
  error,
  showSuccess = false,
  required = false,
  disabled = false,
  autoComplete,
  className,
  inputClassName,
  hint,
  onChange,
  onBlur,
  transform,
}: ValidatedFormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const prefersReducedMotion = useReducedMotion();
  const [showPassword, setShowPassword] = React.useState(false);

  const isPasswordType = type === "password";
  const inputType = isPasswordType && showPassword ? "text" : type;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (transform) {
      const transformed = transform(e.target.value);
      const syntheticEvent = {
        ...e,
        target: { ...e.target, value: transformed },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    } else {
      onChange(e);
    }
  };

  const hasError = !!error;
  const isValid = showSuccess && !hasError && value.length > 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <Label
          htmlFor={id}
          className={cn(
            "text-sm font-medium",
            hasError ? "text-red-600" : "text-slate-700"
          )}
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>

        {/* Validation status indicator */}
        <AnimatePresence mode="wait">
          {hasError && (
            <motion.div
              key="error"
              initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1 text-xs text-red-600"
            >
              <AlertCircle className="h-3 w-3" />
            </motion.div>
          )}
          {isValid && (
            <motion.div
              key="success"
              initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1 text-xs text-emerald-600"
            >
              <Check className="h-3 w-3" />
              <span>Valid</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative">
        <Input
          id={id}
          name={name}
          type={inputType}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          autoComplete={autoComplete}
          onChange={handleChange}
          onBlur={onBlur}
          aria-invalid={hasError ? "true" : "false"}
          aria-describedby={
            [hasError ? errorId : null, hint ? hintId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-required={required}
          className={cn(
            "pr-10 transition-colors",
            hasError && "border-red-300 focus:border-red-500 focus:ring-red-200",
            isValid && "border-emerald-300 focus:border-emerald-500 focus:ring-emerald-200",
            inputClassName
          )}
        />

        {/* Right side icons */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isPasswordType && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}

          {!isPasswordType && (
            <AnimatePresence mode="wait">
              {hasError && (
                <motion.div
                  key="error-icon"
                  initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
                  exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
                >
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </motion.div>
              )}
              {isValid && (
                <motion.div
                  key="success-icon"
                  initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8, rotate: -90 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1, rotate: 0 }}
                  exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Check className="h-4 w-4 text-emerald-500" />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Error message */}
      <AnimatePresence mode="wait">
        {hasError && (
          <motion.p
            key="error-message"
            id={errorId}
            role="alert"
            initial={prefersReducedMotion ? {} : { opacity: 0, height: 0, y: -5 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, height: "auto", y: 0 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, height: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="text-xs text-red-600 flex items-center gap-1"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Hint text */}
      {hint && !hasError && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

// Email-specific auto-correction suggestions
export function EmailFormField(props: Omit<ValidatedFormFieldProps, "type">) {
  const [suggestion, setSuggestion] = React.useState<string | null>(null);

  const commonDomains = [
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "aol.com",
  ];

  const checkTypo = (email: string) => {
    if (!email.includes("@")) {
      setSuggestion(null);
      return;
    }

    const [, domain] = email.split("@");
    if (!domain) {
      setSuggestion(null);
      return;
    }

    // Check for common typos
    const typoMap: Record<string, string> = {
      "gmial.com": "gmail.com",
      "gmal.com": "gmail.com",
      "gmaill.com": "gmail.com",
      "gamil.com": "gmail.com",
      "yaho.com": "yahoo.com",
      "yahooo.com": "yahoo.com",
      "outloo.com": "outlook.com",
      "hotmal.com": "hotmail.com",
      "iclod.com": "icloud.com",
    };

    if (typoMap[domain]) {
      setSuggestion(email.replace(domain, typoMap[domain]));
    } else {
      setSuggestion(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    checkTypo(e.target.value);
    props.onChange(e);
  };

  const applySuggestion = () => {
    if (suggestion) {
      const syntheticEvent = {
        target: { value: suggestion },
      } as React.ChangeEvent<HTMLInputElement>;
      props.onChange(syntheticEvent);
      setSuggestion(null);
    }
  };

  return (
    <div>
      <ValidatedFormField
        {...props}
        type="email"
        onChange={handleChange}
        autoComplete="email"
      />

      <AnimatePresence>
        {suggestion && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="mt-1 text-xs text-blue-600 flex items-center gap-1"
          >
            Did you mean{" "}
            <button
              type="button"
              onClick={applySuggestion}
              className="font-medium underline hover:no-underline"
            >
              {suggestion}
            </button>
            ?
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Phone field with auto-formatting
export function PhoneFormField(props: Omit<ValidatedFormFieldProps, "type" | "transform">) {
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  return (
    <ValidatedFormField
      {...props}
      type="tel"
      transform={formatPhone}
      autoComplete="tel"
      placeholder={props.placeholder || "(555) 123-4567"}
    />
  );
}
