"use client";

import { useState, useCallback, useMemo } from "react";

/**
 * Validation rule definition
 */
export type ValidationRule<T = string> = {
  validate: (value: T, allValues?: Record<string, unknown>) => boolean;
  message: string;
};

/**
 * Built-in validation rules
 */
export const validators = {
  required: (message = "This field is required"): ValidationRule => ({
    validate: (value) => value !== null && value !== undefined && String(value).trim().length > 0,
    message,
  }),

  email: (message = "Please enter a valid email address"): ValidationRule => ({
    validate: (value) =>
      !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)),
    message,
  }),

  url: (message = "Please enter a valid URL"): ValidationRule => ({
    validate: (value) => {
      if (!value) return true;
      try {
        new URL(String(value));
        return true;
      } catch {
        return false;
      }
    },
    message,
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    validate: (value) => !value || String(value).length >= min,
    message: message || `Must be at least ${min} characters`,
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    validate: (value) => !value || String(value).length <= max,
    message: message || `Must be no more than ${max} characters`,
  }),

  min: (min: number, message?: string): ValidationRule<number | string> => ({
    validate: (value) => {
      if (value === null || value === undefined || value === "") return true;
      const num = typeof value === "string" ? parseFloat(value) : value;
      return !isNaN(num) && num >= min;
    },
    message: message || `Must be at least ${min}`,
  }),

  max: (max: number, message?: string): ValidationRule<number | string> => ({
    validate: (value) => {
      if (value === null || value === undefined || value === "") return true;
      const num = typeof value === "string" ? parseFloat(value) : value;
      return !isNaN(num) && num <= max;
    },
    message: message || `Must be no more than ${max}`,
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    validate: (value) => !value || regex.test(String(value)),
    message,
  }),

  hexColor: (message = "Please enter a valid hex color (e.g., #0F766E)"): ValidationRule => ({
    validate: (value) => !value || /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(String(value)),
    message,
  }),

  phone: (message = "Please enter a valid phone number"): ValidationRule => ({
    validate: (value) => !value || /^[\d\s\-+()]+$/.test(String(value)),
    message,
  }),

  integer: (message = "Please enter a whole number"): ValidationRule<number | string> => ({
    validate: (value) => {
      if (value === null || value === undefined || value === "") return true;
      const num = typeof value === "string" ? parseFloat(value) : value;
      return !isNaN(num) && Number.isInteger(num);
    },
    message,
  }),
};

type FieldConfig = {
  rules?: ValidationRule[];
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
};

type FieldState = {
  value: string;
  error: string | null;
  touched: boolean;
  dirty: boolean;
};

type FormState<T extends Record<string, unknown>> = {
  values: T;
  errors: Partial<Record<keyof T, string | null>>;
  touched: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isDirty: boolean;
};

/**
 * Hook for form validation with real-time feedback
 *
 * @example
 * const { fields, validateField, validateAll, isValid, getFieldProps } = useFormValidation({
 *   email: { rules: [validators.required(), validators.email()] },
 *   name: { rules: [validators.required(), validators.maxLength(100)] },
 * }, { email: '', name: '' });
 *
 * <FormField {...getFieldProps('email')} label="Email" />
 */
export function useFormValidation<T extends Record<string, string>>(
  fieldConfigs: Record<keyof T, FieldConfig>,
  initialValues: T
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string | null>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [dirty, setDirty] = useState<Partial<Record<keyof T, boolean>>>({});

  const validateField = useCallback(
    (field: keyof T, value?: string): string | null => {
      const config = fieldConfigs[field];
      if (!config?.rules) return null;

      const valueToValidate = value ?? values[field];

      for (const rule of config.rules) {
        if (!rule.validate(valueToValidate, values as Record<string, unknown>)) {
          return rule.message;
        }
      }
      return null;
    },
    [fieldConfigs, values]
  );

  const handleChange = useCallback(
    (field: keyof T, value: string) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      setDirty((prev) => ({ ...prev, [field]: true }));

      const config = fieldConfigs[field];
      if (config?.validateOnChange !== false) {
        const error = validateField(field, value);
        setErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [fieldConfigs, validateField]
  );

  const handleBlur = useCallback(
    (field: keyof T) => {
      setTouched((prev) => ({ ...prev, [field]: true }));

      const config = fieldConfigs[field];
      if (config?.validateOnBlur !== false) {
        const error = validateField(field);
        setErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [fieldConfigs, validateField]
  );

  const validateAll = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string | null>> = {};
    let isValid = true;

    for (const field of Object.keys(fieldConfigs) as (keyof T)[]) {
      const error = validateField(field);
      newErrors[field] = error;
      if (error) isValid = false;
    }

    setErrors(newErrors);
    setTouched(
      Object.keys(fieldConfigs).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {} as Partial<Record<keyof T, boolean>>
      )
    );

    return isValid;
  }, [fieldConfigs, validateField]);

  const resetForm = useCallback((newValues?: T) => {
    setValues(newValues || initialValues);
    setErrors({});
    setTouched({});
    setDirty({});
  }, [initialValues]);

  const setFieldValue = useCallback((field: keyof T, value: string) => {
    handleChange(field, value);
  }, [handleChange]);

  const setFieldError = useCallback((field: keyof T, error: string | null) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  const isValid = useMemo(() => {
    return Object.values(errors).every((e) => !e);
  }, [errors]);

  const isDirty = useMemo(() => {
    return Object.values(dirty).some(Boolean);
  }, [dirty]);

  /**
   * Get props to spread on FormField component
   */
  const getFieldProps = useCallback(
    (field: keyof T) => ({
      value: values[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        handleChange(field, e.target.value),
      onBlur: () => handleBlur(field),
      error: touched[field] ? errors[field] || undefined : undefined,
      showSuccess: touched[field] && !errors[field] && !!values[field],
    }),
    [values, errors, touched, handleChange, handleBlur]
  );

  return {
    values,
    errors,
    touched,
    isValid,
    isDirty,
    validateField,
    validateAll,
    handleChange,
    handleBlur,
    resetForm,
    setFieldValue,
    setFieldError,
    getFieldProps,
  };
}

export type { FieldConfig, FieldState, FormState };
