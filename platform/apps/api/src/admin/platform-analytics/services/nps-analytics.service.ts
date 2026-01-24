import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DateRange } from "../platform-analytics.service";

export interface NpsOverview {
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
  // YoY comparison
  yoyScore: number | null;
  yoyChange: number | null;
  yoyResponses: number | null;
  yoyResponsesChange: number | null;
}

export interface NpsBySegment {
  segment: string;
  score: number;
  responses: number;
  promoters: number;
  detractors: number;
}

export interface NpsTrend {
  period: string;
  score: number;
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
}

export interface NpsComment {
  id: string;
  score: number;
  category: "promoter" | "passive" | "detractor";
  comment: string;
  sentiment: string | null;
  tags: string[];
  createdAt: Date;
  campgroundName?: string;
}

export interface NpsBySeason {
  season: string;
  score: number;
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
}

export interface NpsByGuestType {
  guestType: "first_time" | "repeat";
  score: number;
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
  avgLifetimeValue?: number;
}

export interface DetractorFollowUp {
  id: string;
  score: number;
  comment: string;
  campgroundName: string;
  guestEmail?: string;
  createdAt: Date;
  followedUp: boolean;
  followUpAt?: Date;
  followUpNote?: string;
  resolved: boolean;
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

    // Calculate YoY comparison (same period last year)
    const yoyStart = new Date(start);
    yoyStart.setFullYear(yoyStart.getFullYear() - 1);
    const yoyEnd = new Date(end);
    yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);

    const yoyResponses = await this.prisma.npsResponse.findMany({
      where: {
        createdAt: { gte: yoyStart, lte: yoyEnd },
      },
      select: { score: true },
    });

    const current = this.calculateNps(responses);
    const previous = this.calculateNps(previousResponses);
    const yoy = this.calculateNps(yoyResponses);

    const total = responses.length;
    const yoyTotal = yoyResponses.length;

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
      // YoY data
      yoyScore: yoyTotal > 0 ? yoy.score : null,
      yoyChange: yoyTotal > 0 ? current.score - yoy.score : null,
      yoyResponses: yoyTotal > 0 ? yoyTotal : null,
      yoyResponsesChange: yoyTotal > 0 ? ((total - yoyTotal) / yoyTotal) * 100 : null,
    };
  }

  /**
   * Get full NPS analytics
   */
  async getFullAnalytics(dateRange: DateRange) {
    const [
      overview,
      trends,
      byAccommodation,
      byCampground,
      worstCampgrounds,
      recentComments,
      tagAnalysis,
      byGuestType,
      bySeason,
      detractorFollowUps,
    ] = await Promise.all([
      this.getOverview(dateRange),
      this.getNpsTrends(dateRange),
      this.getNpsByAccommodationType(dateRange),
      this.getNpsByCampground(dateRange),
      this.getWorstPerformingCampgrounds(dateRange),
      this.getRecentComments(dateRange),
      this.getTagAnalysis(dateRange),
      this.getNpsByGuestType(dateRange),
      this.getNpsBySeason(dateRange),
      this.getDetractorFollowUps(dateRange),
    ]);

    return {
      overview,
      trends,
      byAccommodationType: byAccommodation,
      byCampground,
      worstCampgrounds,
      recentComments,
      tagAnalysis,
      byGuestType,
      bySeason,
      detractorFollowUps,
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
        Reservation: {
          select: {
            Site: { select: { siteType: true } },
          },
        },
      },
    });

    // Group by site type
    const byType: Record<string, { score: number }[]> = {};

    for (const r of responses) {
      const type = r.Reservation?.Site?.siteType || "unknown";
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
  async getNpsByCampground(
    dateRange: DateRange,
    limit = 20,
  ): Promise<
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
        Campground: { select: { name: true } },
      },
    });

    // Group by campground
    const byCampground: Record<string, { name: string; responses: { score: number }[] }> = {};

    for (const r of responses) {
      if (!byCampground[r.campgroundId]) {
        byCampground[r.campgroundId] = {
          name: r.Campground.name,
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
   * Get worst performing campgrounds (lowest NPS scores)
   * Includes top issues from negative feedback
   */
  async getWorstPerformingCampgrounds(
    dateRange: DateRange,
    limit = 10,
  ): Promise<
    {
      campgroundId: string;
      campgroundName: string;
      score: number;
      responses: number;
      promoterPercentage: number;
      detractorPercentage: number;
      topIssues: string[];
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
        campgroundId: true,
        Campground: { select: { name: true } },
      },
    });

    // Group by campground with tag analysis
    const byCampground: Record<
      string,
      { name: string; responses: { score: number }[]; tagCounts: Record<string, number> }
    > = {};

    for (const r of responses) {
      if (!byCampground[r.campgroundId]) {
        byCampground[r.campgroundId] = {
          name: r.Campground.name,
          responses: [],
          tagCounts: {},
        };
      }
      byCampground[r.campgroundId].responses.push({ score: r.score });

      // Count tags from detractor responses (score 0-6)
      if (r.score <= 6) {
        for (const tag of r.tags) {
          byCampground[r.campgroundId].tagCounts[tag] =
            (byCampground[r.campgroundId].tagCounts[tag] || 0) + 1;
        }
      }
    }

    return Object.entries(byCampground)
      .map(([campgroundId, data]) => {
        const nps = this.calculateNps(data.responses);
        const total = data.responses.length;

        // Get top 2 issues from negative feedback
        const topIssues = Object.entries(data.tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([tag]) => tag);

        return {
          campgroundId,
          campgroundName: data.name,
          score: nps.score,
          responses: total,
          promoterPercentage: total > 0 ? (nps.promoters / total) * 100 : 0,
          detractorPercentage: total > 0 ? (nps.detractors / total) * 100 : 0,
          topIssues,
        };
      })
      .filter((cg) => cg.responses >= 10) // Only include campgrounds with enough data
      .sort((a, b) => a.score - b.score) // Sort ascending (worst first)
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
        Campground: { select: { name: true } },
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
      campgroundName: r.Campground.name,
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

  /**
   * Get NPS by guest type (first-time vs repeat)
   */
  async getNpsByGuestType(dateRange: DateRange): Promise<NpsByGuestType[]> {
    const { start, end } = dateRange;

    const responses = await this.prisma.npsResponse.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        guestId: { not: null },
      },
      select: {
        score: true,
        Guest: {
          select: {
            repeatStays: true,
          },
        },
      },
    });

    const firstTime: { score: number }[] = [];
    const repeat: { score: number }[] = [];

    for (const r of responses) {
      const isRepeat = (r.Guest?.repeatStays || 0) > 1;
      if (isRepeat) {
        repeat.push({ score: r.score });
      } else {
        firstTime.push({ score: r.score });
      }
    }

    const firstTimeNps = this.calculateNps(firstTime);
    const repeatNps = this.calculateNps(repeat);

    return [
      {
        guestType: "first_time",
        score: firstTimeNps.score,
        responses: firstTime.length,
        promoters: firstTimeNps.promoters,
        passives: firstTimeNps.passives,
        detractors: firstTimeNps.detractors,
      },
      {
        guestType: "repeat",
        score: repeatNps.score,
        responses: repeat.length,
        promoters: repeatNps.promoters,
        passives: repeatNps.passives,
        detractors: repeatNps.detractors,
      },
    ];
  }

  /**
   * Get NPS by season
   */
  async getNpsBySeason(dateRange: DateRange): Promise<NpsBySeason[]> {
    const { start, end } = dateRange;

    const responses = await this.prisma.npsResponse.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        score: true,
        createdAt: true,
      },
    });

    const getSeason = (date: Date): string => {
      const month = date.getMonth();
      if (month >= 2 && month <= 4) return "Spring";
      if (month >= 5 && month <= 7) return "Summer";
      if (month >= 8 && month <= 10) return "Fall";
      return "Winter";
    };

    const bySeason: Record<string, { score: number }[]> = {
      Spring: [],
      Summer: [],
      Fall: [],
      Winter: [],
    };

    for (const r of responses) {
      const season = getSeason(r.createdAt);
      bySeason[season].push({ score: r.score });
    }

    return Object.entries(bySeason).map(([season, seasonResponses]) => {
      const nps = this.calculateNps(seasonResponses);
      return {
        season,
        score: nps.score,
        responses: seasonResponses.length,
        promoters: nps.promoters,
        passives: nps.passives,
        detractors: nps.detractors,
      };
    });
  }

  /**
   * Get detractors for follow-up tracking
   * Returns detractors (score 0-6) with their contact info and follow-up status
   */
  async getDetractorFollowUps(dateRange: DateRange, limit = 50): Promise<DetractorFollowUp[]> {
    const { start, end } = dateRange;

    const responses = await this.prisma.npsResponse.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        score: { lte: 6 },
      },
      select: {
        id: true,
        score: true,
        comment: true,
        createdAt: true,
        followedUp: true,
        followUpAt: true,
        followUpNote: true,
        resolved: true,
        resolvedAt: true,
        resolvedNote: true,
        Campground: { select: { name: true } },
        Guest: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return responses.map((r) => ({
      id: r.id,
      score: r.score,
      comment: r.comment || "",
      campgroundName: r.Campground.name,
      guestEmail: r.Guest?.email,
      createdAt: r.createdAt,
      followedUp: r.followedUp,
      followUpAt: r.followUpAt ?? undefined,
      followUpNote: r.followUpNote ?? undefined,
      resolved: r.resolved,
      resolvedAt: r.resolvedAt,
      resolvedNote: r.resolvedNote,
    }));
  }
}
