import {
  CreatePaymentIntentSchema,
  CreatePublicPaymentIntentSchema,
  CapturePaymentIntentSchema,
  RefundPaymentIntentSchema,
  UpdatePaymentSettingsSchema,
} from "../schemas/payment-validation.schema";

/**
 * Payment Validation Tests
 *
 * These tests ensure that Zod schemas properly validate payment data
 * and prevent invalid amounts, currencies, or other critical data from
 * reaching the payment processing logic.
 *
 * CRITICAL: These tests protect against financial discrepancies.
 */

describe("Payment Validation Schemas", () => {
  describe("CreatePaymentIntentSchema", () => {
    it("should validate valid payment intent data", () => {
      const validData = {
        reservationId: "res_123",
        amountCents: 9999, // $99.99
        currency: "usd",
        autoCapture: true,
      };

      const result = CreatePaymentIntentSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it("should reject negative amounts", () => {
      const invalidData = {
        reservationId: "res_123",
        amountCents: -1000,
        currency: "usd",
      };

      expect(() => CreatePaymentIntentSchema.parse(invalidData)).toThrow();
    });

    it("should reject zero amounts", () => {
      const invalidData = {
        reservationId: "res_123",
        amountCents: 0,
        currency: "usd",
      };

      expect(() => CreatePaymentIntentSchema.parse(invalidData)).toThrow();
    });

    it("should reject amounts exceeding maximum ($1M)", () => {
      const invalidData = {
        reservationId: "res_123",
        amountCents: 100_000_001, // Over $1M
        currency: "usd",
      };

      expect(() => CreatePaymentIntentSchema.parse(invalidData)).toThrow();
    });

    it("should reject floating point amounts", () => {
      const invalidData = {
        reservationId: "res_123",
        amountCents: 99.99, // Should be 9999 (cents)
        currency: "usd",
      };

      expect(() => CreatePaymentIntentSchema.parse(invalidData)).toThrow();
    });

    it("should reject missing reservationId", () => {
      const invalidData = {
        amountCents: 9999,
        currency: "usd",
      };

      expect(() => CreatePaymentIntentSchema.parse(invalidData)).toThrow();
    });

    it("should default currency to usd when not provided", () => {
      const data = {
        reservationId: "res_123",
        amountCents: 9999,
      };

      const result = CreatePaymentIntentSchema.parse(data);
      expect(result.currency).toBe("usd");
    });

    it("should normalize currency to lowercase", () => {
      const data = {
        reservationId: "res_123",
        amountCents: 9999,
        currency: "USD",
      };

      const result = CreatePaymentIntentSchema.parse(data);
      expect(result.currency).toBe("usd");
    });
  });

  describe("CreatePublicPaymentIntentSchema", () => {
    it("should validate valid public payment intent", () => {
      const validData = {
        reservationId: "res_456",
        currency: "usd",
        guestEmail: "guest@example.com",
        captureMethod: "automatic",
      };

      const result = CreatePublicPaymentIntentSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it("should reject invalid email format", () => {
      const invalidData = {
        reservationId: "res_456",
        guestEmail: "not-an-email",
      };

      expect(() => CreatePublicPaymentIntentSchema.parse(invalidData)).toThrow();
    });

    it("should accept manual capture method", () => {
      const data = {
        reservationId: "res_456",
        captureMethod: "manual",
      };

      const result = CreatePublicPaymentIntentSchema.parse(data);
      expect(result.captureMethod).toBe("manual");
    });

    it("should default to automatic capture method", () => {
      const data = {
        reservationId: "res_456",
      };

      const result = CreatePublicPaymentIntentSchema.parse(data);
      expect(result.captureMethod).toBe("automatic");
    });
  });

  describe("CapturePaymentIntentSchema", () => {
    it("should validate valid capture amount", () => {
      const validData = {
        amountCents: 5000, // $50.00
      };

      const result = CapturePaymentIntentSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it("should allow empty body (capture full amount)", () => {
      const result = CapturePaymentIntentSchema.parse({});
      expect(result.amountCents).toBeUndefined();
    });

    it("should reject negative capture amounts", () => {
      const invalidData = {
        amountCents: -500,
      };

      expect(() => CapturePaymentIntentSchema.parse(invalidData)).toThrow();
    });
  });

  describe("RefundPaymentIntentSchema", () => {
    it("should validate valid refund", () => {
      const validData = {
        amountCents: 3000,
        reason: "requested_by_customer",
      };

      const result = RefundPaymentIntentSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it("should accept all valid refund reasons", () => {
      const reasons: Array<"duplicate" | "fraudulent" | "requested_by_customer"> = [
        "duplicate",
        "fraudulent",
        "requested_by_customer",
      ];

      for (const reason of reasons) {
        const data = { amountCents: 1000, reason };
        expect(() => RefundPaymentIntentSchema.parse(data)).not.toThrow();
      }
    });

    it("should reject invalid refund reasons", () => {
      const invalidData = {
        amountCents: 1000,
        reason: "invalid_reason",
      };

      expect(() => RefundPaymentIntentSchema.parse(invalidData)).toThrow();
    });

    it("should allow refund without specifying amount (full refund)", () => {
      const data = {
        reason: "requested_by_customer",
      };

      const result = RefundPaymentIntentSchema.parse(data);
      expect(result.amountCents).toBeUndefined();
    });
  });

  describe("UpdatePaymentSettingsSchema", () => {
    it("should validate valid payment settings", () => {
      const validData = {
        applicationFeeFlatCents: 200, // $2.00
        billingPlan: "standard",
        perBookingFeeCents: 150,
        monthlyFeeCents: 5000,
        feeMode: "absorb",
      };

      const result = UpdatePaymentSettingsSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    it("should reject negative fees", () => {
      const invalidData = {
        applicationFeeFlatCents: -100,
      };

      expect(() => UpdatePaymentSettingsSchema.parse(invalidData)).toThrow();
    });

    it("should reject fees exceeding maximum", () => {
      const invalidData = {
        applicationFeeFlatCents: 10_001, // Over $100
      };

      expect(() => UpdatePaymentSettingsSchema.parse(invalidData)).toThrow();
    });

    it("should accept all valid billing plans", () => {
      const plans: Array<"ota_only" | "standard" | "enterprise"> = [
        "ota_only",
        "standard",
        "enterprise",
      ];

      for (const billingPlan of plans) {
        const data = { billingPlan };
        expect(() => UpdatePaymentSettingsSchema.parse(data)).not.toThrow();
      }
    });

    it("should accept all valid fee modes", () => {
      const modes: Array<"absorb" | "pass_through"> = ["absorb", "pass_through"];

      for (const feeMode of modes) {
        const data = { feeMode };
        expect(() => UpdatePaymentSettingsSchema.parse(data)).not.toThrow();
      }
    });
  });
});
