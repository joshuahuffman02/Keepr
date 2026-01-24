import { Injectable, ForbiddenException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AiFeatureType, AiConsentType } from "@prisma/client";

interface FeatureCheckResult {
  allowed: boolean;
  reason?: string;
}

@Injectable()
export class AiFeatureGateService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a specific AI feature is enabled for a campground
   */
  async isFeatureEnabled(
    campgroundId: string,
    feature: AiFeatureType,
  ): Promise<FeatureCheckResult> {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        aiEnabled: true,
        aiReplyAssistEnabled: true,
        aiBookingAssistEnabled: true,
        aiAnalyticsEnabled: true,
        aiForecastingEnabled: true,
      },
    });

    if (!campground) {
      return { allowed: false, reason: "Campground not found" };
    }

    if (!campground.aiEnabled) {
      return { allowed: false, reason: "AI features are disabled for this campground" };
    }

    const featureFlags: Record<AiFeatureType, boolean> = {
      reply_assist: campground.aiReplyAssistEnabled,
      booking_assist: campground.aiBookingAssistEnabled,
      analytics: campground.aiAnalyticsEnabled,
      forecasting: campground.aiForecastingEnabled,
      anomaly_detection: campground.aiAnalyticsEnabled, // Bundled with analytics
      recommendations: campground.aiBookingAssistEnabled, // Bundled with booking assist
    };

    if (!featureFlags[feature]) {
      return { allowed: false, reason: `${feature} is not enabled for this campground` };
    }

    return { allowed: true };
  }

  /**
   * Assert that a feature is enabled, throwing if not
   */
  async assertFeatureEnabled(campgroundId: string, feature: AiFeatureType): Promise<void> {
    const result = await this.isFeatureEnabled(campgroundId, feature);
    if (!result.allowed) {
      throw new ForbiddenException(result.reason || "AI feature not available");
    }
  }

  /**
   * Check if guest has given consent for a specific AI feature
   */
  async hasConsent(
    campgroundId: string,
    consentType: AiConsentType,
    guestId?: string,
    sessionId?: string,
  ): Promise<boolean> {
    if (!guestId && !sessionId) {
      return false;
    }

    const consent = await this.prisma.aiConsentRecord.findFirst({
      where: {
        campgroundId,
        consentType,
        granted: true,
        revokedAt: null,
        OR: [guestId ? { guestId } : {}, sessionId ? { sessionId } : {}].filter(
          (obj) => Object.keys(obj).length > 0,
        ),
      },
    });

    return !!consent;
  }

  /**
   * Record consent from a guest
   */
  async recordConsent(data: {
    campgroundId: string;
    consentType: AiConsentType;
    guestId?: string;
    sessionId?: string;
    ipHash?: string;
    userAgent?: string;
    source?: string;
  }): Promise<void> {
    // Check for existing consent record
    const existing = await this.prisma.aiConsentRecord.findFirst({
      where: {
        campgroundId: data.campgroundId,
        consentType: data.consentType,
        OR: [
          data.guestId ? { guestId: data.guestId } : {},
          data.sessionId ? { sessionId: data.sessionId } : {},
        ].filter((obj) => Object.keys(obj).length > 0),
      },
    });

    if (existing) {
      // Update existing record
      await this.prisma.aiConsentRecord.update({
        where: { id: existing.id },
        data: {
          granted: true,
          revokedAt: null,
          grantedAt: new Date(),
          ipHash: data.ipHash,
          userAgent: data.userAgent,
          source: data.source,
        },
      });
    } else {
      // Create new record
      await this.prisma.aiConsentRecord.create({
        data: {
          id: randomUUID(),
          campgroundId: data.campgroundId,
          consentType: data.consentType,
          guestId: data.guestId,
          sessionId: data.sessionId,
          granted: true,
          ipHash: data.ipHash,
          userAgent: data.userAgent,
          source: data.source,
        },
      });
    }
  }

  /**
   * Revoke consent from a guest
   */
  async revokeConsent(
    campgroundId: string,
    consentType: AiConsentType,
    guestId?: string,
    sessionId?: string,
  ): Promise<void> {
    await this.prisma.aiConsentRecord.updateMany({
      where: {
        campgroundId,
        consentType,
        granted: true,
        revokedAt: null,
        OR: [guestId ? { guestId } : {}, sessionId ? { sessionId } : {}].filter(
          (obj) => Object.keys(obj).length > 0,
        ),
      },
      data: {
        granted: false,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Get all consent records for a guest
   */
  async getConsentRecords(campgroundId: string, guestId: string) {
    return this.prisma.aiConsentRecord.findMany({
      where: {
        campgroundId,
        guestId,
      },
      orderBy: { grantedAt: "desc" },
    });
  }

  /**
   * Get AI usage statistics for a campground
   */
  async getUsageStats(campgroundId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await this.prisma.aiInteractionLog.groupBy({
      by: ["featureType"],
      where: {
        campgroundId,
        createdAt: { gte: since },
      },
      _count: { id: true },
      _sum: { tokensUsed: true, costCents: true },
      _avg: { latencyMs: true },
    });

    const totalStats = await this.prisma.aiInteractionLog.aggregate({
      where: {
        campgroundId,
        createdAt: { gte: since },
      },
      _count: { id: true },
      _sum: { tokensUsed: true, costCents: true },
    });

    return {
      period: { days, since },
      byFeature: logs.map((log) => ({
        feature: log.featureType,
        interactions: log._count.id,
        tokensUsed: log._sum.tokensUsed || 0,
        costCents: log._sum.costCents || 0,
        avgLatencyMs: Math.round(log._avg.latencyMs || 0),
      })),
      totals: {
        interactions: totalStats._count.id,
        tokensUsed: totalStats._sum.tokensUsed || 0,
        costCents: totalStats._sum.costCents || 0,
      },
    };
  }
}
