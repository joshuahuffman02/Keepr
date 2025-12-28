import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DynamicPricingTrigger } from '@prisma/client';

interface CreateDynamicRuleDto {
  campgroundId: string;
  name: string;
  trigger: DynamicPricingTrigger;
  conditions: Record<string, any>;
  adjustmentType: 'percent' | 'flat';
  adjustmentValue: number;
  priority?: number;
  siteClassIds?: string[];
  isActive?: boolean;
  validFrom?: string;
  validTo?: string;
}

interface OccupancyConditions {
  occupancyMin?: number;
  occupancyMax?: number;
  daysOutMin?: number;
  daysOutMax?: number;
}

@Injectable()
export class DynamicPricingService {
  constructor(private readonly prisma: PrismaService) {}

  async createRule(dto: CreateDynamicRuleDto) {
    return this.prisma.dynamicPricingRule.create({
      data: {
        campgroundId: dto.campgroundId,
        name: dto.name,
        trigger: dto.trigger,
        conditions: dto.conditions,
        adjustmentType: dto.adjustmentType,
        adjustmentValue: dto.adjustmentValue,
        priority: dto.priority ?? 100,
        siteClassIds: dto.siteClassIds ?? [],
        isActive: dto.isActive ?? true,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validTo: dto.validTo ? new Date(dto.validTo) : null,
      },
    });
  }

