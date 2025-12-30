import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Webhook log entry returned from queries
 */
export interface WebhookLogEntry {
  id: string;
  eventType: string;
  status: string;
  attempt: number;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
  payload: unknown;
  webhookEndpoint: {
    id: string;
    url: string;
    description: string | null;
  };
}

/**
 * Filter options for querying webhook logs
 */
export interface WebhookLogFilter {
  campgroundId: string;
  endpointId?: string;
  eventType?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Webhook delivery statistics
 */
export interface WebhookStats {
  total: number;
  delivered: number;
  failed: number;
  retrying: number;
  deadLetter: number;
  pending: number;
  successRate: number;
  averageAttempts: number;
}

/**
 * Webhook Logs Service
 *
 * Provides logging, querying, and retention management for webhook delivery attempts.
 * Default retention period is 30 days.
 */
@Injectable()
export class WebhookLogsService {
  private readonly logger = new Logger(WebhookLogsService.name);
  private readonly DEFAULT_RETENTION_DAYS = 30;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Query webhook delivery logs with filtering
   *
   * @param filter - Filter options for the query
   * @returns Array of log entries matching the filter
   */
  async queryLogs(filter: WebhookLogFilter): Promise<{
    logs: WebhookLogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    const limit = filter.limit || 50;
    const offset = filter.offset || 0;

    const whereClause: Record<string, unknown> = {
      webhookEndpoint: { campgroundId: filter.campgroundId },
    };

    if (filter.endpointId) {
      whereClause.webhookEndpointId = filter.endpointId;
    }

    if (filter.eventType) {
      whereClause.eventType = filter.eventType;
    }

    if (filter.status) {
      whereClause.status = filter.status;
    }

    if (filter.startDate || filter.endDate) {
      whereClause.createdAt = {};
      if (filter.startDate) {
        (whereClause.createdAt as Record<string, Date>).gte = filter.startDate;
      }
      if (filter.endDate) {
        (whereClause.createdAt as Record<string, Date>).lte = filter.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where: whereClause,
        select: {
          id: true,
          eventType: true,
          status: true,
          attempt: true,
          responseStatus: true,
          responseBody: true,
          errorMessage: true,
          createdAt: true,
          deliveredAt: true,
          payload: true,
          webhookEndpoint: {
            select: {
              id: true,
              url: true,
              description: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1, // Fetch one extra to check hasMore
        skip: offset,
      }),
      this.prisma.webhookDelivery.count({ where: whereClause }),
    ]);

    const hasMore = logs.length > limit;
    if (hasMore) {
      logs.pop(); // Remove the extra item
    }

    return {
      logs: logs as WebhookLogEntry[],
      total,
      hasMore,
    };
  }

  /**
   * Get a single delivery log entry by ID
   */
  async getLogEntry(
    deliveryId: string,
    campgroundId: string
  ): Promise<WebhookLogEntry | null> {
    const entry = await this.prisma.webhookDelivery.findFirst({
      where: {
        id: deliveryId,
        webhookEndpoint: { campgroundId },
      },
      select: {
        id: true,
        eventType: true,
        status: true,
        attempt: true,
        responseStatus: true,
        responseBody: true,
        errorMessage: true,
        createdAt: true,
        deliveredAt: true,
        payload: true,
        webhookEndpoint: {
          select: {
            id: true,
            url: true,
            description: true,
          },
        },
      },
    });

    return entry as WebhookLogEntry | null;
  }

  /**
   * Get webhook delivery statistics for a campground
   */
  async getStats(campgroundId: string, days = 30): Promise<WebhookStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const whereClause = {
      webhookEndpoint: { campgroundId },
      createdAt: { gte: startDate },
    };

    const [total, delivered, failed, retrying, deadLetter, pending, avgResult] =
      await Promise.all([
        this.prisma.webhookDelivery.count({ where: whereClause }),
        this.prisma.webhookDelivery.count({
          where: { ...whereClause, status: "delivered" },
        }),
        this.prisma.webhookDelivery.count({
          where: { ...whereClause, status: "failed" },
        }),
        this.prisma.webhookDelivery.count({
          where: { ...whereClause, status: "retrying" },
        }),
        this.prisma.webhookDelivery.count({
          where: { ...whereClause, status: "dead_letter" },
        }),
        this.prisma.webhookDelivery.count({
          where: { ...whereClause, status: "pending" },
        }),
        this.prisma.webhookDelivery.aggregate({
          where: { ...whereClause, status: "delivered" },
          _avg: { attempt: true },
        }),
      ]);

    const successRate = total > 0 ? Math.round((delivered / total) * 100) : 100;
    const averageAttempts = avgResult._avg.attempt || 1;

    return {
      total,
      delivered,
      failed,
      retrying,
      deadLetter,
      pending,
      successRate,
      averageAttempts: Math.round(averageAttempts * 10) / 10,
    };
  }

