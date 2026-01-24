import { z } from "zod";

/**
 * Zod validation schemas for payment processing
 *
 * CRITICAL: These schemas protect against invalid payment data that could
 * cause financial discrepancies or security issues.
 *
 * All money amounts MUST be in cents (integers) to prevent floating-point errors.
 */

// Maximum payment amount: $1,000,000 = 100,000,000 cents
const MAX_PAYMENT_CENTS = 100_000_000;

// Payment Intent Schemas
export const CreatePaymentIntentSchema = z.object({
  reservationId: z.string().min(1, "Reservation ID is required"),
  amountCents: z
    .number()
    .int("Amount must be an integer")
    .positive("Amount must be positive")
    .max(MAX_PAYMENT_CENTS, "Amount exceeds maximum allowed"),
  currency: z.string().toLowerCase().optional().default("usd"),
  autoCapture: z.boolean().optional().default(true),
});

export const CreatePublicPaymentIntentSchema = z.object({
  reservationId: z.string().min(1, "Reservation ID is required"),
  currency: z.string().toLowerCase().optional().default("usd"),
  guestEmail: z.string().email().optional(),
  captureMethod: z.enum(["automatic", "manual"]).optional().default("automatic"),
});

export const CapturePaymentIntentSchema = z.object({
  amountCents: z
    .number()
    .int("Amount must be an integer")
    .positive("Amount must be positive")
    .max(MAX_PAYMENT_CENTS, "Amount exceeds maximum allowed")
    .optional(),
});

export const RefundPaymentIntentSchema = z.object({
  amountCents: z
    .number()
    .int("Amount must be an integer")
    .positive("Amount must be positive")
    .max(MAX_PAYMENT_CENTS, "Amount exceeds maximum allowed")
    .optional(),
  reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).optional(),
});

// Payment Settings Schemas
export const UpdatePaymentSettingsSchema = z.object({
  applicationFeeFlatCents: z
    .number()
    .int("Fee must be an integer")
    .min(0, "Fee cannot be negative")
    .max(10_000, "Fee exceeds maximum (100.00)")
    .optional(),
  billingPlan: z.enum(["ota_only", "standard", "enterprise"]).optional(),
  perBookingFeeCents: z
    .number()
    .int("Fee must be an integer")
    .min(0, "Fee cannot be negative")
    .max(10_000, "Fee exceeds maximum (100.00)")
    .optional(),
  monthlyFeeCents: z
    .number()
    .int("Fee must be an integer")
    .min(0, "Fee cannot be negative")
    .max(100_000, "Fee exceeds maximum (1000.00)")
    .optional(),
  feeMode: z.enum(["absorb", "pass_through"]).optional(),
});

// Setup Intent Schemas
export const CreateSetupIntentSchema = z.object({
  reservationId: z.string().min(1, "Reservation ID is required"),
  customerEmail: z.string().email().optional(),
});

export const CreatePublicSetupIntentSchema = z.object({
  reservationId: z.string().min(1, "Reservation ID is required"),
  guestEmail: z.string().email().optional(),
});

// Payment Confirmation Schema
export const ConfirmPublicPaymentIntentSchema = z.object({
  reservationId: z.string().min(1, "Reservation ID is required"),
});

// Type exports for TypeScript
export type CreatePaymentIntentInput = z.infer<typeof CreatePaymentIntentSchema>;
export type CreatePublicPaymentIntentInput = z.infer<typeof CreatePublicPaymentIntentSchema>;
export type CapturePaymentIntentInput = z.infer<typeof CapturePaymentIntentSchema>;
export type RefundPaymentIntentInput = z.infer<typeof RefundPaymentIntentSchema>;
export type UpdatePaymentSettingsInput = z.infer<typeof UpdatePaymentSettingsSchema>;
export type CreateSetupIntentInput = z.infer<typeof CreateSetupIntentSchema>;
export type CreatePublicSetupIntentInput = z.infer<typeof CreatePublicSetupIntentSchema>;
export type ConfirmPublicPaymentIntentInput = z.infer<typeof ConfirmPublicPaymentIntentSchema>;
