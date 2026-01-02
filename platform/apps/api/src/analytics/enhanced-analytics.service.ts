import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AnalyticsActorType, AnalyticsEventName, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  TrackAdminEventDto,
  TrackSessionDto,
  UpdateSessionDto,
  TrackFunnelDto,
  CompleteFunnelDto,
  TrackFeatureUsageDto,
} from "./dto/track-admin-event.dto";

type RequestScope = {
  campgroundId?: string | null;
  organizationId?: string | null;
  userId?: string | null;
};

/**
 * Enhanced analytics service for comprehensive staff/admin tracking.
 * Handles sessions, page stats, feature usage, funnels, and real-time events.
 */
@Injectable()
export class EnhancedAnalyticsService {
  private readonly logger = new Logger(EnhancedAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Start or resume a session
   */
  async startSession(dto: TrackSessionDto, scope: RequestScope) {
    const campgroundId = dto.campgroundId ?? scope.campgroundId ?? null;
    const organizationId = dto.organizationId ?? scope.organizationId ?? null;

    // Check if session already exists
    const existing = await this.prisma.analyticsSession.findUnique({
      where: { sessionId: dto.sessionId },
    });

    if (existing) {
      // Session already exists, update it
      return this.prisma.analyticsSession.update({
        where: { sessionId: dto.sessionId },
        data: {
          actorType: dto.actorType as AnalyticsActorType,
          userId: dto.userId ?? existing.userId,
          guestId: dto.guestId ?? existing.guestId,
          updatedAt: new Date(),
        },
      });
    }

    // Create new session
    return this.prisma.analyticsSession.create({
      data: {
        sessionId: dto.sessionId,
        actorType: dto.actorType as AnalyticsActorType,
        userId: dto.userId,
        guestId: dto.guestId,
        campgroundId,
        organizationId,
        startedAt: new Date(),
        entryPage: dto.entryPage,
        deviceType: dto.deviceType,
        browser: dto.browser,
        os: dto.os,
        userAgent: dto.userAgent,
        screenSize: dto.screenSize,
        locale: dto.locale,
        referrer: dto.referrer,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
      },
    });
  }

  /**
   * Update session with heartbeat data
   */
  async updateSession(dto: UpdateSessionDto) {
    const session = await this.prisma.analyticsSession.findUnique({
      where: { sessionId: dto.sessionId },
    });

    if (!session) {
      this.logger.warn(`Session not found: ${dto.sessionId}`);
      return null;
    }

    const data: Prisma.AnalyticsSessionUpdateInput = {
      updatedAt: new Date(),
    };

    if (dto.currentPage) {
      data.exitPage = dto.currentPage;
      // Append to pages array if not already there
      const pages = session.pages || [];
      if (!pages.includes(dto.currentPage)) {
        data.pages = [...pages, dto.currentPage];
      }
    }

    if (dto.pageViews !== undefined) data.pageViews = dto.pageViews;
    if (dto.actions !== undefined) data.actions = dto.actions;
    if (dto.errors !== undefined) data.errors = dto.errors;
    if (dto.pages) data.pages = dto.pages;

    if (dto.endedAt) {
      data.endedAt = new Date(dto.endedAt);
      data.durationSecs = Math.floor(
        (new Date(dto.endedAt).getTime() - session.startedAt.getTime()) / 1000
      );
    }

    return this.prisma.analyticsSession.update({
      where: { sessionId: dto.sessionId },
      data,
    });
  }

  /**
   * End a session
   */
  async endSession(sessionId: string, exitPage?: string) {
    const session = await this.prisma.analyticsSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      this.logger.warn(`Session not found for end: ${sessionId}`);
      return null;
    }

    const now = new Date();
    const durationSecs = Math.floor(
      (now.getTime() - session.startedAt.getTime()) / 1000
    );

    return this.prisma.analyticsSession.update({
      where: { sessionId },
      data: {
        endedAt: now,
        durationSecs,
        exitPage: exitPage ?? session.exitPage,
      },
    });
  }

  // ============================================================================
  // ADMIN EVENT TRACKING
  // ============================================================================

