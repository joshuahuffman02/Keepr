import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AnalyticsEventName, Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { IngestAnalyticsEventDto } from "./dto/ingest-analytics-event.dto";
import { AuditService } from "../audit/audit.service";
import { ApplyRecommendationDto } from "./dto/apply-recommendation.dto";
import { ProposeRecommendationDto } from "./dto/propose-recommendation.dto";
import { randomUUID } from "crypto";

type RequestScope = { campgroundId?: string | null; organizationId?: string | null; userId?: string | null };

const MOCK_MODE = process.env.ANALYTICS_MOCK_MODE === "true";
type MockEvent = {
  sessionId: string;
  eventName: AnalyticsEventName;
  occurredAt: Date;
  page?: string;
  referrer?: string | null;
  referrerUrl?: string | null;
  deviceType?: string | null;
  region?: string | null;
  campgroundId?: string | null;
  organizationId?: string | null;
  reservationId?: string | null;
  siteId?: string | null;
  siteClassId?: string | null;
  promotionId?: string | null;
  imageId?: string | null;
  abVariantId?: string | null;
  metadata?: Record<string, any>;
};

const mockStore: {
  events: MockEvent[];
  aggregates: Map<string, { count: number; sessions: Set<string> }>;
} = {
  events: [],
  aggregates: new Map(),
};

const MOCK_EVENT_LIMIT = 2000;

function dayKey(d: Date) {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy.toISOString();
}

function recordMockEvent(raw: MockEvent) {
  const occurredAt = raw.occurredAt || new Date();
  const event: MockEvent = { ...raw, occurredAt };
  mockStore.events.push(event);
  if (mockStore.events.length > MOCK_EVENT_LIMIT) {
    mockStore.events.shift();
  }

  const key = `${raw.campgroundId ?? "mock"}|${raw.eventName}|${dayKey(occurredAt)}`;
  const entry = mockStore.aggregates.get(key) ?? { count: 0, sessions: new Set<string>() };
  entry.count += 1;
  if (raw.sessionId) entry.sessions.add(raw.sessionId);
  mockStore.aggregates.set(key, entry);
  return event;
}

function getMockAggregates(campgroundId: string, since: Date) {
  const results: Array<{ campgroundId: string; eventName: AnalyticsEventName; date: Date; count: number; uniqueSessions: number }> = [];
  for (const [key, value] of mockStore.aggregates.entries()) {
    const [cg, eventName, dateStr] = key.split("|");
    const date = new Date(dateStr);
    if (cg === (campgroundId ?? "mock") && date >= since) {
      results.push({
        campgroundId: cg,
        eventName: eventName as AnalyticsEventName,
        date,
        count: value.count,
        uniqueSessions: value.sessions.size,
      });
    }
  }
  return results;
}

