import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma, ExpirationTier } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { BatchInventoryService } from "./batch-inventory.service";
import { WebhookService, WebhookEvent } from "../developer-api/webhook.service";

interface ExpirationAlertData {
  batchId: string;
  productId: string;
  productName: string;
  locationName: string | null;
  tier: ExpirationTier;
  expirationDate: Date;
  daysRemaining: number;
  qtyRemaining: number;
}

@Injectable()
export class ExpirationAlertService {
  private readonly logger = new Logger(ExpirationAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly batchInventory: BatchInventoryService,
    private readonly webhookService: WebhookService,
  ) {}

  // ==================== SCHEDULED JOBS ====================

  /**
   * Daily job to generate expiration alerts.
   * Runs at 6:00 AM every day.
   */
  @Cron("0 6 * * *", {
    name: "processExpirationAlerts",
    timeZone: "America/Chicago",
  })
  async processExpirationAlerts() {
    this.logger.log("Starting daily expiration alert processing...");

    try {
      // Get all campgrounds with batch-tracked products
      const campgrounds = await this.prisma.campground.findMany({
        where: {
          Product: {
            some: { useBatchTracking: true },
          },
        },
        select: { id: true, name: true },
      });

      for (const campground of campgrounds) {
        await this.processCampgroundAlerts(campground.id, campground.name);
      }

      this.logger.log("Expiration alert processing completed");
    } catch (error) {
      this.logger.error("Failed to process expiration alerts", error);
    }
  }

