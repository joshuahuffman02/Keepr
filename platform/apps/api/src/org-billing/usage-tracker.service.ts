import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Lightweight service for recording usage events for billing.
 * This service has minimal dependencies to avoid circular imports.
 *
 * Usage events are recorded to the database and later processed
 * by the SubscriptionService to report to Stripe.
 */
@Injectable()
export class UsageTrackerService {
  private readonly logger = new Logger(UsageTrackerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a booking created event for billing
   */
  async trackBookingCreated(
    reservationId: string,
    campgroundId: string,
    metadata?: Record<string, unknown>
  ) {
    try {
      // Get organization from campground
      const campground = await this.prisma.campground.findUnique({
        where: { id: campgroundId },
        select: { organizationId: true },
      });

      if (!campground?.organizationId) {
        this.logger.warn(`No organization found for campground ${campgroundId}`);
        return;
      }

      const organizationId = campground.organizationId;

      await this.prisma.usageEvent.create({
        data: {
          organizationId,
          campgroundId,
          eventType: "booking_created",
          quantity: 1,
          referenceType: "reservation",
          referenceId: reservationId,
          metadata: metadata ?? {},
        },
      });

      this.logger.debug(
        `Tracked booking_created for reservation ${reservationId}, org ${organizationId}`
      );

      // Check for setup service surcharge and apply if needed
      await this.applySetupServiceSurcharge(organizationId, reservationId);
    } catch (error) {
      // Log but don't fail the reservation creation
      this.logger.error(`Failed to track booking_created:`, error);
    }
  }

  /**
   * Check for and apply setup service surcharge ($1/booking until paid off)
   */
  private async applySetupServiceSurcharge(
    organizationId: string,
    reservationId: string
  ) {
    try {
      // Find setup services with outstanding balance (oldest first)
      const servicesWithBalance = await this.prisma.setupService.findMany({
        where: {
          organizationId,
          balanceRemainingCents: { gt: 0 },
          status: { in: ["pending", "in_progress", "completed"] },
        },
        orderBy: { createdAt: "asc" },
        take: 1,
      });

      if (servicesWithBalance.length === 0) {
        return;
      }

      const service = servicesWithBalance[0];
      const chargeAmount = Math.min(
        service.perBookingSurchargeCents,
        service.balanceRemainingCents
      );

      const newBalance = service.balanceRemainingCents - chargeAmount;
      const isPaidOff = newBalance <= 0;

      // Update the setup service balance
      await this.prisma.setupService.update({
        where: { id: service.id },
        data: {
          balanceRemainingCents: Math.max(0, newBalance),
          bookingsCharged: { increment: 1 },
          lastChargedAt: new Date(),
          paidOffAt: isPaidOff ? new Date() : undefined,
        },
      });

      // Track the surcharge as a usage event
      await this.prisma.usageEvent.create({
        data: {
          organizationId,
          eventType: "setup_service_surcharge",
          quantity: 1,
          unitCents: chargeAmount,
          referenceType: "reservation",
          referenceId: reservationId,
          metadata: {
            setupServiceId: service.id,
            setupServiceType: service.serviceType,
            balanceRemaining: newBalance,
            isPaidOff,
          },
        },
      });

      this.logger.debug(
        `Applied setup service surcharge: $${(chargeAmount / 100).toFixed(2)} for service ${service.id}, ` +
          `balance remaining: $${(newBalance / 100).toFixed(2)}`
      );

      if (isPaidOff) {
        this.logger.log(
          `Setup service ${service.id} (${service.serviceType}) is now fully paid off!`
        );
      }
    } catch (error) {
      // Log but don't fail - surcharge tracking is secondary to booking
      this.logger.error(`Failed to apply setup service surcharge:`, error);
    }
  }

  /**
   * Record an SMS sent event for billing
   */
  async trackSmsSent(
    organizationId: string,
    campgroundId: string | null,
    direction: "outbound" | "inbound",
    messageId?: string,
    segmentCount: number = 1
  ) {
    try {
      await this.prisma.usageEvent.create({
        data: {
          organizationId,
          campgroundId,
          eventType: direction === "outbound" ? "sms_outbound" : "sms_inbound",
          quantity: segmentCount,
          referenceType: "message",
          referenceId: messageId,
        },
      });

      this.logger.debug(
        `Tracked sms_${direction} for org ${organizationId}, segments: ${segmentCount}`
      );
    } catch (error) {
      this.logger.error(`Failed to track SMS usage:`, error);
    }
  }

  /**
   * Record AI usage for billing (future use)
   */
  async trackAiUsage(
    organizationId: string,
    campgroundId: string | null,
    tokenCount: number,
    modelId?: string
  ) {
    try {
      await this.prisma.usageEvent.create({
        data: {
          organizationId,
          campgroundId,
          eventType: "ai_usage",
          quantity: tokenCount,
          metadata: modelId ? { modelId } : {},
        },
      });

      this.logger.debug(
        `Tracked ai_usage for org ${organizationId}, tokens: ${tokenCount}`
      );
    } catch (error) {
      this.logger.error(`Failed to track AI usage:`, error);
    }
  }
}