  /**
   * Track an admin/staff event with enhanced context
   */
  async trackAdminEvent(dto: TrackAdminEventDto, scope: RequestScope) {
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const campgroundId = dto.campgroundId ?? scope.campgroundId ?? null;
    const organizationId = dto.organizationId ?? scope.organizationId ?? null;

    // Create the analytics event
    const event = await this.prisma.analyticsEvent.create({
      data: {
        sessionId: dto.sessionId,
        eventName: dto.eventName,
        occurredAt,
        page: dto.page,
        deviceType: dto.deviceType,
        metadata: {
          pageTitle: dto.pageTitle,
          featureArea: dto.featureArea,
          actionType: dto.actionType,
          actionTarget: dto.actionTarget,
          searchQuery: dto.searchQuery,
          timeOnPageSecs: dto.timeOnPageSecs,
          scrollDepth: dto.scrollDepth,
          browser: dto.browser,
          os: dto.os,
          screenSize: dto.screenSize,
          errorMessage: dto.errorMessage,
          errorCode: dto.errorCode,
          ...dto.metadata,
        },
        campground: campgroundId ? { connect: { id: campgroundId } } : undefined,
        organization: organizationId ? { connect: { id: organizationId } } : undefined,
      },
    });

    // Update session with page view or action
    if (dto.eventName === AnalyticsEventName.admin_page_view) {
      await this.prisma.analyticsSession.updateMany({
        where: { sessionId: dto.sessionId },
        data: {
          pageViews: { increment: 1 },
          exitPage: dto.page,
        },
      });
    } else if (dto.eventName === AnalyticsEventName.admin_action) {
      await this.prisma.analyticsSession.updateMany({
        where: { sessionId: dto.sessionId },
        data: { actions: { increment: 1 } },
      });
    } else if (dto.eventName === AnalyticsEventName.admin_error) {
      await this.prisma.analyticsSession.updateMany({
        where: { sessionId: dto.sessionId },
        data: { errors: { increment: 1 } },
      });
    }

    // Create real-time event for live dashboard
    await this.createLiveEvent({
      campgroundId,
      organizationId,
      sessionId: dto.sessionId,
      eventType: dto.eventName,
      actorType: "staff",
      actorId: dto.userId ?? scope.userId ?? undefined,
      eventData: {
        page: dto.page,
        pageTitle: dto.pageTitle,
        featureArea: dto.featureArea,
        actionType: dto.actionType,
        actionTarget: dto.actionTarget,
      },
    });

    return event;
  }

  // ============================================================================
  // FUNNEL TRACKING
  // ============================================================================

  /**
   * Advance a funnel to the next step
   */
  async trackFunnelStep(dto: TrackFunnelDto, scope: RequestScope) {
    const campgroundId = dto.campgroundId ?? scope.campgroundId;
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required for funnel tracking");
    }

    // Find or create funnel
    let funnel = await this.prisma.analyticsFunnel.findFirst({
      where: {
        sessionId: dto.sessionId,
        funnelName: dto.funnelName,
        campgroundId,
        completedAt: null,
        abandonedAt: null,
      },
    });

    const now = new Date();
    const stepField = `step${dto.step}At` as keyof typeof funnel;

    if (!funnel) {
      // Create new funnel
      const stepNames = dto.stepName ? [dto.stepName] : [];
      funnel = await this.prisma.analyticsFunnel.create({
        data: {
          campgroundId,
          organizationId: dto.organizationId ?? scope.organizationId,
          sessionId: dto.sessionId,
          funnelName: dto.funnelName,
          step1At: dto.step === 1 ? now : undefined,
          step2At: dto.step === 2 ? now : undefined,
          step3At: dto.step === 3 ? now : undefined,
          step4At: dto.step === 4 ? now : undefined,
          step5At: dto.step === 5 ? now : undefined,
          step6At: dto.step === 6 ? now : undefined,
          stepNames,
          metadata: dto.metadata,
        },
      });
    } else {
      // Update existing funnel
      const stepNames = [...(funnel.stepNames || [])];
      if (dto.stepName && stepNames.length < dto.step) {
        stepNames.push(dto.stepName);
      }

      const updateData: Record<string, any> = {
        stepNames,
        updatedAt: now,
      };
      updateData[stepField] = now;

      if (dto.metadata) {
        updateData.metadata = {
          ...(funnel.metadata as object || {}),
          ...dto.metadata,
        };
      }

      funnel = await this.prisma.analyticsFunnel.update({
        where: { id: funnel.id },
        data: updateData,
      });
    }

    // Track funnel step event
    await this.prisma.analyticsEvent.create({
      data: {
        sessionId: dto.sessionId,
        eventName: AnalyticsEventName.funnel_step,
        occurredAt: now,
        metadata: {
          funnelName: dto.funnelName,
          step: dto.step,
          stepName: dto.stepName,
          ...dto.metadata,
        },
        campground: { connect: { id: campgroundId } },
        organization: dto.organizationId ? { connect: { id: dto.organizationId } } : undefined,
      },
    });