  /**
   * Process alerts for a single campground.
   */
  async processCampgroundAlerts(
    campgroundId: string,
    campgroundName: string,
  ): Promise<ExpirationAlertData[]> {
    const now = new Date();
    const alerts: ExpirationAlertData[] = [];

    // Get all active batches with expiration dates
    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        campgroundId,
        isActive: true,
        qtyRemaining: { gt: 0 },
        expirationDate: { not: null },
      },
      include: {
        Product: {
          select: {
            id: true,
            name: true,
            sku: true,
            categoryId: true,
            ProductCategory: true,
            ProductExpirationConfig: { where: { campgroundId } },
          },
        },
        StoreLocation: { select: { id: true, name: true } },
      },
    });

    for (const batch of batches) {
      const tier = await this.batchInventory.getExpirationTier(batch);

      // Only create alerts for warning, critical, or expired tiers
      if (tier === ExpirationTier.fresh) continue;

      const daysRemaining = Math.ceil(
        (batch.expirationDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      const alertData: ExpirationAlertData = {
        batchId: batch.id,
        productId: batch.productId,
        productName: batch.Product.name,
        locationName: batch.StoreLocation?.name ?? null,
        tier,
        expirationDate: batch.expirationDate!,
        daysRemaining,
        qtyRemaining: batch.qtyRemaining,
      };

      alerts.push(alertData);

      // Check if we've already created an alert for this batch/tier today
      const existingAlert = await this.prisma.expirationAlert.findFirst({
        where: {
          batchId: batch.id,
          tier,
          alertedAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          },
        },
      });

      if (!existingAlert) {
        // Create new alert record
        await this.prisma.expirationAlert.create({
          data: {
            id: randomUUID(),
            campgroundId,
            batchId: batch.id,
            tier,
            expirationDate: batch.expirationDate!,
            daysRemaining,
            productName: batch.Product.name,
            locationName: batch.StoreLocation?.name,
            qtyRemaining: batch.qtyRemaining,
          },
        });

        // Emit webhook event for new alert
        const webhookEventType = this.getWebhookEventForTier(tier);
        if (webhookEventType) {
          await this.webhookService.emit(webhookEventType, campgroundId, {
            batchId: batch.id,
            productId: batch.productId,
            productSku: batch.Product.sku,
            productName: batch.Product.name,
            expirationDate: batch.expirationDate!.toISOString(),
            daysUntilExpiration: daysRemaining,
            qtyRemaining: batch.qtyRemaining,
            locationId: batch.StoreLocation?.id ?? null,
            locationName: batch.StoreLocation?.name ?? null,
            tier,
          });
        }
      }
    }

    // Log summary
    if (alerts.length > 0) {
      const summary = {
        warning: alerts.filter((a) => a.tier === ExpirationTier.warning).length,
        critical: alerts.filter((a) => a.tier === ExpirationTier.critical).length,
        expired: alerts.filter((a) => a.tier === ExpirationTier.expired).length,
      };
      this.logger.log(
        `${campgroundName}: ${summary.warning} warning, ${summary.critical} critical, ${summary.expired} expired`,
      );
    }

    return alerts;
  }

  // ==================== ALERT QUERIES ====================

  /**
   * Get active alerts for a campground (unacknowledged).
   */
  async getActiveAlerts(
    campgroundId: string,
    options?: {
      tier?: ExpirationTier;
      limit?: number;
    },
  ) {
    return this.prisma.expirationAlert.findMany({
      where: {
        campgroundId,
        acknowledgedAt: null,
        ...(options?.tier ? { tier: options.tier } : {}),
      },
      orderBy: [
        { tier: "desc" }, // expired > critical > warning
        { daysRemaining: "asc" },
      ],
      take: options?.limit,
    });
  }

  /**
   * Get alert history for reporting.
   */
  async getAlertHistory(campgroundId: string, startDate: Date, endDate: Date) {
    return this.prisma.expirationAlert.findMany({
      where: {
        campgroundId,
        alertedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { alertedAt: "desc" },
    });
  }

  /**
   * Acknowledge an alert.
   */
  async acknowledgeAlert(id: string, userId: string) {
    return this.prisma.expirationAlert.update({
      where: { id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedById: userId,
      },
    });
  }

  /**
   * Bulk acknowledge alerts.
   */
  async acknowledgeAlerts(ids: string[], userId: string) {
    return this.prisma.expirationAlert.updateMany({
      where: { id: { in: ids } },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedById: userId,
      },
    });
  }

  // ==================== DASHBOARD DATA ====================

  /**
   * Get expiration dashboard data for a campground.
   */
  async getDashboardData(campgroundId: string) {
    const now = new Date();

    // Get summary from batch inventory service
    const summary = await this.batchInventory.getExpirationSummary(campgroundId);

    // Get recent unacknowledged alerts
    const recentAlerts = await this.getActiveAlerts(campgroundId, { limit: 10 });

    // Get 7-day trend
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const alertHistory = await this.prisma.expirationAlert.groupBy({
      by: ["tier"],
      where: {
        campgroundId,
        alertedAt: { gte: sevenDaysAgo },
      },
      _count: true,
    });

    const trends = {
      warning: alertHistory.find((h) => h.tier === ExpirationTier.warning)?._count ?? 0,
      critical: alertHistory.find((h) => h.tier === ExpirationTier.critical)?._count ?? 0,
      expired: alertHistory.find((h) => h.tier === ExpirationTier.expired)?._count ?? 0,
    };

    return {
      summary: {
        fresh: summary.fresh,
        warning: summary.warning,
        critical: summary.critical,
        expired: summary.expired,
        atRiskValueCents: summary.totalValue,
      },
      topExpiring: summary.batches.slice(0, 5),
      recentAlerts,
      weeklyTrends: trends,
    };
  }

  // ==================== EMAIL REPORTS ====================

  /**
   * Generate daily email report content.
   * To be called by the notification system.
   */
  async generateDailyReportContent(campgroundId: string): Promise<{
    hasAlerts: boolean;
    subject: string;
    items: Array<{
      productName: string;
      locationName: string | null;
      qtyRemaining: number;
      expirationDate: Date;
      daysRemaining: number;
      tier: ExpirationTier;
    }>;
    summary: {
      warning: number;
      critical: number;
      expired: number;
      totalAtRisk: number;
    };
  }> {
    const alerts = await this.processCampgroundAlerts(campgroundId, "");

    const summary = {
      warning: alerts.filter((a) => a.tier === ExpirationTier.warning).length,
      critical: alerts.filter((a) => a.tier === ExpirationTier.critical).length,
      expired: alerts.filter((a) => a.tier === ExpirationTier.expired).length,
      totalAtRisk: alerts.reduce((sum, a) => sum + a.qtyRemaining, 0),
    };

    const hasAlerts = alerts.length > 0;

    let subject = "Daily Inventory Expiration Report";
    if (summary.expired > 0) {
      subject = `ALERT: ${summary.expired} EXPIRED items require attention`;
    } else if (summary.critical > 0) {
      subject = `CRITICAL: ${summary.critical} items critically close to expiration`;
    } else if (summary.warning > 0) {
      subject = `WARNING: ${summary.warning} items approaching expiration`;
    }

    // Sort by urgency
    alerts.sort((a, b) => {
      const tierOrder = { expired: 0, critical: 1, warning: 2, fresh: 3 };
      return tierOrder[a.tier] - tierOrder[b.tier] || a.daysRemaining - b.daysRemaining;
    });

    return {
      hasAlerts,
      subject,
      items: alerts.map((a) => ({
        productName: a.productName,
        locationName: a.locationName,
        qtyRemaining: a.qtyRemaining,
        expirationDate: a.expirationDate,
        daysRemaining: a.daysRemaining,
        tier: a.tier,
      })),
      summary,
    };
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Map expiration tier to webhook event type.
   */
  private getWebhookEventForTier(tier: ExpirationTier): WebhookEvent | null {
    switch (tier) {
      case ExpirationTier.warning:
        return "inventory.expiration.warning";
      case ExpirationTier.critical:
        return "inventory.expiration.critical";
      case ExpirationTier.expired:
        return "inventory.expiration.expired";
      default:
        return null;
    }
  }
}
