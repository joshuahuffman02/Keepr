import { Prisma, TaxRule, TaxRuleType } from "@prisma/client";
import { TaxRulesService } from "./tax-rules.service";
import type { TaxRulesStore } from "./tax-rules.service";
import { NotFoundException } from "@nestjs/common";

const buildTaxRule = (overrides: Partial<TaxRule> = {}): TaxRule => ({
  id: "rule-default",
  campgroundId: "cg-1",
  name: "Tax Rule",
  type: TaxRuleType.exemption,
  rate: null,
  minNights: null,
  maxNights: null,
  category: "general",
  requiresWaiver: false,
  waiverText: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockTaxRulesStore = () =>
  ({
    taxRule: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }) satisfies TaxRulesStore;

describe("TaxRulesService", () => {
  let service: TaxRulesService;
  let mockPrisma: ReturnType<typeof createMockTaxRulesStore>;

  beforeEach(() => {
    mockPrisma = createMockTaxRulesStore();

    service = new TaxRulesService(mockPrisma);
  });

  describe("evaluateExemption", () => {
    describe("basic eligibility", () => {
      it("should return not eligible when no exemption rules exist", async () => {
        mockPrisma.taxRule.findMany.mockResolvedValue([]);

        const result = await service.evaluateExemption("cg-1", 10, true);

        expect(result.eligible).toBe(false);
        expect(result.applied).toBe(false);
        expect(result.rule).toBeNull();
      });

      it("should return eligible and applied for simple exemption", async () => {
        mockPrisma.taxRule.findMany.mockResolvedValue([
          buildTaxRule({
            id: "rule-1",
            name: "Long Stay Exemption",
            type: TaxRuleType.exemption,
          }),
        ]);

        const result = await service.evaluateExemption("cg-1", 5, false);

        expect(result.eligible).toBe(true);
        expect(result.applied).toBe(true);
        if (!result.rule) {
          throw new Error("Expected rule to be set");
        }
        expect(result.rule.id).toBe("rule-1");
      });
    });

    describe("night-based constraints", () => {
      it("should apply when nights meet minimum requirement", async () => {
        mockPrisma.taxRule.findMany.mockResolvedValue([
          buildTaxRule({
            id: "rule-1",
            name: "30+ Night Exemption",
            type: TaxRuleType.exemption,
            minNights: 30,
          }),
        ]);

        const result = await service.evaluateExemption("cg-1", 30, false);

        expect(result.eligible).toBe(true);
        expect(result.applied).toBe(true);
      });

      it("should not apply when nights below minimum", async () => {
        mockPrisma.taxRule.findMany.mockResolvedValue([
          buildTaxRule({
            id: "rule-1",
            name: "30+ Night Exemption",
            type: TaxRuleType.exemption,
            minNights: 30,
          }),
        ]);

        const result = await service.evaluateExemption("cg-1", 29, false);

        expect(result.eligible).toBe(false);
        expect(result.applied).toBe(false);
      });

      it("should apply when nights within max limit", async () => {
        mockPrisma.taxRule.findMany.mockResolvedValue([
          buildTaxRule({
            id: "rule-1",
            name: "Short Stay Exemption",
            type: TaxRuleType.exemption,
            maxNights: 7,
          }),
        ]);

        const result = await service.evaluateExemption("cg-1", 5, false);

        expect(result.eligible).toBe(true);
        expect(result.applied).toBe(true);
      });

      it("should not apply when nights exceed maximum", async () => {
        mockPrisma.taxRule.findMany.mockResolvedValue([
          buildTaxRule({
            id: "rule-1",
            name: "Short Stay Exemption",
            type: TaxRuleType.exemption,
            maxNights: 7,
          }),
        ]);

        const result = await service.evaluateExemption("cg-1", 10, false);

        expect(result.eligible).toBe(false);
        expect(result.applied).toBe(false);
      });

      it("should apply when nights within range (min and max)", async () => {
        mockPrisma.taxRule.findMany.mockResolvedValue([
          buildTaxRule({
            id: "rule-1",
            name: "Mid-Stay Exemption",
            type: TaxRuleType.exemption,
            minNights: 7,
            maxNights: 30,
          }),
        ]);

        const result = await service.evaluateExemption("cg-1", 14, false);

        expect(result.eligible).toBe(true);
        expect(result.applied).toBe(true);
      });

      it("should apply at exact boundary values", async () => {
        mockPrisma.taxRule.findMany.mockResolvedValue([
          buildTaxRule({
            id: "rule-1",
            name: "Range Exemption",
            type: TaxRuleType.exemption,
            minNights: 7,
            maxNights: 30,
          }),
        ]);

        // At min boundary
        const resultMin = await service.evaluateExemption("cg-1", 7, false);
        expect(resultMin.eligible).toBe(true);

        // At max boundary
        const resultMax = await service.evaluateExemption("cg-1", 30, false);
        expect(resultMax.eligible).toBe(true);
      });
    });

    describe("waiver requirements", () => {
      it("should apply exemption when waiver required and signed", async () => {
        mockPrisma.taxRule.findMany.mockResolvedValue([
          buildTaxRule({
            id: "rule-1",
            name: "Waiver Required Exemption",
            type: TaxRuleType.exemption,
            requiresWaiver: true,
            waiverText: "I certify this is my primary residence",
          }),
        ]);

        const result = await service.evaluateExemption("cg-1", 30, true);

        expect(result.eligible).toBe(true);
        expect(result.applied).toBe(true);
      });

      it("should be eligible but not applied when waiver required but not signed", async () => {
        mockPrisma.taxRule.findMany.mockResolvedValue([
          buildTaxRule({
            id: "rule-1",
            name: "Waiver Required Exemption",
            type: TaxRuleType.exemption,
            requiresWaiver: true,
            waiverText: "I certify this is my primary residence",
          }),
        ]);

        const result = await service.evaluateExemption("cg-1", 30, false);

        expect(result.eligible).toBe(true);
        expect(result.applied).toBe(false);
        expect(result.reason).toBe("Waiver required");
      });
    });

    describe("multiple rules", () => {
      it("should apply first matching rule", async () => {
        mockPrisma.taxRule.findMany.mockResolvedValue([
          buildTaxRule({
            id: "rule-1",
            name: "Rule 1 - 30+ nights",
            type: TaxRuleType.exemption,
            minNights: 30,
          }),
          buildTaxRule({
            id: "rule-2",
            name: "Rule 2 - No restrictions",
            type: TaxRuleType.exemption,
          }),
        ]);

        // Should match rule-1 (30+ nights) first
        const result = await service.evaluateExemption("cg-1", 45, false);

        if (!result.rule) {
          throw new Error("Expected rule to be set");
        }
        expect(result.rule.id).toBe("rule-1");
      });

      it("should fall through to next rule if first does not match", async () => {
        mockPrisma.taxRule.findMany.mockResolvedValue([
          buildTaxRule({
            id: "rule-1",
            name: "Rule 1 - 30+ nights",
            type: TaxRuleType.exemption,
            minNights: 30,
          }),
          buildTaxRule({
            id: "rule-2",
            name: "Rule 2 - 7+ nights",
            type: TaxRuleType.exemption,
            minNights: 7,
          }),
        ]);

        // 10 nights doesn't match rule-1 (needs 30), but matches rule-2
        const result = await service.evaluateExemption("cg-1", 10, false);

        expect(result.eligible).toBe(true);
        if (!result.rule) {
          throw new Error("Expected rule to be set");
        }
        expect(result.rule.id).toBe("rule-2");
      });
    });
  });

  describe("CRUD operations", () => {
    describe("create", () => {
      it("should create tax rule with required fields", async () => {
        const data = {
          campgroundId: "cg-1",
          name: "State Tax",
          type: TaxRuleType.percentage,
          rate: 8.5,
        };
        mockPrisma.taxRule.create.mockResolvedValue(
          buildTaxRule({
            id: "rule-1",
            campgroundId: data.campgroundId,
            name: data.name,
            type: data.type,
          }),
        );

        const result = await service.create(data);

        expect(result.id).toBe("rule-1");
        expect(mockPrisma.taxRule.create).toHaveBeenCalledWith({
          data: {
            id: expect.any(String),
            campgroundId: "cg-1",
            name: "State Tax",
            type: "percentage",
            rate: 8.5,
            minNights: undefined,
            maxNights: undefined,
            requiresWaiver: false,
            waiverText: undefined,
          },
        });
      });

      it("should create exemption rule with waiver", async () => {
        const data = {
          campgroundId: "cg-1",
          name: "Extended Stay Exemption",
          type: TaxRuleType.exemption,
          minNights: 30,
          requiresWaiver: true,
          waiverText: "I certify this is my primary residence",
        };
        mockPrisma.taxRule.create.mockResolvedValue(
          buildTaxRule({
            id: "rule-1",
            campgroundId: data.campgroundId,
            name: data.name,
            type: data.type,
            minNights: data.minNights,
            requiresWaiver: data.requiresWaiver,
            waiverText: data.waiverText,
          }),
        );

        await service.create(data);

        expect(mockPrisma.taxRule.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            id: expect.any(String),
            requiresWaiver: true,
            waiverText: "I certify this is my primary residence",
          }),
        });
      });
    });

    describe("findOne", () => {
      it("should return tax rule when found", async () => {
        mockPrisma.taxRule.findFirst.mockResolvedValue(
          buildTaxRule({
            id: "rule-1",
            name: "State Tax",
          }),
        );

        const result = await service.findOne("cg-1", "rule-1");

        expect(result.name).toBe("State Tax");
      });

      it("should throw NotFoundException when not found", async () => {
        mockPrisma.taxRule.findFirst.mockResolvedValue(null);

        await expect(service.findOne("cg-1", "invalid-id")).rejects.toThrow(NotFoundException);
        await expect(service.findOne("cg-1", "invalid-id")).rejects.toThrow("Tax rule not found");
      });
    });

    describe("update", () => {
      it("should update tax rule", async () => {
        mockPrisma.taxRule.findFirst.mockResolvedValue(buildTaxRule({ id: "rule-1" }));
        mockPrisma.taxRule.update.mockResolvedValue(
          buildTaxRule({ id: "rule-1", rate: new Prisma.Decimal(9.0) }),
        );

        const result = await service.update("cg-1", "rule-1", { rate: 9.0 });

        if (!result.rate) {
          throw new Error("Expected rate to be set");
        }
        expect(result.rate.toNumber()).toBe(9.0);
        expect(mockPrisma.taxRule.update).toHaveBeenCalledWith({
          where: { id: "rule-1" },
          data: { rate: 9.0 },
        });
      });

      it("should update isActive status", async () => {
        mockPrisma.taxRule.findFirst.mockResolvedValue(buildTaxRule({ id: "rule-1" }));
        mockPrisma.taxRule.update.mockResolvedValue(
          buildTaxRule({ id: "rule-1", isActive: false }),
        );

        await service.update("cg-1", "rule-1", { isActive: false });

        expect(mockPrisma.taxRule.update).toHaveBeenCalledWith({
          where: { id: "rule-1" },
          data: { isActive: false },
        });
      });
    });

    describe("remove", () => {
      it("should delete tax rule", async () => {
        mockPrisma.taxRule.findFirst.mockResolvedValue(buildTaxRule({ id: "rule-1" }));
        mockPrisma.taxRule.delete.mockResolvedValue(buildTaxRule({ id: "rule-1" }));

        await service.remove("cg-1", "rule-1");

        expect(mockPrisma.taxRule.delete).toHaveBeenCalledWith({
          where: { id: "rule-1" },
        });
      });
    });

    describe("findAllByCampground", () => {
      it("should list rules ordered by createdAt desc", async () => {
        const rules = [
          buildTaxRule({ id: "rule-2", createdAt: new Date("2024-02-01") }),
          buildTaxRule({ id: "rule-1", createdAt: new Date("2024-01-01") }),
        ];
        mockPrisma.taxRule.findMany.mockResolvedValue(rules);

        const result = await service.findAllByCampground("cg-1");

        expect(result).toHaveLength(2);
        expect(mockPrisma.taxRule.findMany).toHaveBeenCalledWith({
          where: { campgroundId: "cg-1" },
          orderBy: { createdAt: "desc" },
        });
      });
    });
  });
});
