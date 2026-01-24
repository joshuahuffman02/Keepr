import { Promotion, PromotionType } from "@prisma/client";
import { PromotionsService } from "./promotions.service";
import type { PromotionsStore } from "./promotions.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { CreatePromotionDto, UpdatePromotionDto } from "./dto/promotions.dto";

describe("PromotionsService", () => {
  let service: PromotionsService;
  let mockPrisma: ReturnType<typeof buildMockPrisma>;

  const createMockPromotion = (overrides: Partial<Promotion> = {}): Promotion => ({
    id: "promo-1",
    campgroundId: "cg-1",
    code: "SUMMER20",
    type: PromotionType.percentage,
    value: 20,
    validFrom: null,
    validTo: null,
    usageLimit: null,
    usageCount: 0,
    isActive: true,
    description: "Summer discount",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const buildMockPrisma = () =>
    ({
      promotion: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    }) satisfies PromotionsStore;

  beforeEach(() => {
    mockPrisma = buildMockPrisma();

    service = new PromotionsService(mockPrisma);
  });

  describe("validate", () => {
    describe("code validation", () => {
      it("should throw when promo code not found", async () => {
        mockPrisma.promotion.findUnique.mockResolvedValue(null);

        await expect(
          service.validate({
            campgroundId: "cg-1",
            code: "INVALID",
            subtotal: 10000,
          }),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.validate({
            campgroundId: "cg-1",
            code: "INVALID",
            subtotal: 10000,
          }),
        ).rejects.toThrow("Promo code not found. Please verify the code and try again");
      });

      it("should normalize code to uppercase", async () => {
        const promo = createMockPromotion();
        mockPrisma.promotion.findUnique.mockResolvedValue(promo);

        await service.validate({
          campgroundId: "cg-1",
          code: "summer20",
          subtotal: 10000,
        });

        expect(mockPrisma.promotion.findUnique).toHaveBeenCalledWith({
          where: {
            campgroundId_code: {
              campgroundId: "cg-1",
              code: "SUMMER20",
            },
          },
        });
      });

      it("should throw when promo code is inactive", async () => {
        const promo = createMockPromotion({ isActive: false });
        mockPrisma.promotion.findUnique.mockResolvedValue(promo);

        await expect(
          service.validate({
            campgroundId: "cg-1",
            code: "SUMMER20",
            subtotal: 10000,
          }),
        ).rejects.toThrow("This promo code is no longer active");
      });
    });

    describe("date validation", () => {
      it("should throw when promo code is not yet valid", async () => {
        const futureDate = new Date(Date.now() + 86400000); // tomorrow
        const promo = createMockPromotion({ validFrom: futureDate });
        mockPrisma.promotion.findUnique.mockResolvedValue(promo);

        await expect(
          service.validate({
            campgroundId: "cg-1",
            code: "SUMMER20",
            subtotal: 10000,
          }),
        ).rejects.toThrow("This promo code is not yet valid");
      });

      it("should throw when promo code has expired", async () => {
        const pastDate = new Date(Date.now() - 86400000); // yesterday
        const promo = createMockPromotion({ validTo: pastDate });
        mockPrisma.promotion.findUnique.mockResolvedValue(promo);

        await expect(
          service.validate({
            campgroundId: "cg-1",
            code: "SUMMER20",
            subtotal: 10000,
          }),
        ).rejects.toThrow("This promo code has expired");
      });

      it("should pass when within valid date range", async () => {
        const promo = createMockPromotion({
          validFrom: new Date(Date.now() - 86400000), // yesterday
          validTo: new Date(Date.now() + 86400000), // tomorrow
        });
        mockPrisma.promotion.findUnique.mockResolvedValue(promo);

        const result = await service.validate({
          campgroundId: "cg-1",
          code: "SUMMER20",
          subtotal: 10000,
        });

        expect(result.valid).toBe(true);
      });
    });

    describe("usage limit validation", () => {
      it("should throw when usage limit reached", async () => {
        const promo = createMockPromotion({ usageLimit: 100, usageCount: 100 });
        mockPrisma.promotion.findUnique.mockResolvedValue(promo);

        await expect(
          service.validate({
            campgroundId: "cg-1",
            code: "SUMMER20",
            subtotal: 10000,
          }),
        ).rejects.toThrow("This promo code has reached its usage limit");
      });

      it("should pass when under usage limit", async () => {
        const promo = createMockPromotion({ usageLimit: 100, usageCount: 50 });
        mockPrisma.promotion.findUnique.mockResolvedValue(promo);

        const result = await service.validate({
          campgroundId: "cg-1",
          code: "SUMMER20",
          subtotal: 10000,
        });

        expect(result.valid).toBe(true);
      });

      it("should pass when no usage limit set", async () => {
        const promo = createMockPromotion({ usageLimit: null, usageCount: 1000 });
        mockPrisma.promotion.findUnique.mockResolvedValue(promo);

        const result = await service.validate({
          campgroundId: "cg-1",
          code: "SUMMER20",
          subtotal: 10000,
        });

        expect(result.valid).toBe(true);
      });
    });

    describe("discount calculation - percentage", () => {
      it("should calculate percentage discount correctly", async () => {
        const promo = createMockPromotion({ type: PromotionType.percentage, value: 20 });
        mockPrisma.promotion.findUnique.mockResolvedValue(promo);

        const result = await service.validate({
          campgroundId: "cg-1",
          code: "SUMMER20",
          subtotal: 10000, // $100
        });

        expect(result.discountCents).toBe(2000); // 20% of $100
      });

      it("should round percentage discount to nearest cent", async () => {
        const promo = createMockPromotion({ type: PromotionType.percentage, value: 33 });
        mockPrisma.promotion.findUnique.mockResolvedValue(promo);

        const result = await service.validate({
          campgroundId: "cg-1",
          code: "SAVE33",
          subtotal: 9999, // $99.99
        });

        expect(result.discountCents).toBe(3300); // Math.round(9999 * 0.33) = 3300
      });

      it("should handle 100% discount", async () => {
        const promo = createMockPromotion({ type: PromotionType.percentage, value: 100 });
        mockPrisma.promotion.findUnique.mockResolvedValue(promo);

        const result = await service.validate({
          campgroundId: "cg-1",
          code: "FREE",
          subtotal: 10000,
        });

        expect(result.discountCents).toBe(10000);
      });
    });

    describe("discount calculation - flat", () => {
      it("should apply flat discount", async () => {
        const promo = createMockPromotion({ type: PromotionType.flat, value: 1500 }); // $15 off
        mockPrisma.promotion.findUnique.mockResolvedValue(promo);

        const result = await service.validate({
          campgroundId: "cg-1",
          code: "FLAT15",
          subtotal: 10000,
        });

        expect(result.discountCents).toBe(1500);
      });

      it("should cap flat discount at subtotal", async () => {
        const promo = createMockPromotion({ type: PromotionType.flat, value: 5000 }); // $50 off
        mockPrisma.promotion.findUnique.mockResolvedValue(promo);

        const result = await service.validate({
          campgroundId: "cg-1",
          code: "FLAT50",
          subtotal: 3000, // Only $30 subtotal
        });

        expect(result.discountCents).toBe(3000); // Capped at subtotal
      });
    });

    describe("return value", () => {
      it("should return complete validation result", async () => {
        const promo = createMockPromotion({
          id: "promo-123",
          code: "SUMMER20",
          type: PromotionType.percentage,
          value: 20,
        });
        mockPrisma.promotion.findUnique.mockResolvedValue(promo);

        const result = await service.validate({
          campgroundId: "cg-1",
          code: "summer20",
          subtotal: 10000,
        });

        expect(result).toEqual({
          valid: true,
          discountCents: 2000,
          promotionId: "promo-123",
          code: "SUMMER20",
          type: PromotionType.percentage,
          value: 20,
        });
      });
    });
  });

  describe("create", () => {
    it("should create promotion with normalized code", async () => {
      const created = createMockPromotion();
      mockPrisma.promotion.create.mockResolvedValue(created);

      const dto: CreatePromotionDto = {
        campgroundId: "cg-1",
        code: "  summer20  ",
        value: 20,
      };
      await service.create(dto);

      expect(mockPrisma.promotion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: "SUMMER20",
        }),
      });
    });

    it("should apply defaults", async () => {
      const created = createMockPromotion();
      mockPrisma.promotion.create.mockResolvedValue(created);

      const dto: CreatePromotionDto = {
        campgroundId: "cg-1",
        code: "TEST",
        value: 10,
      };
      await service.create(dto);

      expect(mockPrisma.promotion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: PromotionType.percentage,
          usageLimit: null,
          isActive: true,
          description: null,
        }),
      });
    });
  });

  describe("update", () => {
    it("should update promotion", async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(createMockPromotion());
      mockPrisma.promotion.update.mockResolvedValue(createMockPromotion({ value: 30 }));

      const dto: UpdatePromotionDto = { value: 30 };
      await service.update("cg-1", "promo-1", dto);

      expect(mockPrisma.promotion.update).toHaveBeenCalledWith({
        where: { id: "promo-1" },
        data: expect.objectContaining({ value: 30 }),
      });
    });

    it("should normalize code on update", async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(createMockPromotion());
      mockPrisma.promotion.update.mockResolvedValue(createMockPromotion());

      const dto: UpdatePromotionDto = { code: "newcode" };
      await service.update("cg-1", "promo-1", dto);

      expect(mockPrisma.promotion.update).toHaveBeenCalledWith({
        where: { id: "promo-1" },
        data: expect.objectContaining({ code: "NEWCODE" }),
      });
    });

    it("should throw NotFoundException for invalid id", async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(null);

      const dto: UpdatePromotionDto = {};
      await expect(service.update("cg-1", "invalid", dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe("incrementUsage", () => {
    it("should increment usage count", async () => {
      mockPrisma.promotion.update.mockResolvedValue(createMockPromotion({ usageCount: 1 }));

      await service.incrementUsage("promo-1");

      expect(mockPrisma.promotion.update).toHaveBeenCalledWith({
        where: { id: "promo-1" },
        data: { usageCount: { increment: 1 } },
      });
    });
  });

  describe("findAll", () => {
    it("should list promotions ordered by active then createdAt", async () => {
      mockPrisma.promotion.findMany.mockResolvedValue([createMockPromotion()]);

      await service.findAll("cg-1");

      expect(mockPrisma.promotion.findMany).toHaveBeenCalledWith({
        where: { campgroundId: "cg-1" },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      });
    });
  });

  describe("remove", () => {
    it("should delete promotion", async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(createMockPromotion());
      mockPrisma.promotion.delete.mockResolvedValue(createMockPromotion());

      await service.remove("cg-1", "promo-1");

      expect(mockPrisma.promotion.delete).toHaveBeenCalledWith({
        where: { id: "promo-1" },
      });
    });

    it("should throw NotFoundException for invalid id", async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(null);

      await expect(service.remove("cg-1", "invalid")).rejects.toThrow(NotFoundException);
    });
  });
});
