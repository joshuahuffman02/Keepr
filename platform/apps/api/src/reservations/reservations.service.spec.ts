import { ReservationsService } from "./reservations.service";
import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { LockService } from "../redis/lock.service";
import { PromotionsService } from "../promotions/promotions.service";
import { EmailService } from "../email/email.service";
import { WaitlistService } from "../waitlist/waitlist.service";
import { LoyaltyService } from "../loyalty/loyalty.service";
import { TaxRulesService } from "../tax-rules/tax-rules.service";
import { MatchScoreService } from "./match-score.service";
import { GamificationService } from "../gamification/gamification.service";
import { PricingV2Service } from "../pricing-v2/pricing-v2.service";
import { DepositPoliciesService } from "../deposit-policies/deposit-policies.service";
import { AccessControlService } from "../access-control/access-control.service";
import { SignaturesService } from "../signatures/signatures.service";
import { AuditService } from "../audit/audit.service";
import { ApprovalsService } from "../approvals/approvals.service";
import { UsageTrackerService } from "../org-billing/usage-tracker.service";
import { RepeatChargesService } from "../repeat-charges/repeat-charges.service";
import { PoliciesService } from "../policies/policies.service";
import { GuestWalletService } from "../guest-wallet/guest-wallet.service";
import { StripeService } from "../payments/stripe.service";
import { RealtimeService } from "../realtime/realtime.service";

