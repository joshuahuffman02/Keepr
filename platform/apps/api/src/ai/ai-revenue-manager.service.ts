import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import type { AiRevenueInsight, Prisma } from "@prisma/client";
import { AiProviderService } from "./ai-provider.service";
import { AiAutopilotConfigService } from "./ai-autopilot-config.service";
import { randomUUID } from "crypto";

const reservationInclude = {
  Site: { include: { SiteClass: true } },
} satisfies Prisma.ReservationInclude;

/**
 * AI Revenue Manager Service
 *
 * Analyzes campground operations to identify revenue opportunities:
 * - "You're leaving $4,200/month on the table. Here's why."
 * - Underutilized sites
 * - Missed upsell opportunities
 * - Pricing gaps
 * - Occupancy optimization
 */

@Injectable()
export class AiRevenueManagerService {
  private readonly logger = new Logger(AiRevenueManagerService.name);

  private readonly reservationInclude = reservationInclude;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProviderService,
    private readonly configService: AiAutopilotConfigService,
  ) {}

  // ==================== INSIGHTS CRUD ====================

  async getInsights(
    campgroundId: string,
    options: {
      status?: string;
      insightType?: string;
      limit?: number;
    } = {},
  ) {
    const { status, insightType, limit = 50 } = options;

    const where: Prisma.AiRevenueInsightWhereInput = { campgroundId };
    if (status) where.status = status;
    if (insightType) where.insightType = insightType;

    return this.prisma.aiRevenueInsight.findMany({
      where,
      orderBy: [{ priority: "desc" }, { impactCents: "desc" }],
      take: limit,
    });
  }

  async getInsight(id: string) {
    const insight = await this.prisma.aiRevenueInsight.findUnique({
      where: { id },
    });
    if (!insight) throw new NotFoundException("Revenue insight not found");
    return insight;
  }

  // ==================== REVENUE ANALYSIS ====================

  /**
   * Analyze revenue opportunities for a campground
   */
  async analyzeRevenue(campgroundId: string) {
    const config = await this.configService.getConfig(campgroundId);

    if (!config.dynamicPricingAiEnabled) {
      this.logger.debug(`Revenue analysis disabled for campground ${campgroundId}`);
      return [];
    }

    const insights: RevenueInsightDraft[] = [];

    // Run all analyses in parallel
    const [occupancyGaps, underutilizedSites, pricingOpportunities, upsellOpportunities] =
      await Promise.all([
        this.analyzeOccupancyGaps(campgroundId),
        this.analyzeUnderutilizedSites(campgroundId),
        this.analyzePricingOpportunities(campgroundId),
        this.analyzeUpsellOpportunities(campgroundId),
      ]);

    insights.push(...occupancyGaps);
    insights.push(...underutilizedSites);
    insights.push(...pricingOpportunities);
    insights.push(...upsellOpportunities);

    // Save insights
    const created: AiRevenueInsight[] = [];
    for (const insight of insights) {
      // Check for existing similar insight
      const existing = await this.prisma.aiRevenueInsight.findFirst({
        where: {
          campgroundId,
          insightType: insight.insightType,
          status: { in: ["new", "in_progress"] },
          title: insight.title,
        },
      });

      if (existing) continue;

      const saved = await this.prisma.aiRevenueInsight.create({
        data: {
          campgroundId,
          id: randomUUID(),
          updatedAt: new Date(),
          ...insight,
        },
      });

      created.push(saved);
    }

    this.logger.log(`Generated ${created.length} revenue insights for campground ${campgroundId}`);

    return created;
  }

  /**
   * Analyze occupancy gaps (empty nights between bookings)
   */
  private async analyzeOccupancyGaps(campgroundId: string) {
    const insights: RevenueInsightDraft[] = [];

    // Get upcoming reservations
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { in: ["confirmed", "pending"] },
        arrivalDate: { gte: today, lte: nextMonth },
      },
      include: this.reservationInclude,
      orderBy: [{ siteId: "asc" }, { arrivalDate: "asc" }],
    });

    // Group by site
    const bySite: Record<string, ReservationWithSite[]> = {};
    for (const res of reservations) {
      if (!bySite[res.siteId]) bySite[res.siteId] = [];
      bySite[res.siteId].push(res);
    }

    // Find gaps
    for (const [siteId, siteRes] of Object.entries(bySite)) {
      for (let i = 0; i < siteRes.length - 1; i++) {
        const current = siteRes[i];
        const next = siteRes[i + 1];

        const gap = Math.ceil(
          (next.arrivalDate.getTime() - current.departureDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        // 1-2 night gaps are opportunities
        if (gap >= 1 && gap <= 2) {
          const pricePerNight = current.Site?.SiteClass?.defaultRate || 5000;
          const impact = pricePerNight * gap;

          insights.push({
            insightType: "occupancy_gap",
            title: `${gap}-night gap on ${current.Site?.name}`,
            summary: `There's a ${gap}-night gap between ${current.departureDate.toLocaleDateString()} and ${next.arrivalDate.toLocaleDateString()} on ${current.Site?.name}. This could be filled with a short-stay promotion.`,
            impactCents: impact,
            difficulty: "easy",
            priority: 70,
            recommendations: [
              {
                action: "Create gap-filler promotion",
                details: `Offer ${15 + gap * 5}% discount for ${gap}-night stays`,
              },
              {
                action: "Email previous guests",
                details: "Send to guests who've booked short stays before",
              },
              {
                action: "Post on social media",
                details: "Last-minute deal for upcoming dates",
              },
            ],
            metadata: {
              siteId,
              siteName: current.Site?.name ?? null,
              gapStart: current.departureDate.toISOString(),
              gapEnd: next.arrivalDate.toISOString(),
              gapNights: gap,
            },
          });
        }
      }
    }

    return insights;
  }

  /**
   * Analyze underutilized sites
   */
  private async analyzeUnderutilizedSites(campgroundId: string) {
    const insights: RevenueInsightDraft[] = [];

    // Get site occupancy for last 90 days
    const past90Days = new Date();
    past90Days.setDate(past90Days.getDate() - 90);

    const sites = await this.prisma.site.findMany({
      where: { campgroundId, status: "available" },
      include: {
        SiteClass: true,
        Reservation: {
          where: {
            status: { in: ["confirmed", "checked_in", "checked_out"] },
            arrivalDate: { gte: past90Days },
          },
          select: { arrivalDate: true, departureDate: true },
        },
      },
    });

    // Calculate occupancy per site
    const siteStats: {
      site: SiteWithReservations;
      occupancyPercent: number;
      nights: number;
    }[] = [];

    for (const site of sites) {
      let occupiedNights = 0;
      for (const res of site.Reservation) {
        const nights = Math.ceil(
          (res.departureDate.getTime() - res.arrivalDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        occupiedNights += nights;
      }

      const occupancyPercent = Math.round((occupiedNights / 90) * 100);
      siteStats.push({ site, occupancyPercent, nights: occupiedNights });
    }

    // Find underperformers (below 30% when others are above 50%)
    const avgOccupancy =
      siteStats.reduce((sum, s) => sum + s.occupancyPercent, 0) / siteStats.length;

    for (const stat of siteStats) {
      if (stat.occupancyPercent < 30 && avgOccupancy > 50) {
        const missedNights = Math.round(90 * (avgOccupancy / 100) - stat.nights);
        const pricePerNight = stat.site.SiteClass?.defaultRate || 5000;
        const impact = missedNights * pricePerNight;

        insights.push({
          insightType: "underutilized_site",
          title: `${stat.site.name} is underperforming`,
          summary: `${stat.site.name} has only ${stat.occupancyPercent}% occupancy vs ${avgOccupancy}% average. This could indicate issues with the site or listing, or an opportunity for targeted marketing.`,
          impactCents: impact,
          difficulty: "medium",
          priority: 60,
          recommendations: [
            {
              action: "Review site listing",
              details: "Ensure photos and description are appealing",
            },
            {
              action: "Check for maintenance issues",
              details: "Verify site is in good condition",
            },
            {
              action: "Consider promotional pricing",
              details: `Temporary discount to drive bookings`,
            },
            {
              action: "Gather guest feedback",
              details: "Ask recent guests about their experience",
            },
          ],
          metadata: {
            siteId: stat.site.id,
            siteName: stat.site.name,
            siteType: stat.site.SiteClass?.name ?? null,
            occupancyPercent: stat.occupancyPercent,
            avgOccupancy,
            missedNights,
          },
        });
      }
    }

    return insights;
  }

  /**
   * Analyze pricing opportunities
   */
  private async analyzePricingOpportunities(campgroundId: string) {
    const insights: RevenueInsightDraft[] = [];

    // Get site classes with reservation data
    const siteClasses = await this.prisma.siteClass.findMany({
      where: { campgroundId },
      include: {
        Site: {
          include: {
            Reservation: {
              where: {
                status: { in: ["confirmed", "checked_in", "checked_out"] },
                createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
              },
            },
          },
        },
      },
    });

    for (const siteClass of siteClasses) {
      const totalSites = siteClass.Site.length;
      if (totalSites === 0) continue;

      // Calculate booking velocity
      const totalBookings = siteClass.Site.reduce((sum, s) => sum + s.Reservation.length, 0);

      const bookingsPerSitePerMonth = totalBookings / totalSites / 3; // 3 months

      // High demand sites might be underpriced
      if (bookingsPerSitePerMonth > 3) {
        const potentialIncrease = Math.round(siteClass.defaultRate * 0.15);
        const impact = potentialIncrease * totalBookings;

        insights.push({
          insightType: "pricing_opportunity",
          title: `${siteClass.name} may be underpriced`,
          summary: `${siteClass.name} sites are booking ${bookingsPerSitePerMonth.toFixed(1)} times per month on average. High demand suggests room for a 10-15% price increase.`,
          impactCents: impact,
          difficulty: "easy",
          priority: 75,
          recommendations: [
            {
              action: "Test price increase",
              details: `Increase base price by 10% ($${(potentialIncrease / 100).toFixed(2)}/night)`,
            },
            {
              action: "Implement dynamic pricing",
              details: "Auto-adjust based on demand",
            },
            {
              action: "Add premium options",
              details: "Offer premium add-ons like early check-in",
            },
          ],
          metadata: {
            siteClassId: siteClass.id,
            siteClassName: siteClass.name,
            currentPrice: siteClass.defaultRate,
            suggestedIncrease: potentialIncrease,
            bookingsPerSitePerMonth,
          },
        });
      }
    }

    return insights;
  }

  /**
   * Analyze upsell opportunities
   */
  private async analyzeUpsellOpportunities(campgroundId: string) {
    const insights: RevenueInsightDraft[] = [];

    // Get reservation add-on usage
    const past90Days = new Date();
    past90Days.setDate(past90Days.getDate() - 90);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { in: ["confirmed", "checked_in", "checked_out"] },
        arrivalDate: { gte: past90Days },
      },
      include: {
        ReservationUpsell: true,
      },
    });

    const totalRes = reservations.length;
    const withAddOns = reservations.filter((r) => r.ReservationUpsell.length > 0).length;
    const addOnRate = totalRes > 0 ? (withAddOns / totalRes) * 100 : 0;

    // Low add-on rate is an opportunity
    if (addOnRate < 20 && totalRes > 20) {
      // Estimate $20 per reservation in missed upsells
      const impact = (totalRes - withAddOns) * 2000;

      insights.push({
        insightType: "missed_upsell",
        title: "Low add-on attachment rate",
        summary: `Only ${addOnRate.toFixed(1)}% of reservations include add-ons. Industry average is 30-40%. Better upselling could add significant revenue.`,
        impactCents: impact,
        difficulty: "medium",
        priority: 65,
        recommendations: [
          {
            action: "Add upsell prompts",
            details: "Show add-ons during checkout and in confirmation emails",
          },
          {
            action: "Create bundle packages",
            details: "Combine popular add-ons at a slight discount",
          },
          {
            action: "Train staff on upselling",
            details: "Mention add-ons during check-in",
          },
          {
            action: "Review add-on pricing",
            details: "Ensure add-ons are priced attractively",
          },
        ],
        metadata: {
          totalReservations: totalRes,
          withAddOns,
          addOnRate,
          targetRate: 35,
        },
      });
    }

    return insights;
  }

  // ==================== INSIGHT ACTIONS ====================

  /**
   * Mark insight as in progress
   */
  async startInsight(id: string) {
    return this.prisma.aiRevenueInsight.update({
      where: { id },
      data: { status: "in_progress" },
    });
  }

  /**
   * Mark insight as completed
   */
  async completeInsight(id: string) {
    return this.prisma.aiRevenueInsight.update({
      where: { id },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });
  }

  /**
   * Dismiss an insight
   */
  async dismissInsight(id: string, reason?: string) {
    return this.prisma.aiRevenueInsight.update({
      where: { id },
      data: {
        status: "dismissed",
        dismissedAt: new Date(),
        dismissedReason: reason,
      },
    });
  }

  // ==================== SUMMARY ====================

  /**
   * Get revenue opportunity summary
   */
  async getRevenueSummary(campgroundId: string) {
    const insights = await this.prisma.aiRevenueInsight.findMany({
      where: {
        campgroundId,
        status: { in: ["new", "in_progress"] },
      },
      select: { insightType: true, impactCents: true, status: true },
    });

    const totalOpportunity = insights.reduce((sum, i) => sum + (i.impactCents || 0), 0);

    const byType: Record<string, { count: number; impact: number }> = {};
    for (const insight of insights) {
      if (!byType[insight.insightType]) {
        byType[insight.insightType] = { count: 0, impact: 0 };
      }
      byType[insight.insightType].count += 1;
      byType[insight.insightType].impact += insight.impactCents || 0;
    }

    return {
      totalOpportunityCents: totalOpportunity,
      totalOpportunityFormatted: `$${(totalOpportunity / 100).toFixed(2)}`,
      activeInsights: insights.length,
      newInsights: insights.filter((i) => i.status === "new").length,
      byType,
    };
  }

  // ==================== SCHEDULED JOBS ====================

  /**
   * Weekly revenue analysis (runs Sunday at 6 AM)
   */
  @Cron("0 6 * * 0")
  async runWeeklyRevenueAnalysis() {
    this.logger.log("Starting weekly revenue analysis...");

    // Get all campgrounds with pricing AI enabled
    const configs = await this.prisma.aiAutopilotConfig.findMany({
      where: { dynamicPricingAiEnabled: true },
      select: { campgroundId: true },
    });

    let analyzed = 0;
    let errors = 0;

    for (const config of configs) {
      try {
        await this.analyzeRevenue(config.campgroundId);
        analyzed++;
      } catch (error) {
        this.logger.error(`Failed to analyze revenue for ${config.campgroundId}: ${error}`);
        errors++;
      }
    }

    this.logger.log(`Weekly revenue analysis complete: ${analyzed} analyzed, ${errors} errors`);
  }
}

type RevenueInsightDraft = {
  insightType: string;
  title: string;
  summary: string;
  impactCents: number;
  difficulty: string;
  priority: number;
  recommendations: Array<{ action: string; details: string }>;
  metadata: Prisma.InputJsonValue;
};

type ReservationWithSite = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

type SiteWithReservations = Prisma.SiteGetPayload<{
  include: {
    SiteClass: true;
    Reservation: {
      select: { arrivalDate: true; departureDate: true };
    };
  };
}>;