  /**
   * Get stats grouped by event type
   */
  async getStatsByEventType(
    campgroundId: string,
    days = 30
  ): Promise<Array<{ eventType: string; total: number; delivered: number; failed: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const deliveries = await this.prisma.webhookDelivery.groupBy({
      by: ["eventType", "status"],
      where: {
        webhookEndpoint: { campgroundId },
        createdAt: { gte: startDate },
      },
      _count: { id: true },
    });

    // Aggregate by event type
    const eventMap = new Map<
      string,
      { total: number; delivered: number; failed: number }
    >();

    for (const d of deliveries) {
      const existing = eventMap.get(d.eventType) || {
        total: 0,
        delivered: 0,
        failed: 0,
      };
      existing.total += d._count.id;
      if (d.status === "delivered") {
        existing.delivered += d._count.id;
      } else if (d.status === "failed" || d.status === "dead_letter") {
        existing.failed += d._count.id;
      }
      eventMap.set(d.eventType, existing);
    }

    return Array.from(eventMap.entries())
      .map(([eventType, stats]) => ({ eventType, ...stats }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Get stats grouped by endpoint
   */
  async getStatsByEndpoint(
    campgroundId: string,
    days = 30
  ): Promise<
    Array<{
      endpointId: string;
      url: string;
      total: number;
      delivered: number;
      failed: number;
      successRate: number;
    }>
  > {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { campgroundId },
      select: { id: true, url: true },
    });

    const stats = await Promise.all(
      endpoints.map(async (endpoint: { id: string; url: string }) => {
        const [total, delivered, failed] = await Promise.all([
          this.prisma.webhookDelivery.count({
            where: {
              webhookEndpointId: endpoint.id,
              createdAt: { gte: startDate },
            },
          }),
          this.prisma.webhookDelivery.count({
            where: {
              webhookEndpointId: endpoint.id,
              status: "delivered",
              createdAt: { gte: startDate },
            },
          }),
          this.prisma.webhookDelivery.count({
            where: {
              webhookEndpointId: endpoint.id,
              status: { in: ["failed", "dead_letter"] },
              createdAt: { gte: startDate },
            },
          }),
        ]);

        return {
          endpointId: endpoint.id,
          url: endpoint.url,
          total,
          delivered,
          failed,
          successRate: total > 0 ? Math.round((delivered / total) * 100) : 100,
        };
      })
    );

    return stats.sort((a, b) => b.total - a.total);
  }

  /**
   * Purge old webhook delivery logs
   *
   * @param retentionDays - Number of days to retain logs (default: 30)
   * @returns Number of records deleted
   */
  async purgeLogs(retentionDays?: number): Promise<{ deleted: number }> {
    const days = retentionDays || this.DEFAULT_RETENTION_DAYS;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Only purge delivered and failed entries, keep dead letter for review
    const result = await this.prisma.webhookDelivery.deleteMany({
      where: {
        status: { in: ["delivered", "failed"] },
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(
      `Purged ${result.count} webhook delivery logs older than ${days} days`
    );

    return { deleted: result.count };
  }

  /**
   * Get recent failures for alerting purposes
   */
  async getRecentFailures(
    campgroundId: string,
    minutes = 60
  ): Promise<Array<{ endpointId: string; url: string; failureCount: number }>> {
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() - minutes);

    const failures = await this.prisma.webhookDelivery.groupBy({
      by: ["webhookEndpointId"],
      where: {
        webhookEndpoint: { campgroundId },
        status: { in: ["failed", "dead_letter"] },
        createdAt: { gte: startTime },
      },
      _count: { id: true },
    });

    if (!failures.length) return [];

    const endpointIds = failures.map((f: { webhookEndpointId: string }) => f.webhookEndpointId);
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { id: { in: endpointIds } },
      select: { id: true, url: true },
    });

    const endpointMap = new Map(endpoints.map((e: { id: string; url: string }) => [e.id, e.url]));

    return failures.map((f: { webhookEndpointId: string; _count: { id: number } }) => ({
      endpointId: f.webhookEndpointId,
      url: endpointMap.get(f.webhookEndpointId) || "Unknown",
      failureCount: f._count.id,
    }));
  }
}
