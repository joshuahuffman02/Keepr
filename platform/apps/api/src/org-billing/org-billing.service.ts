import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

// Types for billing configuration
interface TierConfig {
  monthlyFeeCents: number;
  perBookingFeeCents: number;
  freeMonthlyUntil?: Date | null;
  smsOutboundCents: number;
  smsInboundCents: number;
  aiTokensPer1kCents: number; // Price per 1,000 AI tokens
}

const TIER_CONFIGS: Record<string, TierConfig> = {
  founders_circle: {
    monthlyFeeCents: 0,
    perBookingFeeCents: 75, // $0.75
    freeMonthlyUntil: null, // Forever free
    smsOutboundCents: 3, // $0.03
    smsInboundCents: 3, // $0.03
    aiTokensPer1kCents: 5, // $0.05 per 1K tokens (cost coverage)
  },
  pioneer: {
    monthlyFeeCents: 0, // Free for 12 months, then $29
    perBookingFeeCents: 100, // $1.00
    smsOutboundCents: 3, // $0.03
    smsInboundCents: 3, // $0.03
    aiTokensPer1kCents: 5, // $0.05 per 1K tokens
  },
  trailblazer: {
    monthlyFeeCents: 1450, // $14.50 for 6 months, then $29
    perBookingFeeCents: 125, // $1.25
    smsOutboundCents: 3, // $0.03
    smsInboundCents: 3, // $0.03
    aiTokensPer1kCents: 5, // $0.05 per 1K tokens
  },
  standard: {
    monthlyFeeCents: 6900, // $69
    perBookingFeeCents: 250, // $2.50
    smsOutboundCents: 3, // $0.03
    smsInboundCents: 3, // $0.03
    aiTokensPer1kCents: 5, // $0.05 per 1K tokens
  },
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

const toNullableJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return toJsonValue(value) ?? Prisma.JsonNull;
};

type BillingLineItemCreateData = Omit<
  Prisma.OrganizationBillingLineItemUncheckedCreateInput,
  "id" | "billingPeriodId"
