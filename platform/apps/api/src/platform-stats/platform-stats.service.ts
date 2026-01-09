import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface PlatformStats {
  campgrounds: {
    total: number;
    claimed: number;
    byState: Array<{ state: string; count: number }>;
  };
  activity: {
    pageViewsToday: number;
    pageViewsThisWeek: number;
    searchesToday: number;
    searchesThisWeek: number;
    uniqueVisitorsToday: number;
  };
  recentActivity: Array<{
    type: "page_view" | "search" | "booking";
    campgroundName: string | null;
    campgroundSlug: string | null;
    state: string | null;
    minutesAgo: number;
  }>;
  topRegions: Array<{
    state: string;
    activityCount: number;
  }>;
}

@Injectable()
export class PlatformStatsService {
  private readonly logger = new Logger(PlatformStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get platform-wide statistics for public display
   * This endpoint is unauthenticated and shows aggregate data only
   */
  async getStats(): Promise<PlatformStats> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get campground counts in parallel
    const [
      totalCampgrounds,
      claimedCampgrounds,
      campgroundsByState,
      pageViewsToday,
      pageViewsThisWeek,
      searchesToday,
      searchesThisWeek,
      uniqueVisitorsToday,
      recentPageViews,
      topRegions,
    ] = await Promise.all([
      // Total campgrounds
      this.prisma.campground.count(),

      // Claimed campgrounds
      this.prisma.campground.count({
        where: { claimStatus: "claimed" },
      }),

      // Campgrounds by state (top 10)
      this.prisma.campground.groupBy({
        by: ["state"],
        _count: { id: true },
        where: { state: { not: null } },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),

      // Page views today
      this.prisma.analyticsEvent.count({
        where: {
          eventName: "page_view",
          occurredAt: { gte: oneDayAgo },
        },
      }),

      // Page views this week
      this.prisma.analyticsEvent.count({
        where: {
          eventName: "page_view",
          occurredAt: { gte: oneWeekAgo },
        },
      }),

      // Searches today
      this.prisma.analyticsEvent.count({
        where: {
          eventName: "availability_check",
          occurredAt: { gte: oneDayAgo },
        },
      }),

      // Searches this week
      this.prisma.analyticsEvent.count({
        where: {
          eventName: "availability_check",
          occurredAt: { gte: oneWeekAgo },
        },
      }),

      // Unique visitors today (distinct sessions)
      this.prisma.analyticsEvent
        .findMany({
          where: { occurredAt: { gte: oneDayAgo } },
          select: { sessionId: true },
          distinct: ["sessionId"],
        })
        .then((sessions: { sessionId: string }[]) => sessions.length),

      // Recent page views with campground info (last 15 minutes, limit 10)
      this.prisma.analyticsEvent.findMany({
        where: {
          eventName: { in: ["page_view", "availability_check"] },
          occurredAt: { gte: new Date(now.getTime() - 15 * 60 * 1000) },
          campgroundId: { not: null },
        },
        select: {
          eventName: true,
          occurredAt: true,
          Campground: {
            select: {
              name: true,
              slug: true,
              state: true,
            },
          },
        },
        orderBy: { occurredAt: "desc" },
        take: 10,
      }),

      // Top regions by activity this week
      this.prisma.analyticsEvent.groupBy({
        by: ["region"],
        _count: { id: true },
        where: {
          occurredAt: { gte: oneWeekAgo },
          region: { not: null },
        },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ]);

    return {
      campgrounds: {
        total: totalCampgrounds,
        claimed: claimedCampgrounds,
        byState: campgroundsByState.map((s: { state: string | null; _count: { id: number } }) => ({
          state: s.state || "Unknown",
          count: s._count.id,
        })),
      },
      activity: {
        pageViewsToday,
        pageViewsThisWeek,
        searchesToday,
        searchesThisWeek,
        uniqueVisitorsToday,
      },
      recentActivity: recentPageViews.map((event: {
        eventName: string;
        occurredAt: Date;
        Campground: { name: string; slug: string; state: string | null } | null;
      }) => ({
        type: (event.eventName === "availability_check" ? "search" : "page_view") as "page_view" | "search" | "booking",
        campgroundName: event.Campground?.name || null,
        campgroundSlug: event.Campground?.slug || null,
        state: event.Campground?.state || null,
        minutesAgo: Math.round(
          (now.getTime() - event.occurredAt.getTime()) / 60000
        ),
      })),
      topRegions: topRegions.map((r: { region: string | null; _count: { id: number } }) => ({
        state: r.region || "Unknown",
        activityCount: r._count.id,
      })),
    };
  }
}
