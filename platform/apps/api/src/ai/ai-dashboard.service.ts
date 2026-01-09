import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";

/**
 * AI Dashboard Service
 *
 * Aggregates metrics and provides real-time AI activity data for the dashboard.
 * Tracks ROI, token usage, and all AI feature performance.
 */

@Injectable()
export class AiDashboardService {
  private readonly logger = new Logger(AiDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== REAL-TIME ACTIVITY ====================

  /**
   * Get recent AI activity feed for dashboard
   */
  async getActivityFeed(campgroundId: string, limit: number = 20) {
    // Get various AI activities and merge them
    const [
      autoReplies,
      waitlistOffers,
      anomalies,
      pricingRecs,
      maintenanceAlerts,
      weatherAlerts,
      phoneSessions,
      autonomousActions,
    ] = await Promise.all([
      // Recent auto-replies
      this.prisma.aiReplyDraft.findMany({
        where: { campgroundId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          confidence: true,
          detectedIntent: true,
          createdAt: true,
        },
      }),

      // Recent waitlist scores
      this.prisma.aiWaitlistScore.findMany({
        where: { campgroundId },
        orderBy: { calculatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          aiScore: true,
          calculatedAt: true,
        },
      }),

      // Recent anomalies
      this.prisma.aiAnomalyAlert.findMany({
        where: { campgroundId },
        orderBy: { detectedAt: "desc" },
        take: 10,
        select: {
          id: true,
          type: true,
          severity: true,
          title: true,
          status: true,
          detectedAt: true,
        },
      }),

      // Recent pricing recommendations
      this.prisma.aiPricingRecommendation.findMany({
        where: { campgroundId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          recommendationType: true,
          adjustmentPercent: true,
          status: true,
          createdAt: true,
        },
      }),

      // Recent maintenance alerts
      this.prisma.aiMaintenanceAlert.findMany({
        where: { campgroundId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          severity: true,
          category: true,
          status: true,
          createdAt: true,
        },
      }),

      // Recent weather alerts
      this.prisma.aiWeatherAlert.findMany({
        where: { campgroundId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          alertType: true,
          severity: true,
          guestsNotified: true,
          createdAt: true,
        },
      }),

      // Recent phone sessions
      this.prisma.aiPhoneSession.findMany({
        where: { campgroundId },
        orderBy: { startedAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          intents: true,
          durationSeconds: true,
          startedAt: true,
        },
      }),

      // Recent autonomous actions
      this.prisma.aiAutonomousAction.findMany({
        where: { campgroundId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          actionType: true,
          description: true,
          outcome: true,
          createdAt: true,
        },
      }),
    ]);

    // Transform and merge into unified activity feed
    const activities: any[] = [];

    for (const item of autoReplies) {
      activities.push({
        id: item.id,
        type: "auto_reply",
        title: `AI drafted reply (${item.detectedIntent})`,
        subtitle: item.status === "auto_sent" ? "Auto-sent" : `Status: ${item.status}`,
        confidence: item.confidence,
        timestamp: item.createdAt,
        icon: "message-circle",
        color: item.status === "auto_sent" ? "green" : "blue",
      });
    }

    for (const item of anomalies) {
      activities.push({
        id: item.id,
        type: "anomaly",
        title: item.title,
        subtitle: `${item.severity} severity`,
        timestamp: item.detectedAt,
        icon: "alert-triangle",
        color: item.severity === "critical" ? "red" : item.severity === "high" ? "orange" : "yellow",
      });
    }

    for (const item of pricingRecs) {
      activities.push({
        id: item.id,
        type: "pricing",
        title: `${item.recommendationType}: ${item.adjustmentPercent > 0 ? "+" : ""}${item.adjustmentPercent}%`,
        subtitle: item.status === "applied" ? "Applied" : "Pending review",
        timestamp: item.createdAt,
        icon: "dollar-sign",
        color: item.status === "applied" ? "green" : "purple",
      });
    }

    for (const item of maintenanceAlerts) {
      activities.push({
        id: item.id,
        type: "maintenance",
        title: item.title,
        subtitle: `${item.category} - ${item.severity}`,
        timestamp: item.createdAt,
        icon: "tool",
        color: item.severity === "critical" ? "red" : "orange",
      });
    }

    for (const item of weatherAlerts) {
      activities.push({
        id: item.id,
        type: "weather",
        title: item.title,
        subtitle: item.guestsNotified > 0 ? `${item.guestsNotified} guests notified` : item.alertType,
        timestamp: item.createdAt,
        icon: "cloud-rain",
        color: item.severity === "emergency" ? "red" : "blue",
      });
    }

    for (const item of phoneSessions) {
      activities.push({
        id: item.id,
        type: "phone",
        title: `Phone call ${item.status}`,
        subtitle: item.durationSeconds ? `${Math.round(item.durationSeconds / 60)} min` : item.intents.join(", "),
        timestamp: item.startedAt,
        icon: "phone",
        color: item.status === "completed" ? "green" : item.status === "transferred" ? "blue" : "gray",
      });
    }

    for (const item of autonomousActions) {
      activities.push({
        id: item.id,
        type: "autonomous",
        title: item.description,
        subtitle: `${item.actionType} - ${item.outcome}`,
        timestamp: item.createdAt,
        icon: "zap",
        color: item.outcome === "success" ? "green" : "yellow",
      });
    }

    // Sort by timestamp and limit
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return activities.slice(0, limit);
  }

  // ==================== METRICS ====================

  /**
   * Get or calculate metrics for a period
   */
  async getMetrics(
    campgroundId: string,
    periodDays: number = 30
  ) {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);
    periodStart.setHours(0, 0, 0, 0);

    const periodEnd = new Date();

    // Check for cached metrics
    const cached = await this.prisma.aiDashboardMetrics.findFirst({
      where: {
        campgroundId,
        periodStart,
        periodEnd: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) }, // Within 6 hours
      },
      orderBy: { calculatedAt: "desc" },
    });

    if (cached) return cached;

    // Calculate fresh metrics
    return this.calculateMetrics(campgroundId, periodStart, periodEnd);
  }

  /**
   * Calculate metrics for a period
   */
  async calculateMetrics(
    campgroundId: string,
    periodStart: Date,
    periodEnd: Date
  ) {
    const [
      messages,
      risks,
      pricing,
      phone,
      waitlist,
      autonomous,
    ] = await Promise.all([
      // Message metrics
      this.getMessageMetrics(campgroundId, periodStart, periodEnd),

      // Risk metrics
      this.getRiskMetrics(campgroundId, periodStart, periodEnd),

      // Pricing metrics
      this.getPricingMetrics(campgroundId, periodStart, periodEnd),

      // Phone metrics
      this.getPhoneMetrics(campgroundId, periodStart, periodEnd),

      // Waitlist metrics
      this.getWaitlistMetrics(campgroundId, periodStart, periodEnd),

      // Autonomous action metrics
      this.getAutonomousMetrics(campgroundId, periodStart, periodEnd),
    ]);

    // Calculate totals and ROI
    const estimatedRevenueSavedCents =
      risks.noShowsPrevented * 15000 + // Avg $150 per prevented no-show
      pricing.pricingRevenueDelta +
      waitlist.waitlistRevenue;

    const estimatedRevenueGeneratedCents =
      phone.bookingRevenue + waitlist.waitlistRevenue;

    const aiCostCents = phone.totalCost + autonomous.tokenCost;

    const roiPercent =
      aiCostCents > 0
        ? ((estimatedRevenueSavedCents + estimatedRevenueGeneratedCents - aiCostCents) /
            aiCostCents) *
          100
        : 0;

    const metrics = {
      campgroundId,
      periodStart,
      periodEnd,

      messagesReceived: messages.received,
      messagesHandled: messages.handled,
      messagesAutoSent: messages.autoSent,
      avgResponseTimeMinutes: messages.avgResponseTime,

      risksIdentified: risks.identified,
      noShowsPrevented: risks.noShowsPrevented,
      anomaliesDetected: risks.anomaliesDetected,
      anomaliesResolved: risks.anomaliesResolved,

      pricingSuggestions: pricing.suggestions,
      pricingSuggestionsApplied: pricing.applied,
      pricingRevenueDelta: pricing.pricingRevenueDelta,

      phoneCallsReceived: phone.received,
      phoneCallsHandled: phone.handled,
      phoneCallsTransferred: phone.transferred,
      avgCallDurationSeconds: phone.avgDuration,

      waitlistOffersGenerated: waitlist.offers,
      waitlistOffersAccepted: waitlist.accepted,

      estimatedRevenueSavedCents,
      estimatedRevenueGeneratedCents,
      aiTokensUsed: autonomous.tokensUsed,
      aiCostCents,
      roiPercent: Math.round(roiPercent),

      calculatedAt: new Date(),
    };

    // Cache the metrics
    await this.prisma.aiDashboardMetrics.upsert({
      where: {
        campgroundId_periodStart_periodEnd: {
          campgroundId,
          periodStart,
          periodEnd,
        },
      },
      create: metrics,
      update: metrics,
    });

    return metrics;
  }

  private async getMessageMetrics(
    campgroundId: string,
    periodStart: Date,
    periodEnd: Date
  ) {
    const drafts = await this.prisma.aiReplyDraft.findMany({
      where: {
        campgroundId,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      select: { status: true, createdAt: true, sentAt: true },
    });

    const received = await this.prisma.communication.count({
      where: {
        campgroundId,
        direction: "inbound",
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    });

    const autoSent = drafts.filter((d) => d.status === "auto_sent").length;
    const handled = drafts.filter((d) =>
      ["approved", "edited", "sent", "auto_sent"].includes(d.status)
    ).length;

    // Calculate avg response time
    const withResponse = drafts.filter((d) => d.sentAt);
    const avgResponseTime =
      withResponse.length > 0
        ? withResponse.reduce(
            (sum, d) =>
              sum +
              (d.sentAt!.getTime() - d.createdAt.getTime()) / (1000 * 60),
            0
          ) / withResponse.length
        : null;

    return { received, handled, autoSent, avgResponseTime };
  }

  private async getRiskMetrics(
    campgroundId: string,
    periodStart: Date,
    _periodEnd: Date
  ) {
    const noShowRisks = await this.prisma.aiNoShowRisk.findMany({
      where: {
        campgroundId,
        calculatedAt: { gte: periodStart },
      },
      select: { flagged: true, outcome: true },
    });

    const anomalies = await this.prisma.aiAnomalyAlert.findMany({
      where: {
        campgroundId,
        detectedAt: { gte: periodStart },
      },
      select: { status: true },
    });

    return {
      identified: noShowRisks.filter((r) => r.flagged).length,
      noShowsPrevented: noShowRisks.filter(
        (r) => r.flagged && r.outcome === "showed"
      ).length,
      anomaliesDetected: anomalies.length,
      anomaliesResolved: anomalies.filter((a) => a.status === "resolved").length,
    };
  }

  private async getPricingMetrics(
    campgroundId: string,
    periodStart: Date,
    _periodEnd: Date
  ) {
    const recs = await this.prisma.aiPricingRecommendation.findMany({
      where: {
        campgroundId,
        createdAt: { gte: periodStart },
      },
      select: { status: true, estimatedRevenueDelta: true },
    });

    const applied = recs.filter((r) => r.status === "applied");

    return {
      suggestions: recs.length,
      applied: applied.length,
      pricingRevenueDelta: applied.reduce(
        (sum, r) => sum + (r.estimatedRevenueDelta || 0),
        0
      ),
    };
  }

  private async getPhoneMetrics(
    campgroundId: string,
    periodStart: Date,
    _periodEnd: Date
  ) {
    const sessions = await this.prisma.aiPhoneSession.findMany({
      where: {
        campgroundId,
        startedAt: { gte: periodStart },
      },
      select: { status: true, durationSeconds: true, costCents: true },
    });

    const handled = sessions.filter((s) => s.status === "completed");
    const transferred = sessions.filter((s) => s.status === "transferred");

    const durations = sessions
      .filter((s) => s.durationSeconds)
      .map((s) => s.durationSeconds!);

    return {
      received: sessions.length,
      handled: handled.length,
      transferred: transferred.length,
      avgDuration:
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null,
      totalCost: sessions.reduce((sum, s) => sum + (s.costCents || 0), 0),
      bookingRevenue: 0, // Would need to track bookings made via phone
    };
  }

  private async getWaitlistMetrics(
    campgroundId: string,
    periodStart: Date,
    _periodEnd: Date
  ) {
    const scores = await this.prisma.aiWaitlistScore.findMany({
      where: {
        campgroundId,
        calculatedAt: { gte: periodStart },
      },
      include: {
        WaitlistEntry: { select: { status: true } },
      },
    });

    const accepted = scores.filter(
      (s) => s.WaitlistEntry.status === "offered_accepted"
    );

    return {
      offers: scores.length,
      accepted: accepted.length,
      waitlistRevenue: accepted.length * 20000, // Estimate $200 avg per booking
    };
  }

  private async getAutonomousMetrics(
    campgroundId: string,
    periodStart: Date,
    _periodEnd: Date
  ) {
    const actions = await this.prisma.aiAutonomousAction.findMany({
      where: {
        campgroundId,
        createdAt: { gte: periodStart },
      },
      select: { actionType: true },
    });

    // Sum up token usage from phone sessions
    const phoneSessions = await this.prisma.aiPhoneSession.aggregate({
      where: { campgroundId, startedAt: { gte: periodStart } },
      _sum: { tokensUsed: true, costCents: true },
    });

    return {
      actions: actions.length,
      tokensUsed: phoneSessions._sum.tokensUsed || 0,
      tokenCost: phoneSessions._sum.costCents || 0,
    };
  }

  // ==================== QUICK STATS ====================

  /**
   * Get quick stats for dashboard header
   */
  async getQuickStats(campgroundId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      pendingReplies,
      activeAnomalies,
      pendingPricing,
      activeMaintenanceAlerts,
      activeWeatherAlerts,
      todayCalls,
    ] = await Promise.all([
      this.prisma.aiReplyDraft.count({
        where: { campgroundId, status: "pending" },
      }),
      this.prisma.aiAnomalyAlert.count({
        where: { campgroundId, status: { in: ["new", "acknowledged"] } },
      }),
      this.prisma.aiPricingRecommendation.count({
        where: {
          campgroundId,
          status: "pending",
          expiresAt: { gt: new Date() },
        },
      }),
      this.prisma.aiMaintenanceAlert.count({
        where: { campgroundId, status: { in: ["new", "acknowledged"] } },
      }),
      this.prisma.aiWeatherAlert.count({
        where: { campgroundId, status: "active" },
      }),
      this.prisma.aiPhoneSession.count({
        where: { campgroundId, startedAt: { gte: today } },
      }),
    ]);

    const needsAttention =
      pendingReplies +
      activeAnomalies +
      pendingPricing +
      activeMaintenanceAlerts;

    return {
      needsAttention,
      pendingReplies,
      activeAnomalies,
      pendingPricing,
      activeMaintenanceAlerts,
      activeWeatherAlerts,
      todayCalls,
    };
  }

  // ==================== SCHEDULED JOBS ====================

  /**
   * Calculate daily metrics (runs at 1 AM)
   */
  @Cron("0 1 * * *")
  async calculateDailyMetrics() {
    this.logger.log("Starting daily metrics calculation...");

    const configs = await this.prisma.aiAutopilotConfig.findMany({
      select: { campgroundId: true },
    });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let calculated = 0;

    for (const config of configs) {
      try {
        await this.calculateMetrics(config.campgroundId, yesterday, today);
        calculated++;
      } catch (error) {
        this.logger.error(
          `Failed to calculate metrics for ${config.campgroundId}: ${error}`
        );
      }
    }

    this.logger.log(`Daily metrics calculation complete: ${calculated} campgrounds`);
  }
}
