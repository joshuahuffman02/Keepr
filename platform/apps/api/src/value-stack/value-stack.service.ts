import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { GuaranteeType } from "@prisma/client";

@Injectable()
export class ValueStackService {
  constructor(private prisma: PrismaService) {}

  // ==================== GUARANTEES ====================

  async getGuarantees(campgroundId: string) {
    return this.prisma.campgroundGuarantee.findMany({
      where: { campgroundId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async createGuarantee(data: {
    campgroundId: string;
    type: GuaranteeType;
    title: string;
    description: string;
    iconName?: string;
    sortOrder?: number;
  }) {
    return this.prisma.campgroundGuarantee.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        ...data,
      },
    });
  }

  async updateGuarantee(
    id: string,
    campgroundId: string,
    data: Partial<{
      type: GuaranteeType;
      title: string;
      description: string;
      iconName: string;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    const guarantee = await this.prisma.campgroundGuarantee.findUnique({ where: { id } });
    if (!guarantee) throw new NotFoundException("Guarantee not found");
    if (guarantee.campgroundId !== campgroundId) {
      throw new ForbiddenException("Access denied to this guarantee");
    }
    return this.prisma.campgroundGuarantee.update({
      where: { id },
      data,
    });
  }

  async deleteGuarantee(id: string, campgroundId: string) {
    const guarantee = await this.prisma.campgroundGuarantee.findUnique({ where: { id } });
    if (!guarantee) throw new NotFoundException("Guarantee not found");
    if (guarantee.campgroundId !== campgroundId) {
      throw new ForbiddenException("Access denied to this guarantee");
    }
    return this.prisma.campgroundGuarantee.delete({ where: { id } });
  }

  // ==================== BONUSES ====================

  async getBonuses(campgroundId: string) {
    return this.prisma.campgroundBonus.findMany({
      where: { campgroundId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async createBonus(data: {
    campgroundId: string;
    name: string;
    description?: string;
    valueCents: number;
    iconName?: string;
    siteClassIds?: string[];
    isAutoIncluded?: boolean;
    sortOrder?: number;
  }) {
    return this.prisma.campgroundBonus.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        ...data,
      },
    });
  }

  async updateBonus(
    id: string,
    campgroundId: string,
    data: Partial<{
      name: string;
      description: string;
      valueCents: number;
      iconName: string;
      siteClassIds: string[];
      isAutoIncluded: boolean;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    const bonus = await this.prisma.campgroundBonus.findUnique({ where: { id } });
    if (!bonus) throw new NotFoundException("Bonus not found");
    if (bonus.campgroundId !== campgroundId) {
      throw new ForbiddenException("Access denied to this bonus");
    }
    return this.prisma.campgroundBonus.update({
      where: { id },
      data,
    });
  }

  async deleteBonus(id: string, campgroundId: string) {
    const bonus = await this.prisma.campgroundBonus.findUnique({ where: { id } });
    if (!bonus) throw new NotFoundException("Bonus not found");
    if (bonus.campgroundId !== campgroundId) {
      throw new ForbiddenException("Access denied to this bonus");
    }
    return this.prisma.campgroundBonus.delete({ where: { id } });
  }

  // ==================== LEAD CAPTURE CONFIG ====================

  async getLeadCaptureConfig(campgroundId: string) {
    let config = await this.prisma.leadCaptureConfig.findUnique({
      where: { campgroundId },
    });

    // Return defaults if not configured
    if (!config) {
      config = {
        id: "",
        campgroundId,
        eventsEnabled: true,
        eventsHeadline: "Something exciting is coming...",
        eventsSubtext: "Sign up to be the first to know about special events and deals",
        eventsButtonText: "Notify Me",
        newsletterEnabled: true,
        newsletterHeadline: "Get the inside scoop",
        newsletterSubtext: "Exclusive deals, event announcements, and camping tips",
        newsletterButtonText: "Subscribe",
        firstBookingEnabled: true,
        firstBookingDiscount: 10,
        firstBookingHeadline: "First time? Get 10% off",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return config;
  }

  async upsertLeadCaptureConfig(
    campgroundId: string,
    data: Partial<{
      eventsEnabled: boolean;
      eventsHeadline: string;
      eventsSubtext: string;
      eventsButtonText: string;
      newsletterEnabled: boolean;
      newsletterHeadline: string;
      newsletterSubtext: string;
      newsletterButtonText: string;
      firstBookingEnabled: boolean;
      firstBookingDiscount: number;
      firstBookingHeadline: string;
    }>,
  ) {
    return this.prisma.leadCaptureConfig.upsert({
      where: { campgroundId },
      update: { ...data, updatedAt: new Date() },
      create: { id: randomUUID(), campgroundId, updatedAt: new Date(), ...data },
    });
  }

  // ==================== BOOKING PAGE CONFIG ====================

  async getBookingPageConfig(campgroundId: string) {
    let config = await this.prisma.bookingPageConfig.findUnique({
      where: { campgroundId },
    });

    // Return defaults if not configured
    if (!config) {
      config = {
        id: "",
        campgroundId,
        heroHeadline: null,
        heroSubline: null,
        dreamOutcome: null,
        showReviewCount: true,
        showTrustBadges: true,
        showScarcity: true,
        showLiveViewers: false,
        showLimitedAvail: true,
        bookButtonText: "Book Now",
        checkAvailText: "Check availability",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return config;
  }

  async upsertBookingPageConfig(
    campgroundId: string,
    data: Partial<{
      heroHeadline: string;
      heroSubline: string;
      dreamOutcome: string;
      showReviewCount: boolean;
      showTrustBadges: boolean;
      showScarcity: boolean;
      showLiveViewers: boolean;
      showLimitedAvail: boolean;
      bookButtonText: string;
      checkAvailText: string;
    }>,
  ) {
    return this.prisma.bookingPageConfig.upsert({
      where: { campgroundId },
      update: { ...data, updatedAt: new Date() },
      create: { id: randomUUID(), campgroundId, updatedAt: new Date(), ...data },
    });
  }

  // ==================== LEADS ====================

  async captureLead(data: {
    campgroundId: string;
    email: string;
    source: string;
    ipAddress?: string;
    userAgent?: string;
    marketingOptIn?: boolean;
  }) {
    // Upsert to avoid duplicates
    return this.prisma.publicLead.upsert({
      where: {
        campgroundId_email_source: {
          campgroundId: data.campgroundId,
          email: data.email,
          source: data.source,
        },
      },
      update: {
        marketingOptIn: data.marketingOptIn ?? true,
      },
      create: { id: randomUUID(), ...data },
    });
  }

  async getLeads(campgroundId: string, source?: string) {
    return this.prisma.publicLead.findMany({
      where: {
        campgroundId,
        ...(source ? { source } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // ==================== PUBLIC API ====================

  async getPublicValueStack(campgroundId: string) {
    const [guarantees, bonuses, leadConfig, bookingConfig, charitySettings] = await Promise.all([
      this.getGuarantees(campgroundId),
      this.getBonuses(campgroundId),
      this.getLeadCaptureConfig(campgroundId),
      this.getBookingPageConfig(campgroundId),
      this.getCharityInfo(campgroundId),
    ]);

    return {
      guarantees,
      bonuses,
      leadCaptureConfig: leadConfig,
      bookingPageConfig: bookingConfig,
      // Calculate total bonus value for display
      totalBonusValue: bonuses.reduce((sum, b) => sum + b.valueCents, 0),
      // Charity info if configured
      charity: charitySettings,
    };
  }

  // ==================== CHARITY ====================

  private async getCharityInfo(campgroundId: string) {
    // Get campground's charity settings
    const charitySettings = await this.prisma.campgroundCharity.findUnique({
      where: { campgroundId },
      include: {
        Charity: {
          select: {
            id: true,
            name: true,
            description: true,
            logoUrl: true,
            website: true,
            category: true,
          },
        },
      },
    });

    if (!charitySettings?.isEnabled || !charitySettings.Charity) {
      return null;
    }

    // Get donation stats for this campground
    const donationStats = await this.prisma.charityDonation.aggregate({
      where: {
        campgroundId,
        status: { not: "refunded" },
      },
      _count: true,
      _sum: { amountCents: true },
    });

    // Get unique donor count
    const donors = await this.prisma.charityDonation.groupBy({
      by: ["guestId"],
      where: {
        campgroundId,
        status: { not: "refunded" },
        guestId: { not: null },
      },
    });

    return {
      charity: charitySettings.Charity,
      customMessage: charitySettings.customMessage,
      stats: {
        totalDonations: donationStats._count,
        totalAmountCents: donationStats._sum.amountCents ?? 0,
        donorCount: donors.length,
      },
    };
  }
}
