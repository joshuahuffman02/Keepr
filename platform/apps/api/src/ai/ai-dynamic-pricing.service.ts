import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { AiProviderService } from "./ai-provider.service";
import { AiAutopilotConfigService } from "./ai-autopilot-config.service";
import { AiAutonomousActionService } from "./ai-autonomous-action.service";
import { AiFeatureType } from "@prisma/client";
import type { AiPricingRecommendation, Prisma } from "@prisma/client";

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
  recommendationType:
    | "underpriced"
    | "overpriced"
    | "event_opportunity"
    | "demand_surge"
    | "optimal";
  estimatedRevenueDelta: number;
}

type PricingRecommendationDraft = Omit<PricingAnalysis, "currentPrice" | "suggestedPrice"> & {
  dateStart: Date;
  dateEnd: Date;
  currentPrice: number;
  suggestedPrice: number;
};

const recommendationTypes: PricingAnalysis["recommendationType"][] = [
  "underpriced",
  "overpriced",
  "event_opportunity",
  "demand_surge",
  "optimal",
];
const isRecommendationType = (value: string): value is PricingAnalysis["recommendationType"] =>
  recommendationTypes.some((type) => type === value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

@Injectable()
export class AiDynamicPricingService {
  private readonly logger = new Logger(AiDynamicPricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProviderService,
    private readonly configService: AiAutopilotConfigService,
    private readonly autonomousAction: AiAutonomousActionService,
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
    } = {},
  ) {
    const { status, siteClassId, startDate, endDate, limit = 50 } = options;

    const where: Prisma.AiPricingRecommendationWhereInput = { campgroundId };
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
  async analyzePricing(campgroundId: string): Promise<AiPricingRecommendation[]> {
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
      select: { id: true, name: true, defaultRate: true },
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

    const recommendations: AiPricingRecommendation[] = [];

    for (const siteClass of siteClasses) {
      try {
        const analysis = await this.analyzeClassPricing(campgroundId, siteClass, today, endDate);

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
          const factors: Prisma.InputJsonValue = rec.factors.map((factor) => ({
            name: factor.name,
            impact: factor.impact,
            confidence: factor.confidence,
            details: factor.details,
          }));
          const created = await this.prisma.aiPricingRecommendation.create({
            data: {
              id: randomUUID(),
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
              factors,
              estimatedRevenueDelta: rec.estimatedRevenueDelta,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
          });

          recommendations.push(created);
        }
      } catch (error) {
        this.logger.error(`Failed to analyze pricing for class ${siteClass.id}: ${error}`);
      }
    }

    this.logger.log(
      `Generated ${recommendations.length} pricing recommendations for campground ${campgroundId}`,
    );

    return recommendations;
  }

  /**
   * Analyze pricing for a specific site class
   */
  private async analyzeClassPricing(
    campgroundId: string,
    siteClass: { id: string; name: string; defaultRate: number },
    startDate: Date,
    endDate: Date,
  ): Promise<PricingRecommendationDraft[]> {
    // Get historical reservation data
    const historicalData = await this.getHistoricalData(
      campgroundId,
      siteClass.id,
      startDate,
      endDate,
    );

    // Get current occupancy for upcoming dates
    const occupancyData = await this.getOccupancyForecast(
      campgroundId,
      siteClass.id,
      startDate,
      endDate,
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

    const userPrompt = `Analyze pricing for site class "${siteClass.name}" (base price: $${(siteClass.defaultRate / 100).toFixed(2)}/night)

Historical occupancy by day of week:
${JSON.stringify(historicalData.dayOfWeekOccupancy, null, 2)}

Upcoming 90-day occupancy forecast:
${JSON.stringify(occupancyData, null, 2)}

Local events:
${events.length > 0 ? JSON.stringify(events, null, 2) : "No events found"}

Current date: ${startDate.toISOString().split("T")[0]}`;

    try {
      const response = await this.aiProvider.getCompletion({
        campgroundId,
        featureType: AiFeatureType.recommendations,
        systemPrompt,
        userPrompt,
        temperature: 0.3,
        maxTokens: 2000,
      });

      const parsed = JSON.parse(response.content);
      const recommendations =
        isRecord(parsed) && Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

      return recommendations
        .map((rec): PricingRecommendationDraft | null => {
          if (!isRecord(rec)) return null;
          if (typeof rec.dateStart !== "string" || typeof rec.dateEnd !== "string") return null;

          const dateStart = new Date(rec.dateStart);
          const dateEnd = new Date(rec.dateEnd);
          if (Number.isNaN(dateStart.getTime()) || Number.isNaN(dateEnd.getTime())) return null;

          if (
            typeof rec.recommendationType !== "string" ||
            !isRecommendationType(rec.recommendationType)
          ) {
            return null;
          }

          const currentPrice = typeof rec.currentPrice === "number" ? rec.currentPrice : null;
          const suggestedPrice = typeof rec.suggestedPrice === "number" ? rec.suggestedPrice : null;
          const adjustmentPercent =
            typeof rec.adjustmentPercent === "number" ? rec.adjustmentPercent : null;
          const confidence = typeof rec.confidence === "number" ? rec.confidence : null;
          const reasoning = typeof rec.reasoning === "string" ? rec.reasoning : "";
          const estimatedRevenueDelta =
            typeof rec.estimatedRevenueDelta === "number" ? rec.estimatedRevenueDelta : 0;

          if (
            currentPrice === null ||
            suggestedPrice === null ||
            adjustmentPercent === null ||
            confidence === null
          ) {
            return null;
          }

          const factors = Array.isArray(rec.factors)
            ? rec.factors
                .map((factor): PricingFactor | null => {
                  if (!isRecord(factor)) return null;
                  const name = typeof factor.name === "string" ? factor.name : null;
                  const impact = typeof factor.impact === "number" ? factor.impact : null;
                  const factorConfidence =
                    typeof factor.confidence === "number" ? factor.confidence : null;
                  const details = typeof factor.details === "string" ? factor.details : "";
                  if (!name || impact === null || factorConfidence === null) return null;
                  return { name, impact, confidence: factorConfidence, details };
                })
                .filter((factor): factor is PricingFactor => factor !== null)
            : [];

          return {
            dateStart,
            dateEnd,
            recommendationType: rec.recommendationType,
            currentPrice,
            suggestedPrice,
            adjustmentPercent,
            confidence,
            reasoning,
            estimatedRevenueDelta,
            factors,
          };
        })
        .filter((rec): rec is PricingRecommendationDraft => rec !== null);
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
    _endDate: Date,
  ) {
    // Get reservations from last year
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        Site: { siteClassId },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
        arrivalDate: { gte: lastYear },
      },
      select: {
        arrivalDate: true,
        departureDate: true,
        totalAmount: true,
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
        (res.departureDate.getTime() - res.arrivalDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (nights > 0) {
        dayOfWeekOccupancy[dayOfWeek].avgPrice += (res.totalAmount || 0) / nights;
      }
    }

    // Average out prices
    for (const day in dayOfWeekOccupancy) {
      if (dayOfWeekOccupancy[day].bookings > 0) {
        dayOfWeekOccupancy[day].avgPrice = Math.round(
          dayOfWeekOccupancy[day].avgPrice / dayOfWeekOccupancy[day].bookings,
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
    endDate: Date,
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
        Site: { siteClassId },
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
        const overlap = this.getDateOverlap(res.arrivalDate, res.departureDate, current, weekEnd);
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
  private async getLocalEvents(_campgroundId: string, _startDate: Date, _endDate: Date) {
    // TODO: Integrate with local events API or calendar
    return [];
  }

  /**
   * Calculate date overlap in days
   */
  private getDateOverlap(start1: Date, end1: Date, start2: Date, end2: Date): number {
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
      throw new BadRequestException(`Cannot apply recommendation with status: ${rec.status}`);
    }

    const config = await this.configService.getConfig(rec.campgroundId);

    // Check max adjustment limit
    if (Math.abs(rec.adjustmentPercent) > config.dynamicPricingMaxAdjust) {
      throw new BadRequestException(
        `Adjustment of ${rec.adjustmentPercent}% exceeds maximum allowed ${config.dynamicPricingMaxAdjust}%`,
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
      throw new BadRequestException(`Cannot dismiss recommendation with status: ${rec.status}`);
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
        this.logger.error(`Failed to analyze pricing for ${config.campgroundId}: ${error}`);
        errors++;
      }
    }

    this.logger.log(`Daily pricing analysis complete: ${analyzed} analyzed, ${errors} errors`);
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

    const totalRevenueDelta = applied.reduce((sum, r) => sum + (r.estimatedRevenueDelta || 0), 0);

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

  // ==================== PRICE SENSITIVITY ANALYSIS ====================

  /**
   * Analyze price elasticity - how bookings change with price
   */
  async analyzePriceSensitivity(
    campgroundId: string,
    siteClassId?: string,
  ): Promise<{
    elasticity: number; // negative = elastic (price sensitive), positive = inelastic
    optimalPriceRange: { min: number; max: number };
    pricePoints: Array<{ price: number; conversionRate: number; bookings: number }>;
    insight: string;
  }> {
    // Get historical reservations with pricing data
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const whereClause: Prisma.ReservationWhereInput = {
      campgroundId,
      status: { in: ["confirmed", "checked_in", "checked_out"] },
      createdAt: { gte: sixMonthsAgo },
      totalAmount: { gt: 0 },
    };

    if (siteClassId) {
      whereClause.Site = { siteClassId };
    }

    const reservations = await this.prisma.reservation.findMany({
      where: whereClause,
      select: {
        totalAmount: true,
        arrivalDate: true,
        departureDate: true,
        createdAt: true,
      },
    });

    // Filter out reservations with invalid dates
    const validReservations = reservations.filter((r) => {
      const nights = Math.ceil(
        (r.departureDate.getTime() - r.arrivalDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return nights > 0;
    });

    if (validReservations.length < 20) {
      return {
        elasticity: 0,
        optimalPriceRange: { min: 0, max: 0 },
        pricePoints: [],
        insight: "Not enough data for price sensitivity analysis (need 20+ bookings)",
      };
    }

    // Group by price per night
    const priceGroups = new Map<number, number>();
    for (const res of validReservations) {
      const nights = Math.ceil(
        (res.departureDate.getTime() - res.arrivalDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const pricePerNight = Math.round(res.totalAmount / nights / 500) * 500; // Round to $5 increments
      priceGroups.set(pricePerNight, (priceGroups.get(pricePerNight) || 0) + 1);
    }

    // Convert to sorted array
    const pricePoints = Array.from(priceGroups.entries())
      .map(([price, bookings]) => ({
        price,
        bookings,
        conversionRate: 0, // Would need view data to calculate
      }))
      .sort((a, b) => a.price - b.price);

    // Calculate simple price elasticity
    // Using midpoint method between highest and lowest booking prices
    const totalBookings = validReservations.length;
    const avgPrice =
      validReservations.reduce((sum, r) => {
        const nights = Math.ceil(
          (r.departureDate.getTime() - r.arrivalDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        return sum + r.totalAmount / nights;
      }, 0) / totalBookings;

    // Find price range with most bookings (optimal zone)
    let maxBookingsPrice = pricePoints[0]?.price || 0;
    let maxBookings = 0;
    for (const point of pricePoints) {
      if (point.bookings > maxBookings) {
        maxBookings = point.bookings;
        maxBookingsPrice = point.price;
      }
    }

    // Calculate elasticity estimate
    // Negative elasticity = demand drops as price increases (normal goods)
    let elasticity = -1; // Default assumption
    if (pricePoints.length >= 3) {
      const lowPriceBookings = pricePoints
        .slice(0, Math.ceil(pricePoints.length / 3))
        .reduce((s, p) => s + p.bookings, 0);
      const highPriceBookings = pricePoints
        .slice(-Math.ceil(pricePoints.length / 3))
        .reduce((s, p) => s + p.bookings, 0);
      if (lowPriceBookings > 0 && highPriceBookings > 0) {
        const avgLowPrice =
          pricePoints.slice(0, Math.ceil(pricePoints.length / 3)).reduce((s, p) => s + p.price, 0) /
          Math.ceil(pricePoints.length / 3);
        const avgHighPrice =
          pricePoints.slice(-Math.ceil(pricePoints.length / 3)).reduce((s, p) => s + p.price, 0) /
          Math.ceil(pricePoints.length / 3);
        const pctChangeQuantity = (highPriceBookings - lowPriceBookings) / lowPriceBookings;
        const pctChangePrice = (avgHighPrice - avgLowPrice) / avgLowPrice;
        if (pctChangePrice !== 0) {
          elasticity = pctChangeQuantity / pctChangePrice;
        }
      }
    }

    // Determine optimal price range
    const optimalMin = Math.max(maxBookingsPrice - 1000, pricePoints[0]?.price || 0);
    const optimalMax = Math.min(
      maxBookingsPrice + 1500,
      pricePoints[pricePoints.length - 1]?.price || avgPrice * 1.2,
    );

    // Generate insight
    let insight = "";
    if (elasticity < -1.5) {
      insight =
        "Demand is highly price-sensitive. Consider competitive pricing and promotions for off-peak periods.";
    } else if (elasticity < -0.5) {
      insight =
        "Demand shows moderate price sensitivity. Small price increases during peak times may be well-accepted.";
    } else if (elasticity < 0) {
      insight =
        "Demand is relatively price-inelastic. There's room to increase prices without significantly impacting bookings.";
    } else {
      insight =
        "Unusual pricing pattern detected. Higher prices seem to correlate with more bookings (prestige effect or data anomaly).";
    }

    return {
      elasticity: Math.round(elasticity * 100) / 100,
      optimalPriceRange: { min: optimalMin, max: optimalMax },
      pricePoints,
      insight,
    };
  }

  // ==================== AUTOPILOT MODE ====================

  /**
   * Run autopilot pricing - automatically apply safe recommendations
   * This runs after the daily analysis if autopilot is enabled
   */
  async runAutopilot(campgroundId: string): Promise<{
    applied: number;
    skipped: number;
    reasons: string[];
  }> {
    const config = await this.configService.getConfig(campgroundId);

    const autopilotEnabled = config.dynamicPricingAiEnabled && config.dynamicPricingMode === "auto";
    if (!autopilotEnabled) {
      return { applied: 0, skipped: 0, reasons: ["Autopilot not enabled"] };
    }

    const reasons: string[] = [];
    let applied = 0;
    let skipped = 0;

    // Get pending recommendations
    const recommendations = await this.prisma.aiPricingRecommendation.findMany({
      where: {
        campgroundId,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
      orderBy: { estimatedRevenueDelta: "desc" },
    });

    for (const rec of recommendations) {
      // Check guardrails
      const guardrailCheck = this.checkGuardrails(rec, config);

      if (!guardrailCheck.pass) {
        reasons.push(`${rec.id}: ${guardrailCheck.reason}`);
        skipped++;
        continue;
      }

      try {
        // Auto-apply the recommendation
        await this.prisma.aiPricingRecommendation.update({
          where: { id: rec.id },
          data: {
            status: "applied",
            appliedAt: new Date(),
            appliedById: "autopilot",
          },
        });

        // Log the autonomous action
        await this.autonomousAction.logAction({
          campgroundId,
          actionType: "price_adjusted",
          entityType: "pricing_recommendation",
          entityId: rec.id,
          description: `[Autopilot] Applied ${rec.adjustmentPercent.toFixed(1)}% price adjustment`,
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

        applied++;
        this.logger.log(`[Autopilot] Applied pricing recommendation ${rec.id}`);
      } catch (error) {
        reasons.push(`${rec.id}: Failed to apply - ${error}`);
        skipped++;
      }
    }

    return { applied, skipped, reasons };
  }

  /**
   * Check if recommendation passes guardrails
   */
  private checkGuardrails(
    rec: { adjustmentPercent: number; confidence: number; recommendationType: string },
    config: { dynamicPricingMaxAdjust: number },
  ): { pass: boolean; reason?: string } {
    // Max adjustment limit
    if (Math.abs(rec.adjustmentPercent) > config.dynamicPricingMaxAdjust) {
      return { pass: false, reason: `Exceeds max adjustment (${config.dynamicPricingMaxAdjust}%)` };
    }

    // Minimum confidence threshold
    if (rec.confidence < 0.7) {
      return { pass: false, reason: `Low confidence (${(rec.confidence * 100).toFixed(0)}%)` };
    }

    // Don't auto-apply price decreases > 15% (might indicate error)
    if (rec.adjustmentPercent < -15) {
      return { pass: false, reason: "Large price decrease requires manual review" };
    }

    // Don't auto-apply overpriced recommendations (price decreases)
    if (rec.recommendationType === "overpriced") {
      return { pass: false, reason: "Price decrease recommendations require manual review" };
    }

    return { pass: true };
  }

  // ==================== A/B TESTING ====================

  /**
   * Create a new price experiment
   */
  async createExperiment(
    campgroundId: string,
    data: {
      siteClassId: string;
      name: string;
      description?: string;
      hypothesis: string;
      testPrice: number;
      startDate: Date;
      endDate: Date;
      autoApplyWinner?: boolean;
      createdById?: string;
    },
  ) {
    // Get site class base price
    const siteClass = await this.prisma.siteClass.findUnique({
      where: { id: data.siteClassId },
      select: { defaultRate: true },
    });

    if (!siteClass) {
      throw new NotFoundException("Site class not found");
    }

    // Get sites in this class
    const sites = await this.prisma.site.findMany({
      where: { siteClassId: data.siteClassId, status: "available" },
      select: { id: true },
    });

    if (sites.length < 2) {
      throw new BadRequestException("Need at least 2 sites for A/B testing");
    }

    // Randomly assign sites to control and test groups
    const shuffled = sites.sort(() => Math.random() - 0.5);
    const midpoint = Math.ceil(shuffled.length / 2);
    const controlSites = shuffled.slice(0, midpoint).map((s) => s.id);
    const testSites = shuffled.slice(midpoint).map((s) => s.id);

    const adjustmentPct = ((data.testPrice - siteClass.defaultRate) / siteClass.defaultRate) * 100;

    return this.prisma.aiPriceExperiment.create({
      data: {
        id: randomUUID(),
        campgroundId,
        siteClassId: data.siteClassId,
        name: data.name,
        description: data.description,
        hypothesis: data.hypothesis,
        controlPrice: siteClass.defaultRate,
        testPrice: data.testPrice,
        adjustmentPct,
        startDate: data.startDate,
        endDate: data.endDate,
        controlSiteIds: controlSites,
        testSiteIds: testSites,
        autoApplyWinner: data.autoApplyWinner || false,
        createdById: data.createdById,
        status: "draft",
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Start an experiment
   */
  async startExperiment(id: string) {
    const experiment = await this.prisma.aiPriceExperiment.findUnique({ where: { id } });
    if (!experiment) throw new NotFoundException("Experiment not found");
    if (experiment.status !== "draft") {
      throw new BadRequestException("Can only start experiments in draft status");
    }

    return this.prisma.aiPriceExperiment.update({
      where: { id },
      data: { status: "running" },
    });
  }

  /**
   * Pause an experiment
   */
  async pauseExperiment(id: string) {
    return this.prisma.aiPriceExperiment.update({
      where: { id },
      data: { status: "paused" },
    });
  }

  /**
   * Record a booking for an experiment
   */
  async recordExperimentBooking(experimentId: string, siteId: string, revenueCents: number) {
    const experiment = await this.prisma.aiPriceExperiment.findUnique({
      where: { id: experimentId },
    });

    if (!experiment || experiment.status !== "running") return;

    const isControl = experiment.controlSiteIds.includes(siteId);
    const isTest = experiment.testSiteIds.includes(siteId);

    if (!isControl && !isTest) return;

    await this.prisma.aiPriceExperiment.update({
      where: { id: experimentId },
      data: isControl
        ? {
            controlBookings: { increment: 1 },
            controlRevenue: { increment: revenueCents },
          }
        : {
            testBookings: { increment: 1 },
            testRevenue: { increment: revenueCents },
          },
    });

    // Re-calculate statistical significance
    await this.calculateExperimentSignificance(experimentId);
  }

  /**
   * Calculate statistical significance of experiment results
   * Uses a simplified chi-square test approximation
   */
  private async calculateExperimentSignificance(id: string) {
    const exp = await this.prisma.aiPriceExperiment.findUnique({ where: { id } });
    if (!exp) return;

    const totalBookings = exp.controlBookings + exp.testBookings;
    if (totalBookings < 10) return; // Not enough data

    // Calculate conversion rates (bookings per site)
    const controlRate = exp.controlBookings / exp.controlSiteIds.length;
    const testRate = exp.testBookings / exp.testSiteIds.length;

    // Calculate revenue per booking
    const controlAvgRevenue =
      exp.controlBookings > 0 ? exp.controlRevenue / exp.controlBookings : 0;
    const testAvgRevenue = exp.testBookings > 0 ? exp.testRevenue / exp.testBookings : 0;

    // Revenue lift percentage
    const liftPercent =
      controlAvgRevenue > 0 ? ((testAvgRevenue - controlAvgRevenue) / controlAvgRevenue) * 100 : 0;

    // Simplified p-value approximation using z-test for proportions
    const pooledRate =
      (exp.controlBookings + exp.testBookings) /
      (exp.controlSiteIds.length + exp.testSiteIds.length);
    const se = Math.sqrt(
      pooledRate * (1 - pooledRate) * (1 / exp.controlSiteIds.length + 1 / exp.testSiteIds.length),
    );

    let pValue = 1;
    let winner: string | null = null;

    if (se > 0) {
      const z = Math.abs(testRate - controlRate) / se;
      // Approximate p-value from z-score
      pValue = Math.exp(-0.5 * z * z);

      if (pValue < 0.05 && totalBookings >= 20) {
        // Statistically significant
        winner = testRate > controlRate ? "test" : "control";
      }
    }

    const confidenceLevel = 1 - pValue;

    await this.prisma.aiPriceExperiment.update({
      where: { id },
      data: {
        pValue,
        confidenceLevel,
        winner,
        liftPercent,
      },
    });

    // Check if we should complete and auto-apply
    if (winner && exp.autoApplyWinner && !exp.winnerApplied) {
      await this.completeExperiment(id, true);
    }
  }

  /**
   * Complete an experiment
   */
  async completeExperiment(id: string, applyWinner: boolean = false) {
    const exp = await this.prisma.aiPriceExperiment.findUnique({ where: { id } });
    if (!exp) throw new NotFoundException("Experiment not found");

    const updateData: Prisma.AiPriceExperimentUpdateInput = {
      status: "completed",
    };

    if (applyWinner && exp.winner) {
      updateData.winnerApplied = true;
      updateData.winnerAppliedAt = new Date();

      // Log the action
      await this.autonomousAction.logAction({
        campgroundId: exp.campgroundId,
        actionType: "price_adjusted",
        entityType: "price_experiment",
        entityId: id,
        description: `Experiment "${exp.name}" completed. Winner: ${exp.winner} price (${exp.winner === "test" ? "+" + exp.adjustmentPct.toFixed(1) : "control"}%)`,
        details: {
          controlBookings: exp.controlBookings,
          testBookings: exp.testBookings,
          controlRevenue: exp.controlRevenue,
          testRevenue: exp.testRevenue,
          liftPercent: exp.liftPercent,
          pValue: exp.pValue,
        },
        confidence: exp.confidenceLevel || 0,
        reasoning: exp.hypothesis,
        reversible: true,
      });

      this.logger.log(`Experiment ${id} completed. Winner: ${exp.winner}`);
    }

    return this.prisma.aiPriceExperiment.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Get experiments for a campground
   */
  async getExperiments(campgroundId: string, status?: string) {
    const where: Prisma.AiPriceExperimentWhereInput = { campgroundId };
    if (status) where.status = status;

    return this.prisma.aiPriceExperiment.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get experiment by ID
   */
  async getExperiment(id: string) {
    const exp = await this.prisma.aiPriceExperiment.findUnique({ where: { id } });
    if (!exp) throw new NotFoundException("Experiment not found");
    return exp;
  }

  // ==================== EXTENDED CRON JOBS ====================

  /**
   * Run autopilot after daily analysis (6:30 AM)
   */
  @Cron("30 6 * * *")
  async runDailyAutopilot() {
    this.logger.log("Starting daily autopilot pricing...");

    const configs = await this.prisma.aiAutopilotConfig.findMany({
      where: { dynamicPricingAiEnabled: true, dynamicPricingMode: "auto" },
      select: { campgroundId: true },
    });

    for (const config of configs) {
      try {
        const result = await this.runAutopilot(config.campgroundId);
        this.logger.log(
          `Autopilot for ${config.campgroundId}: ${result.applied} applied, ${result.skipped} skipped`,
        );
      } catch (error) {
        this.logger.error(`Autopilot failed for ${config.campgroundId}: ${error}`);
      }
    }
  }

  /**
   * Update experiment statistics daily (7 AM)
   */
  @Cron("0 7 * * *")
  async updateExperimentStats() {
    const runningExperiments = await this.prisma.aiPriceExperiment.findMany({
      where: { status: "running" },
    });

    for (const exp of runningExperiments) {
      // Check if experiment should end
      if (new Date() > exp.endDate) {
        await this.completeExperiment(exp.id, exp.autoApplyWinner);
        continue;
      }

      // Recalculate significance
      await this.calculateExperimentSignificance(exp.id);
    }

    this.logger.log(`Updated stats for ${runningExperiments.length} experiments`);
  }
}
