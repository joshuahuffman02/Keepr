import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { AiProviderService } from "./ai-provider.service";
import { AiAutopilotConfigService } from "./ai-autopilot-config.service";
import { AiAutonomousActionService } from "./ai-autonomous-action.service";

interface PricingFactor {
  name: string;
  impact: number; // -100 to +100
  confidence: number;
  details: string;
}

interface PricingAnalysis {
  currentPrice: number;
  suggestedPrice: number;
  adjustmentPercent: number;
  confidence: number;
  reasoning: string;
  factors: PricingFactor[];
  recommendationType: "underpriced" | "overpriced" | "event_opportunity" | "demand_surge" | "optimal";
  estimatedRevenueDelta: number;
}

@Injectable()
export class AiDynamicPricingService {
  private readonly logger = new Logger(AiDynamicPricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProviderService,
    private readonly configService: AiAutopilotConfigService,
    private readonly autonomousAction: AiAutonomousActionService
  ) {}

  // ==================== RECOMMENDATIONS CRUD ====================

  async getRecommendations(
    campgroundId: string,
    options: {
      status?: string;
      siteClassId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ) {
    const { status, siteClassId, startDate, endDate, limit = 50 } = options;

    const where: any = { campgroundId };
    if (status) where.status = status;
    if (siteClassId) where.siteClassId = siteClassId;
    if (startDate) where.dateStart = { gte: startDate };
    if (endDate) where.dateEnd = { lte: endDate };
    // Exclude expired
    where.expiresAt = { gt: new Date() };

    return this.prisma.aiPricingRecommendation.findMany({
      where,
      orderBy: [{ estimatedRevenueDelta: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
  }

  async getRecommendation(id: string) {
    const rec = await this.prisma.aiPricingRecommendation.findUnique({
      where: { id },
    });
    if (!rec) throw new NotFoundException("Pricing recommendation not found");
    return rec;
  }

  // ==================== CORE ANALYSIS ====================

  /**
   * Analyze pricing for a campground and generate recommendations
   */
  async analyzePricing(campgroundId: string): Promise<any[]> {
    const config = await this.configService.getConfig(campgroundId);

    if (!config.dynamicPricingAiEnabled) {
      this.logger.debug(`Dynamic pricing disabled for campground ${campgroundId}`);
      return [];
    }

    // Get campground details
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { name: true, timezone: true },
    });

    if (!campground) {
      throw new NotFoundException("Campground not found");
    }

    // Get site classes
    const siteClasses = await this.prisma.siteClass.findMany({
      where: { campgroundId },
      select: { id: true, name: true, basePrice: true },
    });

    if (siteClasses.length === 0) {
      this.logger.debug(`No site classes for campground ${campgroundId}`);
      return [];
    }

    // Analyze next 90 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 90);

    const recommendations: any[] = [];

    for (const siteClass of siteClasses) {
      try {
        const analysis = await this.analyzeClassPricing(
          campgroundId,
          siteClass,
          today,
          endDate
        );

        for (const rec of analysis) {
          // Check if recommendation already exists for this date range
          const existing = await this.prisma.aiPricingRecommendation.findFirst({
            where: {
              campgroundId,
              siteClassId: siteClass.id,
              dateStart: rec.dateStart,
              dateEnd: rec.dateEnd,
              status: "pending",
            },
          });

          if (existing) continue;

          // Create recommendation
          const created = await this.prisma.aiPricingRecommendation.create({
            data: {
              campgroundId,
              siteClassId: siteClass.id,
              dateStart: rec.dateStart,
              dateEnd: rec.dateEnd,
              recommendationType: rec.recommendationType,
              currentPriceCents: rec.currentPrice,
              suggestedPriceCents: rec.suggestedPrice,
              adjustmentPercent: rec.adjustmentPercent,
              confidence: rec.confidence,
              reasoning: rec.reasoning,
              factors: rec.factors,
              estimatedRevenueDelta: rec.estimatedRevenueDelta,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
          });

          recommendations.push(created);
        }
      } catch (error) {
        this.logger.error(
          `Failed to analyze pricing for class ${siteClass.id}: ${error}`
        );
      }
    }

    this.logger.log(
      `Generated ${recommendations.length} pricing recommendations for campground ${campgroundId}`
    );

    return recommendations;
  }

  /**
   * Analyze pricing for a specific site class
   */
  private async analyzeClassPricing(
    campgroundId: string,
    siteClass: { id: string; name: string; basePrice: number },
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    // Get historical reservation data
    const historicalData = await this.getHistoricalData(
      campgroundId,
      siteClass.id,
      startDate,
      endDate
    );

    // Get current occupancy for upcoming dates
    const occupancyData = await this.getOccupancyForecast(
      campgroundId,
      siteClass.id,
      startDate,
      endDate
    );

    // Get any local events (if we have this data)
    const events = await this.getLocalEvents(campgroundId, startDate, endDate);

    // Build AI prompt
    const systemPrompt = `You are a revenue management AI for campgrounds. Analyze the provided data and identify pricing opportunities.

Your goal is to maximize revenue while maintaining fair pricing. Consider:
1. Historical occupancy patterns (weekends vs weekdays)
2. Seasonal demand
3. Local events that might increase demand
4. Current booking velocity
5. Lead time to check-in date

Respond in JSON format with an array of recommendations:
{
  "recommendations": [
    {
      "dateStart": "YYYY-MM-DD",
      "dateEnd": "YYYY-MM-DD",
      "recommendationType": "underpriced" | "overpriced" | "event_opportunity" | "demand_surge",
      "currentPrice": <cents>,
      "suggestedPrice": <cents>,
      "adjustmentPercent": <number>,
      "confidence": <0-1>,
      "reasoning": "<explanation>",
      "estimatedRevenueDelta": <cents per booking>,
      "factors": [
        {
          "name": "<factor name>",
          "impact": <-100 to +100>,
          "confidence": <0-1>,
          "details": "<details>"
        }
      ]
    }
  ]
}

Only include recommendations where adjustment is > 10% or there's a clear opportunity.
Maximum 5 recommendations per analysis.`;

    const userPrompt = `Analyze pricing for site class "${siteClass.name}" (base price: $${(siteClass.basePrice / 100).toFixed(2)}/night)

Historical occupancy by day of week:
${JSON.stringify(historicalData.dayOfWeekOccupancy, null, 2)}

Upcoming 90-day occupancy forecast:
${JSON.stringify(occupancyData, null, 2)}

Local events:
${events.length > 0 ? JSON.stringify(events, null, 2) : "No events found"}

Current date: ${startDate.toISOString().split("T")[0]}`;

    try {
      const response = await this.aiProvider.complete({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        maxTokens: 2000,
        responseFormat: { type: "json_object" },
      });

      const parsed = JSON.parse(response.content);
      return (parsed.recommendations || []).map((rec: any) => ({
        ...rec,
        dateStart: new Date(rec.dateStart),
        dateEnd: new Date(rec.dateEnd),
      }));
    } catch (error) {
      this.logger.error(`AI pricing analysis failed: ${error}`);
      return [];
    }
  }

  /**
   * Get historical reservation data for analysis
   */
  private async getHistoricalData(
    campgroundId: string,
    siteClassId: string,
    _startDate: Date,
    _endDate: Date
  ) {
    // Get reservations from last year
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        site: { siteClassId },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
        arrivalDate: { gte: lastYear },
      },
      select: {
        arrivalDate: true,
        departureDate: true,
        totalAmountCents: true,
      },
    });

    // Calculate day-of-week occupancy patterns
    const dayOfWeekOccupancy: Record<number, { bookings: number; avgPrice: number }> = {};
    for (let i = 0; i < 7; i++) {
      dayOfWeekOccupancy[i] = { bookings: 0, avgPrice: 0 };
    }

    for (const res of reservations) {
      const dayOfWeek = res.arrivalDate.getDay();
      dayOfWeekOccupancy[dayOfWeek].bookings++;
      const nights = Math.ceil(
        (res.departureDate.getTime() - res.arrivalDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (nights > 0) {
        dayOfWeekOccupancy[dayOfWeek].avgPrice += (res.totalAmountCents || 0) / nights;
      }
    }

    // Average out prices
    for (const day in dayOfWeekOccupancy) {
      if (dayOfWeekOccupancy[day].bookings > 0) {
        dayOfWeekOccupancy[day].avgPrice = Math.round(
          dayOfWeekOccupancy[day].avgPrice / dayOfWeekOccupancy[day].bookings
        );
      }
    }

    return { dayOfWeekOccupancy, totalReservations: reservations.length };
  }

  /**
   * Get occupancy forecast for upcoming dates
   */
  private async getOccupancyForecast(
    campgroundId: string,
    siteClassId: string,
    startDate: Date,
    endDate: Date
  ) {
    // Get total sites in this class
    const totalSites = await this.prisma.site.count({
      where: { siteClassId, status: "available" },
    });

    if (totalSites === 0) return [];

    // Get existing reservations for the period
    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        site: { siteClassId },
        status: { in: ["confirmed", "pending"] },
        arrivalDate: { lte: endDate },
        departureDate: { gte: startDate },
      },
      select: { arrivalDate: true, departureDate: true },
    });

    // Build weekly occupancy summary
    const weeks: { weekStart: string; occupancyPercent: number }[] = [];
    const current = new Date(startDate);

    while (current < endDate) {
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 7);

      let occupiedNights = 0;
      const totalNights = totalSites * 7;

      for (const res of reservations) {
        const overlap = this.getDateOverlap(
          res.arrivalDate,
          res.departureDate,
          current,
          weekEnd
        );
        occupiedNights += overlap;
      }

      weeks.push({
        weekStart: current.toISOString().split("T")[0],
        occupancyPercent: Math.round((occupiedNights / totalNights) * 100),
      });

      current.setDate(current.getDate() + 7);
    }

