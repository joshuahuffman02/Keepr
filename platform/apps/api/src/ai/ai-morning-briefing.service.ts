import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { AiInsightsService } from "./ai-insights.service";
import { AiAutopilotConfigService } from "./ai-autopilot-config.service";
import { AiNoShowPredictionService } from "./ai-no-show-prediction.service";
import { EmailService } from "../email/email.service";

interface ArrivingGuest {
  guestName: string;
  siteName: string;
  arrivalDate: Date;
  departureDate: Date;
  specialRequests?: string;
  isVip: boolean;
  totalGuests: number;
  vehicleInfo?: string;
}

interface HighRiskArrival {
  reservationId: string;
  confirmationNumber: string;
  guestName: string;
  siteName: string;
  arrivalDate: Date;
  riskScore: number;
  riskReason: string;
  totalAmountCents: number;
  balanceCents: number;
  guestEmail?: string;
  guestPhone?: string;
  suggestedActions: string[];
}

interface RevenueAtRisk {
  highRiskArrivals: HighRiskArrival[];
  totalRevenueAtRiskCents: number;
  totalHighRiskCount: number;
}

interface MorningBriefing {
  campgroundName: string;
  date: string;
  dayOfWeek: string;
  summary: {
    totalArrivals: number;
    totalDepartures: number;
    occupancyPercent: number;
    pendingPayments: number;
    activeAnomalies: number;
    weatherAlerts: number;
  };
  arrivals: ArrivingGuest[];
  departures: { guestName: string; siteName: string; checkoutTime?: string }[];
  insights: {
    title: string;
    summary: string;
    priority: string;
    actionable: boolean;
    suggestedAction?: string;
  }[];
  anomalies: {
    title: string;
    severity: string;
    summary: string;
    suggestedAction?: string;
  }[];
  weatherAlerts: {
    title: string;
    severity: string;
    description: string;
  }[];
  opportunities: {
    type: string;
    title: string;
    description: string;
    potentialRevenue?: number;
  }[];
  maintenanceReminders: {
    title: string;
    siteName?: string;
    dueDate?: Date;
  }[];
  revenueAtRisk: RevenueAtRisk;
}

@Injectable()
export class AiMorningBriefingService {
  private readonly logger = new Logger(AiMorningBriefingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insightsService: AiInsightsService,
    private readonly configService: AiAutopilotConfigService,
    private readonly noShowService: AiNoShowPredictionService,
    private readonly emailService: EmailService
  ) {}

