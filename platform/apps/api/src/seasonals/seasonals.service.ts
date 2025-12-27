import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SeasonalPricingService, GuestPricingContext } from "./seasonal-pricing.service";
import { EmailService } from "../email/email.service";
import {
  SeasonalStatus,
  RenewalIntent,
  SeasonalPaymentStatus,
  SeasonalPaymentMethod,
  SeasonalBillingFrequency,
  Prisma,
} from ".prisma/client";
import {
  CreateSeasonalGuestDto,
  UpdateSeasonalGuestDto,
} from "./dto";

// Re-export for backwards compatibility
export { CreateSeasonalGuestDto, UpdateSeasonalGuestDto };

export interface SeasonalGuestFilters {
  status?: SeasonalStatus | SeasonalStatus[];
  renewalIntent?: RenewalIntent | RenewalIntent[];
  paymentStatus?: "current" | "past_due" | "paid_ahead";
  contractStatus?: "signed" | "pending" | "not_sent";
  siteId?: string;
  tenureMin?: number;
  tenureMax?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SeasonalDashboardStats {
  totalSeasonals: number;
  activeSeasonals: number;
  renewalRate: number;
  contractsSigned: number;
  contractsTotal: number;
  paymentsCurrent: number;
  paymentsPastDue: number;
  paymentsPaidAhead: number;
  totalMonthlyRevenue: number;
  averageTenure: number;
  longestTenure: number;
  waitlistCount: number;
  combinedTenureYears: number; // Total years of loyalty across all seasonals
  renewalsByIntent: {
    committed: number;
    likely: number;
    undecided: number;
    not_renewing: number;
  };
  milestones: Array<{
    guestId: string;
    guestName: string;
    years: number;
    type: "5year" | "10year" | "15year" | "20year";
  }>;
  churnRiskGuests: Array<{
    guestId: string;
    guestName: string;
    tenure: number;
    riskLevel: "low" | "medium" | "high";
    renewalIntent: string;
  }>;
  paymentAging: {
    current: number; // Less than 30 days
    days30: number;  // 30-59 days
    days60: number;  // 60-89 days
    days90Plus: number; // 90+ days
  };
  needsAttention: {
    pastDuePayments: number;
    expiringContracts: number;
    expiredInsurance: number;
    pendingRenewals: number;
    unsignedContracts: number;
  };
}

export interface RecordPaymentDto {
  seasonalGuestId: string;
  seasonYear: number;
  amount: number;
  paymentMethod: SeasonalPaymentMethod;
  paidAt?: Date;
  checkNumber?: string;
  transactionId?: string;
  notes?: string;
}

export interface BulkMessageDto {
  campgroundId: string;
  seasonalGuestIds: string[];
  channel: "email" | "sms";
  subject?: string;
  body: string;
  templateTokens?: Record<string, string>;
}

@Injectable()
export class SeasonalsService {
  private readonly logger = new Logger(SeasonalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: SeasonalPricingService,
    private readonly emailService: EmailService,
  ) {}

  // ==================== SEASONAL GUEST CRUD ====================