  async listRules(campgroundId: string, includeInactive = false) {
    return this.prisma.dynamicPricingRule.findMany({
      where: {
        campgroundId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { priority: 'asc' },
    });
  }

  async getRule(id: string) {
    const rule = await this.prisma.dynamicPricingRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  async updateRule(id: string, dto: Partial<CreateDynamicRuleDto>) {
    const existing = await this.getRule(id);
    return this.prisma.dynamicPricingRule.update({
      where: { id },
      data: {
        name: dto.name,
        trigger: dto.trigger,
        conditions: dto.conditions,
        adjustmentType: dto.adjustmentType,
        adjustmentValue: dto.adjustmentValue,
        priority: dto.priority,
        siteClassIds: dto.siteClassIds,
        isActive: dto.isActive,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
      },
    });
  }

  async deleteRule(id: string) {
    await this.getRule(id);
    return this.prisma.dynamicPricingRule.delete({ where: { id } });
  }

  /**
   * Calculate price adjustment based on occupancy and rules
   */
  async calculateAdjustment(
    campgroundId: string,
    siteClassId: string | null,
    targetDate: Date,
    basePrice: number
  ): Promise<{ adjustedPrice: number; appliedRules: string[] }> {
    const now = new Date();
    const daysOut = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Get current occupancy for the target date
    const occupancy = await this.getOccupancyForDate(campgroundId, targetDate);

    // Get applicable rules
    const rules = await this.prisma.dynamicPricingRule.findMany({
      where: {
        campgroundId,
        isActive: true,
        OR: [
          { validFrom: null, validTo: null },
          { validFrom: { lte: now }, validTo: { gte: now } },
        ],
      },
      orderBy: { priority: 'asc' },
    });

    let adjustedPrice = basePrice;
    const appliedRules: string[] = [];

    for (const rule of rules) {
      // Check site class filter
      if (rule.siteClassIds.length > 0 && siteClassId && !rule.siteClassIds.includes(siteClassId)) {
        continue;
      }

      // Check conditions
      const conditions = rule.conditions as OccupancyConditions;
      if (!this.matchesConditions(conditions, occupancy, daysOut)) {
        continue;
      }

      // Apply adjustment
      if (rule.adjustmentType === 'percent') {
        adjustedPrice = adjustedPrice * (1 + rule.adjustmentValue / 100);
      } else {
        adjustedPrice = adjustedPrice + rule.adjustmentValue;
      }

      appliedRules.push(rule.name);
    }

    return {
      adjustedPrice: Math.round(adjustedPrice),
      appliedRules,
    };
  }

  private matchesConditions(
    conditions: OccupancyConditions,
    occupancy: number,
    daysOut: number
  ): boolean {
    if (conditions.occupancyMin !== undefined && occupancy < conditions.occupancyMin) return false;
    if (conditions.occupancyMax !== undefined && occupancy > conditions.occupancyMax) return false;
    if (conditions.daysOutMin !== undefined && daysOut < conditions.daysOutMin) return false;
    if (conditions.daysOutMax !== undefined && daysOut > conditions.daysOutMax) return false;
    return true;
  }

  async getOccupancyForDate(campgroundId: string, date: Date): Promise<number> {
    const snapshot = await this.prisma.occupancySnapshot.findUnique({
      where: {
        campgroundId_date: {
          campgroundId,
          date,
        },
      },
    });

    if (snapshot) {
      return snapshot.occupancyPct;
    }

    // Calculate on the fly if no snapshot
    const totalSites = await this.prisma.site.count({
      where: { campgroundId, isActive: true },
    });

    if (totalSites === 0) return 0;

    const occupied = await this.prisma.reservation.count({
      where: {
        campgroundId,
        arrivalDate: { lte: date },
        departureDate: { gt: date },
        status: { in: ['confirmed', 'checked_in'] },
      },
    });

    return (occupied / totalSites) * 100;
  }

  /**
   * Record occupancy snapshot for analytics
   */
  async recordOccupancySnapshot(campgroundId: string, date: Date) {
    const totalSites = await this.prisma.site.count({
      where: { campgroundId, isActive: true },
    });

    const occupied = await this.prisma.reservation.count({
      where: {
        campgroundId,
        arrivalDate: { lte: date },
        departureDate: { gt: date },
        status: { in: ['confirmed', 'checked_in'] },
      },
    });

    const blocked = await this.prisma.maintenanceTicket.count({
      where: {
        campgroundId,
        outOfOrder: true,
        OR: [
          { outOfOrderUntil: null },
          { outOfOrderUntil: { gte: date } },
        ],
      },
    });

    const available = totalSites - occupied - blocked;
    const occupancyPct = totalSites > 0 ? (occupied / totalSites) * 100 : 0;

    // Get revenue for the date
    const revenue = await this.prisma.reservation.aggregate({
      where: {
        campgroundId,
        arrivalDate: { lte: date },
        departureDate: { gt: date },
        status: { in: ['confirmed', 'checked_in', 'checked_out'] },
      },
      _sum: { totalAmount: true },
    });

    return this.prisma.occupancySnapshot.upsert({
      where: { campgroundId_date: { campgroundId, date } },
      update: {
        totalSites,
        occupied,
        blocked,
        available,
        occupancyPct,
        revenueCents: revenue._sum.totalAmount ?? 0,
      },
      create: {
        campgroundId,
        date,
        totalSites,
        occupied,
        blocked,
        available,
        occupancyPct,
        revenueCents: revenue._sum.totalAmount ?? 0,
      },
    });
  }

  /**
   * Generate revenue forecast
   */
  async generateForecast(campgroundId: string, daysAhead = 30) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + daysAhead);

    // Get site count once (not per day!)
    const totalSites = await this.prisma.site.count({
      where: { campgroundId, isActive: true },
    });

    // Single query: generate date series and compute stats for all days at once
    const dailyStats = await this.prisma.$queryRaw<{
      forecast_date: Date;
      reservation_count: bigint;
      projected_rev: bigint;
      day_offset: number;
    }[]>`
      WITH date_series AS (
        SELECT generate_series(
          ${now}::date,
          ${endDate}::date - interval '1 day',
          interval '1 day'
        )::date as forecast_date
      ),
      daily_reservations AS (
        SELECT
          d.forecast_date,
          COUNT(r.id) as reservation_count,
          COALESCE(SUM(r."totalAmount"), 0) as projected_rev
        FROM date_series d
        LEFT JOIN "Reservation" r ON
          r."campgroundId" = ${campgroundId}
          AND r."arrivalDate" <= d.forecast_date
          AND r."departureDate" > d.forecast_date
          AND r.status IN ('confirmed', 'checked_in')
        GROUP BY d.forecast_date
      )
      SELECT
        forecast_date,
        reservation_count,
        projected_rev,
        (forecast_date - ${now}::date) as day_offset
      FROM daily_reservations
      ORDER BY forecast_date
    `;

    // Build forecast records
    const forecastData = dailyStats.map(day => {
      const dayOffset = Number(day.day_offset);
      const occupancyPct = totalSites > 0
        ? (Number(day.reservation_count) / totalSites) * 100
        : 0;
      const confidence = dayOffset < 7 ? 0.9 : dayOffset < 14 ? 0.7 : 0.5;

      return {
        campgroundId,
        forecastDate: day.forecast_date,
        projectedRev: Number(day.projected_rev),
        occupancyPct,
        confidence,
      };
    });

    // Batch upsert using a transaction
    const forecasts = await this.prisma.$transaction(
      forecastData.map(data =>
        this.prisma.revenueForecast.upsert({
          where: { campgroundId_forecastDate: { campgroundId, forecastDate: data.forecastDate } },
          update: {
            projectedRev: data.projectedRev,
            occupancyPct: data.occupancyPct,
            confidence: data.confidence,
          },
          create: data,
        })
      )
    );

    return forecasts;
  }

  async getForecasts(campgroundId: string, startDate: Date, endDate: Date) {
    return this.prisma.revenueForecast.findMany({
      where: {
        campgroundId,
        forecastDate: { gte: startDate, lte: endDate },
      },
      orderBy: { forecastDate: 'asc' },
    });
  }
}

