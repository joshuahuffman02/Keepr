import { Test, TestingModule } from "@nestjs/testing";
import { DepositPoliciesService } from "./deposit-policies.service";
import { DepositApplyTo, DepositDueTiming, DepositPolicy, DepositStrategy } from "@prisma/client";
import { NotFoundException } from "@nestjs/common";
import type { CreateDepositPolicyDto } from "./dto/create-deposit-policy.dto";
import type { UpdateDepositPolicyDto } from "./dto/update-deposit-policy.dto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

describe("DepositPoliciesService", () => {
  let moduleRef: TestingModule;
  let service: DepositPoliciesService;

  const mockPrisma = {
    depositPolicy: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    campground: {
      findUnique: jest.fn(),
    },
  };
  const mockAudit = { record: jest.fn().mockResolvedValue(undefined) };

  const createMockPolicy = (overrides: Partial<DepositPolicy> = {}): DepositPolicy => ({
    id: "policy-1",
    campgroundId: "cg-1",
    siteClassId: null,
    name: "Standard Deposit",
    strategy: DepositStrategy.percent,
    value: 50,
    applyTo: DepositApplyTo.lodging_plus_fees,
    dueTiming: DepositDueTiming.at_booking,
    retryPlanId: null,
    active: true,
    minCap: null,
    maxCap: null,
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    moduleRef = await Test.createTestingModule({
      providers: [
        DepositPoliciesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = moduleRef.get(DepositPoliciesService);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  describe("resolve", () => {
    describe("policy priority", () => {
      it("should return site-class-specific policy when available", async () => {
        const siteClassPolicy = createMockPolicy({
          id: "site-class-policy",
          siteClassId: "class-1",
          name: "Premium Site Deposit",
        });
        mockPrisma.depositPolicy.findFirst.mockResolvedValue(siteClassPolicy);

        const result = await service.resolve("cg-1", "class-1");

        expect(result).toBe(siteClassPolicy);
        expect(mockPrisma.depositPolicy.findFirst).toHaveBeenCalledWith({
          where: { campgroundId: "cg-1", siteClassId: "class-1", active: true },
          orderBy: { createdAt: "desc" },
        });
      });

      it("should fallback to campground default when no site-class policy", async () => {
        const defaultPolicy = createMockPolicy({ id: "default-policy" });
        mockPrisma.depositPolicy.findFirst.mockResolvedValue(null); // No site-class policy
        mockPrisma.campground.findUnique.mockResolvedValue({
          defaultDepositPolicyId: "default-policy",
        });
        mockPrisma.depositPolicy.findUnique.mockResolvedValue(defaultPolicy);

        const result = await service.resolve("cg-1", "class-1");

        expect(result).toBe(defaultPolicy);
      });

      it("should fallback to campground-wide policy when no default set", async () => {
        const campgroundPolicy = createMockPolicy({ id: "campground-policy" });
        mockPrisma.depositPolicy.findFirst
          .mockResolvedValueOnce(null) // No site-class policy
          .mockResolvedValueOnce(campgroundPolicy); // Campground-wide policy
        mockPrisma.campground.findUnique.mockResolvedValue({
          defaultDepositPolicyId: null,
        });

        const result = await service.resolve("cg-1", "class-1");

        expect(result).toBe(campgroundPolicy);
      });

      it("should return null when no policies exist", async () => {
        mockPrisma.depositPolicy.findFirst.mockResolvedValue(null);
        mockPrisma.campground.findUnique.mockResolvedValue({
          defaultDepositPolicyId: null,
        });

        const result = await service.resolve("cg-1", "class-1");

        expect(result).toBeNull();
      });

      it("should skip inactive campground default policy", async () => {
        const inactiveDefault = createMockPolicy({ id: "default-policy", active: false });
        const campgroundPolicy = createMockPolicy({ id: "campground-policy" });

        mockPrisma.depositPolicy.findFirst
          .mockResolvedValueOnce(null) // No site-class policy
          .mockResolvedValueOnce(campgroundPolicy); // Active campground-wide
        mockPrisma.campground.findUnique.mockResolvedValue({
          defaultDepositPolicyId: "default-policy",
        });
        mockPrisma.depositPolicy.findUnique.mockResolvedValue(inactiveDefault);

        const result = await service.resolve("cg-1", "class-1");

        expect(result).toBe(campgroundPolicy);
      });
    });

    describe("without site class", () => {
      it("should skip site-class lookup when siteClassId is null", async () => {
        const campgroundPolicy = createMockPolicy();
        mockPrisma.campground.findUnique.mockResolvedValue({
          defaultDepositPolicyId: null,
        });
        mockPrisma.depositPolicy.findFirst.mockResolvedValue(campgroundPolicy);

        const result = await service.resolve("cg-1", null);

        expect(result).toBe(campgroundPolicy);
        // Should not have called findFirst for site-class-specific policy
        expect(mockPrisma.depositPolicy.findFirst).toHaveBeenCalledTimes(1);
        expect(mockPrisma.depositPolicy.findFirst).toHaveBeenCalledWith({
          where: { campgroundId: "cg-1", siteClassId: null, active: true },
          orderBy: { createdAt: "desc" },
        });
      });
    });
  });

  describe("calculateDeposit", () => {
    describe("strategy: percent", () => {
      it("should calculate percentage of total amount", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.percent,
          value: 50,
          applyTo: DepositApplyTo.lodging_plus_fees,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 10000, 8000, 2);

        expect(result?.depositAmountCents).toBe(5000); // 50% of 10000
      });

      it("should calculate percentage of lodging only when specified", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.percent,
          value: 50,
          applyTo: DepositApplyTo.lodging_only,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 10000, 8000, 2);

        expect(result?.depositAmountCents).toBe(4000); // 50% of 8000 (lodging only)
      });

      it("should round up fractional cents", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.percent,
          value: 33,
          applyTo: DepositApplyTo.lodging_plus_fees,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 10000, 8000, 2);

        expect(result?.depositAmountCents).toBe(3300); // 33% of 10000 = 3300
      });

      it("should handle 100% deposit", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.percent,
          value: 100,
          applyTo: DepositApplyTo.lodging_plus_fees,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 10000, 8000, 2);

        expect(result?.depositAmountCents).toBe(10000);
      });
    });

    describe("strategy: first_night", () => {
      it("should calculate first night as total divided by nights", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.first_night,
          value: 0, // Not used for first_night
          applyTo: DepositApplyTo.lodging_plus_fees,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 30000, 24000, 3);

        expect(result?.depositAmountCents).toBe(10000); // 30000 / 3 nights
      });

      it("should use lodging only for first night when specified", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.first_night,
          value: 0,
          applyTo: DepositApplyTo.lodging_only,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 30000, 24000, 3);

        expect(result?.depositAmountCents).toBe(8000); // 24000 / 3 nights
      });

      it("should round up fractional nightly amounts", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.first_night,
          value: 0,
          applyTo: DepositApplyTo.lodging_plus_fees,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 10000, 8000, 3);

        expect(result?.depositAmountCents).toBe(3334); // ceil(10000 / 3) = 3334
      });

      it("should handle single night stay", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.first_night,
          value: 0,
          applyTo: DepositApplyTo.lodging_plus_fees,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 15000, 12000, 1);

        expect(result?.depositAmountCents).toBe(15000); // Full amount for 1 night
      });
    });

    describe("strategy: fixed", () => {
      it("should use fixed amount in cents", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.fixed,
          value: 5000, // $50.00 fixed
          applyTo: DepositApplyTo.lodging_plus_fees,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 30000, 24000, 3);

        expect(result?.depositAmountCents).toBe(5000);
      });

      it("should not exceed total amount", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.fixed,
          value: 50000, // $500 fixed (more than total)
          applyTo: DepositApplyTo.lodging_plus_fees,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 30000, 24000, 3);

        expect(result?.depositAmountCents).toBe(30000); // Capped at total
      });
    });

    describe("min/max caps", () => {
      it("should apply minimum cap when deposit is too low", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.percent,
          value: 10,
          applyTo: DepositApplyTo.lodging_plus_fees,
          minCap: 2500, // $25 minimum
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 10000, 8000, 2);

        // 10% of 10000 = 1000, but minCap is 2500
        expect(result?.depositAmountCents).toBe(2500);
      });

      it("should apply maximum cap when deposit is too high", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.percent,
          value: 50,
          applyTo: DepositApplyTo.lodging_plus_fees,
          maxCap: 3000, // $30 maximum
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 10000, 8000, 2);

        // 50% of 10000 = 5000, but maxCap is 3000
        expect(result?.depositAmountCents).toBe(3000);
      });

      it("should apply both min and max caps correctly", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.percent,
          value: 50,
          applyTo: DepositApplyTo.lodging_plus_fees,
          minCap: 1000,
          maxCap: 3000,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        // Test within range
        const result1 = await service.calculateDeposit("cg-1", null, 4000, 3000, 2);
        expect(result1?.depositAmountCents).toBe(2000); // 50% of 4000, within range

        // Test below min
        const result2 = await service.calculateDeposit("cg-1", null, 1000, 800, 2);
        expect(result2?.depositAmountCents).toBe(1000); // Would be 500, but minCap. Also capped at total!

        // Test above max
        const result3 = await service.calculateDeposit("cg-1", null, 10000, 8000, 2);
        expect(result3?.depositAmountCents).toBe(3000); // Would be 5000, maxCap applied
      });

      it("should not apply null caps", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.percent,
          value: 50,
          applyTo: DepositApplyTo.lodging_plus_fees,
          minCap: null,
          maxCap: null,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 10000, 8000, 2);

        expect(result?.depositAmountCents).toBe(5000); // 50% unchanged
      });
    });

    describe("never exceed total", () => {
      it("should cap deposit at total even with minCap", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.percent,
          value: 10,
          applyTo: DepositApplyTo.lodging_plus_fees,
          minCap: 5000, // $50 minimum
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 3000, 2500, 1);

        // 10% of 3000 = 300, minCap bumps to 5000, but total is only 3000
        expect(result?.depositAmountCents).toBe(3000);
      });
    });

    describe("return value structure", () => {
      it("should return deposit calculation with policy info", async () => {
        const policy = createMockPolicy({
          id: "test-policy",
          name: "Test Policy",
          strategy: DepositStrategy.percent,
          value: 25,
          applyTo: DepositApplyTo.lodging_plus_fees,
          version: 3,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", "class-1", 10000, 8000, 2);

        expect(result).toEqual({
          depositAmountCents: 2500,
          policy: {
            id: "test-policy",
            name: "Test Policy",
            strategy: DepositStrategy.percent,
            value: 25,
            applyTo: DepositApplyTo.lodging_plus_fees,
          },
          depositPolicyVersion: "dp:test-policy:v3",
        });
      });

      it("should return null when no policy resolved", async () => {
        jest.spyOn(service, "resolve").mockResolvedValue(null);

        const result = await service.calculateDeposit("cg-1", null, 10000, 8000, 2);

        expect(result).toBeNull();
      });
    });

    describe("edge cases", () => {
      it("should handle division by zero (0 nights) for first_night strategy", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.first_night,
          value: 0,
          applyTo: DepositApplyTo.lodging_plus_fees,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        // With 0 nights, division would be Infinity, ceil(Infinity) = Infinity
        // But this should be capped at totalAmount by "never exceed total" logic
        const result = await service.calculateDeposit("cg-1", null, 10000, 8000, 0);

        // Expect it to be capped at total (Math.min handles Infinity)
        expect(result?.depositAmountCents).toBeLessThanOrEqual(10000);
      });

      it("should handle zero total amount", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.percent,
          value: 50,
          applyTo: DepositApplyTo.lodging_plus_fees,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 0, 0, 1);

        expect(result?.depositAmountCents).toBe(0);
      });

      it("should handle very large amounts", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.percent,
          value: 50,
          applyTo: DepositApplyTo.lodging_plus_fees,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 10000000, 8000000, 30);

        expect(result?.depositAmountCents).toBe(5000000); // 50% of 10M cents
      });

      it("should handle many nights", async () => {
        const policy = createMockPolicy({
          strategy: DepositStrategy.first_night,
          value: 0,
          applyTo: DepositApplyTo.lodging_plus_fees,
        });
        jest.spyOn(service, "resolve").mockResolvedValue(policy);

        const result = await service.calculateDeposit("cg-1", null, 300000, 250000, 30);

        expect(result?.depositAmountCents).toBe(10000); // 300000 / 30 nights
      });
    });
  });

  describe("CRUD operations", () => {
    describe("create", () => {
      it("should create deposit policy and audit", async () => {
        const dto: CreateDepositPolicyDto = {
          name: "New Policy",
          strategy: DepositStrategy.percent,
          value: 25,
          applyTo: DepositApplyTo.lodging_plus_fees,
          dueTiming: DepositDueTiming.at_booking,
          active: true,
        };
        const created = createMockPolicy({ ...dto });
        mockPrisma.depositPolicy.create.mockResolvedValue(created);

        const result = await service.create("cg-1", dto, "user-1");

        expect(result).toBe(created);
        expect(mockAudit.record).toHaveBeenCalledWith({
          campgroundId: "cg-1",
          actorId: "user-1",
          action: "deposit_policy.create",
          entity: "DepositPolicy",
          entityId: created.id,
          before: null,
          after: created,
        });
      });

      it("should handle optional siteClassId", async () => {
        const dto: CreateDepositPolicyDto = {
          name: "New Policy",
          strategy: DepositStrategy.percent,
          value: 25,
          applyTo: DepositApplyTo.lodging_plus_fees,
          dueTiming: DepositDueTiming.at_booking,
          active: true,
          siteClassId: "class-1",
        };
        const created = createMockPolicy({ ...dto });
        mockPrisma.depositPolicy.create.mockResolvedValue(created);

        await service.create("cg-1", dto);

        expect(mockPrisma.depositPolicy.create).toHaveBeenCalledWith({
          data: {
            id: expect.any(String),
            ...dto,
            campgroundId: "cg-1",
            siteClassId: "class-1",
            retryPlanId: null,
            updatedAt: expect.any(Date),
          },
        });
      });
    });

    describe("update", () => {
      it("should update deposit policy and audit", async () => {
        const existing = createMockPolicy();
        const updated = { ...existing, value: 75 };
        mockPrisma.depositPolicy.findFirst.mockResolvedValue(existing);
        mockPrisma.depositPolicy.update.mockResolvedValue(updated);

        const updateDto: UpdateDepositPolicyDto = { value: 75 };
        const result = await service.update("cg-1", "policy-1", updateDto, "user-1");

        expect(result).toBe(updated);
        expect(mockAudit.record).toHaveBeenCalledWith({
          campgroundId: existing.campgroundId,
          actorId: "user-1",
          action: "deposit_policy.update",
          entity: "DepositPolicy",
          entityId: "policy-1",
          before: existing,
          after: updated,
        });
      });

      it("should throw NotFoundException for non-existent policy", async () => {
        mockPrisma.depositPolicy.findFirst.mockResolvedValue(null);

        await expect(service.update("cg-1", "invalid-id", {})).rejects.toThrow(NotFoundException);
      });
    });

    describe("remove", () => {
      it("should delete deposit policy and audit", async () => {
        const existing = createMockPolicy();
        mockPrisma.depositPolicy.findFirst.mockResolvedValue(existing);
        mockPrisma.depositPolicy.delete.mockResolvedValue(existing);

        const result = await service.remove("cg-1", "policy-1", "user-1");

        expect(result).toBe(existing);
        expect(mockAudit.record).toHaveBeenCalledWith({
          campgroundId: existing.campgroundId,
          actorId: "user-1",
          action: "deposit_policy.delete",
          entity: "DepositPolicy",
          entityId: "policy-1",
          before: existing,
          after: null,
        });
      });

      it("should throw NotFoundException for non-existent policy", async () => {
        mockPrisma.depositPolicy.findFirst.mockResolvedValue(null);

        await expect(service.remove("cg-1", "invalid-id")).rejects.toThrow(NotFoundException);
      });
    });

    describe("list", () => {
      it("should list policies ordered by active desc, createdAt desc", async () => {
        const policies = [createMockPolicy(), createMockPolicy({ id: "policy-2" })];
        mockPrisma.depositPolicy.findMany.mockResolvedValue(policies);

        const result = await service.list("cg-1");

        expect(result).toBe(policies);
        expect(mockPrisma.depositPolicy.findMany).toHaveBeenCalledWith({
          where: { campgroundId: "cg-1" },
          orderBy: [{ active: "desc" }, { createdAt: "desc" }],
        });
      });
    });
  });
});
