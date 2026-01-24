import { LoyaltyProfile, PointsTransaction } from "@prisma/client";
import { LoyaltyService } from "./loyalty.service";
import type { LoyaltyStore } from "./loyalty.service";

describe("LoyaltyService", () => {
  let service: LoyaltyService;
  let mockPrisma: ReturnType<typeof buildMockPrisma>;

  type LoyaltyProfileWithTransactions = LoyaltyProfile & { transactions: PointsTransaction[] };

  const createMockProfile = (
    overrides: Partial<LoyaltyProfileWithTransactions> = {},
  ): LoyaltyProfileWithTransactions => ({
    id: "profile-1",
    guestId: "guest-1",
    pointsBalance: 0,
    tier: "Bronze",
    transactions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockTransaction = (
    overrides: Partial<PointsTransaction> = {},
  ): PointsTransaction => ({
    id: "tx-1",
    profileId: "profile-1",
    amount: 100,
    reason: "test",
    createdAt: new Date(),
    ...overrides,
  });

  const buildMockPrisma = () =>
    ({
      loyaltyProfile: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      pointsTransaction: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    }) satisfies LoyaltyStore;

  beforeEach(() => {
    mockPrisma = buildMockPrisma();
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));

    service = new LoyaltyService(mockPrisma);
  });

  describe("calculateTier", () => {
    it("should return Bronze for 0-999 points", () => {
      expect(service.calculateTier(0)).toBe("Bronze");
      expect(service.calculateTier(500)).toBe("Bronze");
      expect(service.calculateTier(999)).toBe("Bronze");
    });

    it("should return Silver for 1000-4999 points", () => {
      expect(service.calculateTier(1000)).toBe("Silver");
      expect(service.calculateTier(2500)).toBe("Silver");
      expect(service.calculateTier(4999)).toBe("Silver");
    });

    it("should return Gold for 5000-9999 points", () => {
      expect(service.calculateTier(5000)).toBe("Gold");
      expect(service.calculateTier(7500)).toBe("Gold");
      expect(service.calculateTier(9999)).toBe("Gold");
    });

    it("should return Platinum for 10000+ points", () => {
      expect(service.calculateTier(10000)).toBe("Platinum");
      expect(service.calculateTier(50000)).toBe("Platinum");
      expect(service.calculateTier(100000)).toBe("Platinum");
    });

    it("should handle edge cases at tier boundaries", () => {
      expect(service.calculateTier(999)).toBe("Bronze");
      expect(service.calculateTier(1000)).toBe("Silver");
      expect(service.calculateTier(4999)).toBe("Silver");
      expect(service.calculateTier(5000)).toBe("Gold");
      expect(service.calculateTier(9999)).toBe("Gold");
      expect(service.calculateTier(10000)).toBe("Platinum");
    });

    it("should handle negative points (defensive)", () => {
      expect(service.calculateTier(-100)).toBe("Bronze");
    });
  });

  describe("getProfile", () => {
    it("should return existing profile", async () => {
      const profile = createMockProfile({ pointsBalance: 5000, tier: "Gold" });
      mockPrisma.loyaltyProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile("guest-1");

      expect(result.pointsBalance).toBe(5000);
      expect(result.tier).toBe("Gold");
    });

    it("should create profile if not exists (lazy creation)", async () => {
      mockPrisma.loyaltyProfile.findUnique.mockResolvedValue(null);
      mockPrisma.loyaltyProfile.create.mockResolvedValue(createMockProfile());

      const result = await service.getProfile("guest-new");

      expect(mockPrisma.loyaltyProfile.create).toHaveBeenCalledWith({
        data: { guestId: "guest-new" },
        include: { transactions: true },
      });
      expect(result).toBeDefined();
    });

    it("should include transactions with profile", async () => {
      const profile = createMockProfile({
        transactions: [
          {
            id: "tx-1",
            profileId: "profile-1",
            amount: 100,
            reason: "Stay bonus",
            createdAt: new Date(),
          },
          {
            id: "tx-2",
            profileId: "profile-1",
            amount: 50,
            reason: "Referral bonus",
            createdAt: new Date(),
          },
        ],
      });
      mockPrisma.loyaltyProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile("guest-1");

      expect(result.transactions).toHaveLength(2);
    });
  });

  describe("createProfile", () => {
    it("should create new profile for guest", async () => {
      mockPrisma.loyaltyProfile.create.mockResolvedValue(createMockProfile());

      await service.createProfile("guest-new");

      expect(mockPrisma.loyaltyProfile.create).toHaveBeenCalledWith({
        data: { guestId: "guest-new" },
        include: { transactions: true },
      });
    });
  });

  describe("awardPoints", () => {
    it("should award points and update balance", async () => {
      const profile = createMockProfile({ pointsBalance: 500 });
      mockPrisma.loyaltyProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.pointsTransaction.create.mockResolvedValue(createMockTransaction());
      mockPrisma.loyaltyProfile.update.mockResolvedValue({
        ...profile,
        pointsBalance: 600,
        tier: "Bronze",
      });

      const result = await service.awardPoints("guest-1", 100, "Stay completion");

      expect(mockPrisma.pointsTransaction.create).toHaveBeenCalledWith({
        data: {
          profileId: "profile-1",
          amount: 100,
          reason: "Stay completion",
        },
      });
      expect(mockPrisma.loyaltyProfile.update).toHaveBeenCalledWith({
        where: { id: "profile-1" },
        data: {
          pointsBalance: 600,
          tier: "Bronze",
        },
      });
    });

    it("should upgrade tier when points threshold reached", async () => {
      const profile = createMockProfile({ pointsBalance: 900 });
      mockPrisma.loyaltyProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.pointsTransaction.create.mockResolvedValue(createMockTransaction());
      mockPrisma.loyaltyProfile.update.mockResolvedValue({
        ...profile,
        pointsBalance: 1000,
        tier: "Silver",
      });

      await service.awardPoints("guest-1", 100, "Stay completion");

      expect(mockPrisma.loyaltyProfile.update).toHaveBeenCalledWith({
        where: { id: "profile-1" },
        data: {
          pointsBalance: 1000,
          tier: "Silver", // Upgraded from Bronze
        },
      });
    });

    it("should create profile if guest has none", async () => {
      mockPrisma.loyaltyProfile.findUnique.mockResolvedValue(null);
      mockPrisma.loyaltyProfile.create.mockResolvedValue(createMockProfile());
      mockPrisma.pointsTransaction.create.mockResolvedValue(createMockTransaction());
      mockPrisma.loyaltyProfile.update.mockResolvedValue(createMockProfile({ pointsBalance: 100 }));

      await service.awardPoints("guest-new", 100, "Welcome bonus");

      expect(mockPrisma.loyaltyProfile.create).toHaveBeenCalled();
    });

    it("should handle large point awards", async () => {
      const profile = createMockProfile({ pointsBalance: 0 });
      mockPrisma.loyaltyProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.pointsTransaction.create.mockResolvedValue(createMockTransaction());
      mockPrisma.loyaltyProfile.update.mockResolvedValue({
        ...profile,
        pointsBalance: 15000,
        tier: "Platinum",
      });

      await service.awardPoints("guest-1", 15000, "Promotional bonus");

      expect(mockPrisma.loyaltyProfile.update).toHaveBeenCalledWith({
        where: { id: "profile-1" },
        data: {
          pointsBalance: 15000,
          tier: "Platinum",
        },
      });
    });
  });

  describe("tier progression scenarios", () => {
    it("should progress through tiers correctly", async () => {
      const scenarios = [
        { current: 0, award: 500, expectedTier: "Bronze" },
        { current: 500, award: 500, expectedTier: "Silver" },
        { current: 1000, award: 4000, expectedTier: "Gold" },
        { current: 5000, award: 5000, expectedTier: "Platinum" },
      ];

      for (const scenario of scenarios) {
        const profile = createMockProfile({ pointsBalance: scenario.current });
        mockPrisma.loyaltyProfile.findUnique.mockResolvedValue(profile);
        mockPrisma.pointsTransaction.create.mockResolvedValue(createMockTransaction());
        mockPrisma.loyaltyProfile.update.mockResolvedValue(createMockProfile());

        await service.awardPoints("guest-1", scenario.award, "test");

        expect(mockPrisma.loyaltyProfile.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              tier: scenario.expectedTier,
            }),
          }),
        );
      }
    });
  });
});
