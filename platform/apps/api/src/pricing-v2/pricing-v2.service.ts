import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePricingRuleV2Dto } from "./dto/create-pricing-rule-v2.dto";
import { UpdatePricingRuleV2Dto } from "./dto/update-pricing-rule-v2.dto";
import { PricingRuleType, PricingStackMode, AdjustmentType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { AuditService } from "../audit/audit.service";

export interface PricingBreakdown {
  nights: number;
  baseSubtotalCents: number;
  adjustmentsCents: number;
  demandAdjustmentCents: number;
  totalBeforeTaxCents: number;
  appliedRules: Array<{ id: string; name: string; type: string; adjustmentCents: number }>;
  cappedAt?: "min" | "max" | null;
  pricingRuleVersion: string;
}

@Injectable()
export class PricingV2Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  list(campgroundId: string) {
    return this.prisma.pricingRuleV2.findMany({
      where: { campgroundId },
      orderBy: [{ active: "desc" }, { priority: "asc" }, { createdAt: "desc" }]
    });
  }

  /**
   * Evaluate pricing rules for a reservation.
   * Returns a breakdown of base rate + adjustments + demand, with caps applied.
   */
  async evaluate(
    campgroundId: string,
    siteClassId: string | null,
    baseRateCents: number,
    arrivalDate: Date,
    departureDate: Date,
    occupancyPct?: number
  ): Promise<PricingBreakdown> {
    const nights = this.computeNights(arrivalDate, departureDate);

    // Fetch active rules for campground/siteClass, sorted by priority
    const rules = await this.prisma.pricingRuleV2.findMany({
      where: {
        campgroundId,
        active: true,
        OR: [{ siteClassId: null }, { siteClassId }]
      },
      orderBy: [{ priority: "asc" }]
    });

    // Separate demand rules (applied last)
    const demandRules = rules.filter(r => r.type === PricingRuleType.demand);
    const standardRules = rules.filter(r => r.type !== PricingRuleType.demand);

    let totalCents = 0;
    let baseSubtotalCents = 0;
    let adjustmentsCents = 0;
    const appliedRules: PricingBreakdown["appliedRules"] = [];

    // Process each night
    for (let i = 0; i < nights; i++) {
      const day = new Date(arrivalDate);
      day.setDate(day.getDate() + i);
      const dow = day.getDay();

      let nightlyRate = baseRateCents;
      let nightlyAdjustment = 0;
      let overrideApplied = false;

      // Apply standard rules (priority order, stack/override logic)
      for (const rule of standardRules) {
        if (!this.ruleApplies(rule, day, dow, nights)) continue;

        const adj = this.computeAdjustment(rule.adjustmentType, rule.adjustmentValue, nightlyRate);

        if (rule.stackMode === PricingStackMode.override) {
          nightlyAdjustment = adj;
          overrideApplied = true;
          if (!appliedRules.find(r => r.id === rule.id)) {
            appliedRules.push({ id: rule.id, name: rule.name, type: rule.type, adjustmentCents: adj });
          }
          break; // Override stops further rules
        } else if (rule.stackMode === PricingStackMode.additive) {
          nightlyAdjustment += adj;
          if (!appliedRules.find(r => r.id === rule.id)) {
            appliedRules.push({ id: rule.id, name: rule.name, type: rule.type, adjustmentCents: adj });
          }
        } else if (rule.stackMode === PricingStackMode.max) {
          if (adj > nightlyAdjustment) {
            nightlyAdjustment = adj;
            if (!appliedRules.find(r => r.id === rule.id)) {
              appliedRules.push({ id: rule.id, name: rule.name, type: rule.type, adjustmentCents: adj });
            }
          }
        }
      }

      baseSubtotalCents += baseRateCents;
      adjustmentsCents += nightlyAdjustment;
      totalCents += nightlyRate + nightlyAdjustment;
    }

    // Apply demand adjustments last (based on occupancy)
    let demandAdjustmentCents = 0;
    if (occupancyPct !== undefined && demandRules.length > 0) {
      for (const rule of demandRules) {
        if (!rule.demandBandId) continue;
        const band = await this.prisma.demandBand.findUnique({ where: { id: rule.demandBandId } });
        if (!band || !band.active) continue;
        if (occupancyPct >= band.thresholdPct) {
          const adj = this.computeAdjustment(band.adjustmentType, band.adjustmentValue, totalCents / nights) * nights;
          demandAdjustmentCents += adj;
          appliedRules.push({ id: rule.id, name: rule.name, type: "demand", adjustmentCents: adj });
        }
      }
    }

    totalCents += demandAdjustmentCents;

    // Apply min/max caps from rules (use most restrictive)
    let cappedAt: "min" | "max" | null = null;
    const minCaps = rules.filter(r => r.minRateCap !== null).map(r => r.minRateCap!);
    const maxCaps = rules.filter(r => r.maxRateCap !== null).map(r => r.maxRateCap!);
    const minCap = minCaps.length > 0 ? Math.max(...minCaps) : null;
    const maxCap = maxCaps.length > 0 ? Math.min(...maxCaps) : null;

    if (minCap !== null && totalCents < minCap * nights) {
      totalCents = minCap * nights;
      cappedAt = "min";
    }
    if (maxCap !== null && totalCents > maxCap * nights) {
      totalCents = maxCap * nights;
      cappedAt = "max";
    }

    // Version string for snapshot
    const ruleIds = rules.map(r => r.id).sort().join(",");
    const pricingRuleVersion = `v2:${ruleIds.slice(0, 32)}:${Date.now()}`;

    return {
      nights,
      baseSubtotalCents,
      adjustmentsCents,
      demandAdjustmentCents,
      totalBeforeTaxCents: totalCents,
      appliedRules,
      cappedAt,
      pricingRuleVersion
    };
  }

  private computeNights(arrival: Date, departure: Date): number {
    const ms = departure.getTime() - arrival.getTime();
    if (!Number.isFinite(ms) || ms <= 0) return 1;
    return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
  }

  private ruleApplies(rule: any, day: Date, dow: number, nights: number): boolean {
    if (rule.startDate && day < rule.startDate) return false;
    if (rule.endDate && day > rule.endDate) return false;
    if (rule.dowMask && rule.dowMask.length > 0 && !rule.dowMask.includes(dow)) return false;
    const minNights = this.extractMinNights(rule.calendarRefId);
    if (minNights && nights < minNights) return false;
    return true;
  }

  private extractMinNights(calendarRefId?: string | null): number | null {
    if (!calendarRefId) return null;
    const match = calendarRefId.match(/minNights:(\d+)/i);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private computeAdjustment(adjustmentType: AdjustmentType, value: Decimal, baseCents: number): number {
    const val = Number(value);
    if (adjustmentType === AdjustmentType.percent) {
      return Math.round(baseCents * val);
    }
    return Math.round(val); // flat adjustment in cents
  }

  async create(campgroundId: string, dto: CreatePricingRuleV2Dto, actorId?: string | null) {
    await this.validateRule(campgroundId, dto);
    const rule = await this.prisma.pricingRuleV2.create({
      data: {
        ...dto,
        campgroundId,
        siteClassId: dto.siteClassId ?? null,
        calendarRefId: dto.calendarRefId ?? null,
        demandBandId: dto.demandBandId ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null
      }
    });

    // Audit log
    await this.audit.record({
      campgroundId,
      actorId: actorId ?? null,
      action: "pricing_rule_v2.create",
      entity: "PricingRuleV2",
      entityId: rule.id,
      before: null,
      after: rule
    });

    return rule;
  }

  async update(id: string, dto: UpdatePricingRuleV2Dto, actorId?: string | null) {
    const existing = await this.prisma.pricingRuleV2.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Pricing rule not found");
    const existingForValidation = {
      ...existing,
      adjustmentValue: Number(existing.adjustmentValue),
      startDate: existing.startDate?.toISOString() ?? null,
      endDate: existing.endDate?.toISOString() ?? null,
    };
    await this.validateRule(existing.campgroundId, { ...existingForValidation, ...dto });
    const updated = await this.prisma.pricingRuleV2.update({
      where: { id },
      data: {
        ...dto,
        siteClassId: dto.siteClassId === undefined ? undefined : dto.siteClassId ?? null,
        calendarRefId: dto.calendarRefId === undefined ? undefined : dto.calendarRefId ?? null,
        demandBandId: dto.demandBandId === undefined ? undefined : dto.demandBandId ?? null,
        startDate: dto.startDate === undefined ? undefined : dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate === undefined ? undefined : dto.endDate ? new Date(dto.endDate) : null
      }
    });

    // Audit log
    await this.audit.record({
      campgroundId: existing.campgroundId,
      actorId: actorId ?? null,
      action: "pricing_rule_v2.update",
      entity: "PricingRuleV2",
      entityId: id,
      before: existing,
      after: updated
    });

    return updated;
  }

  async remove(id: string, actorId?: string | null) {
    const existing = await this.prisma.pricingRuleV2.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Pricing rule not found");
    await this.prisma.pricingRuleV2.delete({ where: { id } });

    // Audit log
    await this.audit.record({
      campgroundId: existing.campgroundId,
      actorId: actorId ?? null,
      action: "pricing_rule_v2.delete",
      entity: "PricingRuleV2",
      entityId: id,
      before: existing,
      after: null
    });

    return existing;
  }

  private async validateRule(campgroundId: string, dto: Partial<CreatePricingRuleV2Dto>) {
    // Prevent overlapping overrides in same site class and date window
    if (dto.stackMode === PricingStackMode.override) {
      const overlapping = await this.prisma.pricingRuleV2.count({
        where: {
          campgroundId,
          id: (dto as any).id ? { not: (dto as any).id } : undefined,
          siteClassId: dto.siteClassId ?? null,
          stackMode: PricingStackMode.override,
          active: dto.active ?? true,
          // Rough overlap check; refinement can be added later
          OR: [
            { startDate: null, endDate: null },
            {
              startDate: { lte: dto.endDate ? new Date(dto.endDate) : undefined },
              endDate: { gte: dto.startDate ? new Date(dto.startDate) : undefined }
            }
          ]
        }
      });
      if (overlapping > 0) {
        throw new BadRequestException("Overlapping override pricing rules are not allowed");
      }
    }

    if (dto.type === PricingRuleType.demand && !dto.demandBandId) {
      throw new BadRequestException("Demand rules require a demandBandId");
    }
  }
}
