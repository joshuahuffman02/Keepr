import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DateRange } from "../platform-analytics.service";

export interface ImprovementSuggestion {
  campgroundId: string;
  campgroundName: string;
  npsScore: number;
  primaryIssues: string[];
  suggestions: {
    priority: "high" | "medium" | "low";
    category: string;
    title: string;
    description: string;
    expectedImpact: string;
    estimatedEffort: "low" | "medium" | "high";
  }[];
  detractorCount: number;
  topComplaints: string[];
}

export interface AnomalyAlert {
  id: string;
  type: "nps_drop" | "cancellation_spike" | "revenue_decline" | "booking_slowdown";
  severity: "warning" | "critical";
  campgroundId?: string;
  campgroundName?: string;
  message: string;
  currentValue: number;
  expectedValue: number;
  deviationPercent: number;
  detectedAt: Date;
  recommendations: string[];
}

@Injectable()
export class AiSuggestionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate AI-powered improvement suggestions for struggling campgrounds
   */
  async getImprovementSuggestions(dateRange: DateRange): Promise<ImprovementSuggestion[]> {
    const { start, end } = dateRange;

    // Get NPS responses with comments for analysis
    const responses = await this.prisma.npsResponse.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        score: true,
        comment: true,
        tags: true,
        campgroundId: true,
        Campground: { select: { name: true } },
      },
    });

    // Group by campground
    const byCampground: Record<
      string,
      {
        name: string;
        scores: number[];
        comments: string[];
        tags: Record<string, number>;
      }
    > = {};

    for (const r of responses) {
      if (!byCampground[r.campgroundId]) {
        byCampground[r.campgroundId] = {
          name: r.Campground.name,
          scores: [],
          comments: [],
          tags: {},
        };
      }
      byCampground[r.campgroundId].scores.push(r.score);
      if (r.comment && r.score <= 6) {
        byCampground[r.campgroundId].comments.push(r.comment);
      }
      // Count tags from detractor responses
      if (r.score <= 6) {
        for (const tag of r.tags) {
          byCampground[r.campgroundId].tags[tag] =
            (byCampground[r.campgroundId].tags[tag] || 0) + 1;
        }
      }
    }

    const suggestions: ImprovementSuggestion[] = [];

    for (const [campgroundId, data] of Object.entries(byCampground)) {
      const promoters = data.scores.filter((s) => s >= 9).length;
      const detractors = data.scores.filter((s) => s <= 6).length;
      const nps = Math.round(((promoters - detractors) / data.scores.length) * 100);

      // Only generate suggestions for campgrounds with low NPS
      if (nps < 30 && data.scores.length >= 5) {
        // Get top issues from tags
        const topIssues = Object.entries(data.tags)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([tag]) => tag);

        // Generate suggestions based on common issues
        const generatedSuggestions = this.generateSuggestionsForIssues(topIssues, nps);

        suggestions.push({
          campgroundId,
          campgroundName: data.name,
          npsScore: nps,
          primaryIssues: topIssues,
          suggestions: generatedSuggestions,
          detractorCount: detractors,
          topComplaints: data.comments.slice(0, 5),
        });
      }
    }

    return suggestions.sort((a, b) => a.npsScore - b.npsScore);
  }

  /**
   * Generate specific suggestions based on identified issues
   */
  private generateSuggestionsForIssues(
    issues: string[],
    nps: number,
  ): ImprovementSuggestion["suggestions"] {
    const suggestionMap: Record<string, ImprovementSuggestion["suggestions"][0]> = {
      cleanliness: {
        priority: "high",
        category: "Operations",
        title: "Implement Daily Cleanliness Audits",
        description:
          "Establish a daily inspection checklist for restrooms, common areas, and sites. Assign accountability to specific staff members.",
        expectedImpact: "Can improve NPS by 10-15 points",
        estimatedEffort: "low",
      },
      staff: {
        priority: "high",
        category: "Training",
        title: "Customer Service Training Program",
        description:
          "Implement monthly customer service training sessions focusing on guest interactions, problem resolution, and proactive service.",
        expectedImpact: "Can improve NPS by 8-12 points",
        estimatedEffort: "medium",
      },
      wifi: {
        priority: "medium",
        category: "Infrastructure",
        title: "Upgrade WiFi Infrastructure",
        description:
          "Assess current WiFi coverage and bandwidth. Consider mesh network systems or additional access points for better coverage.",
        expectedImpact: "Can improve NPS by 5-8 points",
        estimatedEffort: "medium",
      },
      noise: {
        priority: "high",
        category: "Policies",
        title: "Enforce Quiet Hours",
        description:
          "Clearly communicate quiet hours (10 PM - 8 AM) at check-in and via signage. Train staff on diplomatic enforcement procedures.",
        expectedImpact: "Can improve NPS by 8-10 points",
        estimatedEffort: "low",
      },
      facilities: {
        priority: "medium",
        category: "Maintenance",
        title: "Facilities Maintenance Program",
        description:
          "Create a preventive maintenance schedule for all facilities. Address repair requests within 24 hours.",
        expectedImpact: "Can improve NPS by 6-10 points",
        estimatedEffort: "medium",
      },
      value: {
        priority: "medium",
        category: "Pricing",
        title: "Value Enhancement Strategy",
        description:
          "Review pricing against local competitors. Consider adding value through complimentary amenities (coffee, firewood) rather than price cuts.",
        expectedImpact: "Can improve NPS by 5-8 points",
        estimatedEffort: "low",
      },
      amenities: {
        priority: "medium",
        category: "Guest Experience",
        title: "Amenity Audit and Enhancement",
        description:
          "Survey guests on desired amenities. Prioritize additions that have highest demand and ROI (e.g., dog park, playground equipment).",
        expectedImpact: "Can improve NPS by 5-10 points",
        estimatedEffort: "high",
      },
      "check-in": {
        priority: "high",
        category: "Operations",
        title: "Streamline Check-in Process",
        description:
          "Implement online pre-check-in, provide clear arrival instructions, and consider after-hours self-check-in options.",
        expectedImpact: "Can improve NPS by 5-8 points",
        estimatedEffort: "medium",
      },
      bathrooms: {
        priority: "high",
        category: "Maintenance",
        title: "Bathroom Renovation Priority",
        description:
          "Schedule deep cleaning twice daily during peak seasons. Budget for fixture updates if facilities are dated.",
        expectedImpact: "Can improve NPS by 10-15 points",
        estimatedEffort: "medium",
      },
      sites: {
        priority: "medium",
        category: "Infrastructure",
        title: "Site Quality Improvements",
        description:
          "Address drainage issues, level pads, and ensure adequate spacing between sites. Consider site-specific upgrades for premium pricing.",
        expectedImpact: "Can improve NPS by 5-10 points",
        estimatedEffort: "high",
      },
      management: {
        priority: "high",
        category: "Leadership",
        title: "Management Responsiveness Training",
        description:
          "Ensure management is visible and accessible. Implement a system for escalating and resolving guest concerns within 2 hours.",
        expectedImpact: "Can improve NPS by 8-12 points",
        estimatedEffort: "low",
      },
      maintenance: {
        priority: "medium",
        category: "Operations",
        title: "Proactive Maintenance System",
        description:
          "Implement work order system for tracking repairs. Conduct weekly site inspections to identify issues before guests report them.",
        expectedImpact: "Can improve NPS by 5-8 points",
        estimatedEffort: "medium",
      },
    };

    // Generate suggestions based on issues
    const suggestions: ImprovementSuggestion["suggestions"] = [];

    for (const issue of issues) {
      const suggestion = suggestionMap[issue.toLowerCase()];
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // If NPS is very low, add a general high-priority suggestion
    if (nps < 0) {
      suggestions.unshift({
        priority: "high",
        category: "Leadership",
        title: "Conduct Emergency Service Review",
        description:
          "With negative NPS, immediate intervention is required. Schedule on-site management review, mystery guest evaluation, and staff meeting to address core issues.",
        expectedImpact: "Foundation for all other improvements",
        estimatedEffort: "low",
      });
    }

    // Add a communication suggestion if not already included
    if (!issues.includes("staff") && suggestions.length < 4) {
      suggestions.push({
        priority: "medium",
        category: "Communication",
        title: "Guest Communication Enhancement",
        description:
          "Send pre-arrival emails with helpful information, check in with guests during stay, and follow up post-stay for feedback.",
        expectedImpact: "Can improve NPS by 3-5 points",
        estimatedEffort: "low",
      });
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Detect anomalies in analytics data
   */
  async detectAnomalies(dateRange: DateRange): Promise<AnomalyAlert[]> {
    const { start, end } = dateRange;
    const alerts: AnomalyAlert[] = [];

    // Calculate period length for previous comparison
    const periodLength = end.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - periodLength);
    const previousEnd = new Date(end.getTime() - periodLength);

    // Check NPS drops by campground
    const [currentNps, previousNps] = await Promise.all([
      this.prisma.npsResponse.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { score: true, campgroundId: true, Campground: { select: { name: true } } },
      }),
      this.prisma.npsResponse.findMany({
        where: { createdAt: { gte: previousStart, lte: previousEnd } },
        select: { score: true, campgroundId: true },
      }),
    ]);

    // Group by campground
    const currentByCg: Record<string, { name: string; scores: number[] }> = {};
    const previousByCg: Record<string, number[]> = {};

    for (const r of currentNps) {
      if (!currentByCg[r.campgroundId]) {
        currentByCg[r.campgroundId] = { name: r.Campground.name, scores: [] };
      }
      currentByCg[r.campgroundId].scores.push(r.score);
    }

    for (const r of previousNps) {
      if (!previousByCg[r.campgroundId]) previousByCg[r.campgroundId] = [];
      previousByCg[r.campgroundId].push(r.score);
    }

    // Calculate NPS and detect significant drops
    for (const [cgId, data] of Object.entries(currentByCg)) {
      if (data.scores.length >= 5 && previousByCg[cgId]?.length >= 5) {
        const currentScore = this.calculateNps(data.scores);
        const previousScore = this.calculateNps(previousByCg[cgId]);
        const drop = previousScore - currentScore;

        if (drop >= 15) {
          alerts.push({
            id: `nps-${cgId}`,
            type: "nps_drop",
            severity: drop >= 25 ? "critical" : "warning",
            campgroundId: cgId,
            campgroundName: data.name,
            message: `${data.name} NPS dropped ${drop} points`,
            currentValue: currentScore,
            expectedValue: previousScore,
            deviationPercent: (drop / Math.abs(previousScore || 1)) * 100,
            detectedAt: new Date(),
            recommendations: [
              "Review recent negative feedback for common themes",
              "Schedule manager check-in with front-line staff",
              "Consider targeted outreach to recent detractors",
            ],
          });
        }
      }
    }

    // Check for cancellation spikes
    const [currentCancels, previousCancels] = await Promise.all([
      this.prisma.reservation.count({
        where: { updatedAt: { gte: start, lte: end }, status: "cancelled" },
      }),
      this.prisma.reservation.count({
        where: { updatedAt: { gte: previousStart, lte: previousEnd }, status: "cancelled" },
      }),
    ]);

    const [currentTotal, previousTotal] = await Promise.all([
      this.prisma.reservation.count({
        where: { createdAt: { gte: start, lte: end } },
      }),
      this.prisma.reservation.count({
        where: { createdAt: { gte: previousStart, lte: previousEnd } },
      }),
    ]);

    const currentCancelRate = currentTotal > 0 ? (currentCancels / currentTotal) * 100 : 0;
    const previousCancelRate = previousTotal > 0 ? (previousCancels / previousTotal) * 100 : 0;

    if (currentCancelRate > previousCancelRate * 1.5 && currentCancelRate > 10) {
      alerts.push({
        id: "cancel-spike",
        type: "cancellation_spike",
        severity: currentCancelRate > 20 ? "critical" : "warning",
        message: `Platform cancellation rate spiked to ${currentCancelRate.toFixed(1)}%`,
        currentValue: currentCancelRate,
        expectedValue: previousCancelRate,
        deviationPercent: ((currentCancelRate - previousCancelRate) / previousCancelRate) * 100,
        detectedAt: new Date(),
        recommendations: [
          "Analyze cancellation reasons in booking data",
          "Review recent pricing or policy changes",
          "Check for external factors (weather, events)",
        ],
      });
    }

    return alerts.sort((a, b) => (a.severity === "critical" ? -1 : 1));
  }

  private calculateNps(scores: number[]): number {
    if (scores.length === 0) return 0;
    const promoters = scores.filter((s) => s >= 9).length;
    const detractors = scores.filter((s) => s <= 6).length;
    return Math.round(((promoters - detractors) / scores.length) * 100);
  }
}
