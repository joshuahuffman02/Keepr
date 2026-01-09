import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, DonationStatus, CharityPayoutStatus } from "@prisma/client";
import { postBalancedLedgerEntries } from "../ledger/ledger-posting.util";

// GL Codes for charity accounting
const GL_CODES = {
  CHARITY_DONATIONS_PAYABLE: "2400", // Liability - money owed to charity
  CHARITY_CASH_COLLECTED: "1010",    // Asset - cash received from guests
  CHARITY_CASH_PAID_OUT: "1010",     // Asset - cash paid to charity
};

// DTOs
export interface CreateCharityDto {
  name: string;
  description?: string;
  logoUrl?: string;
  taxId?: string;
  website?: string;
  category?: string;
}

export interface UpdateCharityDto extends Partial<CreateCharityDto> {
  isActive?: boolean;
  isVerified?: boolean;
}

export interface SetCampgroundCharityDto {
  charityId?: string;
  // Allow creating a new charity inline
  newCharity?: {
    name: string;
    description?: string;
    taxId?: string;
    website?: string;
  };
  isEnabled?: boolean;
  customMessage?: string;
  roundUpType?: string;
  roundUpOptions?: { values: number[] };
  defaultOptIn?: boolean;
  glCode?: string; // For QuickBooks integration
}

export interface CreateDonationDto {
  reservationId: string;
  charityId: string;
  campgroundId: string;
  guestId?: string;
  amountCents: number;
}

export interface CharityStats {
  totalDonations: number;
  totalAmountCents: number;
  donorCount: number;
  optInRate: number;
  averageDonationCents: number;
  byStatus: { status: string; count: number; amountCents: number }[];
}

@Injectable()
export class CharityService {
  private readonly logger = new Logger(CharityService.name);

  constructor(private prisma: PrismaService) {}

  // ==========================================================================
  // CHARITY CRUD (Platform Admin)
  // ==========================================================================