describe("ReservationsService", () => {
  let service: ReservationsService;
  let moduleRef: TestingModule;

  const callPrivate = (key: string, ...args: unknown[]) => {
    const value = Reflect.get(service, key);
    if (typeof value !== "function") {
      throw new Error(`${key} is not a function`);
    }
    return value.call(service, ...args);
  };

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: {} },
        { provide: LockService, useValue: {} },
        { provide: PromotionsService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: WaitlistService, useValue: {} },
        { provide: LoyaltyService, useValue: {} },
        { provide: TaxRulesService, useValue: {} },
        { provide: MatchScoreService, useValue: {} },
        { provide: GamificationService, useValue: {} },
        { provide: PricingV2Service, useValue: {} },
        { provide: DepositPoliciesService, useValue: {} },
        { provide: AccessControlService, useValue: {} },
        { provide: SignaturesService, useValue: {} },
        { provide: AuditService, useValue: {} },
        { provide: ApprovalsService, useValue: {} },
        { provide: UsageTrackerService, useValue: {} },
        { provide: RepeatChargesService, useValue: {} },
        { provide: PoliciesService, useValue: {} },
        { provide: GuestWalletService, useValue: {} },
        { provide: StripeService, useValue: {} },
        { provide: RealtimeService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(ReservationsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  describe("computeNights", () => {
    const computeNights = (arrival: Date, departure: Date) => {
      return callPrivate("computeNights", arrival, departure);
    };

    it("should calculate 1 night for consecutive days", () => {
      const arrival = new Date("2024-06-01");
      const departure = new Date("2024-06-02");
      expect(computeNights(arrival, departure)).toBe(1);
    });

    it("should calculate 3 nights for 4-day span", () => {
      const arrival = new Date("2024-06-01");
      const departure = new Date("2024-06-04");
      expect(computeNights(arrival, departure)).toBe(3);
    });

    it("should calculate 7 nights for week stay", () => {
      const arrival = new Date("2024-06-01");
      const departure = new Date("2024-06-08");
      expect(computeNights(arrival, departure)).toBe(7);
    });

    it("should calculate 30 nights for month stay", () => {
      const arrival = new Date("2024-06-01");
      const departure = new Date("2024-07-01");
      expect(computeNights(arrival, departure)).toBe(30);
    });

    it("should return 1 for same day (minimum 1 night)", () => {
      const arrival = new Date("2024-06-01");
      const departure = new Date("2024-06-01");
      expect(computeNights(arrival, departure)).toBe(1);
    });

    it("should return 1 for negative duration (arrival after departure)", () => {
      const arrival = new Date("2024-06-05");
      const departure = new Date("2024-06-01");
      expect(computeNights(arrival, departure)).toBe(1);
    });

    it("should handle dates with times", () => {
      const arrival = new Date("2024-06-01T14:00:00");
      const departure = new Date("2024-06-03T11:00:00");
      // 1.875 days rounds to 2 nights
      expect(computeNights(arrival, departure)).toBe(2);
    });

    it("should handle year transitions", () => {
      const arrival = new Date("2024-12-30");
      const departure = new Date("2025-01-02");
      expect(computeNights(arrival, departure)).toBe(3);
    });

    it("should handle leap year dates", () => {
      const arrival = new Date("2024-02-28");
      const departure = new Date("2024-03-01");
      // 2024 is a leap year, so Feb 28 to Mar 1 is 2 days
      expect(computeNights(arrival, departure)).toBe(2);
    });
  });

  describe("computePaymentStatus", () => {
    const computePaymentStatus = (total: number | null | undefined, paid: number) => {
      return callPrivate("computePaymentStatus", total, paid);
    };

    it('should return "paid" when paid equals total', () => {
      expect(computePaymentStatus(10000, 10000)).toBe("paid");
    });

    it('should return "paid" when paid exceeds total', () => {
      expect(computePaymentStatus(10000, 12000)).toBe("paid");
    });

    it('should return "partial" when some amount paid', () => {
      expect(computePaymentStatus(10000, 5000)).toBe("partial");
      expect(computePaymentStatus(10000, 1)).toBe("partial");
      expect(computePaymentStatus(10000, 9999)).toBe("partial");
    });

    it('should return "unpaid" when nothing paid', () => {
      expect(computePaymentStatus(10000, 0)).toBe("unpaid");
    });

    it('should return "unpaid" for zero total', () => {
      expect(computePaymentStatus(0, 0)).toBe("unpaid");
    });

    it('should return "unpaid" for negative total', () => {
      expect(computePaymentStatus(-100, 0)).toBe("unpaid");
    });

    it('should return "unpaid" for null/undefined total', () => {
      expect(computePaymentStatus(null, 0)).toBe("unpaid");
      expect(computePaymentStatus(undefined, 0)).toBe("unpaid");
    });
  });

  describe("buildPaymentFields", () => {
    const buildPaymentFields = (totalAmount: number, paidAmount: number) => {
      return callPrivate("buildPaymentFields", totalAmount, paidAmount);
    };

    it("should calculate correct balance when partially paid", () => {
      const result = buildPaymentFields(10000, 3000);
      expect(result.balanceAmount).toBe(7000);
      expect(result.paymentStatus).toBe("partial");
    });

    it("should return zero balance when fully paid", () => {
      const result = buildPaymentFields(10000, 10000);
      expect(result.balanceAmount).toBe(0);
      expect(result.paymentStatus).toBe("paid");
    });

    it("should return zero balance when overpaid", () => {
      const result = buildPaymentFields(10000, 15000);
      expect(result.balanceAmount).toBe(0);
      expect(result.paymentStatus).toBe("paid");
    });

    it("should return full balance when unpaid", () => {
      const result = buildPaymentFields(10000, 0);
      expect(result.balanceAmount).toBe(10000);
      expect(result.paymentStatus).toBe("unpaid");
    });

    it("should handle negative calculations", () => {
      // Math.max(0, ...) ensures balance never negative
      const result = buildPaymentFields(5000, 8000);
      expect(result.balanceAmount).toBe(0);
    });
  });

  describe("isRigCompatible", () => {
    const isRigCompatible = (
      site: {
        siteType: string;
        rigMaxLength?: number | null;
        siteClassRigMaxLength?: number | null;
      },
      rigType?: string | null,
      rigLength?: number | null,
    ) => {
      return callPrivate("isRigCompatible", site, rigType, rigLength);
    };

    describe("non-RV types (always compatible)", () => {
      it("should allow tent on any site type", () => {
        expect(isRigCompatible({ siteType: "rv" }, "tent", null)).toBe(true);
        expect(isRigCompatible({ siteType: "tent" }, "tent", null)).toBe(true);
        expect(isRigCompatible({ siteType: "cabin" }, "tent", null)).toBe(true);
      });

      it("should allow cabin on any site type", () => {
        expect(isRigCompatible({ siteType: "rv" }, "cabin", null)).toBe(true);
      });

      it("should allow car/walkin on any site type", () => {
        expect(isRigCompatible({ siteType: "rv" }, "car", null)).toBe(true);
        expect(isRigCompatible({ siteType: "rv" }, "walkin", null)).toBe(true);
        expect(isRigCompatible({ siteType: "rv" }, "walk-in", null)).toBe(true);
      });

      it("should be case-insensitive for rig types", () => {
        expect(isRigCompatible({ siteType: "rv" }, "TENT", null)).toBe(true);
        expect(isRigCompatible({ siteType: "rv" }, "Cabin", null)).toBe(true);
        expect(isRigCompatible({ siteType: "rv" }, "CAR", null)).toBe(true);
      });
    });

    describe("RV types", () => {
      it("should allow RV on RV sites", () => {
        expect(isRigCompatible({ siteType: "rv", rigMaxLength: 40 }, "rv", 35)).toBe(true);
        expect(isRigCompatible({ siteType: "rv", rigMaxLength: 40 }, "motorhome", 35)).toBe(true);
      });

      it("should reject RV on non-RV sites", () => {
        expect(isRigCompatible({ siteType: "tent" }, "rv", 35)).toBe(false);
        expect(isRigCompatible({ siteType: "cabin" }, "rv", 35)).toBe(false);
      });

      it("should reject RV that exceeds max length", () => {
        expect(isRigCompatible({ siteType: "rv", rigMaxLength: 30 }, "rv", 35)).toBe(false);
        expect(isRigCompatible({ siteType: "rv", rigMaxLength: 35 }, "rv", 36)).toBe(false);
      });

      it("should allow RV at exact max length", () => {
        expect(isRigCompatible({ siteType: "rv", rigMaxLength: 35 }, "rv", 35)).toBe(true);
      });

      it("should use siteClass max length as fallback", () => {
        expect(
          isRigCompatible(
            { siteType: "rv", rigMaxLength: null, siteClassRigMaxLength: 30 },
            "rv",
            35,
          ),
        ).toBe(false);
        expect(
          isRigCompatible(
            { siteType: "rv", rigMaxLength: null, siteClassRigMaxLength: 40 },
            "rv",
            35,
          ),
        ).toBe(true);
      });

      it("should prefer site max length over site class", () => {
        expect(
          isRigCompatible(
            { siteType: "rv", rigMaxLength: 25, siteClassRigMaxLength: 40 },
            "rv",
            30,
          ),
        ).toBe(false);
      });

      it("should allow any RV length when no max specified", () => {
        expect(
          isRigCompatible(
            { siteType: "rv", rigMaxLength: null, siteClassRigMaxLength: null },
            "rv",
            100,
          ),
        ).toBe(true);
      });
    });

    describe("no rig info", () => {
      it("should be compatible when no rig type or length provided", () => {
        expect(isRigCompatible({ siteType: "rv" }, null, null)).toBe(true);
        expect(isRigCompatible({ siteType: "tent" }, null, null)).toBe(true);
        expect(isRigCompatible({ siteType: "rv" }, undefined, undefined)).toBe(true);
      });

      it("should be compatible when only empty string rig type", () => {
        expect(isRigCompatible({ siteType: "rv" }, "", null)).toBe(true);
      });
    });
  });

  describe("validateAssignmentConstraints", () => {
    type AssignmentSite = {
      siteType: string;
      rigMaxLength?: number | null;
      siteClassRigMaxLength?: number | null;
      accessible?: boolean | null;
      amenityTags?: string[] | null;
      maxOccupancy?: number | null;
    };
    type AssignmentOptions = {
      rigType?: string | null;
      rigLength?: number | null;
      requiresAccessible?: boolean | null;
      requiredAmenities?: string[] | null;
      adults?: number | null;
      children?: number | null;
    };
    const validateAssignmentConstraints = (site: AssignmentSite, opts: AssignmentOptions) => {
      return callPrivate("validateAssignmentConstraints", site, opts);
    };

    describe("occupancy constraints", () => {
      it("should pass when occupancy within limit", () => {
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", maxOccupancy: 6 },
            { adults: 2, children: 2 },
          ),
        ).not.toThrow();
      });

      it("should pass when occupancy equals limit", () => {
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", maxOccupancy: 4 },
            { adults: 2, children: 2 },
          ),
        ).not.toThrow();
      });

      it("should throw when occupancy exceeds limit", () => {
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", maxOccupancy: 4 },
            { adults: 3, children: 3 },
          ),
        ).toThrow(BadRequestException);
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", maxOccupancy: 4 },
            { adults: 3, children: 3 },
          ),
        ).toThrow("Occupancy exceeds max");
      });

      it("should handle null/undefined occupancy values", () => {
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", maxOccupancy: 6 },
            { adults: null, children: null },
          ),
        ).not.toThrow();
      });

      it("should skip occupancy check when maxOccupancy is null", () => {
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", maxOccupancy: null },
            { adults: 100, children: 100 },
          ),
        ).not.toThrow();
      });
    });

    describe("rig compatibility", () => {
      it("should throw for incompatible rig", () => {
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "tent", rigMaxLength: null },
            { rigType: "rv", rigLength: 35 },
          ),
        ).toThrow(BadRequestException);
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "tent", rigMaxLength: null },
            { rigType: "rv", rigLength: 35 },
          ),
        ).toThrow("Rig type or length is not compatible");
      });

      it("should throw when rig too long", () => {
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", rigMaxLength: 30 },
            { rigType: "rv", rigLength: 40 },
          ),
        ).toThrow(BadRequestException);
      });
    });

    describe("accessibility requirements", () => {
      it("should pass when accessible site matches requirement", () => {
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", accessible: true },
            { requiresAccessible: true },
          ),
        ).not.toThrow();
      });

      it("should throw when accessible required but site is not", () => {
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", accessible: false },
            { requiresAccessible: true },
          ),
        ).toThrow(BadRequestException);
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", accessible: false },
            { requiresAccessible: true },
          ),
        ).toThrow("ADA accessible site is required");
      });

      it("should pass when accessible not required", () => {
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", accessible: false },
            { requiresAccessible: false },
          ),
        ).not.toThrow();
      });
    });

    describe("amenity requirements", () => {
      it("should pass when all required amenities present", () => {
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", amenityTags: ["wifi", "water", "sewer"] },
            { requiredAmenities: ["wifi", "water"] },
          ),
        ).not.toThrow();
      });

      it("should be case-insensitive for amenities", () => {
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", amenityTags: ["WiFi", "WATER"] },
            { requiredAmenities: ["wifi", "Water"] },
          ),
        ).not.toThrow();
      });

      it("should throw when required amenities missing", () => {
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", amenityTags: ["wifi"] },
            { requiredAmenities: ["wifi", "pool", "hookup"] },
          ),
        ).toThrow(BadRequestException);
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", amenityTags: ["wifi"] },
            { requiredAmenities: ["wifi", "pool", "hookup"] },
          ),
        ).toThrow("missing required amenities: pool, hookup");
      });

      it("should pass when no amenities required", () => {
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", amenityTags: [] },
            { requiredAmenities: [] },
          ),
        ).not.toThrow();
      });

      it("should handle null amenityTags", () => {
        expect(() =>
          validateAssignmentConstraints(
            { siteType: "rv", amenityTags: null },
            { requiredAmenities: ["wifi"] },
          ),
        ).toThrow(BadRequestException);
      });
    });

    describe("combined constraints", () => {
      it("should validate all constraints together", () => {
        expect(() =>
          validateAssignmentConstraints(
            {
              siteType: "rv",
              maxOccupancy: 6,
              rigMaxLength: 40,
              accessible: true,
              amenityTags: ["wifi", "water", "sewer"],
            },
            {
              adults: 2,
              children: 2,
              rigType: "rv",
              rigLength: 35,
              requiresAccessible: true,
              requiredAmenities: ["wifi", "water"],
            },
          ),
        ).not.toThrow();
      });
    });
  });
});
