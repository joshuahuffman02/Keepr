import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface BillingPeriodSummary {
  periodStart: Date;
  periodEnd: Date;
  revenue: {
    grossRevenueCents: number;
    reservationCount: number;
    averageBookingValue: number;
  };
  platformFees: {
    perBookingFeeCents: number;
    bookingCount: number;
    smsOutboundCents: number;
    smsInboundCents: number;
    totalCents: number;
  };
  paymentFees: {
    stripeFeesCents: number;
    refundsCents: number;
    disputesCents: number;
    totalCents: number;
  };
  netRevenue: {
    totalCents: number;
    payoutsCents: number;
    pendingPayoutCents: number;
  };
}

export interface RevenueBreakdown {
  byChannel: {
    online: number;
    kiosk: number;
    staff: number;
    api: number;
  };
  bySiteType: Record<string, number>;
  byMonth: Array<{
    month: string;
    revenueCents: number;
    bookingCount: number;
  }>;
}

@Injectable()
export class BillingDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get comprehensive billing summary for a campground
   */
  async getBillingSummary(campgroundId: string, periodStart?: Date, periodEnd?: Date) {
    const now = new Date();
    const start = periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const end = periodEnd ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get campground with organization for billing tier
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      include: {
        organization: {
          include: {
            earlyAccessEnrollment: true,
          },
        },
      },
    });

    if (!campground) {
      throw new NotFoundException("Campground not found");
    }

    // Get revenue from completed reservations
    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        id: true,
        totalAmount: true,
        paidAmount: true,
        source: true,
        site: {
          select: { siteType: true },
        },
      },
    });

    const grossRevenueCents = reservations.reduce((sum, r) => sum + (r.paidAmount ?? 0), 0);
    const reservationCount = reservations.length;
    const averageBookingValue = reservationCount > 0 ? grossRevenueCents / reservationCount : 0;

    // Get usage events for platform fees
    const usageEvents = await this.prisma.usageEvent.findMany({
      where: {
        campgroundId,
        createdAt: { gte: start, lte: end },
      },
    });

    const bookingFeeEvents = usageEvents.filter(e => e.eventType === "booking_created");
    const smsOutboundEvents = usageEvents.filter(e => e.eventType === "sms_sent");
    const smsInboundEvents = usageEvents.filter(e => e.eventType === "sms_received");

    const perBookingFeeCents = bookingFeeEvents.reduce((sum, e) => sum + (e.unitCents ?? 0), 0);
    const smsOutboundCents = smsOutboundEvents.reduce((sum, e) => sum + (e.unitCents ?? 0), 0);
    const smsInboundCents = smsInboundEvents.reduce((sum, e) => sum + (e.unitCents ?? 0), 0);
    const totalPlatformFeesCents = perBookingFeeCents + smsOutboundCents + smsInboundCents;

    // Get payment fees (Stripe fees, refunds, disputes)
    const payments = await this.prisma.payment.findMany({
      where: {
        reservation: { campgroundId },
        createdAt: { gte: start, lte: end },
        status: "succeeded",
      },
      select: {
        amountCents: true,
        feeAmountCents: true,
        metadata: true,
      },
    });

    const stripeFeesCents = payments.reduce((sum, p) => sum + (p.feeAmountCents ?? 0), 0);

    const refunds = await this.prisma.payment.aggregate({
      where: {
        reservation: { campgroundId },
        createdAt: { gte: start, lte: end },
        status: "refunded",
      },
      _sum: { amountCents: true },
    });
    const refundsCents = refunds._sum.amountCents ?? 0;

    const disputes = await this.prisma.dispute.aggregate({
      where: {
        campgroundId,
        createdAt: { gte: start, lte: end },
      },
      _sum: { amountCents: true },
    });
    const disputesCents = disputes._sum.amountCents ?? 0;

    const totalPaymentFeesCents = stripeFeesCents + refundsCents + disputesCents;

    // Get payouts
    const payouts = await this.prisma.payout.aggregate({
      where: {
        campgroundId,
        paidAt: { gte: start, lte: end },
        status: "paid",
      },
      _sum: { amountCents: true },
    });
    const payoutsCents = payouts._sum.amountCents ?? 0;

    const pendingPayouts = await this.prisma.payout.aggregate({
      where: {
        campgroundId,
        status: { in: ["pending", "in_transit"] },
      },
      _sum: { amountCents: true },
    });
    const pendingPayoutCents = pendingPayouts._sum.amountCents ?? 0;

    const netRevenueCents = grossRevenueCents - totalPaymentFeesCents - totalPlatformFeesCents;

    const summary: BillingPeriodSummary = {
      periodStart: start,
      periodEnd: end,
      revenue: {
        grossRevenueCents,
        reservationCount,
        averageBookingValue: Math.round(averageBookingValue),
      },
      platformFees: {
        perBookingFeeCents,
        bookingCount: bookingFeeEvents.length,
        smsOutboundCents,
        smsInboundCents,
        totalCents: totalPlatformFeesCents,
      },
      paymentFees: {
        stripeFeesCents,
        refundsCents,
        disputesCents,
        totalCents: totalPaymentFeesCents,
      },
      netRevenue: {
        totalCents: netRevenueCents,
        payoutsCents,
        pendingPayoutCents,
      },
    };

    return {
      campground: {
        id: campground.id,
        name: campground.name,
        billingTier: campground.organization?.earlyAccessEnrollment?.tier ?? "standard",
      },
      summary,
    };
  }

  /**
   * Get revenue breakdown by channel, site type, and time
   */
  async getRevenueBreakdown(campgroundId: string, periodStart?: Date, periodEnd?: Date): Promise<RevenueBreakdown> {
    const now = new Date();
    const start = periodStart ?? new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const end = periodEnd ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        paidAmount: true,
        source: true,
        createdAt: true,
        site: {
          select: { siteType: true },
        },
      },
    });

    // By channel
    const byChannel = { online: 0, kiosk: 0, staff: 0, api: 0 };
    for (const r of reservations) {
      const source = r.source?.toLowerCase() ?? "online";
      if (source in byChannel) {
        byChannel[source as keyof typeof byChannel] += r.paidAmount ?? 0;
      } else if (source === "phone" || source === "walkin" || source === "walk_in") {
        byChannel.staff += r.paidAmount ?? 0;
      } else {
        byChannel.online += r.paidAmount ?? 0;
      }
    }

    // By site type
    const bySiteType: Record<string, number> = {};
    for (const r of reservations) {
      const siteType = r.site?.siteType ?? "unknown";
      bySiteType[siteType] = (bySiteType[siteType] ?? 0) + (r.paidAmount ?? 0);
    }

    // By month
    const byMonthMap: Record<string, { revenueCents: number; bookingCount: number }> = {};
    for (const r of reservations) {
      const monthKey = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonthMap[monthKey]) {
        byMonthMap[monthKey] = { revenueCents: 0, bookingCount: 0 };
      }
      byMonthMap[monthKey].revenueCents += r.paidAmount ?? 0;
      byMonthMap[monthKey].bookingCount += 1;
    }

    const byMonth = Object.entries(byMonthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));

    return { byChannel, bySiteType, byMonth };
  }

  /**
   * Get platform fee invoice history for a campground
   */
  async getFeeInvoiceHistory(campgroundId: string, limit = 12) {
    // Get the organization for this campground
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground?.organizationId) {
      return { invoices: [], campgroundBreakdown: [] };
    }

    // Get billing periods
    const periods = await this.prisma.organizationBillingPeriod.findMany({
      where: { organizationId: campground.organizationId },
      orderBy: { periodStart: "desc" },
      take: limit,
      include: {
        lineItems: true,
      },
    });

    // For each period, calculate campground-specific charges
    const campgroundBreakdown = await Promise.all(
      periods.map(async (period) => {
        const usage = await this.prisma.usageEvent.aggregate({
          where: {
            campgroundId,
            createdAt: { gte: period.periodStart, lte: period.periodEnd },
          },
          _sum: { unitCents: true },
          _count: true,
        });

        return {
          periodId: period.id,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          status: period.status,
          totalEventCount: usage._count,
          totalChargesCents: usage._sum.unitCents ?? 0,
          paidAt: period.paidAt,
        };
      })
    );

    return {
      invoices: periods.map((p) => ({
        id: p.id,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        status: p.status,
        totalCents: p.totalCents,
        paidAt: p.paidAt,
        lineItems: p.lineItems,
      })),
      campgroundBreakdown,
    };
  }

  /**
   * Get payout history for a campground
   */
  async getPayoutHistory(campgroundId: string, limit = 20) {
    const payouts = await this.prisma.payout.findMany({
      where: { campgroundId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        lines: {
          take: 50,
        },
      },
    });

    return payouts.map((payout) => ({
      id: payout.id,
      stripePayoutId: payout.stripePayoutId,
      status: payout.status,
      amountCents: payout.amountCents,
      currency: payout.currency,
      arrivalDate: payout.arrivalDate,
      paidAt: payout.paidAt,
      createdAt: payout.createdAt,
      summary: {
        chargeCount: payout.lines.filter((l) => l.type === "charge").length,
        refundCount: payout.lines.filter((l) => l.type === "refund").length,
        feeCount: payout.lines.filter((l) => l.type === "fee").length,
      },
    }));
  }

  /**
   * Get fee transparency breakdown for a specific period
   */
  async getFeeTransparency(campgroundId: string, periodStart: Date, periodEnd: Date) {
    // Get all payments in the period with fee details
    const payments = await this.prisma.payment.findMany({
      where: {
        reservation: { campgroundId },
        createdAt: { gte: periodStart, lte: periodEnd },
        status: "succeeded",
      },
      select: {
        id: true,
        amountCents: true,
        feeAmountCents: true,
        metadata: true,
        createdAt: true,
        reservation: {
          select: {
            id: true,
            confirmationCode: true,
            totalAmount: true,
            guest: {
              select: { primaryFirstName: true, primaryLastName: true },
            },
          },
        },
      },
    });

    // Get usage events for platform fees
    const usageEvents = await this.prisma.usageEvent.findMany({
      where: {
        campgroundId,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      select: {
        id: true,
        eventType: true,
        unitCents: true,
        quantity: true,
        referenceType: true,
        referenceId: true,
        createdAt: true,
      },
    });

    return {
      periodStart,
      periodEnd,
      payments: payments.map((p) => ({
        paymentId: p.id,
        reservationId: p.reservation?.id,
        confirmationCode: p.reservation?.confirmationCode,
        guestName: p.reservation?.guest
          ? `${p.reservation.guest.primaryFirstName} ${p.reservation.guest.primaryLastName}`
          : null,
        grossAmountCents: p.amountCents,
        stripeFeesCents: p.feeAmountCents ?? 0,
        netAmountCents: (p.amountCents ?? 0) - (p.feeAmountCents ?? 0),
        createdAt: p.createdAt,
      })),
      platformFees: usageEvents.map((e) => ({
        eventId: e.id,
        eventType: e.eventType,
        description: this.getEventDescription(e.eventType),
        amountCents: e.unitCents ?? 0,
        quantity: e.quantity,
        referenceType: e.referenceType,
        referenceId: e.referenceId,
        createdAt: e.createdAt,
      })),
      totals: {
        grossPaymentsCents: payments.reduce((sum, p) => sum + (p.amountCents ?? 0), 0),
        stripeFeesTotalCents: payments.reduce((sum, p) => sum + (p.feeAmountCents ?? 0), 0),
        platformFeesTotalCents: usageEvents.reduce((sum, e) => sum + (e.unitCents ?? 0), 0),
      },
    };
  }

  private getEventDescription(eventType: string): string {
    const descriptions: Record<string, string> = {
      booking_created: "Per-booking fee",
      sms_outbound: "Outbound SMS",
      sms_inbound: "Inbound SMS",
      ai_usage: "AI assistant usage",
      setup_service_surcharge: "Setup service (pay-over-time)",
    };
    return descriptions[eventType] ?? eventType;
  }
}