function getMockEvents(campgroundId: string, since: Date) {
  return mockStore.events.filter((e) => (e.campgroundId ?? "mock") === (campgroundId ?? "mock") && e.occurredAt >= since);
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async ingest(dto: IngestAnalyticsEventDto, scope: RequestScope) {
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    if (MOCK_MODE) {
      return recordMockEvent({
        sessionId: dto.sessionId,
        eventName: dto.eventName,
        occurredAt,
        page: dto.page,
        referrer: dto.referrer,
        referrerUrl: dto.referrerUrl,
        deviceType: dto.deviceType,
        region: dto.region,
        campgroundId: dto.campgroundId ?? scope.campgroundId ?? "mock",
        organizationId: dto.organizationId ?? scope.organizationId ?? undefined,
        reservationId: dto.reservationId,
        siteId: dto.siteId,
        siteClassId: dto.siteClassId,
        promotionId: dto.promotionId,
        imageId: dto.imageId,
        abVariantId: dto.abVariantId,
        metadata: dto.metadata,
      });
    }

    const data: Prisma.AnalyticsEventCreateInput = {
      sessionId: dto.sessionId,
      eventName: dto.eventName,
      occurredAt,
      page: dto.page,
      referrer: dto.referrer,
      referrerUrl: dto.referrerUrl,
      deviceType: dto.deviceType,
      region: dto.region,
      metadata: dto.metadata,
      createdAt: new Date(),
      campground: dto.campgroundId
        ? { connect: { id: dto.campgroundId } }
        : scope.campgroundId
        ? { connect: { id: scope.campgroundId } }
        : undefined,
      organization: dto.organizationId
        ? { connect: { id: dto.organizationId } }
        : scope.organizationId
        ? { connect: { id: scope.organizationId } }
        : undefined,
      reservation: dto.reservationId ? { connect: { id: dto.reservationId } } : undefined,
      site: dto.siteId ? { connect: { id: dto.siteId } } : undefined,
      siteClass: dto.siteClassId ? { connect: { id: dto.siteClassId } } : undefined,
      promotion: dto.promotionId ? { connect: { id: dto.promotionId } } : undefined,
      abVariant: dto.abVariantId ? { connect: { id: dto.abVariantId } } : undefined,
      imageId: dto.imageId,
    };

    const event = await this.prisma.analyticsEvent.create({ data });

    await this.updateDailyAggregate({
      campgroundId: dto.campgroundId ?? scope.campgroundId ?? null,
      organizationId: dto.organizationId ?? scope.organizationId ?? null,
      eventName: dto.eventName,
      sessionId: dto.sessionId,
      occurredAt,
    });

    return event;
  }

  private async updateDailyAggregate(params: {
    campgroundId: string | null;
    organizationId: string | null;
    eventName: AnalyticsEventName;
    sessionId: string;
    occurredAt: Date;
  }) {
    if (MOCK_MODE) {
      return;
    }
    if (!params.campgroundId && !params.organizationId) {
      return;
    }

    const dayStart = new Date(params.occurredAt);
    dayStart.setUTCHours(0, 0, 0, 0);

    await this.prisma.analyticsDailyAggregate.upsert({
      where: {
        campgroundId_eventName_date: {
          campgroundId: (params.campgroundId ?? null) as any,
          eventName: params.eventName,
          date: dayStart,
        },
      },
      create: {
        campground: params.campgroundId ? { connect: { id: params.campgroundId } } : undefined,
        organization: params.organizationId ? { connect: { id: params.organizationId } } : undefined,
        eventName: params.eventName,
        date: dayStart,
        count: 1,
        uniqueSessions: params.sessionId ? 1 : 0,
      },
      update: {
        count: { increment: 1 },
        uniqueSessions: params.sessionId ? { increment: 1 } : undefined,
      },
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshDailyAggregates() {
    if (MOCK_MODE) {
      return;
    }
    const rows = await this.prisma.$queryRaw<
      Array<{ campgroundId: string | null; organizationId: string | null; eventName: AnalyticsEventName; date: Date; count: bigint; uniqueSessions: bigint }>
    >`
      SELECT
        "campgroundId",
        "organizationId",
        "eventName",
        date_trunc('day', "occurredAt") AS date,
        COUNT(*)::bigint AS count,
        COUNT(DISTINCT "sessionId")::bigint AS "uniqueSessions"
      FROM "AnalyticsEvent"
      WHERE "occurredAt" >= NOW() - INTERVAL '3 day'
      GROUP BY "campgroundId", "organizationId", "eventName", date
    `;

    for (const row of rows) {
      if (!row.campgroundId) continue;
      await this.prisma.analyticsDailyAggregate.upsert({
        where: {
          campgroundId_eventName_date: {
            campgroundId: row.campgroundId,
            eventName: row.eventName,
            date: row.date,
          },
        },
        create: {
          campground: row.campgroundId ? { connect: { id: row.campgroundId } } : undefined,
          organization: row.organizationId ? { connect: { id: row.organizationId } } : undefined,
          eventName: row.eventName,
          date: row.date,
          count: Number(row.count),
          uniqueSessions: Number(row.uniqueSessions),
        },
        update: {
          count: Number(row.count),
          uniqueSessions: Number(row.uniqueSessions),
        },
      });
    }

    this.logger.debug(`Refreshed analytics daily aggregates (${rows.length} rows)`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async enforceRetention() {
    if (MOCK_MODE) {
      // prune mock events older than retention window
      const days = Number(process.env.ANALYTICS_RETENTION_DAYS || 395);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      mockStore.events = mockStore.events.filter((e) => e.occurredAt >= cutoff);
      for (const [key] of mockStore.aggregates.entries()) {
        const [, , dateStr] = key.split("|");
        const d = new Date(dateStr);
        if (d < cutoff) mockStore.aggregates.delete(key);
      }
      return;
    }
    const days = Number(process.env.ANALYTICS_RETENTION_DAYS || 395);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const deleted = await this.prisma.analyticsEvent.deleteMany({
      where: { occurredAt: { lt: cutoff } },
    });
    if (deleted.count > 0) {
      this.logger.log(`Analytics retention pruned ${deleted.count} events older than ${days} days`);
    }
  }

  async getRecommendations(campgroundId: string) {
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const aggregates = MOCK_MODE
      ? getMockAggregates(campgroundId, since)
      : await this.prisma.analyticsDailyAggregate.findMany({
          where: { campgroundId, date: { gte: since } },
        });

    const sum = (event: AnalyticsEventName) =>
      aggregates.filter((a) => a.eventName === event).reduce((acc, cur) => acc + (cur.count || 0), 0);

    const addToStay = sum(AnalyticsEventName.add_to_stay);
    const completes = sum(AnalyticsEventName.reservation_completed);
    const abandons = sum(AnalyticsEventName.reservation_abandoned);
    const imageViews = sum(AnalyticsEventName.image_viewed);
    const imageClicks = sum(AnalyticsEventName.image_clicked);
    const availabilityChecks = sum(AnalyticsEventName.availability_check);
    const dealViews = sum(AnalyticsEventName.deal_viewed);
    const dealApplies = sum(AnalyticsEventName.deal_applied);

    const recommendations: Array<{
      id: string;
      type: string;
      title: string;
      explanation: string;
      confidence: "low" | "medium" | "high";
      projectedImpact: string;
      action: string;
      applyAllowed: boolean;
      requiresApproval: boolean;
    }> = [];

    // Pricing nudge
    const funnelBase = Math.max(addToStay, 1);
    const abandonmentRate = abandons / funnelBase;
    if (abandonmentRate > 0.4) {
      recommendations.push({
        id: "pricing-soften",
        type: "pricing",
        title: "Lower midweek rates to recover drop-offs",
        explanation: `Abandonment is ${(abandonmentRate * 100).toFixed(0)}% of add-to-stay events. Consider a temporary midweek reduction to improve conversion.`,
        confidence: "medium",
        projectedImpact: "3–7% booking lift on low-occupancy nights",
        action: "apply_pricing_adjustment",
        applyAllowed: true,
        requiresApproval: true,
      });
    }

    // Image order
    if (imageViews > 10 && imageClicks / Math.max(imageViews, 1) < 0.2) {
      recommendations.push({
        id: "image-order",
        type: "images",
        title: "Reorder hero images for better engagement",
        explanation: "Image click-through is low compared to views. Moving high-performing images earlier can lift add-to-stay.",
        confidence: "medium",
        projectedImpact: "5–10% lift in detail clicks",
        action: "reorder_images",
        applyAllowed: true,
        requiresApproval: true,
      });
    }

    // Availability highlight
    if (availabilityChecks > addToStay * 1.5) {
      recommendations.push({
        id: "availability-highlight",
        type: "availability",
        title: "Highlight available alternatives for searched dates",
        explanation: "Guests are checking availability but not committing. Highlight nearby dates or alternative site classes.",
        confidence: "low",
        projectedImpact: "2–5% lift in add-to-stay",
        action: "promote_alternates",
        applyAllowed: false,
        requiresApproval: true,
      });
    }

    // Deal headline
    if (dealViews > 5 && dealApplies / Math.max(dealViews, 1) < 0.2) {
      recommendations.push({
        id: "deal-headline",
        type: "deals",
        title: "Rewrite underperforming deal headline",
        explanation: "Deal views are not translating to applies. Try a clearer value statement and limited-time framing.",
        confidence: "medium",
        projectedImpact: "5–8% lift in deal applies",
        action: "update_deal_copy",
        applyAllowed: false,
        requiresApproval: true,
      });
    }

    // Content suggestion
    recommendations.push({
      id: "content-pool",
      type: "content",
      title: "Add pool/amenity imagery to seasonal pages",
      explanation: "Guests often respond to amenity visuals; adding a pool/amenity image to seasonal pages can increase engagement.",
      confidence: "low",
      projectedImpact: "Small uplift in detail views",
      action: "add_content",
      applyAllowed: false,
      requiresApproval: true,
    });

    return { recommendations, windowDays: 7, stats: { addToStay, completes, abandons, imageViews, imageClicks, availabilityChecks, dealViews, dealApplies } };
  }

  async applyRecommendation(dto: ApplyRecommendationDto, actor: { id: string; role: UserRole }, scope: RequestScope) {
    if (!dto.campgroundId) throw new BadRequestException("campgroundId is required");
    if (MOCK_MODE) {
      this.logger.log(`[MOCK] applyRecommendation ${dto.recommendationId}`);
      return { status: "applied", recommendationId: dto.recommendationId, mock: true };
    }
    await this.audit.record({
      campgroundId: dto.campgroundId,
      actorId: actor.id ?? null,
      action: "recommendation.apply",
      entity: dto.type ?? "recommendation",
      entityId: dto.recommendationId,
      before: null,
      after: {
        targetId: dto.targetId ?? null,
        action: dto.action ?? null,
        payload: dto.payload ?? null,
      },
      ip: null,
      userAgent: null,
    });

    if (dto.action === "apply_pricing_adjustment") {
      const percentRaw = Number(dto.payload?.percentAdjust ?? -5);
      const percentAdjust = Math.max(-30, Math.min(30, Number.isFinite(percentRaw) ? percentRaw : -5));
      const startDate = dto.payload?.startDate ? new Date(dto.payload.startDate) : new Date();
      const endDate = dto.payload?.endDate ? new Date(dto.payload.endDate) : undefined;
      const rule = await this.prisma.pricingRule.create({
        data: {
          campgroundId: dto.campgroundId,
          label: dto.payload?.label || "AI pricing adjust",
          ruleType: "percent",
          percentAdjust,
          siteClassId: dto.targetId || dto.payload?.siteClassId || null,
          startDate,
          endDate: endDate ?? null,
          isActive: true,
        },
      });
      return { status: "applied", recommendationId: dto.recommendationId, pricingRuleId: rule.id };
    }

    if (dto.action === "reorder_images") {
      const order = Array.isArray(dto.payload?.imageOrder) ? dto.payload?.imageOrder : null;
      if (!order || order.length === 0) {
        throw new BadRequestException("imageOrder payload is required");
      }
      const cg = await this.prisma.campground.findUnique({
        where: { id: dto.campgroundId },
        select: { id: true, photos: true, heroImageUrl: true },
      });
      if (!cg) throw new BadRequestException("Campground not found");
      const existing = Array.isArray(cg.photos) ? cg.photos : [];
      const ordered = order.filter((p) => existing.includes(p));
      const remaining = existing.filter((p) => !ordered.includes(p));
      const photos = Array.from(new Set([...ordered, ...remaining]));
      const updated = await this.prisma.campground.update({
        where: { id: dto.campgroundId },
        data: { photos },
      });
      await this.prisma.analyticsEvent.create({
        data: {
          sessionId: randomUUID(),
          eventName: "admin_image_reorder" as any,
          campground: { connect: { id: dto.campgroundId } },
          metadata: { reordered: order.length, total: photos.length },
        },
      });
      return { status: "applied", recommendationId: dto.recommendationId, photos: updated.photos };
    }

    return { status: "applied", recommendationId: dto.recommendationId };
  }

  async proposeRecommendation(dto: ProposeRecommendationDto, actor: { id: string; role: UserRole }, scope: RequestScope) {
    if (!dto.campgroundId) throw new BadRequestException("campgroundId is required");
    if (MOCK_MODE) {
      this.logger.log(`[MOCK] proposeRecommendation ${dto.recommendationId}`);
      return { status: "proposed", recommendationId: dto.recommendationId, mock: true };
    }
    await this.audit.record({
      campgroundId: dto.campgroundId,
      actorId: actor.id ?? null,
      action: "recommendation.propose",
      entity: dto.type ?? "recommendation",
      entityId: dto.recommendationId,
      before: null,
      after: {
        targetId: dto.targetId ?? null,
        payload: dto.payload ?? null,
      },
      ip: null,
      userAgent: null,
    });

    return { status: "proposed", recommendationId: dto.recommendationId };
  }

  async getFunnel(campgroundId: string, days = 30) {
    if (!campgroundId) throw new BadRequestException("campgroundId is required");
    const since = new Date();
    since.setDate(since.getDate() - days);
    const aggregates = MOCK_MODE
      ? getMockAggregates(campgroundId, since)
      : await this.prisma.analyticsDailyAggregate.findMany({
          where: { campgroundId, date: { gte: since } },
        });
    const sum = (event: AnalyticsEventName) =>
      aggregates.filter((a) => a.eventName === event).reduce((acc, cur) => acc + (cur.count || 0), 0);

    const views = sum(AnalyticsEventName.page_view);
    const addToStay = sum(AnalyticsEventName.add_to_stay);
    const starts = sum(AnalyticsEventName.reservation_start);
    const abandoned = sum(AnalyticsEventName.reservation_abandoned);
    const completed = sum(AnalyticsEventName.reservation_completed);

    return {
      windowDays: days,
      steps: { views, addToStay, starts, abandoned, completed },
      conversionRate: views ? completed / views : 0,
      abandonmentRate: starts ? abandoned / starts : 0,
    };
  }

  async getImagePerformance(campgroundId: string, days = 30) {
    if (!campgroundId) throw new BadRequestException("campgroundId is required");
    if (MOCK_MODE) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const events = getMockEvents(campgroundId, since);
      const map = new Map<string, { views: number; clicks: number }>();
      for (const e of events) {
        if (!e.imageId) continue;
        const entry = map.get(e.imageId) ?? { views: 0, clicks: 0 };
        if (e.eventName === AnalyticsEventName.image_viewed) entry.views += 1;
        if (e.eventName === AnalyticsEventName.image_clicked) entry.clicks += 1;
        map.set(e.imageId, entry);
      }
      return Array.from(map.entries())
        .map(([imageId, stats]) => ({
          imageId,
          views: stats.views,
          clicks: stats.clicks,
          ctr: stats.views ? stats.clicks / stats.views : 0,
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 20);
    }
    const rows = await this.prisma.$queryRaw<
      Array<{ imageId: string; views: bigint; clicks: bigint }>
    >`
      SELECT "imageId" as "imageId",
             SUM(CASE WHEN "eventName" = 'image_viewed' THEN 1 ELSE 0 END)::bigint AS views,
             SUM(CASE WHEN "eventName" = 'image_clicked' THEN 1 ELSE 0 END)::bigint AS clicks
      FROM "AnalyticsEvent"
      WHERE "campgroundId" = ${campgroundId}
        AND "imageId" IS NOT NULL
        AND "occurredAt" >= NOW() - INTERVAL '${days} day'
      GROUP BY "imageId"
      ORDER BY views DESC
      LIMIT 20
    `;

    return rows.map((row) => ({
      imageId: row.imageId,
      views: Number(row.views),
      clicks: Number(row.clicks),
      ctr: Number(row.views) ? Number(row.clicks) / Number(row.views) : 0,
    }));
  }

  async getDealPerformance(campgroundId: string, days = 30) {
    if (!campgroundId) throw new BadRequestException("campgroundId is required");
    if (MOCK_MODE) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const events = getMockEvents(campgroundId, since);
      const map = new Map<string, { views: number; applies: number }>();
      for (const e of events) {
        if (!e.promotionId) continue;
        const entry = map.get(e.promotionId) ?? { views: 0, applies: 0 };
        if (e.eventName === AnalyticsEventName.deal_viewed) entry.views += 1;
        if (e.eventName === AnalyticsEventName.deal_applied) entry.applies += 1;
        map.set(e.promotionId, entry);
      }
      return Array.from(map.entries())
        .map(([promotionId, stats]) => ({
          promotionId,
          views: stats.views,
          applies: stats.applies,
          applyRate: stats.views ? stats.applies / stats.views : 0,
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 20);
    }
    const rows = await this.prisma.$queryRaw<
      Array<{ promotionId: string; views: bigint; applies: bigint }>
    >`
      SELECT "promotionId",
             SUM(CASE WHEN "eventName" = 'deal_viewed' THEN 1 ELSE 0 END)::bigint AS views,
             SUM(CASE WHEN "eventName" = 'deal_applied' THEN 1 ELSE 0 END)::bigint AS applies
      FROM "AnalyticsEvent"
      WHERE "campgroundId" = ${campgroundId}
        AND "promotionId" IS NOT NULL
        AND "occurredAt" >= NOW() - INTERVAL '${days} day'
      GROUP BY "promotionId"
      ORDER BY views DESC
      LIMIT 20
    `;

    return rows.map((row) => ({
      promotionId: row.promotionId,
      views: Number(row.views),
      applies: Number(row.applies),
      applyRate: Number(row.views) ? Number(row.applies) / Number(row.views) : 0,
    }));
  }

  async getAttribution(campgroundId: string, days = 30) {
    if (!campgroundId) throw new BadRequestException("campgroundId is required");
    if (MOCK_MODE) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const events = getMockEvents(campgroundId, since);
      const map = new Map<string, number>();
      for (const e of events) {
        const ref = e.referrer ?? "direct";
        map.set(ref, (map.get(ref) ?? 0) + 1);
      }
      const total = Array.from(map.values()).reduce((acc, cur) => acc + cur, 0);
      return Array.from(map.entries()).map(([referrer, count]) => ({
        referrer: referrer === "direct" ? null : referrer,
        count,
        share: total ? count / total : 0,
      }));
    }
    const rows = await this.prisma.$queryRaw<
      Array<{ referrer: string | null; count: bigint }>
    >`
      SELECT COALESCE("referrer", 'direct') as referrer, COUNT(*)::bigint as count
      FROM "AnalyticsEvent"
      WHERE "campgroundId" = ${campgroundId}
        AND "occurredAt" >= NOW() - INTERVAL '${days} day'
      GROUP BY COALESCE("referrer", 'direct')
      ORDER BY count DESC
    `;

    const total = rows.reduce((acc, r) => acc + Number(r.count), 0);
    return rows.map((row) => ({
      referrer: row.referrer,
      count: Number(row.count),
      share: total ? Number(row.count) / total : 0,
    }));
  }

  async getPricingSignals(campgroundId: string, days = 30) {
    if (!campgroundId) throw new BadRequestException("campgroundId is required");
    const since = new Date();
    since.setDate(since.getDate() - days);
    const aggregates = MOCK_MODE
      ? getMockAggregates(campgroundId, since)
      : await this.prisma.analyticsDailyAggregate.findMany({
          where: { campgroundId, date: { gte: since } },
        });
    const sum = (event: AnalyticsEventName) =>
      aggregates.filter((a) => a.eventName === event).reduce((acc, cur) => acc + (cur.count || 0), 0);

    const availabilityChecks = sum(AnalyticsEventName.availability_check);
    const addToStay = sum(AnalyticsEventName.add_to_stay);
    const completes = sum(AnalyticsEventName.reservation_completed);

    return {
      windowDays: days,
      availabilityChecks,
      addToStay,
      completes,
      conversionFromAvailability: availabilityChecks ? completes / availabilityChecks : 0,
      conversionFromAddToStay: addToStay ? completes / addToStay : 0,
    };
  }

  async getAnnualReport(campgroundId: string, year?: number, format?: string) {
    if (!campgroundId) throw new BadRequestException("campgroundId is required");
    const targetYear = year ?? new Date().getFullYear();
    const start = new Date(Date.UTC(targetYear, 0, 1));
    const end = new Date(Date.UTC(targetYear + 1, 0, 1));
    if (MOCK_MODE) {
      const events = mockStore.events.filter(
        (e) => (e.campgroundId ?? "mock") === (campgroundId ?? "mock") && e.occurredAt >= start && e.occurredAt < end
      );
      const byEvent = new Map<AnalyticsEventName, number>();
      const dealMap = new Map<string, { views: number; applies: number }>();
      const imgMap = new Map<string, { views: number; clicks: number }>();
      for (const e of events) {
        byEvent.set(e.eventName, (byEvent.get(e.eventName) ?? 0) + 1);
        if (e.promotionId) {
          const entry = dealMap.get(e.promotionId) ?? { views: 0, applies: 0 };
          if (e.eventName === AnalyticsEventName.deal_viewed) entry.views += 1;
          if (e.eventName === AnalyticsEventName.deal_applied) entry.applies += 1;
          dealMap.set(e.promotionId, entry);
        }
        if (e.imageId) {
          const entry = imgMap.get(e.imageId) ?? { views: 0, clicks: 0 };
          if (e.eventName === AnalyticsEventName.image_viewed) entry.views += 1;
          if (e.eventName === AnalyticsEventName.image_clicked) entry.clicks += 1;
          imgMap.set(e.imageId, entry);
        }
      }
      const summary = {
        year: targetYear,
        range: { start, end },
        events: Array.from(byEvent.entries()).map(([eventName, count]) => ({ eventName, count })),
        deals: Array.from(dealMap.entries()).map(([promotionId, stats]) => ({
          promotionId,
          views: stats.views,
          applies: stats.applies,
        })),
        images: Array.from(imgMap.entries()).map(([imageId, stats]) => ({
          imageId,
          views: stats.views,
          clicks: stats.clicks,
        })),
      };
      if (format === "csv") {
        const lines = [
          ["section", "key", "metric", "value"],
          ...summary.events.map((e) => ["events", e.eventName, "count", String(e.count)]),
          ...summary.deals.map((d) => ["deal", d.promotionId, "views", String(d.views)]),
          ...summary.deals.map((d) => ["deal", d.promotionId, "applies", String(d.applies)]),
          ...summary.images.map((i) => ["image", i.imageId, "views", String(i.views)]),
          ...summary.images.map((i) => ["image", i.imageId, "clicks", String(i.clicks)]),
        ];
        const csv = lines.map((l) => l.join(",")).join("\n");
        return { year: targetYear, csv };
      }
      return summary;
    }

    const eventCounts = await this.prisma.$queryRaw<
      Array<{ eventName: AnalyticsEventName; count: bigint }>
    >`
      SELECT "eventName", COUNT(*)::bigint AS count
      FROM "AnalyticsEvent"
      WHERE "campgroundId" = ${campgroundId}
        AND "occurredAt" >= ${start}
        AND "occurredAt" < ${end}
      GROUP BY "eventName"
    `;

    const deals = await this.prisma.$queryRaw<
      Array<{ promotionId: string; views: bigint; applies: bigint }>
    >`
      SELECT "promotionId",
             SUM(CASE WHEN "eventName" = 'deal_viewed' THEN 1 ELSE 0 END)::bigint AS views,
             SUM(CASE WHEN "eventName" = 'deal_applied' THEN 1 ELSE 0 END)::bigint AS applies
      FROM "AnalyticsEvent"
      WHERE "campgroundId" = ${campgroundId}
        AND "promotionId" IS NOT NULL
        AND "occurredAt" >= ${start}
        AND "occurredAt" < ${end}
      GROUP BY "promotionId"
    `;

    const images = await this.prisma.$queryRaw<
      Array<{ imageId: string; views: bigint; clicks: bigint }>
    >`
      SELECT "imageId",
             SUM(CASE WHEN "eventName" = 'image_viewed' THEN 1 ELSE 0 END)::bigint AS views,
             SUM(CASE WHEN "eventName" = 'image_clicked' THEN 1 ELSE 0 END)::bigint AS clicks
      FROM "AnalyticsEvent"
      WHERE "campgroundId" = ${campgroundId}
        AND "imageId" IS NOT NULL
        AND "occurredAt" >= ${start}
        AND "occurredAt" < ${end}
      GROUP BY "imageId"
    `;

    const summary = {
      year: targetYear,
      range: { start, end },
      events: eventCounts.map((row) => ({ eventName: row.eventName, count: Number(row.count) })),
      deals: deals.map((row) => ({ promotionId: row.promotionId, views: Number(row.views), applies: Number(row.applies) })),
      images: images.map((row) => ({ imageId: row.imageId, views: Number(row.views), clicks: Number(row.clicks) })),
    };

    if (format === "csv") {
      const lines = [
        ["section", "key", "metric", "value"],
        ...summary.events.map((e) => ["events", e.eventName, "count", String(e.count)]),
        ...summary.deals.map((d) => ["deal", d.promotionId, "views", String(d.views)]),
        ...summary.deals.map((d) => ["deal", d.promotionId, "applies", String(d.applies)]),
        ...summary.images.map((i) => ["image", i.imageId, "views", String(i.views)]),
        ...summary.images.map((i) => ["image", i.imageId, "clicks", String(i.clicks)]),
      ];
      const csv = lines.map((l) => l.join(",")).join("\n");
      return { year: targetYear, csv };
    }

    return summary;
  }

  /**
   * Get device breakdown analytics - shows mobile vs desktop vs tablet usage
   */
  async getDeviceBreakdown(campgroundId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    if (MOCK_MODE) {
      // Return mock data
      return {
        period: { days, since },
        devices: [
          { deviceType: "mobile", sessions: 245, bookings: 89, conversionRate: 36.3 },
          { deviceType: "desktop", sessions: 312, bookings: 156, conversionRate: 50.0 },
          { deviceType: "tablet", sessions: 43, bookings: 15, conversionRate: 34.9 }
        ],
        browsers: [
          { browser: "Chrome", sessions: 320, percentage: 53.3 },
          { browser: "Safari", sessions: 180, percentage: 30.0 },
          { browser: "Firefox", sessions: 60, percentage: 10.0 },
          { browser: "Edge", sessions: 40, percentage: 6.7 }
        ],
        trends: []
      };
    }

    // Get session counts by device type
    const deviceSessions = await this.prisma.$queryRaw<
      Array<{ deviceType: string; sessions: bigint }>
    >`
      SELECT COALESCE("deviceType", 'unknown') as "deviceType",
             COUNT(DISTINCT "sessionId")::bigint as sessions
      FROM "AnalyticsEvent"
      WHERE "campgroundId" = ${campgroundId}
        AND "occurredAt" >= ${since}
      GROUP BY "deviceType"
      ORDER BY sessions DESC
    `;

    // Get booking counts by device type (completed_booking event)
    const deviceBookings = await this.prisma.$queryRaw<
      Array<{ deviceType: string; bookings: bigint }>
    >`
      SELECT COALESCE("deviceType", 'unknown') as "deviceType",
             COUNT(*)::bigint as bookings
      FROM "AnalyticsEvent"
      WHERE "campgroundId" = ${campgroundId}
        AND "eventName" = 'completed_booking'
        AND "occurredAt" >= ${since}
      GROUP BY "deviceType"
    `;

    // Build device breakdown with conversion rates
    const bookingMap = new Map(deviceBookings.map(d => [d.deviceType, Number(d.bookings)]));
    const devices = deviceSessions.map(d => {
      const sessions = Number(d.sessions);
      const bookings = bookingMap.get(d.deviceType) || 0;
      return {
        deviceType: d.deviceType,
        sessions,
        bookings,
        conversionRate: sessions > 0 ? Math.round((bookings / sessions) * 1000) / 10 : 0
      };
    });

    // Get daily trends by device type
    const trends = await this.prisma.$queryRaw<
      Array<{ date: Date; deviceType: string; sessions: bigint }>
    >`
      SELECT DATE_TRUNC('day', "occurredAt") as date,
             COALESCE("deviceType", 'unknown') as "deviceType",
             COUNT(DISTINCT "sessionId")::bigint as sessions
      FROM "AnalyticsEvent"
      WHERE "campgroundId" = ${campgroundId}
        AND "occurredAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "occurredAt"), "deviceType"
      ORDER BY date ASC
    `;

    return {
      period: { days, since },
      devices,
      trends: trends.map(t => ({
        date: t.date,
        deviceType: t.deviceType,
        sessions: Number(t.sessions)
      }))
    };
  }
}

