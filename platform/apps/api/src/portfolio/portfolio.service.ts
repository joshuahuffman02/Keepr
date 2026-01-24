import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

export interface DashboardWidget {
  type: "occupancy" | "revenue" | "bookings" | "adr" | "revpar" | "chart";
  position: { x: number; y: number; w: number; h: number };
  config?: Record<string, Prisma.InputJsonValue>;
}

export interface CreateDashboardDto {
  orgId: string;
  name: string;
  layout: DashboardWidget[];
  isDefault?: boolean;
  createdById: string;
}

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

const toJsonInput = (value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  toJsonValue(value) ?? Prisma.JsonNull;

const toNullableJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return toJsonValue(value) ?? Prisma.JsonNull;
};

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Dashboards ----

  async createDashboard(dto: CreateDashboardDto) {
    if (dto.isDefault) {
      // Unset other defaults
      await this.prisma.portfolioDashboard.updateMany({
        where: { orgId: dto.orgId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.portfolioDashboard.create({
      data: {
        id: randomUUID(),
        orgId: dto.orgId,
        name: dto.name,
        layout: toJsonInput(dto.layout),
        isDefault: dto.isDefault ?? false,
        createdById: dto.createdById,
        updatedAt: new Date(),
      },
    });
  }

  async listDashboards(orgId: string) {
    return this.prisma.portfolioDashboard.findMany({
      where: { orgId },
      include: {
        User: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async getDashboard(id: string) {
    const dashboard = await this.prisma.portfolioDashboard.findUnique({
      where: { id },
      include: { Organization: true },
    });
    if (!dashboard) throw new NotFoundException("Dashboard not found");
    return dashboard;
  }

  async updateDashboard(id: string, dto: Partial<CreateDashboardDto>) {
    if (dto.isDefault) {
      const existing = await this.getDashboard(id);
      await this.prisma.portfolioDashboard.updateMany({
        where: { orgId: existing.orgId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.portfolioDashboard.update({
      where: { id },
      data: {
        name: dto.name,
        layout: dto.layout === undefined ? undefined : toJsonInput(dto.layout),
        isDefault: dto.isDefault,
        updatedAt: new Date(),
      },
    });
  }

  async deleteDashboard(id: string) {
    return this.prisma.portfolioDashboard.delete({ where: { id } });
  }

  // ---- Portfolio Metrics ----

  async recordMetrics(
    orgId: string,
    campgroundId: string | null,
    date: Date,
    metrics: { metricType: string; value: number }[],
  ) {
    const results = [];

    for (const metric of metrics) {
      // Get previous value for change calculation
      const previous = await this.prisma.portfolioMetric.findFirst({
        where: {
          orgId,
          campgroundId,
          metricType: metric.metricType,
          metricDate: { lt: date },
        },
        orderBy: { metricDate: "desc" },
      });

      const changePercent = previous
        ? ((metric.value - previous.value) / previous.value) * 100
        : null;

      const result = await this.prisma.portfolioMetric.upsert({
        where: {
          orgId_campgroundId_metricDate_metricType: {
            orgId,
            campgroundId: campgroundId ?? "",
            metricDate: date,
            metricType: metric.metricType,
          },
        },
        update: {
          value: metric.value,
          previousValue: previous?.value,
          changePercent,
        },
        create: {
          id: randomUUID(),
          orgId,
          campgroundId,
          metricDate: date,
          metricType: metric.metricType,
          value: metric.value,
          previousValue: previous?.value,
          changePercent,
        },
      });

      results.push(result);
    }

    return results;
  }

  async getMetrics(
    orgId: string,
    campgroundId?: string,
    metricType?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return this.prisma.portfolioMetric.findMany({
      where: {
        orgId,
        ...(campgroundId ? { campgroundId } : {}),
        ...(metricType ? { metricType } : {}),
        ...(startDate || endDate
          ? {
              metricDate: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        Campground: { select: { id: true, name: true } },
      },
      orderBy: { metricDate: "desc" },
    });
  }

  /**
   * Get aggregated metrics across all properties in organization
   */
  async getPortfolioSummary(orgId: string, date: Date) {
    const campgrounds = await this.prisma.campground.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
    });

    const metrics = await this.prisma.portfolioMetric.findMany({
      where: {
        orgId,
        metricDate: date,
      },
    });

    // Aggregate by metric type
    const summary: Record<string, { total: number; byProperty: Record<string, number> }> = {};

    for (const metric of metrics) {
      if (!summary[metric.metricType]) {
        summary[metric.metricType] = { total: 0, byProperty: {} };
      }

      if (metric.campgroundId) {
        summary[metric.metricType].byProperty[metric.campgroundId] = metric.value;
        summary[metric.metricType].total += metric.value;
      } else {
        // Org-level metric
        summary[metric.metricType].total = metric.value;
      }
    }

    return {
      date,
      campgrounds,
      metrics: summary,
    };
  }

  // ---- Centralized Rate Push ----

  async createRatePush(
    orgId: string,
    name: string,
    rateConfig: Record<string, unknown>,
    targetCampIds: string[],
    createdBy: string,
  ) {
    return this.prisma.centralizedRatePush.create({
      data: {
        id: randomUUID(),
        orgId,
        name,
        rateConfig: toJsonInput(rateConfig),
        targetCampIds,
        status: "draft",
        createdBy,
        updatedAt: new Date(),
      },
    });
  }

  async listRatePushes(orgId: string) {
    return this.prisma.centralizedRatePush.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    });
  }

  async applyRatePush(id: string, appliedBy: string) {
    const push = await this.prisma.centralizedRatePush.findUnique({ where: { id } });
    if (!push) throw new NotFoundException("Rate push not found");

    const results: Record<string, { success: boolean; error?: string }> = {};

    for (const campId of push.targetCampIds) {
      try {
        // Apply rate configuration to campground
        // This would integrate with the pricing service
        // For now, just mark as applied
        results[campId] = { success: true };
      } catch (error) {
        results[campId] = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    const allSuccess = Object.values(results).every((r) => r.success);

    return this.prisma.centralizedRatePush.update({
      where: { id },
      data: {
        status: allSuccess ? "applied" : "failed",
        appliedAt: new Date(),
        appliedBy,
        results: toNullableJsonInput(results),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Calculate and record daily metrics for all properties
   */
  async calculateDailyMetrics(orgId: string, date: Date) {
    const campgrounds = await this.prisma.campground.findMany({
      where: { organizationId: orgId },
    });

    for (const camp of campgrounds) {
      // Get occupancy
      const totalSites = await this.prisma.site.count({
        where: { campgroundId: camp.id, isActive: true },
      });

      const occupied = await this.prisma.reservation.count({
        where: {
          campgroundId: camp.id,
          arrivalDate: { lte: date },
          departureDate: { gt: date },
          status: { in: ["confirmed", "checked_in"] },
        },
      });

      const occupancyPct = totalSites > 0 ? (occupied / totalSites) * 100 : 0;

      // Get revenue
      const revenue = await this.prisma.reservation.aggregate({
        where: {
          campgroundId: camp.id,
          arrivalDate: { lte: date },
          departureDate: { gt: date },
          status: { in: ["confirmed", "checked_in", "checked_out"] },
        },
        _sum: { totalAmount: true },
      });

      const revenueCents = revenue._sum.totalAmount ?? 0;

      // Calculate ADR (Average Daily Rate)
      const adr = occupied > 0 ? revenueCents / occupied : 0;

      // Calculate RevPAR (Revenue Per Available Room)
      const revpar = totalSites > 0 ? revenueCents / totalSites : 0;

      // Get bookings count
      const bookings = await this.prisma.reservation.count({
        where: {
          campgroundId: camp.id,
          createdAt: {
            gte: new Date(date.setHours(0, 0, 0, 0)),
            lt: new Date(date.setHours(23, 59, 59, 999)),
          },
        },
      });

      await this.recordMetrics(orgId, camp.id, date, [
        { metricType: "occupancy", value: occupancyPct },
        { metricType: "revenue", value: revenueCents },
        { metricType: "adr", value: adr },
        { metricType: "revpar", value: revpar },
        { metricType: "bookings", value: bookings },
      ]);
    }

    // Calculate org-level aggregates
    const allMetrics = await this.prisma.portfolioMetric.findMany({
      where: { orgId, metricDate: date, campgroundId: { not: null } },
    });

    const aggregates: Record<string, number> = {};
    for (const m of allMetrics) {
      if (!aggregates[m.metricType]) aggregates[m.metricType] = 0;
      aggregates[m.metricType] += m.value;
    }

    // Average for percentage metrics
    const campCount = campgrounds.length || 1;
    if (aggregates.occupancy) aggregates.occupancy /= campCount;

    await this.recordMetrics(
      orgId,
      null,
      date,
      Object.entries(aggregates).map(([metricType, value]) => ({ metricType, value })),
    );
  }
}
