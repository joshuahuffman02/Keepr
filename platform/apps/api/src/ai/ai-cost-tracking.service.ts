import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AiFeatureType, type Prisma } from "@prisma/client";

/**
 * Cost per 1000 tokens in cents (multiply by 100 to get per-token cost in microcents)
 * Prices as of Jan 2025 - should be updated periodically
 */
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // OpenAI models (cents per 1K tokens)
  "gpt-4o": { input: 0.25, output: 1.0 }, // $2.50/1M input, $10/1M output
  "gpt-4o-mini": { input: 0.015, output: 0.06 }, // $0.15/1M input, $0.60/1M output
  "gpt-4-turbo": { input: 1.0, output: 3.0 }, // $10/1M input, $30/1M output
  "gpt-4": { input: 3.0, output: 6.0 }, // $30/1M input, $60/1M output
  "gpt-3.5-turbo": { input: 0.05, output: 0.15 }, // $0.50/1M input, $1.50/1M output

  // Anthropic models (cents per 1K tokens)
  "claude-3-opus": { input: 1.5, output: 7.5 }, // $15/1M input, $75/1M output
  "claude-3-sonnet": { input: 0.3, output: 1.5 }, // $3/1M input, $15/1M output
  "claude-3-haiku": { input: 0.025, output: 0.125 }, // $0.25/1M input, $1.25/1M output
  "claude-3-haiku-20240307": { input: 0.025, output: 0.125 },
  "claude-3-5-sonnet": { input: 0.3, output: 1.5 },
  "claude-3-5-haiku": { input: 0.1, output: 0.5 },

  // Local models
  local: { input: 0, output: 0 },
  ollama: { input: 0, output: 0 },
};

export interface DailyCostSummary {
  date: string;
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  successRate: number;
  byFeature: Record<
    string,
    {
      costCents: number;
      requests: number;
      inputTokens: number;
      outputTokens: number;
    }
  >;
  byModel: Record<
    string,
    {
      costCents: number;
      requests: number;
    }
  >;
}

export interface MonthlyCostSummary {
  month: string; // YYYY-MM
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  successRate: number;
  dailyBreakdown: DailyCostSummary[];
  budgetCents?: number;
  budgetUsedPercent?: number;
}

export interface FeatureCostSummary {
  feature: AiFeatureType;
  totalCostCents: number;
  totalRequests: number;
  avgCostPerRequest: number;
  avgLatencyMs: number;
  successRate: number;
  trend: "up" | "down" | "stable";
  trendPercent: number;
}

export interface LatencyMetrics {
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  byFeature: Record<
    string,
    {
      p50Ms: number;
      p90Ms: number;
      avgMs: number;
    }
  >;
  byModel: Record<
    string,
    {
      p50Ms: number;
      p90Ms: number;
      avgMs: number;
    }
  >;
}

