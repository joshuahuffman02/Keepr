import {
  PricingV2Service,
  PricingBreakdown,
  computeNights,
  computeAdjustment,
  extractMinNights,
  ruleApplies,
  PricingRuleConstraints,
} from "./pricing-v2.service";
import type { PricingV2Store, PricingAuditWriter } from "./pricing-v2.service";
import { PricingStackMode, AdjustmentType, PricingRuleType, Prisma } from "@prisma/client";

// Decimal is exported from Prisma namespace
const { Decimal } = Prisma;

describe("PricingV2Service", () => {
  let service: PricingV2Service;
  let mockPrisma: ReturnType<typeof buildMockPrisma>;
  let mockAudit: ReturnType<typeof buildMockAudit>;

  const buildMockPrisma = () =>
    ({
      pricingRuleV2: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      demandBand: {
        findUnique: jest.fn(),
      },
    }) satisfies PricingV2Store;

  const buildMockAudit = () =>
    ({
      record: jest.fn().mockResolvedValue(undefined),
    }) satisfies PricingAuditWriter;

  beforeEach(() => {
    mockPrisma = buildMockPrisma();
    mockAudit = buildMockAudit();
    service = new PricingV2Service(mockPrisma, mockAudit);
  });

  describe("computeNights (private)", () => {
    it("should calculate 1 night for same day departure", () => {
      const arrival = new Date("2025-01-01");
      const departure = new Date("2025-01-01");
      expect(computeNights(arrival, departure)).toBe(1);
    });

    it("should calculate 1 night for next day departure", () => {
      const arrival = new Date("2025-01-01");
      const departure = new Date("2025-01-02");
      expect(computeNights(arrival, departure)).toBe(1);
    });

    it("should calculate 3 nights correctly", () => {
      const arrival = new Date("2025-01-01");
      const departure = new Date("2025-01-04");
      expect(computeNights(arrival, departure)).toBe(3);
    });

    it("should calculate 7 nights for a week stay", () => {
      const arrival = new Date("2025-01-01");
      const departure = new Date("2025-01-08");
      expect(computeNights(arrival, departure)).toBe(7);
    });

    it("should return minimum 1 night for negative duration", () => {
      const arrival = new Date("2025-01-05");
      const departure = new Date("2025-01-01");
      expect(computeNights(arrival, departure)).toBe(1);
    });

    it("should handle dates across months", () => {
      const arrival = new Date("2025-01-30");
      const departure = new Date("2025-02-02");
      expect(computeNights(arrival, departure)).toBe(3);
    });

    it("should handle dates across years", () => {
      const arrival = new Date("2024-12-30");
      const departure = new Date("2025-01-02");
      expect(computeNights(arrival, departure)).toBe(3);
    });
  });

  describe("computeAdjustment (private)", () => {
    describe("percent adjustments", () => {
      it("should calculate 10% increase correctly", () => {
        const result = computeAdjustment(AdjustmentType.percent, new Decimal(0.1), 10000);
        expect(result).toBe(1000); // 10% of 10000
      });

      it("should calculate 25% increase correctly", () => {
        const result = computeAdjustment(AdjustmentType.percent, new Decimal(0.25), 10000);
        expect(result).toBe(2500);
      });

      it("should calculate negative percentage (discount)", () => {
        const result = computeAdjustment(AdjustmentType.percent, new Decimal(-0.15), 10000);
        expect(result).toBe(-1500);
      });

      it("should round to nearest cent", () => {
        const result = computeAdjustment(AdjustmentType.percent, new Decimal(0.333), 10000);
        expect(result).toBe(3330); // Rounded
      });

      it("should handle zero base", () => {
        const result = computeAdjustment(AdjustmentType.percent, new Decimal(0.1), 0);
        expect(result).toBe(0);
      });
    });

    describe("flat adjustments", () => {
      it("should return flat amount directly", () => {
        const result = computeAdjustment(AdjustmentType.flat, new Decimal(500), 10000);
        expect(result).toBe(500);
      });

      it("should handle negative flat adjustment", () => {
        const result = computeAdjustment(AdjustmentType.flat, new Decimal(-500), 10000);
        expect(result).toBe(-500);
      });

      it("should ignore base rate for flat adjustments", () => {
        const result = computeAdjustment(AdjustmentType.flat, new Decimal(1000), 5000);
        expect(result).toBe(1000);
      });

      it("should round flat adjustments", () => {
        const result = computeAdjustment(AdjustmentType.flat, new Decimal(100.7), 10000);
        expect(result).toBe(101);
      });
    });
  });

  describe("extractMinNights (private)", () => {
    it("should extract minNights from calendar ref", () => {
      expect(extractMinNights("minNights:3")).toBe(3);
    });

    it("should extract minNights case-insensitively", () => {
      expect(extractMinNights("MinNights:5")).toBe(5);
      expect(extractMinNights("MINNIGHTS:7")).toBe(7);
    });

    it("should return null for null input", () => {
      expect(extractMinNights(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(extractMinNights(undefined)).toBeNull();
    });

    it("should return null for non-matching string", () => {
      expect(extractMinNights("someOtherRef")).toBeNull();
    });

    it("should return null for invalid number", () => {
      expect(extractMinNights("minNights:abc")).toBeNull();
    });

    it("should return null for zero", () => {
      expect(extractMinNights("minNights:0")).toBeNull();
    });

    it("should return null for negative numbers", () => {
      expect(extractMinNights("minNights:-2")).toBeNull();
    });

    it("should handle minNights embedded in longer string", () => {
      expect(extractMinNights("rule:minNights:4:active")).toBe(4);
    });
  });

  describe("ruleApplies (private)", () => {
    const createRule = (
      overrides: Partial<PricingRuleConstraints> = {},
    ): PricingRuleConstraints => ({
      startDate: null,
      endDate: null,
      dowMask: null,
      calendarRefId: null,
      ...overrides,
    });

    it("should return true for rule with no constraints", () => {
      const rule = createRule();
      expect(ruleApplies(rule, new Date("2025-01-15"), 3, 2)).toBe(true);
    });

    describe("date range constraints", () => {
      it("should return false when day is before startDate", () => {
        const rule = createRule({ startDate: new Date("2025-02-01") });
        expect(ruleApplies(rule, new Date("2025-01-15"), 3, 2)).toBe(false);
      });

      it("should return true when day equals startDate", () => {
        const rule = createRule({ startDate: new Date("2025-01-15") });
        expect(ruleApplies(rule, new Date("2025-01-15"), 3, 2)).toBe(true);
      });

      it("should return true when day is after startDate", () => {
        const rule = createRule({ startDate: new Date("2025-01-01") });
        expect(ruleApplies(rule, new Date("2025-01-15"), 3, 2)).toBe(true);
      });

      it("should return false when day is after endDate", () => {
        const rule = createRule({ endDate: new Date("2025-01-10") });
        expect(ruleApplies(rule, new Date("2025-01-15"), 3, 2)).toBe(false);
      });

      it("should return true when day equals endDate", () => {
        const rule = createRule({ endDate: new Date("2025-01-15") });
        expect(ruleApplies(rule, new Date("2025-01-15"), 3, 2)).toBe(true);
      });

      it("should return true when day is within date range", () => {
        const rule = createRule({
          startDate: new Date("2025-01-01"),
          endDate: new Date("2025-01-31"),
        });
        expect(ruleApplies(rule, new Date("2025-01-15"), 3, 2)).toBe(true);
      });
    });

    describe("day of week constraints", () => {
      it("should return true when dow is in mask", () => {
        const rule = createRule({ dowMask: [5, 6] }); // Fri, Sat
        expect(ruleApplies(rule, new Date("2025-01-17"), 5, 2)).toBe(true); // Friday
      });

      it("should return false when dow is not in mask", () => {
        const rule = createRule({ dowMask: [5, 6] }); // Fri, Sat
        expect(ruleApplies(rule, new Date("2025-01-15"), 3, 2)).toBe(false); // Wednesday
      });

      it("should return true for empty dowMask array", () => {
        const rule = createRule({ dowMask: [] });
        expect(ruleApplies(rule, new Date("2025-01-15"), 3, 2)).toBe(true);
      });
    });

    describe("minimum nights constraints", () => {
      it("should return true when stay meets minimum nights", () => {
        const rule = createRule({ calendarRefId: "minNights:3" });
        expect(ruleApplies(rule, new Date("2025-01-15"), 3, 3)).toBe(true);
      });

      it("should return true when stay exceeds minimum nights", () => {
        const rule = createRule({ calendarRefId: "minNights:3" });
        expect(ruleApplies(rule, new Date("2025-01-15"), 3, 5)).toBe(true);
      });

      it("should return false when stay is below minimum nights", () => {
        const rule = createRule({ calendarRefId: "minNights:3" });
        expect(ruleApplies(rule, new Date("2025-01-15"), 3, 2)).toBe(false);
      });
    });

    describe("combined constraints", () => {
      it("should require all constraints to pass", () => {
        const rule = createRule({
          startDate: new Date("2025-01-01"),
          endDate: new Date("2025-01-31"),
          dowMask: [5, 6],
          calendarRefId: "minNights:2",
        });

        // All pass
        expect(ruleApplies(rule, new Date("2025-01-17"), 5, 3)).toBe(true);
        // Date fails
        expect(ruleApplies(rule, new Date("2025-02-15"), 5, 3)).toBe(false);
        // DOW fails
        expect(ruleApplies(rule, new Date("2025-01-15"), 3, 3)).toBe(false);
        // Nights fails
        expect(ruleApplies(rule, new Date("2025-01-17"), 5, 1)).toBe(false);
      });
    });
  });

  describe("evaluate", () => {
    it("should calculate base pricing with no rules", async () => {
      mockPrisma.pricingRuleV2.findMany.mockResolvedValue([]);

      const result = await service.evaluate(
        "cg-1",
        "class-1",
        5000, // $50/night base
        new Date("2025-01-01"),
        new Date("2025-01-04"), // 3 nights
      );

      expect(result.nights).toBe(3);
      expect(result.baseSubtotalCents).toBe(15000); // 3 * 5000
      expect(result.adjustmentsCents).toBe(0);
      expect(result.demandAdjustmentCents).toBe(0);
      expect(result.totalBeforeTaxCents).toBe(15000);
      expect(result.appliedRules).toEqual([]);
    });

    it("should apply additive percentage rule", async () => {
      mockPrisma.pricingRuleV2.findMany.mockResolvedValue([
        {
          id: "rule-1",
          name: "Weekend Premium",
          type: PricingRuleType.season,
          stackMode: PricingStackMode.additive,
          adjustmentType: AdjustmentType.percent,
          adjustmentValue: new Decimal(0.2), // 20%
          startDate: null,
          endDate: null,
          dowMask: null,
          calendarRefId: null,
          minRateCap: null,
          maxRateCap: null,
          demandBandId: null,
        },
      ]);

      const result = await service.evaluate(
        "cg-1",
        "class-1",
        5000,
        new Date("2025-01-01"),
        new Date("2025-01-02"), // 1 night
      );

      expect(result.nights).toBe(1);
      expect(result.baseSubtotalCents).toBe(5000);
      expect(result.adjustmentsCents).toBe(1000); // 20% of 5000
      expect(result.totalBeforeTaxCents).toBe(6000);
      expect(result.appliedRules).toHaveLength(1);
      expect(result.appliedRules[0].name).toBe("Weekend Premium");
    });

    it("should apply flat discount rule", async () => {
      mockPrisma.pricingRuleV2.findMany.mockResolvedValue([
        {
          id: "rule-1",
          name: "Flat Discount",
          type: PricingRuleType.season,
          stackMode: PricingStackMode.additive,
          adjustmentType: AdjustmentType.flat,
          adjustmentValue: new Decimal(-1000), // -$10
          startDate: null,
          endDate: null,
          dowMask: null,
          calendarRefId: null,
          minRateCap: null,
          maxRateCap: null,
          demandBandId: null,
        },
      ]);

      const result = await service.evaluate(
        "cg-1",
        "class-1",
        5000,
        new Date("2025-01-01"),
        new Date("2025-01-02"),
      );

      expect(result.adjustmentsCents).toBe(-1000);
      expect(result.totalBeforeTaxCents).toBe(4000);
    });

    it("should stop processing on override rule", async () => {
      mockPrisma.pricingRuleV2.findMany.mockResolvedValue([
        {
          id: "rule-1",
          name: "Override Rate",
          type: PricingRuleType.season,
          stackMode: PricingStackMode.override,
          adjustmentType: AdjustmentType.flat,
          adjustmentValue: new Decimal(2000),
          priority: 1,
          startDate: null,
          endDate: null,
          dowMask: null,
          calendarRefId: null,
          minRateCap: null,
          maxRateCap: null,
          demandBandId: null,
        },
        {
          id: "rule-2",
          name: "Additional Discount",
          type: PricingRuleType.season,
          stackMode: PricingStackMode.additive,
          adjustmentType: AdjustmentType.flat,
          adjustmentValue: new Decimal(-500),
          priority: 2,
          startDate: null,
          endDate: null,
          dowMask: null,
          calendarRefId: null,
          minRateCap: null,
          maxRateCap: null,
          demandBandId: null,
        },
      ]);

      const result = await service.evaluate(
        "cg-1",
        "class-1",
        5000,
        new Date("2025-01-01"),
        new Date("2025-01-02"),
      );

      // Override rule takes effect, second rule ignored
      expect(result.adjustmentsCents).toBe(2000);
      expect(result.appliedRules).toHaveLength(1);
      expect(result.appliedRules[0].name).toBe("Override Rate");
    });

    it("should apply max stacking mode", async () => {
      mockPrisma.pricingRuleV2.findMany.mockResolvedValue([
        {
          id: "rule-1",
          name: "Small Increase",
          type: PricingRuleType.season,
          stackMode: PricingStackMode.max,
          adjustmentType: AdjustmentType.flat,
          adjustmentValue: new Decimal(500),
          startDate: null,
          endDate: null,
          dowMask: null,
          calendarRefId: null,
          minRateCap: null,
          maxRateCap: null,
          demandBandId: null,
        },
        {
          id: "rule-2",
          name: "Large Increase",
          type: PricingRuleType.season,
          stackMode: PricingStackMode.max,
          adjustmentType: AdjustmentType.flat,
          adjustmentValue: new Decimal(1500),
          startDate: null,
          endDate: null,
          dowMask: null,
          calendarRefId: null,
          minRateCap: null,
          maxRateCap: null,
          demandBandId: null,
        },
      ]);

      const result = await service.evaluate(
        "cg-1",
        "class-1",
        5000,
        new Date("2025-01-01"),
        new Date("2025-01-02"),
      );

      // Only the larger adjustment should apply
      expect(result.adjustmentsCents).toBe(1500);
    });

    it("should apply minimum rate cap", async () => {
      mockPrisma.pricingRuleV2.findMany.mockResolvedValue([
        {
          id: "rule-1",
          name: "Big Discount",
          type: PricingRuleType.season,
          stackMode: PricingStackMode.additive,
          adjustmentType: AdjustmentType.flat,
          adjustmentValue: new Decimal(-4000),
          startDate: null,
          endDate: null,
          dowMask: null,
          calendarRefId: null,
          minRateCap: 3000, // Minimum $30/night
          maxRateCap: null,
          demandBandId: null,
        },
      ]);

      const result = await service.evaluate(
        "cg-1",
        "class-1",
        5000,
        new Date("2025-01-01"),
        new Date("2025-01-02"),
      );

      // Would be 5000 - 4000 = 1000, but capped at 3000
      expect(result.totalBeforeTaxCents).toBe(3000);
      expect(result.cappedAt).toBe("min");
    });

    it("should apply maximum rate cap", async () => {
      mockPrisma.pricingRuleV2.findMany.mockResolvedValue([
        {
          id: "rule-1",
          name: "Big Increase",
          type: PricingRuleType.season,
          stackMode: PricingStackMode.additive,
          adjustmentType: AdjustmentType.flat,
          adjustmentValue: new Decimal(10000),
          startDate: null,
          endDate: null,
          dowMask: null,
          calendarRefId: null,
          minRateCap: null,
          maxRateCap: 8000, // Maximum $80/night
          demandBandId: null,
        },
      ]);

      const result = await service.evaluate(
        "cg-1",
        "class-1",
        5000,
        new Date("2025-01-01"),
        new Date("2025-01-02"),
      );

      // Would be 5000 + 10000 = 15000, but capped at 8000
      expect(result.totalBeforeTaxCents).toBe(8000);
      expect(result.cappedAt).toBe("max");
    });

    it("should apply demand adjustment based on occupancy", async () => {
      mockPrisma.pricingRuleV2.findMany.mockResolvedValue([
        {
          id: "rule-1",
          name: "High Demand Surge",
          type: PricingRuleType.demand,
          stackMode: PricingStackMode.additive,
          adjustmentType: AdjustmentType.percent,
          adjustmentValue: new Decimal(0),
          startDate: null,
          endDate: null,
          dowMask: null,
          calendarRefId: null,
          minRateCap: null,
          maxRateCap: null,
          demandBandId: "band-1",
        },
      ]);

      mockPrisma.demandBand.findUnique.mockResolvedValue({
        id: "band-1",
        active: true,
        thresholdPct: 80,
        adjustmentType: AdjustmentType.percent,
        adjustmentValue: new Decimal(0.25), // 25% surge
      });

      const result = await service.evaluate(
        "cg-1",
        "class-1",
        5000,
        new Date("2025-01-01"),
        new Date("2025-01-02"),
        85, // 85% occupancy
      );

      expect(result.demandAdjustmentCents).toBe(1250); // 25% of 5000
      expect(result.totalBeforeTaxCents).toBe(6250);
    });

    it("should not apply demand adjustment below threshold", async () => {
      mockPrisma.pricingRuleV2.findMany.mockResolvedValue([
        {
          id: "rule-1",
          name: "High Demand Surge",
          type: PricingRuleType.demand,
          demandBandId: "band-1",
          stackMode: PricingStackMode.additive,
          adjustmentType: AdjustmentType.percent,
          adjustmentValue: new Decimal(0),
          startDate: null,
          endDate: null,
          dowMask: null,
          calendarRefId: null,
          minRateCap: null,
          maxRateCap: null,
        },
      ]);

      mockPrisma.demandBand.findUnique.mockResolvedValue({
        id: "band-1",
        active: true,
        thresholdPct: 80,
        adjustmentType: AdjustmentType.percent,
        adjustmentValue: new Decimal(0.25),
      });

      const result = await service.evaluate(
        "cg-1",
        "class-1",
        5000,
        new Date("2025-01-01"),
        new Date("2025-01-02"),
        70, // 70% occupancy (below 80% threshold)
      );

      expect(result.demandAdjustmentCents).toBe(0);
      expect(result.totalBeforeTaxCents).toBe(5000);
    });
  });
});