  async listCharities(options?: { category?: string; activeOnly?: boolean }) {
    const where: Prisma.CharityWhereInput = {};

    if (options?.category) {
      where.category = options.category;
    }
    if (options?.activeOnly !== false) {
      where.isActive = true;
    }

    return this.prisma.charity.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            campgroundCharities: true,
            donations: true,
          },
        },
      },
    });
  }

  async getCharity(id: string) {
    const charity = await this.prisma.charity.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            campgroundCharities: true,
            donations: true,
          },
        },
      },
    });

    if (!charity) {
      throw new NotFoundException("Charity not found");
    }

    return charity;
  }

  async createCharity(data: CreateCharityDto) {
    return this.prisma.charity.create({
      data: {
        name: data.name,
        description: data.description,
        logoUrl: data.logoUrl,
        taxId: data.taxId,
        website: data.website,
        category: data.category,
      },
    });
  }

  async updateCharity(id: string, data: UpdateCharityDto) {
    await this.getCharity(id); // Ensure exists

    return this.prisma.charity.update({
      where: { id },
      data,
    });
  }

  async deleteCharity(id: string) {
    await this.getCharity(id); // Ensure exists

    // Soft delete - just deactivate
    return this.prisma.charity.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getCharityCategories() {
    const charities = await this.prisma.charity.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ["category"],
    });

    return charities
      .map((c) => c.category)
      .filter(Boolean)
      .sort();
  }

  // ==========================================================================
  // CAMPGROUND CHARITY SETTINGS
  // ==========================================================================

  async getCampgroundCharity(campgroundId: string) {
    return this.prisma.campgroundCharity.findUnique({
      where: { campgroundId },
      include: {
        Charity: true,
      },
    });
  }

  async setCampgroundCharity(campgroundId: string, data: SetCampgroundCharityDto) {
    let charityId = data.charityId;

    // If creating a new charity inline
    if (data.newCharity && !charityId) {
      const newCharity = await this.prisma.charity.create({
        data: {
          name: data.newCharity.name,
          description: data.newCharity.description,
          taxId: data.newCharity.taxId,
          website: data.newCharity.website,
          isActive: true,
          isVerified: false, // Campground-created charities aren't platform-verified
        },
      });
      charityId = newCharity.id;
    }

    if (!charityId) {
      throw new BadRequestException("Either charityId or newCharity must be provided");
    }

    // Verify charity exists
    await this.getCharity(charityId);

    return this.prisma.campgroundCharity.upsert({
      where: { campgroundId },
      create: {
        campgroundId,
        charityId,
        isEnabled: data.isEnabled ?? true,
        customMessage: data.customMessage,
        roundUpType: data.roundUpType ?? "nearest_dollar",
        roundUpOptions: data.roundUpOptions as Prisma.InputJsonValue,
        defaultOptIn: data.defaultOptIn ?? false,
        glCode: data.glCode ?? "2400",
      },
      update: {
        charityId,
        isEnabled: data.isEnabled,
        customMessage: data.customMessage,
        roundUpType: data.roundUpType,
        roundUpOptions: data.roundUpOptions as Prisma.InputJsonValue,
        defaultOptIn: data.defaultOptIn,
        glCode: data.glCode,
      },
      include: {
        Charity: true,
      },
    });
  }

  async disableCampgroundCharity(campgroundId: string) {
    const settings = await this.getCampgroundCharity(campgroundId);
    if (!settings) return null;

    return this.prisma.campgroundCharity.update({
      where: { campgroundId },
      data: { isEnabled: false },
    });
  }

  // ==========================================================================
  // DONATIONS
  // ==========================================================================

  async createDonation(data: CreateDonationDto) {
    return this.prisma.$transaction(async (tx) => {
      // Create the donation record
      const donation = await tx.charityDonation.create({
        data: {
          reservationId: data.reservationId,
          charityId: data.charityId,
          campgroundId: data.campgroundId,
          guestId: data.guestId,
          amountCents: data.amountCents,
          status: "collected",
        },
        include: {
          Charity: true,
        },
      });

      // Create balanced ledger entries:
      // Debit Cash (asset increases) | Credit Charity Donations Payable (liability increases)
      try {
        const ledgerEntries = await postBalancedLedgerEntries(tx, [
          {
            campgroundId: data.campgroundId,
            reservationId: data.reservationId,
            glCode: GL_CODES.CHARITY_CASH_COLLECTED,
            account: "Cash - Charity Collections",
            description: `Charity donation collected for ${donation.Charity.name}`,
            amountCents: data.amountCents,
            direction: "debit",
            externalRef: `donation:${donation.id}:debit`,
          },
          {
            campgroundId: data.campgroundId,
            reservationId: data.reservationId,
            glCode: GL_CODES.CHARITY_DONATIONS_PAYABLE,
            account: "Charity Donations Payable",
            description: `Charity donation payable to ${donation.Charity.name}`,
            amountCents: data.amountCents,
            direction: "credit",
            externalRef: `donation:${donation.id}:credit`,
          },
        ]);

        // Update donation with journal entry reference
        if (ledgerEntries.length > 0) {
          await tx.charityDonation.update({
            where: { id: donation.id },
            data: { journalEntryId: ledgerEntries[0].id },
          });
        }
      } catch (err) {
        this.logger.error("Failed to post charity donation ledger entries:", err);
        // Continue without ledger entries for now - they can be reconciled later
      }

      return donation;
    });
  }

  async getDonationByReservation(reservationId: string) {
    return this.prisma.charityDonation.findUnique({
      where: { reservationId },
      include: {
        Charity: true,
      },
    });
  }

  async refundDonation(reservationId: string) {
    const donation = await this.getDonationByReservation(reservationId);
    if (!donation) return null;

    return this.prisma.$transaction(async (tx) => {
      const updatedDonation = await tx.charityDonation.update({
        where: { reservationId },
        data: {
          status: "refunded",
          refundedAt: new Date(),
        },
        include: {
          Charity: true,
        },
      });

      // Create reversal ledger entries:
      // Debit Charity Donations Payable (liability decreases) | Credit Cash (asset decreases)
      try {
        await postBalancedLedgerEntries(tx, [
          {
            campgroundId: donation.campgroundId,
            reservationId,
            glCode: GL_CODES.CHARITY_DONATIONS_PAYABLE,
            account: "Charity Donations Payable",
            description: `Charity donation refund - ${updatedDonation.Charity.name}`,
            amountCents: donation.amountCents,
            direction: "debit",
            externalRef: `donation-refund:${donation.id}:debit`,
          },
          {
            campgroundId: donation.campgroundId,
            reservationId,
            glCode: GL_CODES.CHARITY_CASH_COLLECTED,
            account: "Cash - Charity Collections",
            description: `Charity donation refund - ${updatedDonation.Charity.name}`,
            amountCents: donation.amountCents,
            direction: "credit",
            externalRef: `donation-refund:${donation.id}:credit`,
          },
        ]);
      } catch (err) {
        this.logger.error("Failed to post charity refund ledger entries:", err);
      }

      return updatedDonation;
    });
  }

  async listDonations(options: {
    campgroundId?: string;
    charityId?: string;
    status?: DonationStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.CharityDonationWhereInput = {};

    if (options.campgroundId) where.campgroundId = options.campgroundId;
    if (options.charityId) where.charityId = options.charityId;
    if (options.status) where.status = options.status;
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const [donations, total] = await Promise.all([
      this.prisma.charityDonation.findMany({
        where,
        include: {
          Charity: true,
          Reservation: {
            select: {
              id: true,
              arrivalDate: true,
              departureDate: true,
              Guest: {
                select: { primaryFirstName: true, primaryLastName: true, email: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: options.limit ?? 50,
        skip: options.offset ?? 0,
      }),
      this.prisma.charityDonation.count({ where }),
    ]);

    return { donations, total };
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  async getCharityStats(options: {
    charityId?: string;
    campgroundId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<CharityStats> {
    const where: Prisma.CharityDonationWhereInput = {
      status: { not: "refunded" },
    };

    if (options.charityId) where.charityId = options.charityId;
    if (options.campgroundId) where.campgroundId = options.campgroundId;
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    // Run all queries in parallel for performance
    const [donations, donors, byStatus, reservationCount] = await Promise.all([
      // Get donation stats
      this.prisma.charityDonation.aggregate({
        where,
        _count: true,
        _sum: { amountCents: true },
      }),
      // Get unique donors
      this.prisma.charityDonation.groupBy({
        by: ["guestId"],
        where: { ...where, guestId: { not: null } },
      }),
      // Get by status
      this.prisma.charityDonation.groupBy({
        by: ["status"],
        where: options.campgroundId ? { campgroundId: options.campgroundId } : {},
        _count: true,
        _sum: { amountCents: true },
      }),
      // Get reservation count for opt-in rate (only if campgroundId provided)
      options.campgroundId
        ? this.prisma.reservation.count({
            where: {
              campgroundId: options.campgroundId,
              status: { in: ["confirmed", "checked_in", "checked_out"] },
              createdAt: where.createdAt,
            },
          })
        : Promise.resolve(0),
    ]);

    // Calculate opt-in rate
    const optInRate = reservationCount > 0
      ? (donations._count / reservationCount) * 100
      : 0;

    return {
      totalDonations: donations._count,
      totalAmountCents: donations._sum.amountCents ?? 0,
      donorCount: donors.length,
      optInRate: Math.round(optInRate * 10) / 10,
      averageDonationCents:
        donations._count > 0
          ? Math.round((donations._sum.amountCents ?? 0) / donations._count)
          : 0,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
        amountCents: s._sum.amountCents ?? 0,
      })),
    };
  }

  async getCampgroundDonationStats(campgroundId: string, startDate?: Date, endDate?: Date) {
    return this.getCharityStats({ campgroundId, startDate, endDate });
  }

  async getPlatformDonationStats(startDate?: Date, endDate?: Date) {
    const stats = await this.getCharityStats({ startDate, endDate });

    // Also get per-charity breakdown
    const byCharity = await this.prisma.charityDonation.groupBy({
      by: ["charityId"],
      where: {
        status: { not: "refunded" },
        createdAt: startDate || endDate ? {
          gte: startDate,
          lte: endDate,
        } : undefined,
      },
      _count: true,
      _sum: { amountCents: true },
    });

    const charities = await this.prisma.charity.findMany({
      where: { id: { in: byCharity.map((c) => c.charityId) } },
      select: { id: true, name: true, logoUrl: true },
    });

    const charityMap = new Map(charities.map((c) => [c.id, c]));

    return {
      ...stats,
      byCharity: byCharity.map((c) => ({
        charity: charityMap.get(c.charityId),
        count: c._count,
        amountCents: c._sum.amountCents ?? 0,
      })),
    };
  }

  // ==========================================================================
  // PAYOUTS
  // ==========================================================================

  async createPayout(charityId: string, createdBy?: string) {
    // Get all collected donations for this charity
    const donations = await this.prisma.charityDonation.findMany({
      where: {
        charityId,
        status: "collected",
      },
    });

    if (donations.length === 0) {
      throw new BadRequestException("No donations available for payout");
    }

    const totalAmountCents = donations.reduce((sum, d) => sum + d.amountCents, 0);

    // Create payout and update donations in a transaction
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.charityPayout.create({
        data: {
          charityId,
          amountCents: totalAmountCents,
          status: "pending",
          createdBy,
        },
        include: {
          Charity: true,
        },
      });

      // Mark donations as pending_payout
      await tx.charityDonation.updateMany({
        where: {
          id: { in: donations.map((d) => d.id) },
        },
        data: {
          status: "pending_payout",
          payoutId: payout.id,
        },
      });

      return payout;
    });
  }

  async completePayout(payoutId: string, reference?: string, notes?: string) {
    const payout = await this.prisma.charityPayout.findUnique({
      where: { id: payoutId },
      include: {
        Charity: true,
        donations: {
          select: { campgroundId: true, amountCents: true },
        },
      },
    });

    if (!payout) {
      throw new NotFoundException("Payout not found");
    }

    return this.prisma.$transaction(async (tx) => {
      // Update payout
      const updatedPayout = await tx.charityPayout.update({
        where: { id: payoutId },
        data: {
          status: "completed",
          payoutDate: new Date(),
          reference,
          notes,
        },
        include: {
          Charity: true,
        },
      });

      // Mark donations as paid_out
      await tx.charityDonation.updateMany({
        where: { payoutId },
        data: { status: "paid_out" },
      });

      // Create ledger entries for each campground involved in this payout
      // Group donations by campground
      const byCampground = new Map<string, number>();
      for (const donation of payout.donations) {
        const current = byCampground.get(donation.campgroundId) ?? 0;
        byCampground.set(donation.campgroundId, current + donation.amountCents);
      }

      // Post ledger entries for each campground
      // Debit Charity Donations Payable (liability decreases) | Credit Cash (asset decreases)
      for (const [campgroundId, amountCents] of byCampground) {
        try {
          await postBalancedLedgerEntries(tx, [
            {
              campgroundId,
              glCode: GL_CODES.CHARITY_DONATIONS_PAYABLE,
              account: "Charity Donations Payable",
              description: `Charity payout to ${payout.Charity.name} (ref: ${reference || payoutId})`,
              amountCents,
              direction: "debit",
              externalRef: `payout:${payoutId}:${campgroundId}:debit`,
            },
            {
              campgroundId,
              glCode: GL_CODES.CHARITY_CASH_PAID_OUT,
              account: "Cash - Charity Payouts",
              description: `Charity payout to ${payout.Charity.name} (ref: ${reference || payoutId})`,
              amountCents,
              direction: "credit",
              externalRef: `payout:${payoutId}:${campgroundId}:credit`,
            },
          ]);
        } catch (err) {
          this.logger.error(`Failed to post payout ledger entries for campground ${campgroundId}:`, err);
        }
      }

      return updatedPayout;
    });
  }

  async listPayouts(options?: {
    charityId?: string;
    status?: CharityPayoutStatus;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.CharityPayoutWhereInput = {};

    if (options?.charityId) where.charityId = options.charityId;
    if (options?.status) where.status = options.status;

    const [payouts, total] = await Promise.all([
      this.prisma.charityPayout.findMany({
        where,
        include: {
          Charity: true,
          _count: { select: { donations: true } },
        },
        orderBy: { createdAt: "desc" },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      this.prisma.charityPayout.count({ where }),
    ]);

    return { payouts, total };
  }

  // ==========================================================================
  // ROUND-UP CALCULATION
  // ==========================================================================

  calculateRoundUp(
    totalCents: number,
    roundUpType: string,
    roundUpOptions?: { values: number[] }
  ): { roundUpAmount: number; newTotal: number } {
    let roundUpAmount = 0;

    switch (roundUpType) {
      case "nearest_dollar":
        // Round up to nearest $1.00
        roundUpAmount = (100 - (totalCents % 100)) % 100;
        break;

      case "nearest_5":
        // Round up to nearest $5.00
        roundUpAmount = (500 - (totalCents % 500)) % 500;
        break;

      case "fixed":
        // Use first fixed value (default $1)
        const values = roundUpOptions?.values ?? [100];
        roundUpAmount = values[0];
        break;

      default:
        roundUpAmount = (100 - (totalCents % 100)) % 100;
    }

    // If round-up would be 0, use $1
    if (roundUpAmount === 0) {
      roundUpAmount = 100;
    }

    return {
      roundUpAmount,
      newTotal: totalCents + roundUpAmount,
    };
  }
}
