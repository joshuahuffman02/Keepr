import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

interface RecordUsageInput {
  apiClientId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize?: number;
  responseSize?: number;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ApiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async recordUsage(input: RecordUsageInput) {
    return this.prisma.apiUsage.create({
      data: {
        id: randomUUID(),
        apiClientId: input.apiClientId,
        endpoint: input.endpoint,
        method: input.method,
        statusCode: input.statusCode,
        responseTime: input.responseTime,
        requestSize: input.requestSize,
        responseSize: input.responseSize,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  // Check if client has exceeded rate limit
  async checkRateLimit(
    apiClientId: string,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const client = await this.prisma.apiClient.findUnique({
      where: { id: apiClientId },
      select: { rateLimit: true },
    });

    const rateLimit = client?.rateLimit || 1000;
    const windowStart = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

    const usageCount = await this.prisma.apiUsage.count({
      where: {
        apiClientId,
        createdAt: { gte: windowStart },
      },
    });

    const remaining = Math.max(0, rateLimit - usageCount);
    const resetAt = new Date(windowStart.getTime() + 60 * 60 * 1000);

    return {
      allowed: usageCount < rateLimit,
      remaining,
      resetAt,
    };
  }

  // Get usage stats for a client
  async getClientStats(apiClientId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalRequests, avgResponseTime, statusBreakdown, topEndpoints, dailyUsage] =
      await Promise.all([
        // Total requests
        this.prisma.apiUsage.count({
          where: { apiClientId, createdAt: { gte: startDate } },
        }),

        // Average response time
        this.prisma.apiUsage.aggregate({
          where: { apiClientId, createdAt: { gte: startDate } },
          _avg: { responseTime: true },
        }),

        // Status code breakdown
        this.prisma.apiUsage.groupBy({
          by: ["statusCode"],
          where: { apiClientId, createdAt: { gte: startDate } },
          _count: true,
        }),

        // Top endpoints
        this.prisma.apiUsage.groupBy({
          by: ["endpoint", "method"],
          where: { apiClientId, createdAt: { gte: startDate } },
          _count: true,
          orderBy: { _count: { endpoint: "desc" } },
          take: 10,
        }),

        // Daily usage (raw query for date grouping)
        this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM "ApiUsage"
        WHERE api_client_id = ${apiClientId}
          AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `,
      ]);

    const successRate =
      statusBreakdown.length > 0
        ? Math.round(
            (statusBreakdown
              .filter((s) => s.statusCode >= 200 && s.statusCode < 300)
              .reduce((sum, s) => sum + s._count, 0) /
              totalRequests) *
              100,
          )
        : 100;

    return {
      totalRequests,
      avgResponseTime: Math.round(avgResponseTime._avg.responseTime || 0),
      successRate,
      statusBreakdown: statusBreakdown.map((s) => ({
        statusCode: s.statusCode,
        count: s._count,
      })),
      topEndpoints: topEndpoints.map((e) => ({
        endpoint: e.endpoint,
        method: e.method,
        count: e._count,
      })),
      dailyUsage: dailyUsage.map((d) => ({
        date: d.date,
        count: Number(d.count),
      })),
    };
  }

  // Get platform-wide API stats (for admin)
  async getPlatformStats(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalRequests, uniqueClients, avgResponseTime, topClients] = await Promise.all([
      this.prisma.apiUsage.count({
        where: { createdAt: { gte: startDate } },
      }),

      this.prisma.apiUsage.groupBy({
        by: ["apiClientId"],
        where: { createdAt: { gte: startDate } },
      }),

      this.prisma.apiUsage.aggregate({
        where: { createdAt: { gte: startDate } },
        _avg: { responseTime: true },
      }),

      this.prisma.apiUsage.groupBy({
        by: ["apiClientId"],
        where: { createdAt: { gte: startDate } },
        _count: true,
        orderBy: { _count: { apiClientId: "desc" } },
        take: 10,
      }),
    ]);

    // Get client names for top clients
    const clientIds = topClients.map((c) => c.apiClientId);
    const clients = await this.prisma.apiClient.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, Campground: { select: { name: true } } },
    });
    const clientMap = new Map(clients.map((c) => [c.id, c]));

    return {
      totalRequests,
      uniqueClients: uniqueClients.length,
      avgResponseTime: Math.round(avgResponseTime._avg.responseTime || 0),
      topClients: topClients.map((c) => {
        const client = clientMap.get(c.apiClientId);
        return {
          apiClientId: c.apiClientId,
          name: client?.name || "Unknown",
          campground: client?.Campground?.name || "Unknown",
          requests: c._count,
        };
      }),
    };
  }

  // Cleanup old usage records (call from cron)
  async cleanupOldRecords(retentionDays = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.apiUsage.deleteMany({
      where: { createdAt: { lt: cutoffDate } },
    });

    return { deleted: result.count };
  }
}
