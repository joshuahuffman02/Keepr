import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SeasonalPricingService, GuestPricingContext } from "./seasonal-pricing.service";
import {
  SeasonalStatus,
  RenewalIntent,
  SeasonalPaymentStatus,
  SeasonalPaymentMethod,
  SeasonalBillingFrequency,
  Prisma,
} from "@prisma/client";

// DTOs
export interface CreateSeasonalGuestDto {
  campgroundId: string;
  guestId: string;
  firstSeasonYear: number;
  currentSiteId?: string;
  preferredSites?: string[];
  preferredPaymentMethod?: SeasonalPaymentMethod;
  paysInFull?: boolean;
  autoPayEnabled?: boolean;
  paymentDay?: number;
  isMetered?: boolean;
  meteredElectric?: boolean;
  meteredWater?: boolean;
  notes?: string;
  tags?: string[];
}

export interface UpdateSeasonalGuestDto {
  currentSiteId?: string;
  preferredSites?: string[];
  status?: SeasonalStatus;
  renewalIntent?: RenewalIntent;
  renewalNotes?: string;
  preferredPaymentMethod?: SeasonalPaymentMethod;
  paysInFull?: boolean;
  autoPayEnabled?: boolean;
  paymentDay?: number;
  isMetered?: boolean;
  meteredElectric?: boolean;
  meteredWater?: boolean;
  coiExpiresAt?: Date;
  coiDocumentUrl?: string;
  vehiclePlates?: string[];
  petCount?: number;
  petNotes?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  notes?: string;
  tags?: string[];
}

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
  needsAttention: {
    pastDuePayments: number;
    expiringContracts: number;
    expiredInsurance: number;
    pendingRenewals: number;
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
    private readonly pricingService: SeasonalPricingService
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

    // Post-filter by payment status if needed
    let filteredSeasonals = seasonals;
    if (filters.paymentStatus) {
      filteredSeasonals = seasonals.filter((s) => {
        const hasPastDue = s.payments.some((p) => p.status === SeasonalPaymentStatus.past_due);
        const hasDue = s.payments.some((p) => p.status === SeasonalPaymentStatus.due);

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

    // Get all seasonals
    const seasonals = await this.prisma.seasonalGuest.findMany({
      where: { campgroundId },
      include: {
        payments: {
          where: { seasonYear: currentYear },
        },
        pricing: {
          where: { seasonYear: currentYear },
        },
      },
    });

    const activeSeasonals = seasonals.filter((s) => s.status === SeasonalStatus.active);

    // Calculate payment stats
    let paymentsCurrent = 0;
    let paymentsPastDue = 0;
    let paymentsPaidAhead = 0;
    let totalMonthlyRevenue = 0;

    for (const seasonal of activeSeasonals) {
      const hasPastDue = seasonal.payments.some((p) => p.status === SeasonalPaymentStatus.past_due);
      const allPaid = seasonal.payments.every(
        (p) => p.status === SeasonalPaymentStatus.paid || p.dueDate > now
      );

      if (hasPastDue) {
        paymentsPastDue++;
      } else if (allPaid && seasonal.payments.length > 0) {
        paymentsPaidAhead++;
      } else {
        paymentsCurrent++;
      }

      // Sum up monthly revenue from pricing
      if (seasonal.pricing[0]) {
        const monthlyRate = seasonal.pricing[0].finalRate.toNumber() / 6; // Assume 6-month season
        totalMonthlyRevenue += monthlyRate;
      }
    }

    // Calculate renewal stats
    const renewalCommitted = seasonals.filter((s) => s.renewalIntent === RenewalIntent.committed).length;
    const renewalLikely = seasonals.filter((s) => s.renewalIntent === RenewalIntent.likely).length;
    const renewalRate = activeSeasonals.length > 0
      ? ((renewalCommitted + renewalLikely * 0.7) / activeSeasonals.length) * 100
      : 0;

    // Get contract stats (from signature requests)
    const contracts = await this.prisma.signatureRequest.findMany({
      where: {
        campgroundId,
        seasonYear: currentYear,
        documentType: { in: ["seasonal", "monthly"] },
      },
    });

    const contractsSigned = contracts.filter((c) =>
      ["signed", "signed_paper", "waived"].includes(c.status)
    ).length;

    // Calculate needs attention
    const pastDuePayments = await this.prisma.seasonalPayment.count({
      where: {
        campgroundId,
        status: SeasonalPaymentStatus.past_due,
      },
    });

    const expiringContracts = await this.prisma.signatureRequest.count({
      where: {
        campgroundId,
        seasonYear: currentYear,
        documentType: { in: ["seasonal", "monthly"] },
        status: "sent",
        expiresAt: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Within 7 days
        },
      },
    });

    const expiredInsurance = await this.prisma.seasonalGuest.count({
      where: {
        campgroundId,
        status: SeasonalStatus.active,
        coiExpiresAt: { lt: now },
      },
    });

    const pendingRenewals = await this.prisma.seasonalGuest.count({
      where: {
        campgroundId,
        status: SeasonalStatus.active,
        renewalIntent: { in: [null, RenewalIntent.undecided] },
      },
    });

    // Calculate average tenure
    const totalTenure = seasonals.reduce((sum, s) => sum + s.totalSeasons, 0);
    const averageTenure = seasonals.length > 0 ? totalTenure / seasonals.length : 0;

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
      needsAttention: {
        pastDuePayments,
        expiringContracts,
        expiredInsurance,
        pendingRenewals,
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

    // TODO: Integrate with actual email/SMS sending service
    // For now, mark as sent
    await this.prisma.seasonalCommunication.updateMany({
      where: { campaignId },
      data: {
        status: "sent",
        sentAt: new Date(),
      },
    });

    this.logger.log(`Sent bulk ${dto.channel} to ${seasonals.length} seasonals`);

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

    // Update seniority ranks
    const updates = seasonals.map((seasonal, index) =>
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
