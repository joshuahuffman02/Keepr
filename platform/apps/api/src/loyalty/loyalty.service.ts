import { Inject, Injectable } from "@nestjs/common";
import { LoyaltyProfile, PointsTransaction } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type LoyaltyProfileWithTransactions = LoyaltyProfile & { transactions: PointsTransaction[] };
type LoyaltyProfileSummary = { guestId: string; tier: string; pointsBalance: number };

type LoyaltyStoreClient = {
  loyaltyProfile: {
    findUnique: (args: {
      where: { guestId: string };
      include?: { transactions?: { orderBy: { createdAt: "desc" } } };
    }) => Promise<LoyaltyProfileWithTransactions | null>;
    findMany: (args: {
      where: { guestId: { in: string[] } };
      select: { guestId: true; tier: true; pointsBalance: true };
    }) => Promise<LoyaltyProfileSummary[]>;
    create: (args: {
      data: { guestId: string };
      include: { transactions: true };
    }) => Promise<LoyaltyProfileWithTransactions>;
    update: (args: {
      where: { id: string };
      data: { pointsBalance: number; tier: string };
    }) => Promise<LoyaltyProfile>;
  };
  pointsTransaction: {
    create: (args: {
      data: { profileId: string; amount: number; reason: string };
    }) => Promise<PointsTransaction>;
  };
};

export type LoyaltyStore = LoyaltyStoreClient & {
  $transaction: <T>(fn: (tx: LoyaltyStoreClient) => Promise<T>) => Promise<T>;
};

@Injectable()
export class LoyaltyService {
  constructor(@Inject(PrismaService) private readonly prisma: LoyaltyStore) {}

  async getProfile(guestId: string) {
    const profile = await this.prisma.loyaltyProfile.findUnique({
      where: { guestId },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!profile) {
      // Create profile if it doesn't exist (lazy creation)
      return this.createProfile(guestId);
    }

    return profile;
  }

  async getProfilesBatch(guestIds: string[]) {
    if (!guestIds.length) return [];

    const profiles = await this.prisma.loyaltyProfile.findMany({
      where: { guestId: { in: guestIds } },
      select: {
        guestId: true,
        tier: true,
        pointsBalance: true,
      },
    });

    // Return a map for easy lookup
    const profileMap = new Map(profiles.map((p) => [p.guestId, p]));

    // Return array with same order, defaulting missing profiles
    return guestIds.map(
      (id) => profileMap.get(id) || { guestId: id, tier: "Bronze", pointsBalance: 0 },
    );
  }

  async createProfile(guestId: string) {
    return this.prisma.loyaltyProfile.create({
      data: {
        guestId,
      },
      include: {
        transactions: true,
      },
    });
  }

  async awardPoints(guestId: string, amount: number, reason: string) {
    let profile = await this.prisma.loyaltyProfile.findUnique({
      where: { guestId },
    });

    if (!profile) {
      profile = await this.createProfile(guestId);
    }

    const newBalance = profile.pointsBalance + amount;
    const newTier = this.calculateTier(newBalance);

    // Transactional update
    return this.prisma.$transaction(async (tx) => {
      await tx.pointsTransaction.create({
        data: {
          profileId: profile.id,
          amount,
          reason,
        },
      });

      return tx.loyaltyProfile.update({
        where: { id: profile.id },
        data: {
          pointsBalance: newBalance,
          tier: newTier,
        },
      });
    });
  }

  calculateTier(points: number): string {
    if (points >= 10000) return "Platinum";
    if (points >= 5000) return "Gold";
    if (points >= 1000) return "Silver";
    return "Bronze";
  }
}