>;

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
        OrganizationBillingLineItem: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!period) {
      period = await this.prisma.organizationBillingPeriod.create({
        data: {
          id: randomUUID(),
          organizationId,
          periodStart,
          periodEnd,
          status: "open",
          dueAt: new Date(periodEnd.getTime() + 15 * 24 * 60 * 60 * 1000), // Due 15 days after period end
          updatedAt: new Date(),
        },
        include: {
          OrganizationBillingLineItem: true,
        },
      });
    }

    const { OrganizationBillingLineItem, ...rest } = period;
    return { ...rest, lineItems: OrganizationBillingLineItem };
  }

  /**
   * Get billing summary for an organization
   */
  async getBillingSummary(organizationId: string) {
    // Get organization with early access enrollment
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        EarlyAccessEnrollment: true,
        Campground: {
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
    const tierName = org.EarlyAccessEnrollment?.tier || "standard";
    const tierConfig = TIER_CONFIGS[tierName] || TIER_CONFIGS.standard;

    // Calculate current period charges from usage events
    const usageSummary = await this.calculatePeriodUsage(
      organizationId,
      currentPeriod.periodStart,
      currentPeriod.periodEnd,
    );

    // Calculate monthly fee (check if still in free period)
    let monthlyFeeCents = tierConfig.monthlyFeeCents;
    if (org.EarlyAccessEnrollment?.monthlyFeeEndsAt) {
      const freeUntil = new Date(org.EarlyAccessEnrollment.monthlyFeeEndsAt);
      if (new Date() < freeUntil) {
        monthlyFeeCents = 0;
      } else {
        // After promo period, use locked rate or standard
        monthlyFeeCents = org.EarlyAccessEnrollment.lockedMonthlyFee || 2900; // $29 default
      }
    } else if (tierName === "founders_circle") {
      // Founder's circle is forever free
      monthlyFeeCents = 0;
    }

    // Calculate totals
    const subscriptionCents = monthlyFeeCents;
    const bookingFeesCents =
      usageSummary.bookingCount *
      (org.EarlyAccessEnrollment?.lockedBookingFee || tierConfig.perBookingFeeCents);
    const smsOutboundCents = usageSummary.smsOutbound * tierConfig.smsOutboundCents;
    const smsInboundCents = usageSummary.smsInbound * tierConfig.smsInboundCents;
    const aiTokensCents = Math.round(
      (usageSummary.aiTokens / 1000) * tierConfig.aiTokensPer1kCents,
    );
    const setupServiceSurchargeCents = usageSummary.setupServiceSurchargeCents || 0;
    const totalCents =
      subscriptionCents +
      bookingFeesCents +
      smsOutboundCents +
      smsInboundCents +
      aiTokensCents +
      setupServiceSurchargeCents;

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
        lockedBookingFee: org.EarlyAccessEnrollment?.lockedBookingFee,
        monthlyFeeEndsAt: org.EarlyAccessEnrollment?.monthlyFeeEndsAt,
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
          unitCents: org.EarlyAccessEnrollment?.lockedBookingFee || tierConfig.perBookingFeeCents,
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
        aiUsage: {
          description: `AI Usage (${(usageSummary.aiTokens / 1000).toFixed(1)}K tokens)`,
          quantity: usageSummary.aiTokens,
          unitCents: tierConfig.aiTokensPer1kCents, // per 1K tokens
          amountCents: aiTokensCents,
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
          0,
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
        eventType: "sms_outbound",
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    const smsInbound = await this.prisma.usageEvent.count({
      where: {
        organizationId,
        eventType: "sms_inbound",
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
        eventType: "ai_usage",
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
      include: { EarlyAccessEnrollment: true },
    });

    const tierName = org?.EarlyAccessEnrollment?.tier || "standard";
    const tierConfig = TIER_CONFIGS[tierName] || TIER_CONFIGS.standard;

    // Calculate unit cost based on event type
    let unitCents: number | null = null;
    switch (data.eventType) {
      case "booking_created":
        unitCents = org?.EarlyAccessEnrollment?.lockedBookingFee || tierConfig.perBookingFeeCents;
        break;
      case "sms_outbound":
        unitCents = tierConfig.smsOutboundCents;
        break;
      case "sms_inbound":
        unitCents = tierConfig.smsInboundCents;
        break;
    }

    return this.prisma.usageEvent.create({
      data: {
        id: randomUUID(),
        organizationId: data.organizationId,
        campgroundId: data.campgroundId,
        eventType: data.eventType,
        quantity: data.quantity || 1,
        unitCents,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        metadata: data.metadata === undefined ? undefined : toNullableJsonInput(data.metadata),
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
        OrganizationBillingLineItem: {
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
      lineItems: period.OrganizationBillingLineItem,
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
    offset = 0,
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
          Campground: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.usageEvent.count({ where }),
    ]);

    return {
      events: events.map((event) => {
        const { Campground, ...rest } = event;
        return { ...rest, campground: Campground };
      }),
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
        Organization: {
          include: { EarlyAccessEnrollment: true },
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
      period.periodEnd,
    );

    const tierName = period.Organization.EarlyAccessEnrollment?.tier || "standard";
    const tierConfig = TIER_CONFIGS[tierName] || TIER_CONFIGS.standard;
    const lockedBookingFee =
      period.Organization.EarlyAccessEnrollment?.lockedBookingFee || tierConfig.perBookingFeeCents;

    // Calculate monthly fee
    let monthlyFeeCents = tierConfig.monthlyFeeCents;
    if (period.Organization.EarlyAccessEnrollment?.monthlyFeeEndsAt) {
      const freeUntil = new Date(period.Organization.EarlyAccessEnrollment.monthlyFeeEndsAt);
      if (period.periodEnd < freeUntil) {
        monthlyFeeCents = 0;
      } else {
        monthlyFeeCents = period.Organization.EarlyAccessEnrollment.lockedMonthlyFee || 2900;
      }
    } else if (tierName === "founders_circle") {
      monthlyFeeCents = 0;
    }

    // Create line items
    const lineItems: BillingLineItemCreateData[] = [];

    // Subscription
    if (monthlyFeeCents > 0) {
      lineItems.push({
        type: "subscription",
        description: "Monthly subscription",
        quantity: 1,
        unitCents: monthlyFeeCents,
        totalCents: monthlyFeeCents,
      });
    }

    // Booking fees
    if (usage.bookingCount > 0) {
      lineItems.push({
        type: "booking_fee",
        description: `Per-booking fees (${usage.bookingCount} bookings)`,
        quantity: usage.bookingCount,
        unitCents: lockedBookingFee,
        totalCents: usage.bookingCount * lockedBookingFee,
      });
    }

    // SMS outbound
    if (usage.smsOutbound > 0) {
      lineItems.push({
        type: "sms_outbound",
        description: `Outbound SMS (${usage.smsOutbound} messages)`,
        quantity: usage.smsOutbound,
        unitCents: tierConfig.smsOutboundCents,
        totalCents: usage.smsOutbound * tierConfig.smsOutboundCents,
      });
    }

    // SMS inbound
    if (usage.smsInbound > 0) {
      lineItems.push({
        type: "sms_inbound",
        description: `Inbound SMS (${usage.smsInbound} messages)`,
        quantity: usage.smsInbound,
        unitCents: tierConfig.smsInboundCents,
        totalCents: usage.smsInbound * tierConfig.smsInboundCents,
      });
    }

    // AI usage
    if (usage.aiTokens > 0) {
      const aiTokensCents = Math.round((usage.aiTokens / 1000) * tierConfig.aiTokensPer1kCents);
      lineItems.push({
        type: "ai_usage",
        description: `AI Usage (${(usage.aiTokens / 1000).toFixed(1)}K tokens)`,
        quantity: usage.aiTokens,
        unitCents: tierConfig.aiTokensPer1kCents, // per 1K tokens
        totalCents: aiTokensCents,
      });
    }

    // Setup service surcharges (pay-over-time)
    if (usage.setupServiceSurchargeCents > 0) {
      lineItems.push({
        type: "overage",
        description: `Setup service pay-over-time (${usage.setupServiceSurchargeCount} bookings @ $1.00)`,
        quantity: usage.setupServiceSurchargeCount,
        unitCents: 100, // $1.00
        totalCents: usage.setupServiceSurchargeCents,
        metadata: { kind: "setup_service_surcharge" },
      });
    }

    // Calculate totals
    const subtotalCents = lineItems.reduce((sum, item) => sum + item.totalCents, 0);

    // Update period with line items
    const updated = await this.prisma.$transaction(async (tx) => {
      // Create line items
      await tx.organizationBillingLineItem.createMany({
        data: lineItems.map((item) => ({
          id: randomUUID(),
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
          updatedAt: new Date(),
        },
        include: {
          OrganizationBillingLineItem: true,
        },
      });
    });

    const { OrganizationBillingLineItem, ...rest } = updated;
    return { ...rest, lineItems: OrganizationBillingLineItem };
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
        updatedAt: new Date(),
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