  async create(dto: CreateSeasonalGuestDto, createdBy?: string) {
    // Check if guest already exists as seasonal at this campground
    const existing = await this.prisma.seasonalGuest.findUnique({
      where: {
        guestId_campgroundId: {
          guestId: dto.guestId,
          campgroundId: dto.campgroundId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException("Guest is already a seasonal at this campground");
    }

    // Get current count for seniority ranking
    const count = await this.prisma.seasonalGuest.count({
      where: { campgroundId: dto.campgroundId },
    });

    return this.prisma.seasonalGuest.create({
      data: {
        campgroundId: dto.campgroundId,
        guestId: dto.guestId,
        firstSeasonYear: dto.firstSeasonYear,
        totalSeasons: 1,
        seniorityRank: count + 1,
        currentSiteId: dto.currentSiteId,
        preferredSites: dto.preferredSites || [],
        preferredPaymentMethod: dto.preferredPaymentMethod,
        paysInFull: dto.paysInFull || false,
        autoPayEnabled: dto.autoPayEnabled || false,
        paymentDay: dto.paymentDay || 1,
        isMetered: dto.isMetered || false,
        meteredElectric: dto.meteredElectric || false,
        meteredWater: dto.meteredWater || false,
        notes: dto.notes,
        tags: dto.tags || [],
        createdBy,
      },
      include: {
        guest: true,
        currentSite: true,
      },
    });
  }

  async findById(id: string) {
    const seasonal = await this.prisma.seasonalGuest.findUnique({
      where: { id },
      include: {
        guest: true,
        currentSite: true,
        pricing: {
          orderBy: { seasonYear: "desc" },
          take: 2,
        },
        payments: {
          orderBy: { dueDate: "desc" },
          take: 12,
        },
        communications: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!seasonal) {
      throw new NotFoundException(`Seasonal guest ${id} not found`);
    }

    return seasonal;
  }

  async findByCampground(campgroundId: string, filters: SeasonalGuestFilters = {}) {
    const where: Prisma.SeasonalGuestWhereInput = {
      campgroundId,
    };

    // Status filter
    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    // Renewal intent filter
    if (filters.renewalIntent) {
      where.renewalIntent = Array.isArray(filters.renewalIntent)
        ? { in: filters.renewalIntent }
        : filters.renewalIntent;
    }

    // Site filter
    if (filters.siteId) {
      where.currentSiteId = filters.siteId;
    }

    // Tenure filters
    if (filters.tenureMin !== undefined) {
      where.totalSeasons = { gte: filters.tenureMin };
    }
    if (filters.tenureMax !== undefined) {
      where.totalSeasons = {
        ...(where.totalSeasons as Prisma.IntFilter || {}),
        lte: filters.tenureMax,
      };
    }

    // Search filter
    if (filters.search) {
      where.OR = [
        { guest: { primaryFirstName: { contains: filters.search, mode: "insensitive" } } },
        { guest: { primaryLastName: { contains: filters.search, mode: "insensitive" } } },
        { guest: { email: { contains: filters.search, mode: "insensitive" } } },
        { currentSite: { name: { contains: filters.search, mode: "insensitive" } } },
        { notes: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [seasonals, total] = await Promise.all([
      this.prisma.seasonalGuest.findMany({
        where,
        include: {
          guest: true,
          currentSite: true,
          pricing: {
            orderBy: { seasonYear: "desc" },
            take: 1,
          },
          payments: {
            where: {
              status: { in: [SeasonalPaymentStatus.past_due, SeasonalPaymentStatus.due] },
            },
            orderBy: { dueDate: "asc" },
            take: 1,
          },
        },
        orderBy: [
          { seniorityRank: "asc" },
          { totalSeasons: "desc" },
        ],
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.seasonalGuest.count({ where }),
    ]);

    type SeasonalListItem = (typeof seasonals)[number];
    type PaymentListItem = SeasonalListItem["payments"][number];

    // Post-filter by payment status if needed
    let filteredSeasonals: SeasonalListItem[] = seasonals;
    if (filters.paymentStatus) {
      filteredSeasonals = seasonals.filter((s: SeasonalListItem) => {
        const hasPastDue = s.payments.some((p: PaymentListItem) => p.status === SeasonalPaymentStatus.past_due);
        const hasDue = s.payments.some((p: PaymentListItem) => p.status === SeasonalPaymentStatus.due);

        switch (filters.paymentStatus) {
          case "past_due":
            return hasPastDue;
          case "current":
            return !hasPastDue && hasDue;
          case "paid_ahead":
            return !hasPastDue && !hasDue;
          default:
            return true;
        }
      });
    }

    return {
      data: filteredSeasonals,
      total,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
    };
  }

  async update(id: string, dto: UpdateSeasonalGuestDto) {
    const existing = await this.prisma.seasonalGuest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Seasonal guest ${id} not found`);
    }

    // If renewal intent is being set, record the timestamp
    const data: Prisma.SeasonalGuestUpdateInput = { ...dto };
    if (dto.renewalIntent && dto.renewalIntent !== existing.renewalIntent) {
      data.renewalIntentAt = new Date();
    }

    return this.prisma.seasonalGuest.update({
      where: { id },
      data,
      include: {
        guest: true,
        currentSite: true,
      },
    });
  }

  async updateRenewalIntent(id: string, intent: RenewalIntent, notes?: string) {
    return this.prisma.seasonalGuest.update({
      where: { id },
      data: {
        renewalIntent: intent,
        renewalIntentAt: new Date(),
        renewalNotes: notes,
        // Update status based on intent
        status: intent === RenewalIntent.not_renewing
          ? SeasonalStatus.not_renewing
          : SeasonalStatus.active,
      },
    });
  }

  // ==================== DASHBOARD STATS ====================

  async getDashboardStats(campgroundId: string, seasonYear?: number): Promise<SeasonalDashboardStats> {
    const currentYear = seasonYear || new Date().getFullYear();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Run all independent queries in parallel for performance
    const [
      seasonals,
      contracts,
      pastDuePaymentsCount,
      expiringContracts,
      expiredInsurance,
      pendingRenewals,
      waitlistCount,
      // Payment aging buckets
      pastDue30Days,
      pastDue60Days,
      pastDue90Days,
    ] = await Promise.all([
      // Main seasonals query with relations
      this.prisma.seasonalGuest.findMany({
        where: { campgroundId },
        include: {
          guest: true,
          payments: {
            where: { seasonYear: currentYear },
          },
          pricing: {
            where: { seasonYear: currentYear },
          },
        },
      }),
      // Contract stats
      this.prisma.signatureRequest.findMany({
        where: {
          campgroundId,
          seasonYear: currentYear,
          documentType: { in: ["seasonal", "monthly"] },
        },
        select: { status: true },
      }),
      // Past due payments count
      this.prisma.seasonalPayment.count({
        where: {
          campgroundId,
          status: SeasonalPaymentStatus.past_due,
        },
      }),
      // Expiring contracts (within 7 days)
      this.prisma.signatureRequest.count({
        where: {
          campgroundId,
          seasonYear: currentYear,
          documentType: { in: ["seasonal", "monthly"] },
          status: "sent",
          expiresAt: {
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      // Expired insurance
      this.prisma.seasonalGuest.count({
        where: {
          campgroundId,
          status: SeasonalStatus.active,
          coiExpiresAt: { lt: now },
        },
      }),
      // Pending renewals
      this.prisma.seasonalGuest.count({
        where: {
          campgroundId,
          status: SeasonalStatus.active,
          renewalIntent: { in: [null, RenewalIntent.undecided] },
        },
      }),
      // Waitlist count
      this.prisma.seasonalGuest.count({
        where: {
          campgroundId,
          status: SeasonalStatus.waitlist,
        },
      }),
      // Payment aging: 30+ days
      this.prisma.seasonalPayment.count({
        where: {
          campgroundId,
          status: SeasonalPaymentStatus.past_due,
          dueDate: { lt: thirtyDaysAgo, gte: sixtyDaysAgo },
        },
      }),
      // Payment aging: 60+ days
      this.prisma.seasonalPayment.count({
        where: {
          campgroundId,
          status: SeasonalPaymentStatus.past_due,
          dueDate: { lt: sixtyDaysAgo, gte: ninetyDaysAgo },
        },
      }),
      // Payment aging: 90+ days
      this.prisma.seasonalPayment.count({
        where: {
          campgroundId,
          status: SeasonalPaymentStatus.past_due,
          dueDate: { lt: ninetyDaysAgo },
        },
      }),
    ]);

    type SeasonalWithRelations = (typeof seasonals)[number];
    type PaymentRecord = SeasonalWithRelations["payments"][number];
    type ContractRecord = (typeof contracts)[number];

    const activeSeasonals = seasonals.filter((s: SeasonalWithRelations) => s.status === SeasonalStatus.active);

    // Calculate payment stats
    let paymentsCurrent = 0;
    let paymentsPastDue = 0;
    let paymentsPaidAhead = 0;
    let totalMonthlyRevenue = 0;

    for (const seasonal of activeSeasonals) {
      const hasPastDue = seasonal.payments.some((p: PaymentRecord) => p.status === SeasonalPaymentStatus.past_due);
      const allPaid = seasonal.payments.every(
        (p: PaymentRecord) => p.status === SeasonalPaymentStatus.paid || p.dueDate > now
      );

      if (hasPastDue) {
        paymentsPastDue++;
      } else if (allPaid && seasonal.payments.length > 0) {
        paymentsPaidAhead++;
      } else {
        paymentsCurrent++;
      }

      // Sum up monthly revenue from pricing (configurable season length)
      if (seasonal.pricing[0]) {
        const SEASON_LENGTH_MONTHS = 6; // TODO: Make configurable per campground
        const monthlyRate = seasonal.pricing[0].finalRate.toNumber() / SEASON_LENGTH_MONTHS;
        totalMonthlyRevenue += monthlyRate;
      }
    }

    // Calculate renewal stats by intent
    const renewalsByIntent = {
      committed: seasonals.filter((s: SeasonalWithRelations) => s.renewalIntent === RenewalIntent.committed).length,
      likely: seasonals.filter((s: SeasonalWithRelations) => s.renewalIntent === RenewalIntent.likely).length,
      undecided: seasonals.filter((s: SeasonalWithRelations) => s.renewalIntent === RenewalIntent.undecided || s.renewalIntent === null).length,
      not_renewing: seasonals.filter((s: SeasonalWithRelations) => s.renewalIntent === RenewalIntent.not_renewing).length,
    };

    const renewalRate = activeSeasonals.length > 0
      ? ((renewalsByIntent.committed + renewalsByIntent.likely * 0.7) / activeSeasonals.length) * 100
      : 0;

    // Contract stats
    const contractsSigned = contracts.filter((c: ContractRecord) =>
      ["signed", "signed_paper", "waived"].includes(c.status)
    ).length;
    const unsignedContracts = activeSeasonals.length - contractsSigned;

    // Calculate tenure stats
    const totalTenure = seasonals.reduce((sum: number, s: SeasonalWithRelations) => sum + s.totalSeasons, 0);
    const averageTenure = seasonals.length > 0 ? totalTenure / seasonals.length : 0;
    const longestTenure = seasonals.length > 0
      ? Math.max(...seasonals.map((s: SeasonalWithRelations) => s.totalSeasons))
      : 0;

    // Community stats - combined years of loyalty
    const combinedTenureYears = totalTenure;

    // Find milestone guests (5, 10, 15, 20 years) - only active
    const milestoneYears = [5, 10, 15, 20];
    const milestones: SeasonalDashboardStats["milestones"] = [];

    for (const seasonal of activeSeasonals) {
      if (milestoneYears.includes(seasonal.totalSeasons)) {
        const guestName = seasonal.guest
          ? `${seasonal.guest.primaryFirstName} ${seasonal.guest.primaryLastName}`
          : "Unknown Guest";

        let type: "5year" | "10year" | "15year" | "20year";
        if (seasonal.totalSeasons >= 20) type = "20year";
        else if (seasonal.totalSeasons >= 15) type = "15year";
        else if (seasonal.totalSeasons >= 10) type = "10year";
        else type = "5year";

        milestones.push({
          guestId: seasonal.id,
          guestName,
          years: seasonal.totalSeasons,
          type,
        });
      }
    }

    // Sort milestones by years descending
    milestones.sort((a, b) => b.years - a.years);

    // Calculate churn risk guests (long tenure + undecided/not_renewing = high risk)
    const churnRiskGuests: SeasonalDashboardStats["churnRiskGuests"] = [];
    for (const seasonal of activeSeasonals) {
      const isAtRisk = seasonal.totalSeasons >= 3 &&
        (seasonal.renewalIntent === RenewalIntent.undecided ||
         seasonal.renewalIntent === RenewalIntent.not_renewing ||
         seasonal.renewalIntent === null);

      if (isAtRisk) {
        const guestName = seasonal.guest
          ? `${seasonal.guest.primaryFirstName} ${seasonal.guest.primaryLastName}`
          : "Unknown Guest";

        // Calculate risk level based on tenure and status
        let riskLevel: "low" | "medium" | "high" = "low";
        if (seasonal.totalSeasons >= 10) {
          riskLevel = "high"; // Long-tenured guests leaving is a big deal
        } else if (seasonal.totalSeasons >= 5) {
          riskLevel = "medium";
        } else if (seasonal.renewalIntent === RenewalIntent.not_renewing) {
          riskLevel = "high"; // Confirmed not renewing
        }

        churnRiskGuests.push({
          guestId: seasonal.id,
          guestName,
          tenure: seasonal.totalSeasons,
          riskLevel,
          renewalIntent: seasonal.renewalIntent || "undecided",
        });
      }
    }

    // Sort by risk level (high first) then tenure
    churnRiskGuests.sort((a, b) => {
      const riskOrder = { high: 0, medium: 1, low: 2 };
      if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      }
      return b.tenure - a.tenure;
    });

    return {
      totalSeasonals: seasonals.length,
      activeSeasonals: activeSeasonals.length,
      renewalRate: Math.round(renewalRate),
      contractsSigned,
      contractsTotal: contracts.length,
      paymentsCurrent,
      paymentsPastDue,
      paymentsPaidAhead,
      totalMonthlyRevenue: Math.round(totalMonthlyRevenue),
      averageTenure: Math.round(averageTenure * 10) / 10,
      longestTenure,
      waitlistCount,
      renewalsByIntent,
      milestones,
      // New fields
      combinedTenureYears,
      churnRiskGuests: churnRiskGuests.slice(0, 10), // Top 10 at-risk guests
      paymentAging: {
        current: pastDuePaymentsCount - pastDue30Days - pastDue60Days - pastDue90Days,
        days30: pastDue30Days,
        days60: pastDue60Days,
        days90Plus: pastDue90Days,
      },
      needsAttention: {
        pastDuePayments: pastDuePaymentsCount,
        expiringContracts,
        expiredInsurance,
        pendingRenewals,
        unsignedContracts: Math.max(0, unsignedContracts),
      },
    };
  }

  // ==================== PAYMENTS ====================

  async recordPayment(dto: RecordPaymentDto, recordedBy: string) {
    const seasonalGuest = await this.prisma.seasonalGuest.findUnique({
      where: { id: dto.seasonalGuestId },
      include: {
        payments: {
          where: {
            seasonYear: dto.seasonYear,
            status: { in: [SeasonalPaymentStatus.due, SeasonalPaymentStatus.past_due, SeasonalPaymentStatus.scheduled] },
          },
          orderBy: { dueDate: "asc" },
        },
      },
    });

    if (!seasonalGuest) {
      throw new NotFoundException(`Seasonal guest ${dto.seasonalGuestId} not found`);
    }

    // Find the earliest unpaid payment to apply this to
    let remainingAmount = dto.amount;
    const updates: Promise<any>[] = [];

    for (const payment of seasonalGuest.payments) {
      if (remainingAmount <= 0) break;

      const paymentAmount = payment.amount.toNumber();
      const alreadyPaid = payment.paidAmount?.toNumber() || 0;
      const remaining = paymentAmount - alreadyPaid;

      if (remaining > 0) {
        const toApply = Math.min(remaining, remainingAmount);
        const newPaidAmount = alreadyPaid + toApply;
        const isFullyPaid = newPaidAmount >= paymentAmount;

        updates.push(
          this.prisma.seasonalPayment.update({
            where: { id: payment.id },
            data: {
              paidAmount: newPaidAmount,
              paidAt: dto.paidAt || new Date(),
              paymentMethod: dto.paymentMethod,
              checkNumber: dto.checkNumber,
              transactionId: dto.transactionId,
              status: isFullyPaid ? SeasonalPaymentStatus.paid : SeasonalPaymentStatus.partial,
              notes: dto.notes,
              recordedBy,
            },
          })
        );

        remainingAmount -= toApply;
      }
    }

    await Promise.all(updates);

    this.logger.log(`Recorded payment of $${dto.amount} for seasonal guest ${dto.seasonalGuestId}`);

    return this.findById(dto.seasonalGuestId);
  }

  async getPaymentHistory(seasonalGuestId: string, seasonYear?: number) {
    const where: Prisma.SeasonalPaymentWhereInput = { seasonalGuestId };
    if (seasonYear) {
      where.seasonYear = seasonYear;
    }

    return this.prisma.seasonalPayment.findMany({
      where,
      orderBy: { dueDate: "desc" },
    });
  }

  // ==================== RATE CARDS ====================

  async createRateCard(data: Prisma.SeasonalRateCardCreateInput) {
    return this.prisma.seasonalRateCard.create({
      data,
      include: {
        discounts: true,
        incentives: true,
      },
    });
  }

  async getRateCards(campgroundId: string, seasonYear?: number) {
    const where: Prisma.SeasonalRateCardWhereInput = { campgroundId };
    if (seasonYear) {
      where.seasonYear = seasonYear;
    }

    return this.prisma.seasonalRateCard.findMany({
      where,
      include: {
        discounts: { where: { isActive: true } },
        incentives: { where: { isActive: true } },
      },
      orderBy: [{ seasonYear: "desc" }, { name: "asc" }],
    });
  }

  async updateRateCard(id: string, data: Prisma.SeasonalRateCardUpdateInput) {
    return this.prisma.seasonalRateCard.update({
      where: { id },
      data,
      include: {
        discounts: true,
        incentives: true,
      },
    });
  }

  async addDiscount(rateCardId: string, data: Omit<Prisma.SeasonalDiscountCreateInput, "rateCard">) {
    return this.prisma.seasonalDiscount.create({
      data: {
        ...data,
        rateCard: { connect: { id: rateCardId } },
      },
    });
  }

  async addIncentive(rateCardId: string, data: Omit<Prisma.SeasonalIncentiveCreateInput, "rateCard">) {
    return this.prisma.seasonalIncentive.create({
      data: {
        ...data,
        rateCard: { connect: { id: rateCardId } },
      },
    });
  }

  // ==================== BULK COMMUNICATIONS ====================

  async sendBulkMessage(dto: BulkMessageDto, sentBy: string) {
    const seasonals = await this.prisma.seasonalGuest.findMany({
      where: {
        id: { in: dto.seasonalGuestIds },
        campgroundId: dto.campgroundId,
      },
      include: { guest: true },
    });

    const communications: Prisma.SeasonalCommunicationCreateManyInput[] = [];
    const campaignId = `bulk_${Date.now()}`;

    for (const seasonal of seasonals) {
      // Replace template tokens
      let body = dto.body;
      body = body.replace(/\{\{first_name\}\}/g, seasonal.guest.primaryFirstName);
      body = body.replace(/\{\{last_name\}\}/g, seasonal.guest.primaryLastName);
      body = body.replace(/\{\{site\}\}/g, seasonal.currentSiteId || "TBD");
      body = body.replace(/\{\{tenure_years\}\}/g, String(seasonal.totalSeasons));

      // Replace any custom tokens
      if (dto.templateTokens) {
        for (const [key, value] of Object.entries(dto.templateTokens)) {
          body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
        }
      }

      communications.push({
        seasonalGuestId: seasonal.id,
        campgroundId: dto.campgroundId,
        channel: dto.channel,
        direction: "outbound",
        subject: dto.subject,
        body,
        status: "queued",
        campaignId,
        campaignName: dto.subject || "Bulk Message",
        sentBy,
      });
    }

    await this.prisma.seasonalCommunication.createMany({
      data: communications,
    });

    // Send the actual messages
    const sendResults = await Promise.allSettled(
      seasonals.map(async (seasonal, index) => {
        const comm = communications[index];

        if (dto.channel === "email" && seasonal.guest.email) {
          await this.emailService.sendEmail({
            to: seasonal.guest.email,
            subject: dto.subject || "Message from your campground",
            html: comm.body.replace(/\n/g, "<br>"),
            campgroundId: dto.campgroundId,
          });
        }
        // SMS would require a separate provider (Twilio, etc.)
        // For now, SMS messages are stored in the database for manual processing
        // or future SMS provider integration
      })
    );

    // Count successful sends
    const successCount = sendResults.filter(r => r.status === "fulfilled").length;
    const failCount = sendResults.filter(r => r.status === "rejected").length;

    // Update communication status based on results
    await this.prisma.seasonalCommunication.updateMany({
      where: { campaignId },
      data: {
        status: dto.channel === "sms" ? "queued" : "sent",
        sentAt: dto.channel === "sms" ? null : new Date(),
      },
    });

    this.logger.log(`Sent bulk ${dto.channel} to ${seasonals.length} seasonals (${successCount} succeeded, ${failCount} failed)`);

    return {
      sent: seasonals.length,
      campaignId,
    };
  }

  // ==================== SENIORITY MANAGEMENT ====================

  async recalculateSeniority(campgroundId: string) {
    // Get all seasonals ordered by first season year and total seasons
    const seasonals = await this.prisma.seasonalGuest.findMany({
      where: { campgroundId, status: SeasonalStatus.active },
      orderBy: [
        { firstSeasonYear: "asc" },
        { totalSeasons: "desc" },
      ],
    });

    type SeasonalRecord = (typeof seasonals)[number];

    // Update seniority ranks
    const updates = seasonals.map((seasonal: SeasonalRecord, index: number) =>
      this.prisma.seasonalGuest.update({
        where: { id: seasonal.id },
        data: { seniorityRank: index + 1 },
      })
    );

    await Promise.all(updates);

    this.logger.log(`Recalculated seniority for ${seasonals.length} seasonals in campground ${campgroundId}`);
  }

  // ==================== CONVERT RESERVATION TO SEASONAL ====================

  /**
   * Convert a reservation to a seasonal guest record
   * This is a STAFF-ONLY operation - guests cannot convert themselves
   */
  async convertReservationToSeasonal(
    reservationId: string,
    options: {
      rateCardId?: string;
      isMetered?: boolean;
      paysInFull?: boolean;
      notes?: string;
    },
    convertedBy: string
  ) {
    // Fetch the reservation with guest and site info
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        site: true,
        campground: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservation ${reservationId} not found`);
    }

    // Validate this is a suitable reservation for conversion
    const stayDays = Math.ceil(
      (reservation.departureDate.getTime() - reservation.arrivalDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (stayDays < 28) {
      throw new BadRequestException(
        "Only long-term reservations (28+ days) can be converted to seasonal guests"
      );
    }

    // Check if already linked to a seasonal
    if (reservation.seasonalGuestId) {
      throw new BadRequestException("This reservation is already linked to a seasonal guest");
    }

    // Check if guest already has a seasonal record at this campground
    const existingSeasonal = await this.prisma.seasonalGuest.findUnique({
      where: {
        guestId_campgroundId: {
          guestId: reservation.guestId,
          campgroundId: reservation.campgroundId,
        },
      },
    });

    if (existingSeasonal) {
      // Link the reservation to existing seasonal and return
      await this.prisma.reservation.update({
        where: { id: reservationId },
        data: { seasonalGuestId: existingSeasonal.id },
      });

      this.logger.log(
        `Linked reservation ${reservationId} to existing seasonal guest ${existingSeasonal.id}`
      );

      return {
        seasonalGuest: await this.findById(existingSeasonal.id),
        created: false,
        linked: true,
      };
    }

    // Calculate first season year from arrival date
    const firstSeasonYear = reservation.arrivalDate.getFullYear();

    // Get seniority rank
    const count = await this.prisma.seasonalGuest.count({
      where: { campgroundId: reservation.campgroundId },
    });

    // Create the seasonal guest record
    const seasonalGuest = await this.prisma.seasonalGuest.create({
      data: {
        campgroundId: reservation.campgroundId,
        guestId: reservation.guestId,
        firstSeasonYear,
        totalSeasons: 1,
        seniorityRank: count + 1,
        currentSiteId: reservation.siteId,
        preferredSites: [reservation.siteId],
        status: SeasonalStatus.active,
        isMetered: options.isMetered || false,
        paysInFull: options.paysInFull || false,
        vehiclePlates: reservation.vehiclePlate ? [reservation.vehiclePlate] : [],
        petCount: reservation.petCount || 0,
        originReservationId: reservationId,
        convertedAt: new Date(),
        convertedBy,
        notes: options.notes,
        createdBy: convertedBy,
      },
      include: {
        guest: true,
        currentSite: true,
      },
    });

    // Link the reservation to the seasonal guest
    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { seasonalGuestId: seasonalGuest.id },
    });

    // If a rate card is provided, apply pricing
    if (options.rateCardId) {
      const guestContext: GuestPricingContext = {
        isMetered: options.isMetered || false,
        paysInFull: options.paysInFull || false,
        tenureYears: 1,
        isReturning: false,
      };

      await this.pricingService.applyPricingToGuest(
        seasonalGuest.id,
        options.rateCardId,
        firstSeasonYear
      );
    }

    this.logger.log(
      `Converted reservation ${reservationId} to seasonal guest ${seasonalGuest.id} by ${convertedBy}`
    );

    return {
      seasonalGuest: await this.findById(seasonalGuest.id),
      created: true,
      linked: true,
    };
  }

  /**
   * Link an existing reservation to an existing seasonal guest
   */
  async linkReservationToSeasonal(
    reservationId: string,
    seasonalGuestId: string,
    linkedBy: string
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservation ${reservationId} not found`);
    }

    const seasonalGuest = await this.prisma.seasonalGuest.findUnique({
      where: { id: seasonalGuestId },
    });

    if (!seasonalGuest) {
      throw new NotFoundException(`Seasonal guest ${seasonalGuestId} not found`);
    }

    // Verify same campground and guest
    if (reservation.campgroundId !== seasonalGuest.campgroundId) {
      throw new BadRequestException("Reservation and seasonal guest must be at the same campground");
    }

    if (reservation.guestId !== seasonalGuest.guestId) {
      throw new BadRequestException("Reservation guest must match seasonal guest");
    }

    // Link them
    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { seasonalGuestId },
    });

    this.logger.log(
      `Linked reservation ${reservationId} to seasonal guest ${seasonalGuestId} by ${linkedBy}`
    );

    return this.findById(seasonalGuestId);
  }

  // ==================== SEASON ROLLOVER ====================

  async rolloverSeason(campgroundId: string, fromYear: number, toYear: number) {
    // Find all active seasonals who committed to renewing
    const renewingSeasonals = await this.prisma.seasonalGuest.findMany({
      where: {
        campgroundId,
        status: SeasonalStatus.active,
        renewalIntent: { in: [RenewalIntent.committed, RenewalIntent.likely] },
      },
    });

    let rolledOver = 0;

    for (const seasonal of renewingSeasonals) {
      // Increment total seasons
      await this.prisma.seasonalGuest.update({
        where: { id: seasonal.id },
        data: {
          totalSeasons: seasonal.totalSeasons + 1,
          renewalIntent: null,
          renewalIntentAt: null,
          renewalNotes: null,
        },
      });

      rolledOver++;
    }

    // Mark non-renewing seasonals as departed
    await this.prisma.seasonalGuest.updateMany({
      where: {
        campgroundId,
        renewalIntent: RenewalIntent.not_renewing,
      },
      data: {
        status: SeasonalStatus.departed,
      },
    });

    // Recalculate seniority
    await this.recalculateSeniority(campgroundId);

    this.logger.log(`Rolled over ${rolledOver} seasonals from ${fromYear} to ${toYear}`);

    return { rolledOver };
  }
}
