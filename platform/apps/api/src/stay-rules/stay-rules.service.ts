import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

interface DateRange {
  start: string;
  end: string;
}

type StayRuleUpdate = Partial<{
  campgroundId: string;
  name: string;
  minNights: number;
  maxNights: number;
  siteClasses: string[];
  dateRanges: DateRange[];
  ignoreDaysBefore: number;
  isActive: boolean;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeDateRanges = (value: unknown): DateRange[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is DateRange => {
    if (!isRecord(entry)) return false;
    return typeof entry.start === "string" && typeof entry.end === "string";
  });
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

@Injectable()
export class StayRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    campgroundId: string;
    name: string;
    minNights?: number;
    maxNights?: number;
    siteClasses?: string[];
    dateRanges?: DateRange[];
    ignoreDaysBefore?: number;
  }) {
    return this.prisma.stayRule.create({
      data: {
        id: randomUUID(),
        campgroundId: data.campgroundId,
        name: data.name,
        minNights: data.minNights ?? 1,
        maxNights: data.maxNights ?? 28,
        siteClasses: data.siteClasses ?? [],
        dateRanges: toJsonValue(data.dateRanges ?? []),
        ignoreDaysBefore: data.ignoreDaysBefore ?? 0,
        updatedAt: new Date(),
      },
    });
  }

  async findAllByCampground(campgroundId: string) {
    return this.prisma.stayRule.findMany({
      where: { campgroundId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(campgroundId: string, id: string) {
    const rule = await this.prisma.stayRule.findFirst({
      where: { id, campgroundId },
    });
    if (!rule) throw new NotFoundException("Stay rule not found");
    return rule;
  }

  async update(campgroundId: string, id: string, data: StayRuleUpdate) {
    await this.findOne(campgroundId, id);
    const { campgroundId: _campgroundId, dateRanges, ...rest } = data;
    const updateData: Prisma.StayRuleUpdateInput = {
      ...rest,
      ...(dateRanges !== undefined ? { dateRanges: toJsonValue(dateRanges) } : {}),
    };
    return this.prisma.stayRule.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(campgroundId: string, id: string) {
    await this.findOne(campgroundId, id);
    return this.prisma.stayRule.delete({ where: { id } });
  }

  async duplicate(campgroundId: string, id: string) {
    const existing = await this.findOne(campgroundId, id);
    return this.prisma.stayRule.create({
      data: {
        id: randomUUID(),
        campgroundId: existing.campgroundId,
        name: `${existing.name} (Copy)`,
        minNights: existing.minNights,
        maxNights: existing.maxNights,
        siteClasses: existing.siteClasses,
        dateRanges: toJsonValue(normalizeDateRanges(existing.dateRanges)),
        ignoreDaysBefore: existing.ignoreDaysBefore,
        isActive: false, // Start as inactive
        updatedAt: new Date(),
      },
    });
  }

  // Evaluate applicable stay rules for a booking
  async evaluateRules(campgroundId: string, siteClass: string, arrivalDate: Date, nights: number) {
    const rules = await this.prisma.stayRule.findMany({
      where: {
        campgroundId,
        isActive: true,
      },
    });

    const daysUntilArrival = Math.ceil(
      (arrivalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    for (const rule of rules) {
      // Check if rule applies to this site class
      if (rule.siteClasses.length > 0 && !rule.siteClasses.includes(siteClass)) {
        continue;
      }

      // Check if date ranges apply
      const dateRanges = normalizeDateRanges(rule.dateRanges);
      if (dateRanges.length > 0) {
        const arrivalStr = arrivalDate.toISOString().split("T")[0];
        const inRange = dateRanges.some(
          (range) => arrivalStr >= range.start && arrivalStr <= range.end,
        );
        if (!inRange) continue;
      }

      // Check ignore days before (allows last-minute bookings)
      const effectiveMinNights = daysUntilArrival <= rule.ignoreDaysBefore ? 1 : rule.minNights;

      // Check constraints
      if (nights < effectiveMinNights) {
        return {
          valid: false,
          rule,
          reason: `Minimum ${effectiveMinNights} nights required`,
        };
      }
      if (nights > rule.maxNights) {
        return {
          valid: false,
          rule,
          reason: `Maximum ${rule.maxNights} nights allowed`,
        };
      }
    }

    return { valid: true, rule: null };
  }
}
