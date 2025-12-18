"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ValidationRule = "required" | "email" | "password" | "phone";

interface ValidatedInputProps {
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  validation?: ValidationRule;
  className?: string;
  showSuccessMessage?: boolean;
  successMessage?: string;
}

const validators: Record<ValidationRule, (value: string) => boolean> = {
  required: (value) => value.trim().length > 0,
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  password: (value) => value.length >= 8,
  phone: (value) => /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(value.replace(/\D/g, "").length >= 10 ? value : "")
};

export function ValidatedInput({
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  minLength,
  validation = "required",
  className,
  showSuccessMessage = true,
  successMessage = "Looks good!"
}: ValidatedInputProps) {
  const [isValid, setIsValid] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [touched, setTouched] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const valid = validators[validation](value);

    if (valid && !isValid && touched) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    }

    setIsValid(valid);
  }, [value, validation, isValid, touched]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!touched) setTouched(true);
    onChange(e.target.value);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          type={type}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          className={cn(
            "bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pr-10",
            "transition-all duration-200",
            "focus:bg-slate-800 focus:shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]",
            isValid && touched && "border-emerald-500/50 focus:border-emerald-500",
            className
          )}
        />

        <AnimatePresence>
          {isValid && touched && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
              transition={prefersReducedMotion ? { duration: 0.1 } : { type: "spring" as const, stiffness: 500, damping: 25 }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <Check className="h-5 w-5 text-emerald-400" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showSuccess && showSuccessMessage && !prefersReducedMotion && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute -bottom-5 left-0 text-emerald-400 text-xs"
          >
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
