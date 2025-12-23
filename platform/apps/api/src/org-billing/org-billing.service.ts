import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Types for billing configuration
interface TierConfig {
  monthlyFeeCents: number;
  perBookingFeeCents: number;
  freeMonthlyUntil?: Date | null;
  smsOutboundCents: number;
  smsInboundCents: number;
}

const TIER_CONFIGS: Record<string, TierConfig> = {
  founders_circle: {
    monthlyFeeCents: 0,
    perBookingFeeCents: 75, // $0.75
    freeMonthlyUntil: null, // Forever free
    smsOutboundCents: 10,
    smsInboundCents: 4,
  },
  pioneer: {
    monthlyFeeCents: 0, // Free for 12 months, then $29
    perBookingFeeCents: 100, // $1.00
    smsOutboundCents: 10,
    smsInboundCents: 4,
  },
  trailblazer: {
    monthlyFeeCents: 1450, // $14.50 for 6 months, then $29
    perBookingFeeCents: 125, // $1.25
    smsOutboundCents: 10,
    smsInboundCents: 4,
  },
  standard: {
    monthlyFeeCents: 6900, // $69
    perBookingFeeCents: 250, // $2.50
    smsOutboundCents: 10,
    smsInboundCents: 4,
  },
};

@Injectable()
export class OrgBillingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get the current billing period for an organization, creating one if needed
   */
  async getCurrentPeriod(organizationId: string) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    let period = await this.prisma.organizationBillingPeriod.findUnique({
      where: {
        organizationId_periodStart: {
          organizationId,
          periodStart,
        },
      },
      include: {
        lineItems: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!period) {
      period = await this.prisma.organizationBillingPeriod.create({
        data: {
          organizationId,
          periodStart,
          periodEnd,
          status: "open",
          dueAt: new Date(periodEnd.getTime() + 15 * 24 * 60 * 60 * 1000), // Due 15 days after period end
        },
        include: {
          lineItems: true,
        },
      });
    }

    return period;
  }

  /**
   * Get billing summary for an organization
   */
  async getBillingSummary(organizationId: string) {
    // Get organization with early access enrollment
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        earlyAccessEnrollment: true,
        campgrounds: {
          select: { id: true, name: true },
        },
      },
    });

    if (!org) {
      throw new NotFoundException("Organization not found");
    }

    // Get current period
    const currentPeriod = await this.getCurrentPeriod(organizationId);

    // Get tier config
    const tierName = org.earlyAccessEnrollment?.tier || "standard";
    const tierConfig = TIER_CONFIGS[tierName] || TIER_CONFIGS.standard;

    // Calculate current period charges from usage events
    const usageSummary = await this.calculatePeriodUsage(
      organizationId,
      currentPeriod.periodStart,
      currentPeriod.periodEnd
    );

    // Calculate monthly fee (check if still in free period)
    let monthlyFeeCents = tierConfig.monthlyFeeCents;
    if (org.earlyAccessEnrollment?.monthlyFeeEndsAt) {
      const freeUntil = new Date(org.earlyAccessEnrollment.monthlyFeeEndsAt);
      if (new Date() < freeUntil) {
        monthlyFeeCents = 0;
      } else {
        // After promo period, use locked rate or standard
        monthlyFeeCents = org.earlyAccessEnrollment.lockedMonthlyFee || 2900; // $29 default
      }
    } else if (tierName === "founders_circle") {
      // Founder's circle is forever free
      monthlyFeeCents = 0;
    }

    // Calculate totals
    const subscriptionCents = monthlyFeeCents;
    const bookingFeesCents = usageSummary.bookingCount * (org.earlyAccessEnrollment?.lockedBookingFee || tierConfig.perBookingFeeCents);
    const smsOutboundCents = usageSummary.smsOutbound * tierConfig.smsOutboundCents;
    const smsInboundCents = usageSummary.smsInbound * tierConfig.smsInboundCents;
    const setupServiceSurchargeCents = usageSummary.setupServiceSurchargeCents || 0;
    const totalCents = subscriptionCents + bookingFeesCents + smsOutboundCents + smsInboundCents + setupServiceSurchargeCents;

    // Get active setup services with balance for display
    const activeSetupServices = await this.prisma.setupService.findMany({
      where: {
        organizationId,
        balanceRemainingCents: { gt: 0 },
      },
      select: {
        id: true,
        serviceType: true,
        totalCents: true,
        balanceRemainingCents: true,
        bookingsCharged: true,
      },
    });

    return {
      organization: {
        id: org.id,
        name: org.name,
        billingEmail: org.billingEmail,
      },
      tier: {
        name: tierName,
        displayName: this.getTierDisplayName(tierName),
        lockedBookingFee: org.earlyAccessEnrollment?.lockedBookingFee,
        monthlyFeeEndsAt: org.earlyAccessEnrollment?.monthlyFeeEndsAt,
      },
      currentPeriod: {
        id: currentPeriod.id,
        periodStart: currentPeriod.periodStart,
        periodEnd: currentPeriod.periodEnd,
        status: currentPeriod.status,
        dueAt: currentPeriod.dueAt,
      },
      charges: {
        subscription: {
          description: "Monthly subscription",
          amountCents: subscriptionCents,
        },
        bookingFees: {
          description: `Per-booking fees (${usageSummary.bookingCount} bookings)`,
          quantity: usageSummary.bookingCount,
          unitCents: org.earlyAccessEnrollment?.lockedBookingFee || tierConfig.perBookingFeeCents,
          amountCents: bookingFeesCents,
        },
        smsOutbound: {
          description: `Outbound SMS (${usageSummary.smsOutbound} messages)`,
          quantity: usageSummary.smsOutbound,
          unitCents: tierConfig.smsOutboundCents,
          amountCents: smsOutboundCents,
        },
        smsInbound: {
          description: `Inbound SMS (${usageSummary.smsInbound} messages)`,
          quantity: usageSummary.smsInbound,
          unitCents: tierConfig.smsInboundCents,
          amountCents: smsInboundCents,
        },
        setupServiceSurcharge: {
          description: `Setup service pay-over-time (${usageSummary.setupServiceSurchargeCount || 0} bookings)`,
          quantity: usageSummary.setupServiceSurchargeCount || 0,
          amountCents: setupServiceSurchargeCents,
        },
      },
      totals: {
        subtotalCents: totalCents,
        discountCents: 0,
        taxCents: 0,
        totalCents: totalCents,
      },
      usage: usageSummary,
      setupServices: {
        activeWithBalance: activeSetupServices,
        totalBalanceRemainingCents: activeSetupServices.reduce(
          (sum, s) => sum + s.balanceRemainingCents,
          0
        ),
      },
    };
  }

  /**
   * Calculate usage for a billing period
   */
  async calculatePeriodUsage(organizationId: string, periodStart: Date, periodEnd: Date) {
    // Count bookings created in period
    const bookingCount = await this.prisma.usageEvent.count({
      where: {
        organizationId,
        eventType: "booking_created",
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    // Count SMS messages
    const smsOutbound = await this.prisma.usageEvent.count({
      where: {
        organizationId,
        eventType: "sms_sent",
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    const smsInbound = await this.prisma.usageEvent.count({
      where: {
        organizationId,
        eventType: "sms_received",
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    // AI usage
    const aiUsage = await this.prisma.usageEvent.aggregate({
      where: {
        organizationId,
        eventType: "ai_tokens_used",
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      _sum: {
        quantity: true,
      },
    });

    // Setup service surcharges (pay-over-time)
    const setupServiceSurcharges = await this.prisma.usageEvent.aggregate({
      where: {
        organizationId,
        eventType: "setup_service_surcharge",
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      _sum: {
        unitCents: true,
      },
      _count: true,
    });

    return {
      bookingCount,
      smsOutbound,
      smsInbound,
      aiTokens: aiUsage._sum.quantity || 0,
      setupServiceSurchargeCount: setupServiceSurcharges._count || 0,
      setupServiceSurchargeCents: setupServiceSurcharges._sum.unitCents || 0,
    };
  }

  /**
   * Record a usage event
   */
  async recordUsageEvent(data: {
    organizationId: string;
    campgroundId?: string;
    eventType: string;
    quantity?: number;
    referenceType?: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
  }) {
    // Get the tier config for pricing
    const org = await this.prisma.organization.findUnique({
      where: { id: data.organizationId },
      include: { earlyAccessEnrollment: true },
    });

    const tierName = org?.earlyAccessEnrollment?.tier || "standard";
    const tierConfig = TIER_CONFIGS[tierName] || TIER_CONFIGS.standard;

    // Calculate unit cost based on event type
    let unitCents: number | null = null;
    switch (data.eventType) {
      case "booking_created":
        unitCents = org?.earlyAccessEnrollment?.lockedBookingFee || tierConfig.perBookingFeeCents;
        break;
      case "sms_sent":
        unitCents = tierConfig.smsOutboundCents;
        break;
      case "sms_received":
        unitCents = tierConfig.smsInboundCents;
        break;
    }

    return this.prisma.usageEvent.create({
      data: {
        organizationId: data.organizationId,
        campgroundId: data.campgroundId,
        eventType: data.eventType,
        quantity: data.quantity || 1,
        unitCents,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        metadata: data.metadata,
      },
    });
  }

  /**
   * Get billing history for an organization
   */
  async getBillingHistory(organizationId: string, limit = 12) {
    const periods = await this.prisma.organizationBillingPeriod.findMany({
      where: { organizationId },
      orderBy: { periodStart: "desc" },
      take: limit,
      include: {
        lineItems: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return periods.map((period) => ({
      id: period.id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      status: period.status,
      subtotalCents: period.subtotalCents,
      discountCents: period.discountCents,
      taxCents: period.taxCents,
      totalCents: period.totalCents,
      invoicedAt: period.invoicedAt,
      paidAt: period.paidAt,
      dueAt: period.dueAt,
      lineItems: period.lineItems,
    }));
  }

  /**
   * Get detailed usage breakdown
   */
  async getUsageDetails(
    organizationId: string,
    eventType?: string,
    periodStart?: Date,
    periodEnd?: Date,
    limit = 100,
    offset = 0
  ) {
    const where: Record<string, unknown> = { organizationId };

    if (eventType) {
      where.eventType = eventType;
    }

    if (periodStart && periodEnd) {
      where.createdAt = {
        gte: periodStart,
        lte: periodEnd,
      };
    }

    const [events, total] = await Promise.all([
      this.prisma.usageEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          campground: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.usageEvent.count({ where }),
    ]);

    return {
      events,
      total,
      limit,
      offset,
    };
  }

  /**
   * Finalize a billing period and create invoice
   */
  async finalizePeriod(periodId: string) {
    const period = await this.prisma.organizationBillingPeriod.findUnique({
      where: { id: periodId },
      include: {
        organization: {
          include: { earlyAccessEnrollment: true },
        },
      },
    });

    if (!period) {
      throw new NotFoundException("Billing period not found");
    }

    if (period.status !== "open") {
      throw new BadRequestException("Period is not open for finalization");
    }

    // Calculate final charges
    const usage = await this.calculatePeriodUsage(
      period.organizationId,
      period.periodStart,
      period.periodEnd
    );

    const tierName = period.organization.earlyAccessEnrollment?.tier || "standard";
    const tierConfig = TIER_CONFIGS[tierName] || TIER_CONFIGS.standard;
    const lockedBookingFee = period.organization.earlyAccessEnrollment?.lockedBookingFee || tierConfig.perBookingFeeCents;

    // Calculate monthly fee
    let monthlyFeeCents = tierConfig.monthlyFeeCents;
    if (period.organization.earlyAccessEnrollment?.monthlyFeeEndsAt) {
      const freeUntil = new Date(period.organization.earlyAccessEnrollment.monthlyFeeEndsAt);
      if (period.periodEnd < freeUntil) {
        monthlyFeeCents = 0;
      } else {
        monthlyFeeCents = period.organization.earlyAccessEnrollment.lockedMonthlyFee || 2900;
      }
    } else if (tierName === "founders_circle") {
      monthlyFeeCents = 0;
    }

    // Create line items
    const lineItems = [];

    // Subscription
    if (monthlyFeeCents > 0) {
      lineItems.push({
        type: "subscription" as const,
        description: "Monthly subscription",
        quantity: 1,
        unitCents: monthlyFeeCents,
        totalCents: monthlyFeeCents,
      });
    }

    // Booking fees
    if (usage.bookingCount > 0) {
      lineItems.push({
        type: "booking_fee" as const,
        description: `Per-booking fees (${usage.bookingCount} bookings)`,
        quantity: usage.bookingCount,
        unitCents: lockedBookingFee,
        totalCents: usage.bookingCount * lockedBookingFee,
      });
    }

    // SMS outbound
    if (usage.smsOutbound > 0) {
      lineItems.push({
        type: "sms_outbound" as const,
        description: `Outbound SMS (${usage.smsOutbound} messages)`,
        quantity: usage.smsOutbound,
        unitCents: tierConfig.smsOutboundCents,
        totalCents: usage.smsOutbound * tierConfig.smsOutboundCents,
      });
    }

    // SMS inbound
    if (usage.smsInbound > 0) {
      lineItems.push({
        type: "sms_inbound" as const,
        description: `Inbound SMS (${usage.smsInbound} messages)`,
        quantity: usage.smsInbound,
        unitCents: tierConfig.smsInboundCents,
        totalCents: usage.smsInbound * tierConfig.smsInboundCents,
      });
    }

    // Setup service surcharges (pay-over-time)
    if (usage.setupServiceSurchargeCents > 0) {
      lineItems.push({
        type: "setup_service_surcharge" as const,
        description: `Setup service pay-over-time (${usage.setupServiceSurchargeCount} bookings @ $1.00)`,
        quantity: usage.setupServiceSurchargeCount,
        unitCents: 100, // $1.00
        totalCents: usage.setupServiceSurchargeCents,
      });
    }

    // Calculate totals
    const subtotalCents = lineItems.reduce((sum, item) => sum + item.totalCents, 0);

    // Update period with line items
    const updated = await this.prisma.$transaction(async (tx) => {
      // Create line items
      await tx.organizationBillingLineItem.createMany({
        data: lineItems.map((item) => ({
          billingPeriodId: periodId,
          ...item,
        })),
      });

      // Mark usage events as billed
      await tx.usageEvent.updateMany({
        where: {
          organizationId: period.organizationId,
          createdAt: {
            gte: period.periodStart,
            lte: period.periodEnd,
          },
          billed: false,
        },
        data: {
          billed: true,
          billedAt: new Date(),
          billingPeriodId: periodId,
        },
      });

      // Update period status
      return tx.organizationBillingPeriod.update({
        where: { id: periodId },
        data: {
          status: "invoiced",
          subtotalCents,
          totalCents: subtotalCents,
          invoicedAt: new Date(),
        },
        include: {
          lineItems: true,
        },
      });
    });

    return updated;
  }

  /**
   * Mark a period as paid
   */
  async markPeriodPaid(periodId: string, stripePaymentIntentId?: string) {
    return this.prisma.organizationBillingPeriod.update({
      where: { id: periodId },
      data: {
        status: "paid",
        paidAt: new Date(),
        stripePaymentIntentId,
      },
    });
  }

  private getTierDisplayName(tier: string): string {
    const names: Record<string, string> = {
      founders_circle: "Founder's Circle",
      pioneer: "Pioneer",
      trailblazer: "Trailblazer",
      standard: "Standard",
    };
    return names[tier] || tier;
  }
}