    return funnel;
  }

  /**
   * Complete or abandon a funnel
   */
  async completeFunnel(dto: CompleteFunnelDto, scope: RequestScope) {
    const campgroundId = dto.campgroundId ?? scope.campgroundId;
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required for funnel completion");
    }

    const funnel = await this.prisma.analyticsFunnel.findFirst({
      where: {
        sessionId: dto.sessionId,
        funnelName: dto.funnelName,
        campgroundId,
        completedAt: null,
        abandonedAt: null,
      },
    });

    if (!funnel) {
      this.logger.warn(`No active funnel found: ${dto.funnelName} for session ${dto.sessionId}`);
      return null;
    }

    const now = new Date();
    const startTime = funnel.step1At || funnel.createdAt;
    const totalDurationSecs = Math.floor((now.getTime() - startTime.getTime()) / 1000);

    const updateData: Prisma.AnalyticsFunnelUpdateInput = {
      totalDurationSecs,
      updatedAt: now,
    };

    if (dto.outcome === "completed") {
      updateData.completedAt = now;
    } else {
      updateData.abandonedAt = now;
      updateData.abandonedStep = dto.abandonedStep;
      updateData.abandonReason = dto.abandonReason;
    }

    if (dto.metadata) {
      updateData.metadata = {
        ...(funnel.metadata as object || {}),
        ...dto.metadata,
      };
    }

    const updated = await this.prisma.analyticsFunnel.update({
      where: { id: funnel.id },
      data: updateData,
    });

    // Track completion/abandonment event
    await this.prisma.analyticsEvent.create({
      data: {
        sessionId: dto.sessionId,
        eventName: dto.outcome === "completed"
          ? AnalyticsEventName.funnel_complete
          : AnalyticsEventName.funnel_abandon,
        occurredAt: now,
        metadata: {
          funnelName: dto.funnelName,
          outcome: dto.outcome,
          abandonedStep: dto.abandonedStep,
          abandonReason: dto.abandonReason,
          totalDurationSecs,
          ...dto.metadata,
        },
        campground: { connect: { id: campgroundId } },
      },
    });

    return updated;
  }

  // ============================================================================
  // FEATURE USAGE TRACKING
  // ============================================================================

  /**
   * Track feature usage
   */
  async trackFeatureUsage(dto: TrackFeatureUsageDto, scope: RequestScope) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const campgroundId = dto.campgroundId ?? scope.campgroundId;
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required for feature tracking");
    }

    // Upsert daily feature usage
    const existing = await this.prisma.analyticsFeatureUsage.findFirst({
      where: {
        campgroundId,
        date: today,
        feature: dto.feature,
        subFeature: dto.subFeature ?? null,
      },
    });

    if (existing) {
      // Update existing record
      const errorCount = dto.outcome === "failure" ? 1 : 0;
      const successCount = dto.outcome === "success" ? 1 : 0;
      const newUsageCount = existing.usageCount + 1;
      const newSuccessRate = existing.successRate !== null
        ? ((existing.successRate * existing.usageCount) + (successCount ? 1 : 0)) / newUsageCount
        : (successCount ? 1 : 0);

      await this.prisma.analyticsFeatureUsage.update({
        where: { id: existing.id },
        data: {
          usageCount: { increment: 1 },
          uniqueUsers: dto.userId && !await this.hasUserUsedFeatureToday(campgroundId, dto.feature, dto.userId, today)
            ? { increment: 1 }
            : undefined,
          avgDurationSecs: dto.durationSecs !== undefined
            ? (((existing.avgDurationSecs || 0) * existing.usageCount) + dto.durationSecs) / newUsageCount
            : undefined,
          successRate: newSuccessRate,
          errorCount: { increment: errorCount },
        },
      });
    } else {
      // Create new record
      await this.prisma.analyticsFeatureUsage.create({
        data: {
          campgroundId,
          organizationId: scope.organizationId,
          date: today,
          feature: dto.feature,
          subFeature: dto.subFeature,
          usageCount: 1,
          uniqueUsers: 1,
          avgDurationSecs: dto.durationSecs,
          successRate: dto.outcome === "success" ? 1 : dto.outcome === "failure" ? 0 : null,
          errorCount: dto.outcome === "failure" ? 1 : 0,
        },
      });
    }

    // Track the event
    await this.prisma.analyticsEvent.create({
      data: {
        sessionId: dto.sessionId,
        eventName: AnalyticsEventName.admin_feature_use,
        occurredAt: new Date(),
        metadata: {
          feature: dto.feature,
          subFeature: dto.subFeature,
          durationSecs: dto.durationSecs,
          outcome: dto.outcome,
          errorMessage: dto.errorMessage,
          ...dto.metadata,
        },
        campground: { connect: { id: campgroundId } },
      },
    });

    return { success: true };
  }

  private async hasUserUsedFeatureToday(
    campgroundId: string,
    feature: string,
    userId: string,
    date: Date
  ): Promise<boolean> {
    const count = await this.prisma.analyticsEvent.count({
      where: {
        campgroundId,
        eventName: AnalyticsEventName.admin_feature_use,
        occurredAt: { gte: date },
        metadata: {
          path: ["feature"],
          equals: feature,
        },
      },
    });
    return count > 0;
  }

  // ============================================================================
  // REAL-TIME EVENTS
  // ============================================================================

  /**
   * Create a live event for real-time dashboard
   */
  private async createLiveEvent(params: {
    campgroundId?: string | null;
    organizationId?: string | null;
    sessionId: string;
    eventType: string;
    actorType: string;
    actorId?: string;
    eventData: Record<string, any>;
  }) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.prisma.analyticsLiveEvent.create({
      data: {
        campgroundId: params.campgroundId,
        organizationId: params.organizationId,
        sessionId: params.sessionId,
        eventType: params.eventType,
        actorType: params.actorType,
        actorId: params.actorId,
        eventData: params.eventData,
        expiresAt,
      },
    });
  }

  /**
   * Get live events for real-time dashboard
   */
  async getLiveEvents(campgroundId: string, limit = 50) {
    return this.prisma.analyticsLiveEvent.findMany({
      where: { campgroundId },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
  }

  // ============================================================================
  // AGGREGATION QUERIES
  // ============================================================================

  /**
   * Get page stats for a campground
   */
  async getPageStats(campgroundId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.prisma.analyticsPageStats.findMany({
      where: {
        campgroundId,
        date: { gte: since },
      },
      orderBy: [{ date: "desc" }, { views: "desc" }],
    });
  }

  /**
   * Get feature usage stats
   */
  async getFeatureUsage(campgroundId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const usage = await this.prisma.analyticsFeatureUsage.findMany({
      where: {
        campgroundId,
        date: { gte: since },
      },
      orderBy: { date: "desc" },
    });

    // Aggregate by feature
    const byFeature = new Map<string, {
      feature: string;
      totalUsage: number;
      uniqueUsers: number;
      avgDuration: number;
      successRate: number;
      errorCount: number;
      dates: Date[];
    }>();

    for (const record of usage) {
      const existing = byFeature.get(record.feature);
      if (existing) {
        existing.totalUsage += record.usageCount;
        existing.uniqueUsers = Math.max(existing.uniqueUsers, record.uniqueUsers);
        if (record.avgDurationSecs) {
          existing.avgDuration = (existing.avgDuration + record.avgDurationSecs) / 2;
        }
        if (record.successRate !== null) {
          existing.successRate = (existing.successRate + record.successRate) / 2;
        }
        existing.errorCount += record.errorCount;
        existing.dates.push(record.date);
      } else {
        byFeature.set(record.feature, {
          feature: record.feature,
          totalUsage: record.usageCount,
          uniqueUsers: record.uniqueUsers,
          avgDuration: record.avgDurationSecs || 0,
          successRate: record.successRate || 0,
          errorCount: record.errorCount,
          dates: [record.date],
        });
      }
    }

    return Array.from(byFeature.values()).sort((a, b) => b.totalUsage - a.totalUsage);
  }

  /**
   * Get funnel analysis
   */
  async getFunnelAnalysis(campgroundId: string, funnelName: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const funnels = await this.prisma.analyticsFunnel.findMany({
      where: {
        campgroundId,
        funnelName,
        createdAt: { gte: since },
      },
    });

    const total = funnels.length;
    const completed = funnels.filter((f) => f.completedAt !== null).length;
    const abandoned = funnels.filter((f) => f.abandonedAt !== null).length;
    const inProgress = total - completed - abandoned;

    // Count by abandoned step
    const abandonByStep = new Map<number, number>();
    for (const funnel of funnels) {
      if (funnel.abandonedStep) {
        abandonByStep.set(funnel.abandonedStep, (abandonByStep.get(funnel.abandonedStep) || 0) + 1);
      }
    }

    // Calculate step completion rates
    const stepCounts = [0, 0, 0, 0, 0, 0];
    for (const funnel of funnels) {
      if (funnel.step1At) stepCounts[0]++;
      if (funnel.step2At) stepCounts[1]++;
      if (funnel.step3At) stepCounts[2]++;
      if (funnel.step4At) stepCounts[3]++;
      if (funnel.step5At) stepCounts[4]++;
      if (funnel.step6At) stepCounts[5]++;
    }

    // Average duration for completed funnels
    const completedFunnels = funnels.filter((f) => f.completedAt && f.totalDurationSecs);
    const avgDuration = completedFunnels.length > 0
      ? completedFunnels.reduce((sum, f) => sum + (f.totalDurationSecs || 0), 0) / completedFunnels.length
      : 0;

    return {
      funnelName,
      windowDays: days,
      total,
      completed,
      abandoned,
      inProgress,
      completionRate: total > 0 ? completed / total : 0,
      abandonmentRate: total > 0 ? abandoned / total : 0,
      avgDurationSecs: avgDuration,
      stepCompletionRates: stepCounts.map((count, i) =>
        total > 0 ? count / total : 0
      ),
      abandonByStep: Object.fromEntries(abandonByStep),
    };
  }

  /**
   * Get session stats
   */
  async getSessionStats(campgroundId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const sessions = await this.prisma.analyticsSession.findMany({
      where: {
        campgroundId,
        startedAt: { gte: since },
      },
    });

    const total = sessions.length;
    const byActorType = new Map<string, number>();
    const byDevice = new Map<string, number>();
    let totalDuration = 0;
    let totalPageViews = 0;
    let totalActions = 0;

    for (const session of sessions) {
      byActorType.set(session.actorType, (byActorType.get(session.actorType) || 0) + 1);
      if (session.deviceType) {
        byDevice.set(session.deviceType, (byDevice.get(session.deviceType) || 0) + 1);
      }
      totalDuration += session.durationSecs || 0;
      totalPageViews += session.pageViews;
      totalActions += session.actions;
    }

    return {
      windowDays: days,
      totalSessions: total,
      avgDurationSecs: total > 0 ? totalDuration / total : 0,
      avgPageViews: total > 0 ? totalPageViews / total : 0,
      avgActions: total > 0 ? totalActions / total : 0,
      byActorType: Object.fromEntries(byActorType),
      byDevice: Object.fromEntries(byDevice),
    };
  }

  /**
   * Get staff metrics
   */
  async getStaffMetrics(campgroundId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.prisma.analyticsStaffMetrics.findMany({
      where: {
        campgroundId,
        date: { gte: since },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });
  }

  // ============================================================================
  // CRON JOBS
  // ============================================================================

  /**
   * Aggregate page stats daily
   */
  @Cron(CronExpression.EVERY_HOUR)
  async aggregatePageStats() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Get all admin page view events from yesterday
    const events = await this.prisma.$queryRaw<
      Array<{
        campgroundId: string;
        page: string;
        views: bigint;
        uniqueSessions: bigint;
        uniqueUsers: bigint;
      }>
    >`
      SELECT
        "campgroundId",
        "page",
        COUNT(*)::bigint AS views,
        COUNT(DISTINCT "sessionId")::bigint AS "uniqueSessions",
        COUNT(DISTINCT CASE WHEN metadata->>'userId' IS NOT NULL THEN metadata->>'userId' END)::bigint AS "uniqueUsers"
      FROM "AnalyticsEvent"
      WHERE "eventName" = 'admin_page_view'
        AND "occurredAt" >= ${yesterday}
        AND "occurredAt" < ${today}
        AND "campgroundId" IS NOT NULL
        AND "page" IS NOT NULL
      GROUP BY "campgroundId", "page"
    `;

    for (const row of events) {
      if (!row.campgroundId || !row.page) continue;

      // Determine feature area from path
      const featureArea = this.getFeatureAreaFromPath(row.page);

      await this.prisma.analyticsPageStats.upsert({
        where: {
          campgroundId_date_path: {
            campgroundId: row.campgroundId,
            date: yesterday,
            path: row.page,
          },
        },
        create: {
          campgroundId: row.campgroundId,
          date: yesterday,
          path: row.page,
          featureArea,
          views: Number(row.views),
          uniqueSessions: Number(row.uniqueSessions),
          uniqueUsers: Number(row.uniqueUsers),
        },
        update: {
          views: Number(row.views),
          uniqueSessions: Number(row.uniqueSessions),
          uniqueUsers: Number(row.uniqueUsers),
        },
      });
    }

    this.logger.debug(`Aggregated page stats: ${events.length} pages`);
  }

  /**
   * Aggregate staff metrics daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async aggregateStaffMetrics() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Get staff sessions from yesterday
    const sessions = await this.prisma.analyticsSession.findMany({
      where: {
        actorType: "staff",
        startedAt: { gte: yesterday, lt: today },
        userId: { not: null },
        campgroundId: { not: null },
      },
    });

    // Aggregate by user and campground
    const metrics = new Map<string, {
      campgroundId: string;
      userId: string;
      sessions: number;
      totalDuration: number;
      pageViews: number;
      actions: number;
      errors: number;
    }>();

    for (const session of sessions) {
      if (!session.userId || !session.campgroundId) continue;
      const key = `${session.campgroundId}:${session.userId}`;
      const existing = metrics.get(key) || {
        campgroundId: session.campgroundId,
        userId: session.userId,
        sessions: 0,
        totalDuration: 0,
        pageViews: 0,
        actions: 0,
        errors: 0,
      };

      existing.sessions++;
      existing.totalDuration += session.durationSecs || 0;
      existing.pageViews += session.pageViews;
      existing.actions += session.actions;
      existing.errors += session.errors;

      metrics.set(key, existing);
    }

    // Write metrics
    for (const metric of metrics.values()) {
      await this.prisma.analyticsStaffMetrics.upsert({
        where: {
          campgroundId_userId_date: {
            campgroundId: metric.campgroundId,
            userId: metric.userId,
            date: yesterday,
          },
        },
        create: {
          campgroundId: metric.campgroundId,
          userId: metric.userId,
          date: yesterday,
          sessionsCount: metric.sessions,
          totalSessionSecs: metric.totalDuration,
          avgSessionSecs: metric.sessions > 0 ? metric.totalDuration / metric.sessions : null,
          pageViews: metric.pageViews,
          actionsCount: metric.actions,
          errorsCount: metric.errors,
        },
        update: {
          sessionsCount: metric.sessions,
          totalSessionSecs: metric.totalDuration,
          avgSessionSecs: metric.sessions > 0 ? metric.totalDuration / metric.sessions : null,
          pageViews: metric.pageViews,
          actionsCount: metric.actions,
          errorsCount: metric.errors,
        },
      });
    }

    this.logger.debug(`Aggregated staff metrics: ${metrics.size} staff-campground pairs`);
  }

  /**
   * Clean up expired live events
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupLiveEvents() {
    const now = new Date();
    const deleted = await this.prisma.analyticsLiveEvent.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    if (deleted.count > 0) {
      this.logger.debug(`Cleaned up ${deleted.count} expired live events`);
    }
  }

  /**
   * End stale sessions (no activity for 30 minutes)
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async endStaleSessions() {
    const threshold = new Date();
    threshold.setMinutes(threshold.getMinutes() - 30);

    const staleSessions = await this.prisma.analyticsSession.findMany({
      where: {
        endedAt: null,
        updatedAt: { lt: threshold },
      },
    });

    for (const session of staleSessions) {
      const durationSecs = Math.floor(
        (session.updatedAt.getTime() - session.startedAt.getTime()) / 1000
      );

      await this.prisma.analyticsSession.update({
        where: { id: session.id },
        data: {
          endedAt: session.updatedAt,
          durationSecs,
        },
      });
    }

    if (staleSessions.length > 0) {
      this.logger.debug(`Ended ${staleSessions.length} stale sessions`);
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private getFeatureAreaFromPath(path: string): string {
    // Map URL paths to feature areas
    if (path.includes("/reservations") || path.includes("/calendar")) return "reservations";
    if (path.includes("/pos") || path.includes("/store")) return "pos";
    if (path.includes("/housekeeping") || path.includes("/cleaning")) return "housekeeping";
    if (path.includes("/maintenance") || path.includes("/tickets")) return "maintenance";
    if (path.includes("/reports") || path.includes("/analytics")) return "reports";
    if (path.includes("/guests")) return "guests";
    if (path.includes("/payments") || path.includes("/billing")) return "payments";
    if (path.includes("/settings")) return "settings";
    if (path.includes("/staff") || path.includes("/schedule")) return "staff";
    if (path.includes("/communications") || path.includes("/messages")) return "communications";
    if (path.includes("/promotions") || path.includes("/marketing")) return "marketing";
    if (path.includes("/ai")) return "ai";
    return "other";
  }
}
