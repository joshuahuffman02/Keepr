import { PaymentsController } from "./payments.controller";
import { Test, TestingModule } from "@nestjs/testing";
import { ReservationsService } from "../reservations/reservations.service";
import { StripeService } from "./stripe.service";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsReconciliationService } from "./reconciliation.service";
import { IdempotencyService } from "./idempotency.service";
import { GatewayConfigService } from "./gateway-config.service";
import { Reflector } from "@nestjs/core";
import { PermissionsService } from "../permissions/permissions.service";

describe("PaymentsController - Fee Calculations", () => {
  let controller: PaymentsController;
  let moduleRef: TestingModule | undefined;

  const callPrivate = (key: string, ...args: unknown[]) => {
    const value = Reflect.get(controller, key);
    if (typeof value !== "function") {
      throw new Error(`${key} is not a function`);
    }
    return value.call(controller, ...args);
  };

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: ReservationsService, useValue: {} },
        { provide: StripeService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: PaymentsReconciliationService, useValue: {} },
        { provide: IdempotencyService, useValue: {} },
        { provide: GatewayConfigService, useValue: {} },
        { provide: Reflector, useValue: new Reflector() },
        {
          provide: PermissionsService,
          useValue: {
            isPlatformStaff: () => false,
            checkAccess: async () => ({ allowed: true }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(PaymentsController);
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  describe("calculateGatewayFee", () => {
    const calculateGatewayFee = (
      amountCents: number,
      percentBasisPoints: number | null | undefined,
      flatFeeCents: number | null | undefined,
    ) => {
      return callPrivate("calculateGatewayFee", amountCents, percentBasisPoints, flatFeeCents);
    };

    it("should calculate fee with percentage only", () => {
      // 2.9% of $100.00 = $2.90 = 290 cents
      // 2.9% = 290 basis points
      const result = calculateGatewayFee(10000, 290, 0);
      expect(result).toBe(290);
    });

    it("should calculate fee with flat fee only", () => {
      const result = calculateGatewayFee(10000, 0, 30);
      expect(result).toBe(30);
    });

    it("should calculate combined percentage and flat fee", () => {
      // Standard Stripe: 2.9% + $0.30
      // On $100.00: 290 cents + 30 cents = 320 cents
      const result = calculateGatewayFee(10000, 290, 30);
      expect(result).toBe(320);
    });

    it("should round percentage portion correctly", () => {
      // 2.9% of $1.00 = $0.029 = 2.9 cents, rounds to 3
      const result = calculateGatewayFee(100, 290, 0);
      expect(result).toBe(3);
    });

    it("should handle zero amount", () => {
      const result = calculateGatewayFee(0, 290, 30);
      expect(result).toBe(30); // Just flat fee
    });

    it("should return 0 for negative result (defensive)", () => {
      // Math.max(0, ...) ensures no negative fees
      const result = calculateGatewayFee(0, 0, 0);
      expect(result).toBe(0);
    });

    it("should handle null/undefined values gracefully", () => {
      const result = calculateGatewayFee(10000, null, undefined);
      expect(result).toBe(0);
    });

    it("should calculate fee for large amounts", () => {
      // 2.9% of $10,000.00 = $290.00 = 29000 cents
      const result = calculateGatewayFee(1000000, 290, 30);
      expect(result).toBe(29030);
    });

    it("should calculate fee for small amounts", () => {
      // 2.9% of $0.50 = $0.0145 = 1 cent (rounded) + 30 flat = 31 cents
      const result = calculateGatewayFee(50, 290, 30);
      expect(result).toBe(31);
    });
  });

  describe("computeChargeAmounts", () => {
    type ChargeOptions = {
      reservation: {
        balanceAmount?: number | null;
        totalAmount?: number | null;
        paidAmount?: number | null;
      };
      platformFeeMode: string;
      applicationFeeCents: number;
      gatewayFeeMode: string;
      gatewayFeePercentBasisPoints: number;
      gatewayFeeFlatCents: number;
      requestedAmountCents?: number;
    };
    const computeChargeAmounts = (opts: ChargeOptions) => {
      return callPrivate("computeChargeAmounts", opts);
    };

    describe("base due calculation", () => {
      it("should use balanceAmount when available", () => {
        const result = computeChargeAmounts({
          reservation: { balanceAmount: 5000, totalAmount: 10000, paidAmount: 3000 },
          platformFeeMode: "absorb",
          applicationFeeCents: 200,
          gatewayFeeMode: "absorb",
          gatewayFeePercentBasisPoints: 290,
          gatewayFeeFlatCents: 30,
        });
        expect(result.baseDue).toBe(5000);
      });

      it("should calculate from total - paid when balanceAmount is null", () => {
        const result = computeChargeAmounts({
          reservation: { balanceAmount: null, totalAmount: 10000, paidAmount: 3000 },
          platformFeeMode: "absorb",
          applicationFeeCents: 200,
          gatewayFeeMode: "absorb",
          gatewayFeePercentBasisPoints: 290,
          gatewayFeeFlatCents: 30,
        });
        expect(result.baseDue).toBe(7000);
      });

      it("should handle fully paid reservation", () => {
        const result = computeChargeAmounts({
          reservation: { balanceAmount: 0, totalAmount: 10000, paidAmount: 10000 },
          platformFeeMode: "absorb",
          applicationFeeCents: 200,
          gatewayFeeMode: "absorb",
          gatewayFeePercentBasisPoints: 290,
          gatewayFeeFlatCents: 30,
        });
        expect(result.baseDue).toBe(0);
        expect(result.amountCents).toBe(0);
      });
    });

    describe("absorb mode (campground absorbs fees)", () => {
      it("should not add pass-through fees in absorb mode", () => {
        const result = computeChargeAmounts({
          reservation: { balanceAmount: 10000 },
          platformFeeMode: "absorb",
          applicationFeeCents: 200,
          gatewayFeeMode: "absorb",
          gatewayFeePercentBasisPoints: 290,
          gatewayFeeFlatCents: 30,
        });
        expect(result.platformPassThroughFeeCents).toBe(0);
        expect(result.gatewayPassThroughFeeCents).toBe(0);
        expect(result.amountCents).toBe(10000);
      });
    });

    describe("pass_through mode (guest pays fees)", () => {
      it("should add platform fee when platformFeeMode is pass_through", () => {
        const result = computeChargeAmounts({
          reservation: { balanceAmount: 10000 },
          platformFeeMode: "pass_through",
          applicationFeeCents: 200,
          gatewayFeeMode: "absorb",
          gatewayFeePercentBasisPoints: 290,
          gatewayFeeFlatCents: 30,
        });
        expect(result.platformPassThroughFeeCents).toBe(200);
        expect(result.gatewayPassThroughFeeCents).toBe(0);
        expect(result.amountCents).toBe(10200);
      });

      it("should add gateway fee when gatewayFeeMode is pass_through", () => {
        const result = computeChargeAmounts({
          reservation: { balanceAmount: 10000 },
          platformFeeMode: "absorb",
          applicationFeeCents: 200,
          gatewayFeeMode: "pass_through",
          gatewayFeePercentBasisPoints: 290,
          gatewayFeeFlatCents: 30,
        });
        expect(result.platformPassThroughFeeCents).toBe(0);
        // Gateway fee: (10000 * 290 / 10000) + 30 = 290 + 30 = 320
        expect(result.gatewayPassThroughFeeCents).toBe(320);
        expect(result.amountCents).toBe(10320);
      });

      it("should add both fees when both modes are pass_through", () => {
        const result = computeChargeAmounts({
          reservation: { balanceAmount: 10000 },
          platformFeeMode: "pass_through",
          applicationFeeCents: 200,
          gatewayFeeMode: "pass_through",
          gatewayFeePercentBasisPoints: 290,
          gatewayFeeFlatCents: 30,
        });
        expect(result.platformPassThroughFeeCents).toBe(200);
        expect(result.gatewayPassThroughFeeCents).toBe(320);
        expect(result.amountCents).toBe(10520);
      });
    });

    describe("requested amount handling", () => {
      it("should use requested amount when less than max charge", () => {
        const result = computeChargeAmounts({
          reservation: { balanceAmount: 10000 },
          platformFeeMode: "absorb",
          applicationFeeCents: 200,
          gatewayFeeMode: "absorb",
          gatewayFeePercentBasisPoints: 290,
          gatewayFeeFlatCents: 30,
          requestedAmountCents: 5000,
        });
        expect(result.amountCents).toBe(5000);
      });

      it("should cap at max charge when requested amount exceeds it", () => {
        const result = computeChargeAmounts({
          reservation: { balanceAmount: 10000 },
          platformFeeMode: "absorb",
          applicationFeeCents: 200,
          gatewayFeeMode: "absorb",
          gatewayFeePercentBasisPoints: 290,
          gatewayFeeFlatCents: 30,
          requestedAmountCents: 50000,
        });
        expect(result.amountCents).toBe(10000);
      });

      it("should handle negative requested amount", () => {
        const result = computeChargeAmounts({
          reservation: { balanceAmount: 10000 },
          platformFeeMode: "absorb",
          applicationFeeCents: 200,
          gatewayFeeMode: "absorb",
          gatewayFeePercentBasisPoints: 290,
          gatewayFeeFlatCents: 30,
          requestedAmountCents: -100,
        });
        expect(result.amountCents).toBe(0);
      });
    });
  });

  describe("buildReceiptLinesFromIntent", () => {
    type IntentLike = {
      amount?: number | null;
      amount_received?: number | null;
      metadata?: Record<string, string | number | null | undefined>;
    };
    const buildReceiptLinesFromIntent = (intent: IntentLike) => {
      return callPrivate("buildReceiptLinesFromIntent", intent);
    };

    it("should build receipt lines from basic payment intent", () => {
      const intent = {
        amount: 10000,
        amount_received: 10000,
        metadata: {
          baseAmountCents: "9400",
          platformPassThroughFeeCents: "200",
          gatewayPassThroughFeeCents: "400",
        },
      };

      const result = buildReceiptLinesFromIntent(intent);

      expect(result.lineItems).toHaveLength(3);
      expect(result.lineItems[0]).toEqual({ label: "Reservation charge", amountCents: 9400 });
      expect(result.lineItems[1]).toEqual({ label: "Platform fee", amountCents: 200 });
      expect(result.lineItems[2]).toEqual({ label: "Gateway fee", amountCents: 400 });
      expect(result.feeCents).toBe(600);
      expect(result.totalCents).toBe(10000);
    });

    it("should handle intent with no pass-through fees", () => {
      const intent = {
        amount: 10000,
        amount_received: 10000,
        metadata: {},
      };

      const result = buildReceiptLinesFromIntent(intent);

      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0]).toEqual({ label: "Reservation charge", amountCents: 10000 });
      expect(result.feeCents).toBeUndefined();
      expect(result.totalCents).toBe(10000);
    });

    it("should include tax when present", () => {
      const intent = {
        amount: 10800,
        amount_received: 10800,
        metadata: {
          baseAmountCents: "10000",
          taxCents: "800",
        },
      };

      const result = buildReceiptLinesFromIntent(intent);

      expect(result.taxCents).toBe(800);
      expect(result.totalCents).toBe(10800);
    });

    it("should use applicationFeeCents as fallback for platform fee", () => {
      const intent = {
        amount: 10200,
        amount_received: 10200,
        metadata: {
          applicationFeeCents: "200", // legacy field name
        },
      };

      const result = buildReceiptLinesFromIntent(intent);

      expect(result.lineItems).toContainEqual({ label: "Platform fee", amountCents: 200 });
    });

    it("should handle zero amounts gracefully", () => {
      const intent = {
        amount: 0,
        metadata: {
          baseAmountCents: "0",
        },
      };

      const result = buildReceiptLinesFromIntent(intent);

      expect(result.lineItems).toHaveLength(0);
      expect(result.totalCents).toBe(0);
    });

    it("should handle missing metadata", () => {
      const intent = {
        amount: 5000,
      };

      const result = buildReceiptLinesFromIntent(intent);

      expect(result.lineItems).toHaveLength(1);
      expect(result.totalCents).toBe(5000);
    });

    it("should parse string metadata values correctly", () => {
      const intent = {
        amount: 10000,
        amount_received: 10000,
        metadata: {
          baseAmountCents: "9700",
          platformPassThroughFeeCents: "300",
        },
      };

      const result = buildReceiptLinesFromIntent(intent);

      expect(result.lineItems[0].amountCents).toBe(9700);
      expect(result.lineItems[1].amountCents).toBe(300);
    });
  });

  describe("getPaymentMethodTypes", () => {
    const getPaymentMethodTypes = (capabilities?: Record<string, string> | null) => {
      return controller.getPaymentMethodTypes(capabilities);
    };

    it("should return card when card_payments is active", () => {
      const result = getPaymentMethodTypes({ card_payments: "active" });
      expect(result).toContain("card");
    });

    it("should return us_bank_account when ACH is active", () => {
      const result = getPaymentMethodTypes({ us_bank_account_ach_payments: "active" });
      expect(result).toContain("us_bank_account");
    });

    it("should return both when both are active", () => {
      const result = getPaymentMethodTypes({
        card_payments: "active",
        us_bank_account_ach_payments: "active",
      });
      expect(result).toContain("card");
      expect(result).toContain("us_bank_account");
      expect(result).toHaveLength(2);
    });

    it("should default to card when no capabilities", () => {
      const result = getPaymentMethodTypes(undefined);
      expect(result).toEqual(["card"]);
    });

    it("should default to card when null capabilities", () => {
      const result = getPaymentMethodTypes(null);
      expect(result).toEqual(["card"]);
    });

    it("should default to card when capabilities are empty", () => {
      const result = getPaymentMethodTypes({});
      expect(result).toEqual(["card"]);
    });

    it("should not include inactive capabilities", () => {
      const result = getPaymentMethodTypes({
        card_payments: "inactive",
        us_bank_account_ach_payments: "pending",
      });
      expect(result).toEqual(["card"]); // defaults to card
    });
  });

  describe("buildThreeDsPolicy", () => {
    type ThreeDsConfig = Parameters<PaymentsController["buildThreeDsPolicy"]>[1];
    const buildThreeDsPolicy = (currency?: string | null, gatewayConfig?: ThreeDsConfig) => {
      return controller.buildThreeDsPolicy(currency, gatewayConfig);
    };

    describe("EU/UK currencies", () => {
      it('should return "any" for EUR currency', () => {
        expect(buildThreeDsPolicy("eur")).toBe("any");
        expect(buildThreeDsPolicy("EUR")).toBe("any");
      });

      it('should return "any" for GBP currency', () => {
        expect(buildThreeDsPolicy("gbp")).toBe("any");
        expect(buildThreeDsPolicy("GBP")).toBe("any");
      });

      it('should return "any" for CHF currency', () => {
        expect(buildThreeDsPolicy("chf")).toBe("any");
      });

      it('should return "any" for SEK currency', () => {
        expect(buildThreeDsPolicy("sek")).toBe("any");
      });

      it('should return "any" for NOK currency', () => {
        expect(buildThreeDsPolicy("nok")).toBe("any");
      });
    });

    describe("US/other currencies", () => {
      it('should return "automatic" for USD currency', () => {
        expect(buildThreeDsPolicy("usd")).toBe("automatic");
        expect(buildThreeDsPolicy("USD")).toBe("automatic");
      });

      it('should return "automatic" for CAD currency', () => {
        expect(buildThreeDsPolicy("cad")).toBe("automatic");
      });

      it('should return "automatic" for AUD currency', () => {
        expect(buildThreeDsPolicy("aud")).toBe("automatic");
      });
    });

    describe("region-based override", () => {
      it('should return "any" when region is eu', () => {
        expect(buildThreeDsPolicy("usd", { region: "eu" })).toBe("any");
      });

      it('should return "any" when region is uk', () => {
        expect(buildThreeDsPolicy("usd", { region: "uk" })).toBe("any");
      });

      it("should use additionalConfig.region if present", () => {
        expect(buildThreeDsPolicy("usd", { additionalConfig: { region: "eu" } })).toBe("any");
      });

      it('should return "automatic" for non-EU region', () => {
        expect(buildThreeDsPolicy("usd", { region: "us" })).toBe("automatic");
      });
    });

    describe("edge cases", () => {
      it("should handle null currency", () => {
        expect(buildThreeDsPolicy(null)).toBe("automatic");
      });

      it("should handle undefined currency", () => {
        expect(buildThreeDsPolicy(undefined)).toBe("automatic");
      });

      it("should handle empty string currency", () => {
        expect(buildThreeDsPolicy("")).toBe("automatic");
      });
    });
  });

  describe("fee calculation integration scenarios", () => {
    it("should calculate correct total for standard US transaction", () => {
      // $100 reservation, absorb mode
      const result = controller.computeChargeAmounts({
        reservation: { balanceAmount: 10000 },
        platformFeeMode: "absorb",
        applicationFeeCents: 200, // $2 platform fee
        gatewayFeeMode: "absorb",
        gatewayFeePercentBasisPoints: 290, // 2.9%
        gatewayFeeFlatCents: 30, // $0.30
      });

      // Guest pays $100, campground absorbs fees
      expect(result.amountCents).toBe(10000);
      expect(result.platformPassThroughFeeCents).toBe(0);
      expect(result.gatewayPassThroughFeeCents).toBe(0);
    });

    it("should calculate correct total for pass-through transaction", () => {
      // $100 reservation, pass-through mode
      const result = controller.computeChargeAmounts({
        reservation: { balanceAmount: 10000 },
        platformFeeMode: "pass_through",
        applicationFeeCents: 200, // $2 platform fee
        gatewayFeeMode: "pass_through",
        gatewayFeePercentBasisPoints: 290, // 2.9%
        gatewayFeeFlatCents: 30, // $0.30
      });

      // Guest pays: $100 + $2 platform + $3.20 gateway = $105.20
      expect(result.amountCents).toBe(10520);
      expect(result.platformPassThroughFeeCents).toBe(200);
      expect(result.gatewayPassThroughFeeCents).toBe(320);
    });

    it("should handle partial payment scenario", () => {
      // $500 total, $200 already paid, balance $300
      const result = controller.computeChargeAmounts({
        reservation: { balanceAmount: 30000, totalAmount: 50000, paidAmount: 20000 },
        platformFeeMode: "pass_through",
        applicationFeeCents: 200,
        gatewayFeeMode: "absorb",
        gatewayFeePercentBasisPoints: 290,
        gatewayFeeFlatCents: 30,
      });

      // Guest pays balance + platform fee: $300 + $2 = $302
      expect(result.baseDue).toBe(30000);
      expect(result.amountCents).toBe(30200);
      expect(result.platformPassThroughFeeCents).toBe(200);
    });

    it("should handle deposit (partial charge) scenario", () => {
      // $500 balance, request only $100 deposit
      const result = controller.computeChargeAmounts({
        reservation: { balanceAmount: 50000 },
        platformFeeMode: "absorb",
        applicationFeeCents: 200,
        gatewayFeeMode: "absorb",
        gatewayFeePercentBasisPoints: 290,
        gatewayFeeFlatCents: 30,
        requestedAmountCents: 10000,
      });

      expect(result.amountCents).toBe(10000);
      expect(result.baseDue).toBe(50000);
    });
  });
});