    return weeks;
  }

  /**
   * Get local events (placeholder - would integrate with events API)
   */
  private async getLocalEvents(
    _campgroundId: string,
    _startDate: Date,
    _endDate: Date
  ) {
    // TODO: Integrate with local events API or calendar
    return [];
  }

  /**
   * Calculate date overlap in days
   */
  private getDateOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): number {
    const overlapStart = Math.max(start1.getTime(), start2.getTime());
    const overlapEnd = Math.min(end1.getTime(), end2.getTime());

    if (overlapEnd <= overlapStart) return 0;

    return Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24));
  }

  // ==================== APPLY / DISMISS ====================

  /**
   * Apply a pricing recommendation
   */
  async applyRecommendation(id: string, userId: string) {
    const rec = await this.getRecommendation(id);

    if (rec.status !== "pending") {
      throw new Error(`Cannot apply recommendation with status: ${rec.status}`);
    }

    const config = await this.configService.getConfig(rec.campgroundId);

    // Check max adjustment limit
    if (Math.abs(rec.adjustmentPercent) > config.dynamicPricingMaxAdjust) {
      throw new Error(
        `Adjustment of ${rec.adjustmentPercent}% exceeds maximum allowed ${config.dynamicPricingMaxAdjust}%`
      );
    }

    // TODO: Actually apply the price adjustment to the pricing system
    // This would integrate with the existing pricing-v2 or dynamic-pricing module

    // For now, just mark as applied
    const updated = await this.prisma.aiPricingRecommendation.update({
      where: { id },
      data: {
        status: "applied",
        appliedAt: new Date(),
        appliedById: userId,
      },
    });

    // Log autonomous action
    await this.autonomousAction.logAction({
      campgroundId: rec.campgroundId,
      actionType: "price_adjusted",
      entityType: "pricing_recommendation",
      entityId: id,
      description: `Applied ${rec.adjustmentPercent}% price adjustment for ${rec.recommendationType}`,
      details: {
        siteClassId: rec.siteClassId,
        dateStart: rec.dateStart,
        dateEnd: rec.dateEnd,
        currentPrice: rec.currentPriceCents,
        suggestedPrice: rec.suggestedPriceCents,
        adjustmentPercent: rec.adjustmentPercent,
      },
      confidence: rec.confidence,
      reasoning: rec.reasoning,
      reversible: true,
    });

    this.logger.log(`Applied pricing recommendation ${id} by user ${userId}`);

    return updated;
  }

  /**
   * Dismiss a pricing recommendation
   */
  async dismissRecommendation(id: string, userId: string, reason?: string) {
    const rec = await this.getRecommendation(id);

    if (rec.status !== "pending") {
      throw new Error(`Cannot dismiss recommendation with status: ${rec.status}`);
    }

    return this.prisma.aiPricingRecommendation.update({
      where: { id },
      data: {
        status: "dismissed",
        dismissedAt: new Date(),
        dismissedById: userId,
        dismissedReason: reason,
      },
    });
  }

  // ==================== SCHEDULED JOBS ====================

  /**
   * Daily pricing analysis (runs at 6 AM)
   */
  @Cron("0 6 * * *")
  async runDailyPricingAnalysis() {
    this.logger.log("Starting daily pricing analysis...");

    // Get all campgrounds with dynamic pricing enabled
    const configs = await this.prisma.aiAutopilotConfig.findMany({
      where: { dynamicPricingAiEnabled: true },
      select: { campgroundId: true },
    });

    let analyzed = 0;
    let errors = 0;

    for (const config of configs) {
      try {
        await this.analyzePricing(config.campgroundId);
        analyzed++;
      } catch (error) {
        this.logger.error(
          `Failed to analyze pricing for ${config.campgroundId}: ${error}`
        );
        errors++;
      }
    }

    this.logger.log(
      `Daily pricing analysis complete: ${analyzed} analyzed, ${errors} errors`
    );
  }

  /**
   * Clean up expired recommendations (runs daily at midnight)
   */
  @Cron("0 0 * * *")
  async cleanupExpiredRecommendations() {
    const result = await this.prisma.aiPricingRecommendation.updateMany({
      where: {
        status: "pending",
        expiresAt: { lt: new Date() },
      },
      data: { status: "expired" },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} pricing recommendations`);
    }
  }

  // ==================== DASHBOARD SUMMARY ====================

  /**
   * Get pricing summary for dashboard
   */
  async getPricingSummary(campgroundId: string) {
    const pending = await this.prisma.aiPricingRecommendation.count({
      where: { campgroundId, status: "pending", expiresAt: { gt: new Date() } },
    });

    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const applied = await this.prisma.aiPricingRecommendation.findMany({
      where: {
        campgroundId,
        status: "applied",
        appliedAt: { gte: last30Days },
      },
      select: { estimatedRevenueDelta: true, adjustmentPercent: true },
    });

    const totalRevenueDelta = applied.reduce(
      (sum, r) => sum + (r.estimatedRevenueDelta || 0),
      0
    );

    const avgAdjustment =
      applied.length > 0
        ? applied.reduce((sum, r) => sum + r.adjustmentPercent, 0) / applied.length
        : 0;

    return {
      pendingRecommendations: pending,
      appliedLast30Days: applied.length,
      estimatedRevenueDeltaCents: totalRevenueDelta,
      averageAdjustmentPercent: Math.round(avgAdjustment * 10) / 10,
    };
  }
}
