import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { AiAutopilotConfigService } from "./ai-autopilot-config.service";
import { EmailService } from "../email/email.service";

interface RiskFactors {
  paymentStatusScore: number;
  leadTimeScore: number;
  guestHistoryScore: number;
  communicationScore: number;
  bookingSourceScore: number;
}

@Injectable()
export class AiNoShowPredictionService {
  private readonly logger = new Logger(AiNoShowPredictionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: AiAutopilotConfigService,
    private readonly emailService: EmailService
  ) {}

  // ==================== RISK QUERIES ====================

  /**
   * Get all no-show risks for a campground
   */
  async getRisks(campgroundId: string, flaggedOnly = false, daysAhead?: number) {
    const arrivalBefore = daysAhead
      ? new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
      : undefined;

    const where: any = {
      reservation: {
        campgroundId,
        status: "confirmed",
        arrivalDate: {
          gte: new Date(),
          ...(arrivalBefore ? { lte: arrivalBefore } : {}),
        },
      },
    };

    if (flaggedOnly) {
      where.flagged = true;
    }

    return this.prisma.aiNoShowRisk.findMany({
      where,
      include: {
        reservation: {
          select: {
            id: true,
            confirmationNumber: true,
            arrivalDate: true,
            departureDate: true,
            status: true,
            totalAmountCents: true,
            balanceCents: true,
            guest: {
              select: {
                id: true,
                primaryFirstName: true,
                primaryLastName: true,
                email: true,
                phone: true,
              },
            },
            site: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { riskScore: "desc" },
    });
  }

  /**
   * Get risk for a specific reservation
   */
  async getRisk(reservationId: string) {
    const risk = await this.prisma.aiNoShowRisk.findUnique({
      where: { reservationId },
      include: {
        reservation: {
          include: {
            guest: true,
            site: true,
          },
        },
      },
    });

    if (!risk) {
      // Calculate on-demand if not exists
      return this.calculateRisk(reservationId);
    }

    return risk;
  }

  // ==================== RISK CALCULATION ====================

  /**
   * Calculate no-show risk for a reservation
   */
  async calculateRisk(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        campground: true,
        payments: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    // Get config
    const config = await this.configService.getConfig(reservation.campgroundId);

    if (!config.noShowPredictionEnabled) {
      return null;
    }

    // Calculate all risk factors
    const factors = await this.calculateRiskFactors(reservation);

    // Calculate weighted risk score (0-1)
    const weights = {
      payment: 0.30,
      leadTime: 0.15,
      guestHistory: 0.25,
      communication: 0.20,
      bookingSource: 0.10,
    };

    const riskScore =
      (100 - factors.paymentStatusScore) * weights.payment / 100 +
      (100 - factors.leadTimeScore) * weights.leadTime / 100 +
      (100 - factors.guestHistoryScore) * weights.guestHistory / 100 +
      (100 - factors.communicationScore) * weights.communication / 100 +
      (100 - factors.bookingSourceScore) * weights.bookingSource / 100;

    // Determine if flagged based on threshold
    const flagged = riskScore >= config.noShowThreshold;

    // Build reason text
    const reasons: string[] = [];
    if (factors.paymentStatusScore < 50) reasons.push("Unpaid or partial payment");
    if (factors.leadTimeScore < 40) reasons.push("Last-minute booking");
    if (factors.guestHistoryScore < 50) reasons.push("New guest or past no-shows");
    if (factors.communicationScore < 40) reasons.push("No communication received");
    if (factors.bookingSourceScore < 50) reasons.push("Higher-risk booking source");

    const riskReason = reasons.length > 0 ? reasons.join(", ") : "Multiple minor risk factors";

    // Upsert the risk record
    return this.prisma.aiNoShowRisk.upsert({
      where: { reservationId },
      create: {
        reservationId,
        riskScore,
        paymentStatusScore: factors.paymentStatusScore,
        leadTimeScore: factors.leadTimeScore,
        guestHistoryScore: factors.guestHistoryScore,
        communicationScore: factors.communicationScore,
        bookingSourceScore: factors.bookingSourceScore,
        riskReason,
        flagged,
      },
      update: {
        riskScore,
        paymentStatusScore: factors.paymentStatusScore,
        leadTimeScore: factors.leadTimeScore,
        guestHistoryScore: factors.guestHistoryScore,
        communicationScore: factors.communicationScore,
        bookingSourceScore: factors.bookingSourceScore,
        riskReason,
        flagged,
        calculatedAt: new Date(),
      },
      include: {
        reservation: {
          select: {
            id: true,
            confirmationNumber: true,
            arrivalDate: true,
            guest: {
              select: { primaryFirstName: true, primaryLastName: true, email: true },
            },
          },
        },
      },
    });
  }

  /**
   * Calculate all risk factors for a reservation
   */
  private async calculateRiskFactors(reservation: any): Promise<RiskFactors> {
    const [paymentStatusScore, guestHistoryScore, communicationScore] = await Promise.all([
      this.calculatePaymentStatusScore(reservation),
      this.calculateGuestHistoryScore(reservation.guestId, reservation.campgroundId),
      this.calculateCommunicationScore(reservation.id),
    ]);

    return {
      paymentStatusScore,
      leadTimeScore: this.calculateLeadTimeScore(reservation),
      guestHistoryScore,
      communicationScore,
      bookingSourceScore: this.calculateBookingSourceScore(reservation),
    };
  }

  /**
   * Payment status score (0-100, higher = lower risk)
   * Paid in full = 100, partial = 60, unpaid = 20
   */
  private async calculatePaymentStatusScore(reservation: any): Promise<number> {
    const totalAmount = reservation.totalAmountCents || 0;
    const balance = reservation.balanceCents || 0;

    if (totalAmount === 0) return 80; // Free booking, moderate confidence

    const paidPercent = ((totalAmount - balance) / totalAmount) * 100;

    if (paidPercent >= 100) return 100; // Fully paid
    if (paidPercent >= 50) return 70;   // More than half paid
    if (paidPercent >= 20) return 45;   // Some payment made
    if (paidPercent > 0) return 30;     // Minimal payment
    return 15; // No payment at all
  }

  /**
   * Lead time score (0-100, higher = lower risk)
   * Longer lead time = lower risk (more commitment)
   */
  private calculateLeadTimeScore(reservation: any): number {
    const now = new Date();
    const arrivalDate = new Date(reservation.arrivalDate);
    const createdAt = new Date(reservation.createdAt);

    // Days between booking and arrival
    const leadTimeDays = Math.floor(
      (arrivalDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Days until arrival from now
    const daysUntilArrival = Math.floor(
      (arrivalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    let score = 50; // Base score

    // Lead time bonus
    if (leadTimeDays >= 60) score += 30;      // 2+ months advance
    else if (leadTimeDays >= 30) score += 25; // 1+ month advance
    else if (leadTimeDays >= 14) score += 15; // 2+ weeks advance
    else if (leadTimeDays >= 7) score += 5;   // 1+ week advance
    else if (leadTimeDays < 2) score -= 20;   // Last minute booking

    // Proximity adjustment (closer = slightly higher risk)
    if (daysUntilArrival <= 1) score -= 10;
    else if (daysUntilArrival <= 3) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Guest history score (0-100, higher = lower risk)
   * Previous stays and no-show history
   */
  private async calculateGuestHistoryScore(
    guestId: string | null,
    campgroundId: string
  ): Promise<number> {
    if (!guestId) return 35; // Unknown guest = higher risk

    // Get guest's reservation history
    const history = await this.prisma.reservation.groupBy({
      by: ["status"],
      where: {
        guestId,
        campgroundId,
        arrivalDate: { lt: new Date() },
      },
      _count: true,
    });

    const completed = history.find((h) => h.status === "checked_out")?._count || 0;
    const noShows = history.find((h) => h.status === "no_show")?._count || 0;
    const cancelled = history.find((h) => h.status === "cancelled")?._count || 0;
    const total = completed + noShows + cancelled;

    if (total === 0) return 45; // New guest, slight risk

    // Calculate reliability rate
    const reliabilityRate = (completed / total) * 100;
    const noShowRate = (noShows / total) * 100;

    let score = 50; // Base score

    // Positive history
    if (completed >= 5) score += 35;        // Very loyal guest
    else if (completed >= 3) score += 25;   // Returning guest
    else if (completed >= 1) score += 15;   // Has stayed before

    // Negative history
    if (noShowRate >= 50) score -= 40;      // Chronic no-show
    else if (noShows >= 2) score -= 30;     // Multiple no-shows
    else if (noShows >= 1) score -= 20;     // One no-show

    // High cancellation rate
    if (cancelled >= 3 && cancelled > completed) score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Communication score (0-100, higher = lower risk)
   * Based on guest responsiveness and recent contact
   */
  private async calculateCommunicationScore(reservationId: string): Promise<number> {
    const communications = await this.prisma.communication.findMany({
      where: { reservationId },
      select: { direction: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (communications.length === 0) return 40; // No communication

    const inbound = communications.filter((c) => c.direction === "inbound").length;
    const outbound = communications.filter((c) => c.direction === "outbound").length;

    let score = 50; // Base score

    // Guest has responded
    if (inbound > 0) score += 25;

    // Recent communication (within 7 days)
    const recentComm = communications.find(
      (c) => new Date(c.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
    );
    if (recentComm) score += 15;

    // Response ratio
    if (outbound > 0 && inbound > 0) {
      const responseRate = inbound / outbound;
      if (responseRate >= 0.8) score += 10;
      else if (responseRate >= 0.5) score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Booking source score (0-100, higher = lower risk)
   */
  private calculateBookingSourceScore(reservation: any): number {
    const source = reservation.source || "unknown";

    const sourceScores: Record<string, number> = {
      direct: 85,           // Direct booking = high commitment
      admin: 80,            // Staff-created = verified
      repeat: 90,           // Returning customer
      referral: 85,         // Referred = committed
      online: 70,           // Standard online
      phone: 75,            // Phone = slightly higher
      walk_in: 65,          // Walk-in = less commitment
      third_party: 50,      // OTA = higher risk
      unknown: 55,
    };

    return sourceScores[source] || 55;
  }

  // ==================== ACTIONS ====================

  /**
   * Send a confirmation reminder for a high-risk reservation
   */
  async sendReminder(reservationId: string) {
    const risk = await this.getRisk(reservationId);

    if (!risk || !risk.reservation) {
      throw new NotFoundException("Risk record or reservation not found");
    }

    const reservation = risk.reservation;
    const guestEmail = (reservation as any).guest?.email;

    if (!guestEmail) {
      throw new BadRequestException("Guest has no email address");
    }

    const campground = await this.prisma.campground.findUnique({
      where: { id: (reservation as any).campgroundId || "" },
      select: { name: true, phone: true },
    });

    const arrivalDate = new Date(reservation.arrivalDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #0f172a; margin: 0;">Confirmation Reminder</h1>
          <p style="color: #64748b; margin-top: 8px;">Please confirm your upcoming stay</p>
        </div>

        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 12px; padding: 24px; color: white; margin-bottom: 24px;">
          <p style="margin: 0 0 8px 0; opacity: 0.9;">Your Arrival Date</p>
          <p style="margin: 0; font-size: 24px; font-weight: bold;">${arrivalDate}</p>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <p style="margin: 0; color: #334155; line-height: 1.6;">
            Hi ${(reservation as any).guest?.primaryFirstName || "there"},
          </p>
          <p style="margin: 16px 0 0 0; color: #334155; line-height: 1.6;">
            We're looking forward to hosting you at ${campground?.name}! To ensure your site is ready, please confirm that you'll be arriving as planned.
          </p>
          <p style="margin: 16px 0 0 0; color: #334155; line-height: 1.6;">
            If your plans have changed, please let us know so we can assist you with modifications or cancellation.
          </p>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 16px;">Reservation Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Confirmation #</td>
              <td style="padding: 8px 0; color: #0f172a; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${reservation.confirmationNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Site</td>
              <td style="padding: 8px 0; color: #0f172a; text-align: right; border-bottom: 1px solid #f1f5f9;">${(reservation as any).site?.name || "Assigned at check-in"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Arrival</td>
              <td style="padding: 8px 0; color: #0f172a; text-align: right;">${arrivalDate}</td>
            </tr>
          </table>
        </div>

        ${campground?.phone ? `
          <div style="text-align: center; margin-bottom: 24px;">
            <p style="color: #64748b; font-size: 14px; margin: 0;">
              Questions? Call us at <strong>${campground.phone}</strong>
            </p>
          </div>
        ` : ""}

        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">
            ${campground?.name} • Powered by Keepr
          </p>
        </div>
      </div>
    `;

    await this.emailService.sendEmail({
      to: guestEmail,
      subject: `Please Confirm Your Stay - ${campground?.name}`,
      html,
      reservationId,
      guestId: (reservation as any).guestId,
    });

    // Update the risk record
    await this.prisma.aiNoShowRisk.update({
      where: { reservationId },
      data: { reminderSentAt: new Date() },
    });

    return { sent: true, to: guestEmail };
  }

  /**
   * Mark a reservation as confirmed (guest responded)
   */
  async markConfirmed(reservationId: string, source?: string) {
    const risk = await this.prisma.aiNoShowRisk.findUnique({
      where: { reservationId },
    });

    if (!risk) {
      throw new NotFoundException("Risk record not found");
    }

    return this.prisma.aiNoShowRisk.update({
      where: { reservationId },
      data: {
        guestConfirmed: true,
        guestConfirmedAt: new Date(),
        confirmationSource: source || "manual",
        // Reduce risk score since guest confirmed
        riskScore: Math.max(0, risk.riskScore - 0.3),
        flagged: false,
      },
    });
  }

  // ==================== BATCH OPERATIONS ====================

  /**
   * Recalculate risks for all upcoming reservations
   */
  async recalculateAll(campgroundId: string, daysAhead = 7) {
    const config = await this.configService.getConfig(campgroundId);

    if (!config.noShowPredictionEnabled) {
      return { calculated: 0, flagged: 0 };
    }

    const arrivalBefore = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: "confirmed",
        arrivalDate: {
          gte: new Date(),
          lte: arrivalBefore,
        },
      },
      select: { id: true },
    });

    let calculated = 0;
    let flagged = 0;

    for (const reservation of reservations) {
      try {
        const risk = await this.calculateRisk(reservation.id);
        if (risk) {
          calculated++;
          if (risk.flagged) flagged++;
        }
      } catch (error) {
        this.logger.warn(`Failed to calculate risk for ${reservation.id}: ${error}`);
      }
    }

    return { calculated, flagged, total: reservations.length };
  }

  // ==================== SCHEDULED JOBS ====================

  /**
   * Recalculate risks for upcoming arrivals (2 AM daily)
   */
  @Cron("0 2 * * *")
  async recalculateUpcomingRisks() {
    this.logger.log("Recalculating no-show risks for upcoming arrivals...");

    const configs = await this.prisma.aiAutopilotConfig.findMany({
      where: { noShowPredictionEnabled: true },
      select: { campgroundId: true, noShowReminderDaysBefore: true },
    });

    let totalCalculated = 0;
    let totalFlagged = 0;

    for (const config of configs) {
      try {
        const result = await this.recalculateAll(
          config.campgroundId,
          config.noShowReminderDaysBefore + 2 // A bit more than reminder window
        );
        totalCalculated += result.calculated;
        totalFlagged += result.flagged;
      } catch (error) {
        this.logger.error(`Failed to recalculate for ${config.campgroundId}: ${error}`);
      }
    }

    this.logger.log(`Risk recalculation complete: ${totalCalculated} calculated, ${totalFlagged} flagged`);
  }

  /**
   * Send auto-reminders for flagged reservations (9 AM daily)
   */
  @Cron("0 9 * * *")
  async sendAutoReminders() {
    this.logger.log("Sending auto-reminders for high-risk reservations...");

    const configs = await this.prisma.aiAutopilotConfig.findMany({
      where: {
        noShowPredictionEnabled: true,
        noShowAutoReminder: true,
      },
      select: { campgroundId: true, noShowReminderDaysBefore: true },
    });

    let sent = 0;

    for (const config of configs) {
      try {
        // Find flagged reservations arriving within the reminder window
        const reminderWindow = new Date(
          Date.now() + config.noShowReminderDaysBefore * 24 * 60 * 60 * 1000
        );

        const risks = await this.prisma.aiNoShowRisk.findMany({
          where: {
            flagged: true,
            reminderSentAt: null, // Haven't sent reminder yet
            guestConfirmed: false,
            reservation: {
              campgroundId: config.campgroundId,
              status: "confirmed",
              arrivalDate: {
                gte: new Date(),
                lte: reminderWindow,
              },
            },
          },
          select: { reservationId: true },
          take: 50, // Limit per campground per day
        });

        for (const risk of risks) {
          try {
            await this.sendReminder(risk.reservationId);
            sent++;
          } catch (error) {
            this.logger.warn(`Failed to send reminder for ${risk.reservationId}: ${error}`);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to process reminders for ${config.campgroundId}: ${error}`);
      }
    }

    this.logger.log(`Auto-reminders sent: ${sent}`);
  }
}