@Injectable()
export class AiCostTrackingService {
  private readonly logger = new Logger(AiCostTrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate cost for a single API call based on token usage
   */
  calculateCost(inputTokens: number, outputTokens: number, model: string): number {
    const modelKey = this.normalizeModelName(model);
    const costs = MODEL_COSTS[modelKey] || MODEL_COSTS["gpt-4o-mini"];

    const inputCost = (inputTokens / 1000) * costs.input;
    const outputCost = (outputTokens / 1000) * costs.output;

    // Return cost in cents, rounded to 2 decimal places
    return Math.round((inputCost + outputCost) * 100) / 100;
  }

  /**
   * Get daily cost summary for a date range
   */
  async getDailyCosts(
    startDate: Date,
    endDate: Date,
    campgroundId?: string,
  ): Promise<DailyCostSummary[]> {
    const where: Prisma.AiInteractionLogWhereInput = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (campgroundId) {
      where.campgroundId = campgroundId;
    }

    const logs = await this.prisma.aiInteractionLog.findMany({
      where,
      select: {
        createdAt: true,
        featureType: true,
        modelUsed: true,
        inputTokens: true,
        outputTokens: true,
        tokensUsed: true,
        costCents: true,
        success: true,
        latencyMs: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by date
    const dailyMap = new Map<string, DailyCostSummary>();

    for (const log of logs) {
      const dateStr = log.createdAt.toISOString().split("T")[0];

      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, {
          date: dateStr,
          totalCostCents: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalRequests: 0,
          successRate: 0,
          byFeature: {},
          byModel: {},
        });
      }

      const day = dailyMap.get(dateStr)!;
      const inputTokens = log.inputTokens || 0;
      const outputTokens = log.outputTokens || 0;
      const costCents =
        log.costCents ||
        this.calculateCost(inputTokens, outputTokens, log.modelUsed || "gpt-4o-mini");

      day.totalCostCents += costCents;
      day.totalInputTokens += inputTokens;
      day.totalOutputTokens += outputTokens;
      day.totalRequests += 1;

      // By feature
      const feature = log.featureType;
      if (!day.byFeature[feature]) {
        day.byFeature[feature] = { costCents: 0, requests: 0, inputTokens: 0, outputTokens: 0 };
      }
      day.byFeature[feature].costCents += costCents;
      day.byFeature[feature].requests += 1;
      day.byFeature[feature].inputTokens += inputTokens;
      day.byFeature[feature].outputTokens += outputTokens;

      // By model
      const model = log.modelUsed || "unknown";
      if (!day.byModel[model]) {
        day.byModel[model] = { costCents: 0, requests: 0 };
      }
      day.byModel[model].costCents += costCents;
      day.byModel[model].requests += 1;
    }

    // Calculate success rates
    for (const [dateStr, day] of dailyMap) {
      const dayLogs = logs.filter((l) => l.createdAt.toISOString().split("T")[0] === dateStr);
      const successCount = dayLogs.filter((l) => l.success).length;
      day.successRate = day.totalRequests > 0 ? (successCount / day.totalRequests) * 100 : 0;
    }

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get monthly cost summary
   */
  async getMonthlyCosts(
    year: number,
    month: number,
    campgroundId?: string,
  ): Promise<MonthlyCostSummary> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const dailyCosts = await this.getDailyCosts(startDate, endDate, campgroundId);

    // Get campground budget if specified
    let budgetCents: number | undefined;
    if (campgroundId) {
      const campground = await this.prisma.campground.findUnique({
        where: { id: campgroundId },
        select: { aiMonthlyBudgetCents: true },
      });
      budgetCents = campground?.aiMonthlyBudgetCents || undefined;
    }

    const totalCostCents = dailyCosts.reduce((sum, d) => sum + d.totalCostCents, 0);
    const totalInputTokens = dailyCosts.reduce((sum, d) => sum + d.totalInputTokens, 0);
    const totalOutputTokens = dailyCosts.reduce((sum, d) => sum + d.totalOutputTokens, 0);
    const totalRequests = dailyCosts.reduce((sum, d) => sum + d.totalRequests, 0);
    const avgSuccessRate =
      dailyCosts.length > 0
        ? dailyCosts.reduce((sum, d) => sum + d.successRate, 0) / dailyCosts.length
        : 0;

    return {
      month: `${year}-${month.toString().padStart(2, "0")}`,
      totalCostCents,
      totalInputTokens,
      totalOutputTokens,
      totalRequests,
      successRate: avgSuccessRate,
      dailyBreakdown: dailyCosts,
      budgetCents,
      budgetUsedPercent: budgetCents ? (totalCostCents / budgetCents) * 100 : undefined,
    };
  }

  /**
   * Get costs broken down by feature
   */
  async getCostsByFeature(
    startDate: Date,
    endDate: Date,
    campgroundId?: string,
  ): Promise<FeatureCostSummary[]> {
    const where: Prisma.AiInteractionLogWhereInput = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (campgroundId) {
      where.campgroundId = campgroundId;
    }

    // Get current period data
    const currentLogs = await this.prisma.aiInteractionLog.groupBy({
      by: ["featureType"],
      where,
      _sum: {
        costCents: true,
        latencyMs: true,
      },
      _count: {
        id: true,
      },
      _avg: {
        latencyMs: true,
      },
    });

    // Get previous period for trend comparison
    const periodLength = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodLength);
    const prevEndDate = new Date(startDate.getTime() - 1);

    const prevLogs = await this.prisma.aiInteractionLog.groupBy({
      by: ["featureType"],
      where: {
        ...where,
        createdAt: {
          gte: prevStartDate,
          lte: prevEndDate,
        },
      },
      _sum: {
        costCents: true,
      },
      _count: {
        id: true,
      },
    });

    // Calculate success rates per feature
    const successRates = await this.prisma.aiInteractionLog.groupBy({
      by: ["featureType", "success"],
      where,
      _count: {
        id: true,
      },
    });

    const successRateMap = new Map<string, number>();
    const featureCountsMap = new Map<string, { success: number; total: number }>();

    for (const sr of successRates) {
      const feature = sr.featureType;
      if (!featureCountsMap.has(feature)) {
        featureCountsMap.set(feature, { success: 0, total: 0 });
      }
      const counts = featureCountsMap.get(feature)!;
      counts.total += sr._count.id;
      if (sr.success) {
        counts.success += sr._count.id;
      }
    }

    for (const [feature, counts] of featureCountsMap) {
      successRateMap.set(feature, counts.total > 0 ? (counts.success / counts.total) * 100 : 0);
    }

    // Build result
    const prevMap = new Map(prevLogs.map((p) => [p.featureType, p._sum.costCents || 0]));

    return currentLogs
      .map((log) => {
        const currentCost = log._sum.costCents || 0;
        const prevCost = prevMap.get(log.featureType) || 0;
        const trendPercent = prevCost > 0 ? ((currentCost - prevCost) / prevCost) * 100 : 0;
        const trend: FeatureCostSummary["trend"] =
          trendPercent > 5 ? "up" : trendPercent < -5 ? "down" : "stable";

        return {
          feature: log.featureType,
          totalCostCents: currentCost,
          totalRequests: log._count.id,
          avgCostPerRequest: log._count.id > 0 ? currentCost / log._count.id : 0,
          avgLatencyMs: log._avg.latencyMs || 0,
          successRate: successRateMap.get(log.featureType) || 0,
          trend,
          trendPercent: Math.round(trendPercent * 100) / 100,
        };
      })
      .sort((a, b) => b.totalCostCents - a.totalCostCents);
  }

  /**
   * Get latency percentiles across all AI calls
   */
  async getLatencyMetrics(
    startDate: Date,
    endDate: Date,
    campgroundId?: string,
  ): Promise<LatencyMetrics> {
    const where: Prisma.AiInteractionLogWhereInput = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      success: true, // Only consider successful calls for latency
    };

    if (campgroundId) {
      where.campgroundId = campgroundId;
    }

    const logs = await this.prisma.aiInteractionLog.findMany({
      where,
      select: {
        latencyMs: true,
        featureType: true,
        modelUsed: true,
      },
      orderBy: { latencyMs: "asc" },
    });

    if (logs.length === 0) {
      return {
        p50Ms: 0,
        p90Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
        avgMs: 0,
        minMs: 0,
        maxMs: 0,
        byFeature: {},
        byModel: {},
      };
    }

    const latencies = logs.map((l) => l.latencyMs);
    const sorted = [...latencies].sort((a, b) => a - b);

    // Calculate percentiles
    const p50 = this.percentile(sorted, 50);
    const p90 = this.percentile(sorted, 90);
    const p95 = this.percentile(sorted, 95);
    const p99 = this.percentile(sorted, 99);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    // By feature
    const byFeature: Record<string, { p50Ms: number; p90Ms: number; avgMs: number }> = {};
    const featureLatencies = new Map<string, number[]>();

    for (const log of logs) {
      if (!featureLatencies.has(log.featureType)) {
        featureLatencies.set(log.featureType, []);
      }
      featureLatencies.get(log.featureType)!.push(log.latencyMs);
    }

    for (const [feature, lats] of featureLatencies) {
      const sortedLats = [...lats].sort((a, b) => a - b);
      byFeature[feature] = {
        p50Ms: this.percentile(sortedLats, 50),
        p90Ms: this.percentile(sortedLats, 90),
        avgMs: lats.reduce((a, b) => a + b, 0) / lats.length,
      };
    }

    // By model
    const byModel: Record<string, { p50Ms: number; p90Ms: number; avgMs: number }> = {};
    const modelLatencies = new Map<string, number[]>();

    for (const log of logs) {
      const model = log.modelUsed || "unknown";
      if (!modelLatencies.has(model)) {
        modelLatencies.set(model, []);
      }
      modelLatencies.get(model)!.push(log.latencyMs);
    }

    for (const [model, lats] of modelLatencies) {
      const sortedLats = [...lats].sort((a, b) => a - b);
      byModel[model] = {
        p50Ms: this.percentile(sortedLats, 50),
        p90Ms: this.percentile(sortedLats, 90),
        avgMs: lats.reduce((a, b) => a + b, 0) / lats.length,
      };
    }

    return {
      p50Ms: p50,
      p90Ms: p90,
      p95Ms: p95,
      p99Ms: p99,
      avgMs: Math.round(avg),
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1],
      byFeature,
      byModel,
    };
  }

  /**
   * Get platform-wide AI usage summary (for platform admins)
   */
  async getPlatformSummary(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalCostCents: number;
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    successRate: number;
    topCampgrounds: { campgroundId: string; name: string; costCents: number; requests: number }[];
    topModels: { model: string; costCents: number; requests: number }[];
    costTrend: { date: string; costCents: number }[];
  }> {
    const where = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Overall stats
    const stats = await this.prisma.aiInteractionLog.aggregate({
      where,
      _sum: {
        costCents: true,
        inputTokens: true,
        outputTokens: true,
        tokensUsed: true,
      },
      _count: {
        id: true,
      },
    });

    const successCount = await this.prisma.aiInteractionLog.count({
      where: { ...where, success: true },
    });

    // Top campgrounds by cost
    const byCampground = await this.prisma.aiInteractionLog.groupBy({
      by: ["campgroundId"],
      where,
      _sum: { costCents: true },
      _count: { id: true },
      orderBy: { _sum: { costCents: "desc" } },
      take: 10,
    });

    // Get campground names
    const campgroundIds = byCampground.map((c) => c.campgroundId);
    const campgrounds = await this.prisma.campground.findMany({
      where: { id: { in: campgroundIds } },
      select: { id: true, name: true },
    });
    const campgroundNames = new Map(campgrounds.map((c) => [c.id, c.name]));

    // Top models
    const byModel = await this.prisma.aiInteractionLog.groupBy({
      by: ["modelUsed"],
      where,
      _sum: { costCents: true },
      _count: { id: true },
      orderBy: { _sum: { costCents: "desc" } },
      take: 5,
    });

    // Cost trend by day
    const dailyCosts = await this.getDailyCosts(startDate, endDate);

    return {
      totalCostCents: stats._sum.costCents || 0,
      totalRequests: stats._count.id,
      totalInputTokens: stats._sum.inputTokens || 0,
      totalOutputTokens: stats._sum.outputTokens || 0,
      successRate: stats._count.id > 0 ? (successCount / stats._count.id) * 100 : 0,
      topCampgrounds: byCampground.map((c) => ({
        campgroundId: c.campgroundId,
        name: campgroundNames.get(c.campgroundId) || "Unknown",
        costCents: c._sum.costCents || 0,
        requests: c._count.id,
      })),
      topModels: byModel.map((m) => ({
        model: m.modelUsed || "unknown",
        costCents: m._sum.costCents || 0,
        requests: m._count.id,
      })),
      costTrend: dailyCosts.map((d) => ({
        date: d.date,
        costCents: d.totalCostCents,
      })),
    };
  }

  /**
   * Check if a campground is approaching or over budget
   */
  async checkBudgetStatus(campgroundId: string): Promise<{
    budgetCents: number | null;
    usedCents: number;
    usedPercent: number;
    status: "ok" | "warning" | "exceeded";
    projectedMonthEndCents: number;
  }> {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { aiMonthlyBudgetCents: true },
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const usedStats = await this.prisma.aiInteractionLog.aggregate({
      where: {
        campgroundId,
        createdAt: {
          gte: monthStart,
          lte: now,
        },
      },
      _sum: { costCents: true },
    });

    const usedCents = usedStats._sum.costCents || 0;
    const budgetCents = campground?.aiMonthlyBudgetCents || null;

    // Project month-end usage based on current rate
    const daysElapsed = Math.max(1, (now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24));
    const totalDays = (monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24);
    const projectedMonthEndCents = Math.round((usedCents / daysElapsed) * totalDays);

    let status: "ok" | "warning" | "exceeded" = "ok";
    let usedPercent = 0;

    if (budgetCents) {
      usedPercent = (usedCents / budgetCents) * 100;
      if (usedPercent >= 100) {
        status = "exceeded";
      } else if (usedPercent >= 80) {
        status = "warning";
      }
    }

    return {
      budgetCents,
      usedCents,
      usedPercent: Math.round(usedPercent * 100) / 100,
      status,
      projectedMonthEndCents,
    };
  }

  /**
   * Calculate percentile value from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  }

  /**
   * Normalize model names for cost lookup
   */
  private normalizeModelName(model: string): string {
    const normalized = model.toLowerCase();

    // Handle versioned model names
    if (normalized.includes("gpt-4o-mini")) return "gpt-4o-mini";
    if (normalized.includes("gpt-4o")) return "gpt-4o";
    if (normalized.includes("gpt-4-turbo")) return "gpt-4-turbo";
    if (normalized.includes("gpt-4")) return "gpt-4";
    if (normalized.includes("gpt-3.5")) return "gpt-3.5-turbo";

    if (normalized.includes("claude-3-opus")) return "claude-3-opus";
    if (normalized.includes("claude-3-5-sonnet")) return "claude-3-5-sonnet";
    if (normalized.includes("claude-3-sonnet")) return "claude-3-sonnet";
    if (normalized.includes("claude-3-5-haiku")) return "claude-3-5-haiku";
    if (normalized.includes("claude-3-haiku")) return "claude-3-haiku";

    if (normalized.includes("local") || normalized.includes("ollama")) return "local";

    return model;
  }
}
