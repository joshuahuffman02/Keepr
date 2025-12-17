import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DateRange } from "../platform-analytics.service";

interface NpsOverview {
  score: number;
  totalResponses: number;
  promoters: number;
  passives: number;
  detractors: number;
  promoterPercentage: number;
  passivePercentage: number;
  detractorPercentage: number;
  responseRate: number;
  previousScore: number | null;
  scoreTrend: number | null;
}

interface NpsBySegment {
  segment: string;
  score: number;
  responses: number;
  promoters: number;
  detractors: number;
}

interface NpsTrend {
  period: string;
  score: number;
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
}

interface NpsComment {
  id: string;
  score: number;
  category: "promoter" | "passive" | "detractor";
  comment: string;
  sentiment: string | null;
  tags: string[];
  createdAt: Date;
  campgroundName?: string;
}

@Injectable()
export class NpsAnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate NPS score from responses
   * NPS = % Promoters (9-10) - % Detractors (0-6)
   */
  private calculateNps(responses: { score: number }[]): {
    score: number;
    promoters: number;
    passives: number;
    detractors: number;
  } {
    if (responses.length === 0) {
      return { score: 0, promoters: 0, passives: 0, detractors: 0 };
    }

    let promoters = 0;
    let passives = 0;
    let detractors = 0;

    for (const r of responses) {
      if (r.score >= 9) promoters++;
      else if (r.score >= 7) passives++;
      else detractors++;
    }

    const total = responses.length;
    const score = Math.round(((promoters - detractors) / total) * 100);

    return { score, promoters, passives, detractors };
  }

  /**
   * Get NPS overview metrics
   */
  async getOverview(dateRange: DateRange): Promise<NpsOverview> {
    const { start, end } = dateRange;

    // Get current period responses
    const responses = await this.prisma.npsResponse.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: { score: true },
    });

    // Get total invites for response rate
    const totalInvites = await this.prisma.npsInvite.count({
      where: {
        sentAt: { gte: start, lte: end },
      },
    });

    // Calculate previous period for trend
    const periodLength = end.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - periodLength);
    const previousEnd = new Date(end.getTime() - periodLength);

    const previousResponses = await this.prisma.npsResponse.findMany({
      where: {
        createdAt: { gte: previousStart, lte: previousEnd },
      },
      select: { score: true },
    });

    const current = this.calculateNps(responses);
    const previous = this.calculateNps(previousResponses);

    const total = responses.length;

    return {
      score: current.score,
      totalResponses: total,
      promoters: current.promoters,
      passives: current.passives,
      detractors: current.detractors,
      promoterPercentage: total > 0 ? (current.promoters / total) * 100 : 0,
      passivePercentage: total > 0 ? (current.passives / total) * 100 : 0,
      detractorPercentage: total > 0 ? (current.detractors / total) * 100 : 0,
      responseRate: totalInvites > 0 ? (total / totalInvites) * 100 : 0,
      previousScore: previousResponses.length > 0 ? previous.score : null,
      scoreTrend: previousResponses.length > 0 ? current.score - previous.score : null,
    };
  }

  /**
   * Get full NPS analytics
   */
  async getFullAnalytics(dateRange: DateRange) {
    const [overview, trends, byAccommodation, byCampground, recentComments, tagAnalysis] =
      await Promise.all([
        this.getOverview(dateRange),
        this.getNpsTrends(dateRange),
        this.getNpsByAccommodationType(dateRange),
        this.getNpsByCampground(dateRange),
        this.getRecentComments(dateRange),
        this.getTagAnalysis(dateRange),
      ]);

    return {
      overview,
      trends,
      byAccommodationType: byAccommodation,
      byCampground,
      recentComments,
      tagAnalysis,
    };
  }

  /**
   * Get NPS trends over time
   */
  async getNpsTrends(dateRange: DateRange): Promise<NpsTrend[]> {
    const { start, end } = dateRange;

    const responses = await this.prisma.npsResponse.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        score: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by month
    const byMonth: Record<string, { score: number }[]> = {};

    for (const r of responses) {
      const month = r.createdAt.toISOString().slice(0, 7);
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push({ score: r.score });
    }

    return Object.entries(byMonth)
      .map(([period, monthResponses]) => {
        const nps = this.calculateNps(monthResponses);
        return {
          period,
          score: nps.score,
          responses: monthResponses.length,
          promoters: nps.promoters,
          passives: nps.passives,
          detractors: nps.detractors,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Get NPS by accommodation type
   */
  async getNpsByAccommodationType(dateRange: DateRange): Promise<NpsBySegment[]> {
    const { start, end } = dateRange;

    const responses = await this.prisma.npsResponse.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        reservationId: { not: null },
      },
      select: {
        score: true,
        reservation: {
          select: {
            site: { select: { siteType: true } },
          },
        },
      },
    });

    // Group by site type
    const byType: Record<string, { score: number }[]> = {};

    for (const r of responses) {
      const type = r.reservation?.site?.siteType || "unknown";
      if (!byType[type]) byType[type] = [];
      byType[type].push({ score: r.score });
    }

    return Object.entries(byType)
      .map(([segment, typeResponses]) => {
        const nps = this.calculateNps(typeResponses);
        return {
          segment,
          score: nps.score,
          responses: typeResponses.length,
          promoters: nps.promoters,
          detractors: nps.detractors,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Get NPS by campground
   */
  async getNpsByCampground(dateRange: DateRange, limit = 20): Promise<
    {
      campgroundId: string;
      campgroundName: string;
      score: number;
      responses: number;
      promoterPercentage: number;
      detractorPercentage: number;
    }[]
  > {
    const { start, end } = dateRange;

    const responses = await this.prisma.npsResponse.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        score: true,
        campgroundId: true,
        campground: { select: { name: true } },
      },
    });

    // Group by campground
    const byCampground: Record<string, { name: string; responses: { score: number }[] }> = {};

    for (const r of responses) {
      if (!byCampground[r.campgroundId]) {
        byCampground[r.campgroundId] = {
          name: r.campground.name,
          responses: [],
        };
      }
      byCampground[r.campgroundId].responses.push({ score: r.score });
    }

    return Object.entries(byCampground)
      .map(([campgroundId, data]) => {
        const nps = this.calculateNps(data.responses);
        const total = data.responses.length;
        return {
          campgroundId,
          campgroundName: data.name,
          score: nps.score,
          responses: total,
          promoterPercentage: total > 0 ? (nps.promoters / total) * 100 : 0,
          detractorPercentage: total > 0 ? (nps.detractors / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get recent comments with sentiment
   */
  async getRecentComments(dateRange: DateRange, limit = 50): Promise<NpsComment[]> {
    const { start, end } = dateRange;

    const responses = await this.prisma.npsResponse.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        comment: { not: null },
      },
      select: {
        id: true,
        score: true,
        comment: true,
        sentiment: true,
        tags: true,
        createdAt: true,
        campground: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return responses.map((r) => ({
      id: r.id,
      score: r.score,
      category: r.score >= 9 ? "promoter" : r.score >= 7 ? "passive" : "detractor",
      comment: r.comment!,
      sentiment: r.sentiment,
      tags: r.tags,
      createdAt: r.createdAt,
      campgroundName: r.campground.name,
    }));
  }

  /**
   * Analyze common tags/themes in feedback
   */
  async getTagAnalysis(dateRange: DateRange): Promise<
    {
      tag: string;
      count: number;
      avgScore: number;
      sentiment: "positive" | "neutral" | "negative";
    }[]
  > {
    const { start, end } = dateRange;

    const responses = await this.prisma.npsResponse.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        score: true,
        tags: true,
      },
    });

    // Count tags and calculate average score per tag
    const tagData: Record<string, { count: number; totalScore: number }> = {};

    for (const r of responses) {
      for (const tag of r.tags) {
        if (!tagData[tag]) {
          tagData[tag] = { count: 0, totalScore: 0 };
        }
        tagData[tag].count++;
        tagData[tag].totalScore += r.score;
      }
    }

    return Object.entries(tagData)
      .map(([tag, data]) => {
        const avgScore = data.count > 0 ? data.totalScore / data.count : 0;
        let sentiment: "positive" | "neutral" | "negative";
        if (avgScore >= 8) sentiment = "positive";
        else if (avgScore >= 6) sentiment = "neutral";
        else sentiment = "negative";

        return {
          tag,
          count: data.count,
          avgScore,
          sentiment,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  /**
   * Get NPS score distribution (histogram)
   */
  async getScoreDistribution(dateRange: DateRange): Promise<{ score: number; count: number }[]> {
    const { start, end } = dateRange;

    const responses = await this.prisma.npsResponse.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: { score: true },
    });

    // Initialize all scores 0-10
    const distribution: Record<number, number> = {};
    for (let i = 0; i <= 10; i++) {
      distribution[i] = 0;
    }

    for (const r of responses) {
      distribution[r.score]++;
    }

    return Object.entries(distribution)
      .map(([score, count]) => ({
        score: parseInt(score),
        count,
      }))
      .sort((a, b) => a.score - b.score);
  }
}