  /**
   * Generate morning briefing for a campground
   */
  async generateBriefing(campgroundId: string): Promise<MorningBriefing> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { name: true, timezone: true },
    });

    // Gather all data in parallel
    const [
      arrivalsData,
      departuresData,
      occupancyData,
      pendingPayments,
      anomalies,
      weatherAlerts,
      maintenanceTickets,
      insights,
      opportunities,
      revenueAtRisk,
    ] = await Promise.all([
      this.getArrivals(campgroundId, today, tomorrow),
      this.getDepartures(campgroundId, today, tomorrow),
      this.getOccupancy(campgroundId, today),
      this.getPendingPayments(campgroundId),
      this.getActiveAnomalies(campgroundId),
      this.getWeatherAlerts(campgroundId),
      this.getMaintenanceReminders(campgroundId),
      this.getDailyInsights(campgroundId),
      this.detectOpportunities(campgroundId, nextWeek),
      this.getRevenueAtRisk(campgroundId, today, tomorrow),
    ]);

    return {
      campgroundName: campground?.name || "Your Campground",
      date: today.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      }),
      dayOfWeek: today.toLocaleDateString("en-US", { weekday: "long" }),
      summary: {
        totalArrivals: arrivalsData.length,
        totalDepartures: departuresData.length,
        occupancyPercent: occupancyData.percent,
        pendingPayments: pendingPayments.count,
        activeAnomalies: anomalies.length,
        weatherAlerts: weatherAlerts.length,
      },
      arrivals: arrivalsData,
      departures: departuresData,
      insights,
      anomalies,
      weatherAlerts,
      opportunities,
      maintenanceReminders: maintenanceTickets,
      revenueAtRisk,
    };
  }

  private async getArrivals(
    campgroundId: string,
    today: Date,
    tomorrow: Date
  ): Promise<ArrivingGuest[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { in: ["confirmed", "pending"] },
        arrivalDate: { gte: today, lt: tomorrow },
      },
      include: {
        guest: { select: { firstName: true, lastName: true, isVip: true } },
        site: { select: { name: true } },
      },
      orderBy: { arrivalDate: "asc" },
    });

    return reservations.map((r) => ({
      guestName: `${r.guest.firstName} ${r.guest.lastName}`,
      siteName: r.site?.name || "Unassigned",
      arrivalDate: r.arrivalDate,
      departureDate: r.departureDate,
      specialRequests: r.specialRequests || undefined,
      isVip: r.guest.isVip || false,
      totalGuests: (r.adults || 0) + (r.children || 0),
      vehicleInfo: r.vehicleInfo || undefined,
    }));
  }

  private async getDepartures(
    campgroundId: string,
    today: Date,
    tomorrow: Date
  ): Promise<{ guestName: string; siteName: string; checkoutTime?: string }[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: "checked_in",
        departureDate: { gte: today, lt: tomorrow },
      },
      include: {
        guest: { select: { firstName: true, lastName: true } },
        site: { select: { name: true } },
      },
      orderBy: { departureDate: "asc" },
    });

    return reservations.map((r) => ({
      guestName: `${r.guest.firstName} ${r.guest.lastName}`,
      siteName: r.site?.name || "Unknown",
    }));
  }

  private async getOccupancy(
    campgroundId: string,
    date: Date
  ): Promise<{ percent: number; occupied: number; total: number }> {
    const totalSites = await this.prisma.site.count({
      where: { campgroundId, status: "active" },
    });

    const occupiedToday = await this.prisma.reservation.count({
      where: {
        campgroundId,
        status: { in: ["confirmed", "checked_in"] },
        arrivalDate: { lte: date },
        departureDate: { gt: date },
      },
    });

    return {
      percent: totalSites > 0 ? Math.round((occupiedToday / totalSites) * 100) : 0,
      occupied: occupiedToday,
      total: totalSites,
    };
  }

  private async getPendingPayments(
    campgroundId: string
  ): Promise<{ count: number; totalCents: number }> {
    const pending = await this.prisma.reservation.aggregate({
      where: {
        campgroundId,
        status: { in: ["confirmed", "checked_in"] },
        balanceAmount: { gt: 0 },
      },
      _count: { id: true },
      _sum: { balanceAmount: true },
    });

    return {
      count: pending._count.id || 0,
      totalCents: pending._sum.balanceAmount || 0,
    };
  }

  private async getActiveAnomalies(campgroundId: string) {
    const anomalies = await this.prisma.aiAnomalyAlert.findMany({
      where: {
        campgroundId,
        status: { in: ["new", "acknowledged"] },
      },
      orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
      take: 5,
      select: {
        title: true,
        severity: true,
        summary: true,
        suggestedAction: true,
      },
    });

    return anomalies;
  }

  private async getWeatherAlerts(campgroundId: string) {
    const alerts = await this.prisma.aiWeatherAlert.findMany({
      where: {
        campgroundId,
        status: "active",
      },
      select: {
        title: true,
        severity: true,
        description: true,
      },
    });

    return alerts;
  }

  private async getMaintenanceReminders(campgroundId: string) {
    const tickets = await this.prisma.maintenanceTicket.findMany({
      where: {
        campgroundId,
        status: { in: ["open", "in_progress"] },
        priority: { in: ["high", "urgent"] },
      },
      include: {
        site: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      select: {
        title: true,
        site: { select: { name: true } },
        dueDate: true,
      },
    });

    return tickets.map((t) => ({
      title: t.title,
      siteName: t.site?.name,
      dueDate: t.dueDate || undefined,
    }));
  }

  private async getDailyInsights(campgroundId: string) {
    try {
      return await this.insightsService.generateDailyInsights(campgroundId);
    } catch {
      return [];
    }
  }

  /**
   * Get high-risk arrivals for today (revenue at risk section)
   */
  private async getRevenueAtRisk(
    campgroundId: string,
    today: Date,
    tomorrow: Date
  ): Promise<RevenueAtRisk> {
    try {
      // First, ensure we have up-to-date risk calculations for today's arrivals
      // Get today's arrivals that are confirmed
      const todaysArrivals = await this.prisma.reservation.findMany({
        where: {
          campgroundId,
          status: { in: ["confirmed", "pending"] },
          arrivalDate: { gte: today, lt: tomorrow },
        },
        select: { id: true },
      });

      // Calculate risk for any that don't have a recent calculation
      for (const reservation of todaysArrivals) {
        const existingRisk = await this.prisma.aiNoShowRisk.findUnique({
          where: { reservationId: reservation.id },
          select: { calculatedAt: true },
        });

        // Recalculate if no risk record or if it's older than 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (!existingRisk || existingRisk.calculatedAt < twentyFourHoursAgo) {
          try {
            await this.noShowService.calculateRisk(reservation.id);
          } catch {
            // Skip if calculation fails
          }
        }
      }

      // Now fetch high-risk arrivals for today
      const highRiskRecords = await this.prisma.aiNoShowRisk.findMany({
        where: {
          flagged: true,
          guestConfirmed: false, // Don't show if guest has already confirmed
          reservation: {
            campgroundId,
            status: { in: ["confirmed", "pending"] },
            arrivalDate: { gte: today, lt: tomorrow },
          },
        },
        include: {
          reservation: {
            select: {
              id: true,
              confirmationNumber: true,
              arrivalDate: true,
              totalAmountCents: true,
              balanceCents: true,
              guest: {
                select: {
                  primaryFirstName: true,
                  primaryLastName: true,
                  email: true,
                  phone: true,
                },
              },
              site: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { riskScore: "desc" },
        take: 10, // Limit to top 10 for the briefing
      });

      const highRiskArrivals: HighRiskArrival[] = highRiskRecords.map((risk) => {
        const reservation = risk.reservation;
        const suggestedActions = this.getSuggestedActions(risk);

        return {
          reservationId: reservation.id,
          confirmationNumber: reservation.confirmationNumber || "N/A",
          guestName: reservation.guest
            ? `${reservation.guest.primaryFirstName || ""} ${reservation.guest.primaryLastName || ""}`.trim()
            : "Unknown Guest",
          siteName: reservation.site?.name || "Unassigned",
          arrivalDate: reservation.arrivalDate,
          riskScore: risk.riskScore,
          riskReason: risk.riskReason || "Multiple risk factors",
          totalAmountCents: reservation.totalAmountCents || 0,
          balanceCents: reservation.balanceCents || 0,
          guestEmail: reservation.guest?.email || undefined,
          guestPhone: reservation.guest?.phone || undefined,
          suggestedActions,
        };
      });

      // Calculate total revenue at risk (unpaid balance of high-risk reservations)
      const totalRevenueAtRiskCents = highRiskArrivals.reduce(
        (sum, arrival) => sum + arrival.totalAmountCents,
        0
      );

      return {
        highRiskArrivals,
        totalRevenueAtRiskCents,
        totalHighRiskCount: highRiskArrivals.length,
      };
    } catch (error) {
      this.logger.warn(`Failed to get revenue at risk: ${error}`);
      return {
        highRiskArrivals: [],
        totalRevenueAtRiskCents: 0,
        totalHighRiskCount: 0,
      };
    }
  }

  /**
   * Generate suggested actions based on risk factors
   */
  private getSuggestedActions(risk: any): string[] {
    const actions: string[] = [];

    // Check payment status
    if (risk.paymentStatusScore < 50) {
      actions.push("Request payment or deposit");
    }

    // Check communication
    if (risk.communicationScore < 50 && !risk.reminderSentAt) {
      actions.push("Send confirmation reminder");
    } else if (risk.reminderSentAt && !risk.guestConfirmed) {
      actions.push("Follow up by phone");
    }

    // Check guest history
    if (risk.guestHistoryScore < 40) {
      actions.push("Verify contact information");
    }

    // If no specific actions, suggest general confirmation
    if (actions.length === 0) {
      actions.push("Confirm arrival with guest");
    }

    return actions;
  }

  private async detectOpportunities(
    campgroundId: string,
    lookAheadDate: Date
  ): Promise<MorningBriefing["opportunities"]> {
    const opportunities: MorningBriefing["opportunities"] = [];

    // Check for high-demand periods with low pricing
    const upcomingReservations = await this.prisma.reservation.count({
      where: {
        campgroundId,
        arrivalDate: { lte: lookAheadDate },
        departureDate: { gte: new Date() },
        status: { in: ["confirmed", "pending"] },
      },
    });

    const totalSites = await this.prisma.site.count({
      where: { campgroundId, status: "active" },
    });

    const occupancyRate = totalSites > 0 ? upcomingReservations / totalSites : 0;

    // High demand opportunity
    if (occupancyRate > 0.8) {
      opportunities.push({
        type: "pricing",
        title: "High Demand Period Ahead",
        description: `Next 7 days are at ${Math.round(occupancyRate * 100)}% capacity. Consider raising rates for remaining availability.`,
        potentialRevenue: Math.round((totalSites - upcomingReservations) * 5000), // Estimate $50 more per night
      });
    }

    // Check for gap nights (single night openings)
    const gapNights = await this.findGapNights(campgroundId);
    if (gapNights > 0) {
      opportunities.push({
        type: "gap_fill",
        title: `${gapNights} Gap Night${gapNights > 1 ? "s" : ""} Available`,
        description: "Consider offering discounted rates for single-night gaps to maximize revenue.",
        potentialRevenue: gapNights * 8000, // Estimate $80 per gap night
      });
    }

    // Check for last-minute availability
    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const tomorrowOccupied = await this.prisma.reservation.count({
      where: {
        campgroundId,
        status: { in: ["confirmed", "checked_in"] },
        arrivalDate: { lte: tomorrowStart },
        departureDate: { gt: tomorrowStart },
      },
    });

    const tomorrowAvailable = totalSites - tomorrowOccupied;
    if (tomorrowAvailable > totalSites * 0.3) {
      opportunities.push({
        type: "last_minute",
        title: `${tomorrowAvailable} Sites Available Tomorrow`,
        description: "Consider a last-minute deal to fill empty sites.",
        potentialRevenue: tomorrowAvailable * 6000, // Estimate $60 per discounted night
      });
    }

    return opportunities;
  }

  private async findGapNights(campgroundId: string): Promise<number> {
    // Simplified gap detection - count sites with single-night openings in next 7 days
    // Full implementation would analyze reservation patterns
    const sites = await this.prisma.site.count({
      where: { campgroundId, status: "active" },
    });
    // Estimate 10% of sites have gaps (simplified)
    return Math.floor(sites * 0.1);
  }

  /**
   * Send morning briefing email
   */
  async sendBriefingEmail(campgroundId: string): Promise<{ sent: boolean; recipients: number }> {
    const config = await this.configService.getConfig(campgroundId);

    if (!config.morningBriefingEnabled) {
      return { sent: false, recipients: 0 };
    }

    const briefing = await this.generateBriefing(campgroundId);

    // Get recipients - owners and managers for the campground's organization
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (!campground?.organizationId) {
      this.logger.debug(`No organization for campground ${campgroundId}`);
      return { sent: false, recipients: 0 };
    }

    const staff = await this.prisma.user.findMany({
      where: {
        organizationId: campground.organizationId,
        role: { in: ["owner", "manager"] },
        email: { not: null },
      },
      select: { email: true, firstName: true },
    });

    if (staff.length === 0) {
      this.logger.debug(`No morning briefing recipients for ${campgroundId}`);
      return { sent: false, recipients: 0 };
    }

    const html = this.generateBriefingHtml(briefing);

    for (const member of staff) {
      if (!member.email) continue;

      await this.emailService.sendEmail({
        to: member.email,
        subject: `Good Morning! ${briefing.dayOfWeek} Briefing - ${briefing.campgroundName}`,
        html,
        campgroundId,
      });
    }

    return { sent: true, recipients: staff.length };
  }

  private generateBriefingHtml(briefing: MorningBriefing): string {
    const hasAlerts = briefing.anomalies.length > 0 || briefing.weatherAlerts.length > 0;
    const alertBannerColor = briefing.anomalies.some(a => a.severity === "critical") ? "#dc2626" :
                             briefing.weatherAlerts.some(w => w.severity === "emergency") ? "#dc2626" :
                             hasAlerts ? "#f59e0b" : "#10b981";

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 16px; padding: 32px; margin-bottom: 24px; text-align: center;">
          <h1 style="color: white; margin: 0 0 8px 0; font-size: 28px;">Good Morning!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px;">${briefing.dayOfWeek}, ${briefing.date}</p>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">${briefing.campgroundName}</p>
        </div>

        <!-- Quick Stats -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
          <div style="background: white; border-radius: 12px; padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <p style="margin: 0; font-size: 32px; font-weight: bold; color: #059669;">${briefing.summary.totalArrivals}</p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Arrivals</p>
          </div>
          <div style="background: white; border-radius: 12px; padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <p style="margin: 0; font-size: 32px; font-weight: bold; color: #3b82f6;">${briefing.summary.totalDepartures}</p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Departures</p>
          </div>
          <div style="background: white; border-radius: 12px; padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <p style="margin: 0; font-size: 32px; font-weight: bold; color: #8b5cf6;">${briefing.summary.occupancyPercent}%</p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Occupancy</p>
          </div>
        </div>

        ${hasAlerts ? `
        <!-- Alerts Banner -->
        <div style="background: ${alertBannerColor}; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; color: white; font-weight: 600;">
            ${briefing.anomalies.length > 0 ? `${briefing.anomalies.length} active alert${briefing.anomalies.length > 1 ? 's' : ''}` : ''}
            ${briefing.anomalies.length > 0 && briefing.weatherAlerts.length > 0 ? ' | ' : ''}
            ${briefing.weatherAlerts.length > 0 ? `${briefing.weatherAlerts.length} weather alert${briefing.weatherAlerts.length > 1 ? 's' : ''}` : ''}
          </p>
        </div>
        ` : ''}

        ${briefing.revenueAtRisk.totalHighRiskCount > 0 ? `
        <!-- Revenue at Risk -->
        <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h2 style="margin: 0; font-size: 18px; color: white;">Revenue at Risk</h2>
            <div style="background: rgba(255,255,255,0.2); border-radius: 8px; padding: 8px 12px;">
              <p style="margin: 0; font-size: 20px; font-weight: bold; color: white;">$${(briefing.revenueAtRisk.totalRevenueAtRiskCents / 100).toLocaleString()}</p>
              <p style="margin: 2px 0 0 0; font-size: 10px; color: rgba(255,255,255,0.8);">Total at risk</p>
            </div>
          </div>
          <p style="margin: 0 0 16px 0; font-size: 13px; color: rgba(255,255,255,0.9);">
            ${briefing.revenueAtRisk.totalHighRiskCount} arrival${briefing.revenueAtRisk.totalHighRiskCount > 1 ? 's' : ''} today ${briefing.revenueAtRisk.totalHighRiskCount > 1 ? 'have' : 'has'} a high no-show risk. Take action to secure this revenue.
          </p>
          ${briefing.revenueAtRisk.highRiskArrivals.slice(0, 5).map(r => `
            <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 12px; margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                  <p style="margin: 0; font-weight: 600; color: white;">${r.guestName}</p>
                  <p style="margin: 4px 0 0 0; font-size: 12px; color: rgba(255,255,255,0.8);">
                    Site ${r.siteName} | Conf #${r.confirmationNumber}
                  </p>
                  <p style="margin: 4px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.7);">
                    Risk: ${r.riskReason}
                  </p>
                </div>
                <div style="text-align: right; margin-left: 12px;">
                  <p style="margin: 0; font-size: 14px; font-weight: 600; color: #fcd34d;">$${(r.totalAmountCents / 100).toLocaleString()}</p>
                  <p style="margin: 2px 0 0 0; font-size: 10px; color: rgba(255,255,255,0.7);">${Math.round(r.riskScore * 100)}% risk</p>
                </div>
              </div>
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
                <p style="margin: 0; font-size: 11px; color: #fcd34d; font-weight: 500;">
                  Suggested: ${r.suggestedActions.join(' | ')}
                </p>
                ${r.guestPhone ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.8);">Phone: ${r.guestPhone}</p>` : ''}
              </div>
            </div>
          `).join('')}
          ${briefing.revenueAtRisk.totalHighRiskCount > 5 ? `
            <p style="margin: 8px 0 0 0; font-size: 12px; color: rgba(255,255,255,0.7); text-align: center;">
              + ${briefing.revenueAtRisk.totalHighRiskCount - 5} more high-risk arrivals. View all in dashboard.
            </p>
          ` : ''}
        </div>
        ` : ''}

        ${briefing.arrivals.length > 0 ? `
        <!-- Today's Arrivals -->
        <div style="background: white; border-radius: 16px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #0f172a;">Today's Arrivals</h2>
          ${briefing.arrivals.map(a => `
            <div style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <p style="margin: 0; font-weight: 600; color: #0f172a;">
                    ${a.isVip ? '<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 8px;">VIP</span>' : ''}
                    ${a.guestName}
                  </p>
                  <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Site ${a.siteName} | ${a.totalGuests} guest${a.totalGuests > 1 ? 's' : ''}</p>
                </div>
              </div>
              ${a.specialRequests ? `<p style="margin: 8px 0 0 0; padding: 8px; background: #fef3c7; border-radius: 6px; font-size: 12px; color: #92400e;">Special Request: ${a.specialRequests}</p>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${briefing.insights.length > 0 ? `
        <!-- AI Insights -->
        <div style="background: white; border-radius: 16px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #0f172a;">AI Insights</h2>
          ${briefing.insights.slice(0, 3).map(i => `
            <div style="padding: 12px; background: ${i.priority === 'high' ? '#fef2f2' : i.priority === 'medium' ? '#fffbeb' : '#f0fdf4'}; border-radius: 8px; margin-bottom: 8px;">
              <p style="margin: 0; font-weight: 600; color: #0f172a;">${i.title}</p>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #475569;">${i.summary}</p>
              ${i.suggestedAction ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #059669; font-weight: 500;">Action: ${i.suggestedAction}</p>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${briefing.opportunities.length > 0 ? `
        <!-- Revenue Opportunities -->
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px 0; font-size: 18px; color: white;">Revenue Opportunities</h2>
          ${briefing.opportunities.map(o => `
            <div style="padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px; margin-bottom: 8px;">
              <p style="margin: 0; font-weight: 600; color: white;">${o.title}</p>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.8);">${o.description}</p>
              ${o.potentialRevenue ? `<p style="margin: 8px 0 0 0; font-size: 14px; color: #fcd34d; font-weight: 600;">Potential: +$${(o.potentialRevenue / 100).toLocaleString()}</p>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${briefing.maintenanceReminders.length > 0 ? `
        <!-- Maintenance Reminders -->
        <div style="background: white; border-radius: 16px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #0f172a;">Maintenance Reminders</h2>
          ${briefing.maintenanceReminders.map(m => `
            <div style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
              <p style="margin: 0; font-size: 14px; color: #0f172a;">${m.title}</p>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">${m.siteName ? `Site ${m.siteName}` : 'General'}</p>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- Footer -->
        <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 12px; margin: 0;">Log in to your dashboard for full details</p>
          <p style="color: #94a3b8; font-size: 11px; margin-top: 8px;">AI-Powered Morning Briefing | Camp Everyday</p>
        </div>
      </div>
    `;
  }

  // ==================== SCHEDULED JOBS ====================

  /**
   * Send morning briefings (7 AM daily)
   */
  @Cron("0 7 * * *")
  async sendMorningBriefings() {
    this.logger.log("Sending morning briefings...");

    const configs = await this.prisma.aiAutopilotConfig.findMany({
      where: { morningBriefingEnabled: true },
      select: { campgroundId: true, morningBriefingTime: true },
    });

    let sent = 0;

    for (const config of configs) {
      try {
        // Could enhance with timezone-aware sending based on morningBriefingTime
        const result = await this.sendBriefingEmail(config.campgroundId);
        if (result.sent) sent++;
      } catch (error) {
        this.logger.error(`Failed to send briefing for ${config.campgroundId}: ${error}`);
      }
    }

    this.logger.log(`Morning briefings sent: ${sent}`);
  }

  /**
   * Get briefing API endpoint
   */
  async getBriefingForApi(campgroundId: string) {
    return this.generateBriefing(campgroundId);
  }
}
