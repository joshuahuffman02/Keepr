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
    validate: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)),
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
export function useFormValidation(
  fieldConfigs: Record<string, FieldConfig>,
  initialValues: Record<string, string>,
) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  const validateField = useCallback(
    (field: string, value?: string): string | null => {
      const config = fieldConfigs[field];
      if (!config?.rules) return null;

      const valueToValidate = value ?? values[field];

      for (const rule of config.rules) {
        if (!rule.validate(valueToValidate, values)) {
          return rule.message;
        }
      }
      return null;
    },
    [fieldConfigs, values],
  );

  const handleChange = useCallback(
    (field: string, value: string) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      setDirty((prev) => ({ ...prev, [field]: true }));

      const config = fieldConfigs[field];
      if (config?.validateOnChange !== false) {
        const error = validateField(field, value);
        setErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [fieldConfigs, validateField],
  );

  const handleBlur = useCallback(
    (field: string) => {
      setTouched((prev) => ({ ...prev, [field]: true }));

      const config = fieldConfigs[field];
      if (config?.validateOnBlur !== false) {
        const error = validateField(field);
        setErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [fieldConfigs, validateField],
  );

  const validateAll = useCallback((): boolean => {
    const newErrors: Record<string, string | null> = {};
    let isValid = true;

    for (const field of Object.keys(fieldConfigs)) {
      const error = validateField(field);
      newErrors[field] = error;
      if (error) isValid = false;
    }

    setErrors(newErrors);
    const allTouched: Record<string, boolean> = {};
    Object.keys(fieldConfigs).forEach((key) => {
      allTouched[key] = true;
    });
    setTouched(allTouched);

    return isValid;
  }, [fieldConfigs, validateField]);

  const resetForm = useCallback(
    (newValues?: Record<string, string>) => {
      setValues(newValues || initialValues);
      setErrors({});
      setTouched({});
      setDirty({});
    },
    [initialValues],
  );

  const setFieldValue = useCallback(
    (field: string, value: string) => {
      handleChange(field, value);
    },
    [handleChange],
  );

  const setFieldError = useCallback((field: string, error: string | null) => {
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
    (field: string) => ({
      value: values[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        handleChange(field, e.target.value),
      onBlur: () => handleBlur(field),
      error: touched[field] ? errors[field] || undefined : undefined,
      showSuccess: touched[field] && !errors[field] && !!values[field],
    }),
    [values, errors, touched, handleChange, handleBlur],
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
