import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { SegmentScope, SegmentStatus, Prisma, StayReasonPreset } from "@prisma/client";

interface SegmentCriteria {
  type: string;
  operator: string;
  value: string | string[] | number | boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isSegmentCriteria = (value: unknown): value is SegmentCriteria => {
  if (!isRecord(value)) return false;
  if (typeof value.type !== "string") return false;
  if (typeof value.operator !== "string") return false;
  const criterionValue = value.value;
  if (typeof criterionValue === "string") return true;
  if (typeof criterionValue === "number") return Number.isFinite(criterionValue);
  if (typeof criterionValue === "boolean") return true;
  return isStringArray(criterionValue);
};

const parseSegmentCriteria = (value: unknown): SegmentCriteria[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isSegmentCriteria);
};

const toCriteriaJson = (criteria: SegmentCriteria[]): Prisma.InputJsonValue =>
  criteria.map((criterion) => ({
    type: criterion.type,
    operator: criterion.operator,
    value: criterion.value,
  }));

const stayReasonPresetValues: ReadonlyArray<StayReasonPreset> = [
  StayReasonPreset.vacation,
  StayReasonPreset.family_visit,
  StayReasonPreset.event,
  StayReasonPreset.work_remote,
  StayReasonPreset.stopover,
  StayReasonPreset.relocation,
  StayReasonPreset.other,
];

const isStayReasonPreset = (value: unknown): value is StayReasonPreset =>
  typeof value === "string" && stayReasonPresetValues.some((entry) => entry === value);

interface CreateSegmentDto {
  name: string;
  description?: string;
  scope: SegmentScope;
  criteria: SegmentCriteria[];
  isTemplate?: boolean;
  organizationId?: string;
  campgroundId?: string;
  createdById: string;
  createdByEmail: string;
}

interface UpdateSegmentDto {
  name?: string;
  description?: string;
  criteria?: SegmentCriteria[];
  status?: SegmentStatus;
}

@Injectable()
export class GuestSegmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateSegmentDto) {
    const segment = await this.prisma.guestSegment.create({
      data: {
        id: randomUUID(),
        name: data.name,
        description: data.description,
        scope: data.scope,
        criteria: toCriteriaJson(data.criteria),
        isTemplate: data.isTemplate || false,
        organizationId: data.organizationId,
        campgroundId: data.campgroundId,
        createdById: data.createdById,
        createdByEmail: data.createdByEmail,
      },
    });

    // Calculate initial guest count
    await this.calculateGuestCount(segment.id);

    return this.findOne(segment.id);
  }

  async findAll(params: {
    scope?: SegmentScope;
    status?: SegmentStatus;
    campgroundId?: string;
    organizationId?: string;
    isTemplate?: boolean;
  }) {
    const where: Prisma.GuestSegmentWhereInput = {};

    if (params.scope) where.scope = params.scope;
    if (params.status) where.status = params.status;
    if (params.campgroundId) where.campgroundId = params.campgroundId;
    if (params.organizationId) where.organizationId = params.organizationId;
    if (params.isTemplate !== undefined) where.isTemplate = params.isTemplate;

    return this.prisma.guestSegment.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
  }

  async findOne(id: string) {
    const segment = await this.prisma.guestSegment.findUnique({
      where: { id },
      include: {
        Campground: {
          select: { id: true, name: true },
        },
      },
    });
    if (!segment) return segment;
    const { Campground, ...rest } = segment;
    return { ...rest, campground: Campground };
  }

  async update(id: string, data: UpdateSegmentDto) {
    const segment = await this.prisma.guestSegment.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.criteria && { criteria: toCriteriaJson(data.criteria) }),
        ...(data.status && { status: data.status }),
      },
    });

    // Recalculate guest count if criteria changed
    if (data.criteria) {
      await this.calculateGuestCount(segment.id);
    }

    return this.findOne(segment.id);
  }

  async archive(id: string) {
    return this.prisma.guestSegment.update({
      where: { id },
      data: { status: "archived" },
    });
  }

  async duplicate(id: string, userId: string, userEmail: string) {
    const original = await this.findOne(id);
    if (!original) throw new NotFoundException("Segment not found");

    return this.create({
      name: `${original.name} (Copy)`,
      description: original.description || undefined,
      scope: "campground", // Copies default to campground scope
      criteria: parseSegmentCriteria(original.criteria),
      isTemplate: false,
      campgroundId: original.campgroundId || undefined,
      organizationId: original.organizationId || undefined,
      createdById: userId,
      createdByEmail: userEmail,
    });
  }

  async getGlobalTemplates() {
    return this.prisma.guestSegment.findMany({
      where: {
        scope: "global",
        isTemplate: true,
        status: "active",
      },
      orderBy: { name: "asc" },
    });
  }

  async calculateGuestCount(segmentId: string): Promise<number> {
    const segment = await this.prisma.guestSegment.findUnique({
      where: { id: segmentId },
    });

    if (!segment) return 0;

    const criteria = parseSegmentCriteria(segment.criteria);
    const whereConditions = this.buildGuestWhereFromCriteria(criteria);

    const count = await this.prisma.guest.count({
      where: whereConditions,
    });

    await this.prisma.guestSegment.update({
      where: { id: segmentId },
      data: {
        guestCount: count,
        lastCalculated: new Date(),
      },
    });

    return count;
  }

  async getSegmentGuests(
    segmentId: string,
    options?: {
      skip?: number;
      take?: number;
    },
  ) {
    const segment = await this.prisma.guestSegment.findUnique({
      where: { id: segmentId },
    });

    if (!segment) return { guests: [], total: 0 };

    const criteria = parseSegmentCriteria(segment.criteria);
    const whereConditions = this.buildGuestWhereFromCriteria(criteria);

    // CRITICAL: Always filter by campgroundId for multi-tenant isolation
    const finalWhere = {
      ...whereConditions,
      campgroundId: segment.campgroundId,
    };

    const [guests, total] = await Promise.all([
      this.prisma.guest.findMany({
        where: finalWhere,
        skip: options?.skip || 0,
        take: options?.take || 50,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          primaryFirstName: true,
          primaryLastName: true,
          email: true,
          city: true,
          state: true,
          country: true,
          repeatStays: true,
          createdAt: true,
        },
      }),
      this.prisma.guest.count({ where: finalWhere }),
    ]);

    return { guests, total };
  }

  private buildGuestWhereFromCriteria(criteria: SegmentCriteria[]): Prisma.GuestWhereInput {
    const conditions: Prisma.GuestWhereInput[] = [];

    for (const criterion of criteria) {
      const condition = this.criterionToWhere(criterion);
      if (condition) {
        conditions.push(condition);
      }
    }

    if (conditions.length === 0) return {};
    if (conditions.length === 1) return conditions[0];

    return { AND: conditions };
  }

  private criterionToWhere(criterion: SegmentCriteria): Prisma.GuestWhereInput | null {
    const { type, operator, value } = criterion;

    switch (type) {
      case "country": {
        const stringValue = this.toStringArrayOrNull(value);
        if (!stringValue) return null;
        return { country: this.applyStringOperator(operator, stringValue) };
      }

      case "state": {
        const stringValue = this.toStringArrayOrNull(value);
        if (!stringValue) return null;
        return { state: this.applyStringOperator(operator, stringValue) };
      }

      case "city": {
        const stringValue = this.toStringArrayOrNull(value);
        if (!stringValue) return null;
        return { city: this.applyStringOperator(operator, stringValue) };
      }

      case "has_children":
        // This would need to be checked via reservations
        return {
          Reservation: {
            some: {
              children: value === "true" || value === true ? { gt: 0 } : { equals: 0 },
            },
          },
        };

      case "has_pets":
        // Check tags for pet indicator
        return {
          tags: {
            has: "has_pets",
          },
        };

      case "rig_type": {
        const stringValue = this.toStringArrayOrNull(value);
        if (!stringValue) return null;
        return { rigType: this.applyStringOperator(operator, stringValue) };
      }

      case "repeat_stays":
        return {
          repeatStays: this.applyNumericOperator(operator, Number(value)),
        };

      case "stay_length":
        // Would need to calculate from reservations
        return null;

      case "stay_reason": {
        const stringValue = this.toStringArrayOrNull(value);
        if (!stringValue) return null;
        const filter = this.applyStayReasonOperator(operator, stringValue);
        if (!filter) return null;
        return {
          Reservation: {
            some: {
              stayReasonPreset: filter,
            },
          },
        };
      }

      case "booking_month":
        // Complex query - would need raw SQL
        return null;

      case "arrival_day":
        // Complex query - would need raw SQL
        return null;

      default:
        return null;
    }
  }

  private applyStringOperator(operator: string, value: string[]): Prisma.StringFilter {
    const [firstValue] = value;
    switch (operator) {
      case "equals":
        return { equals: firstValue ?? "" };
      case "not_equals":
        return { not: firstValue ?? "" };
      case "contains":
        return { contains: firstValue ?? "", mode: "insensitive" };
      case "in":
        return { in: value };
      case "not_in":
        return { notIn: value };
      default:
        return { equals: firstValue ?? "" };
    }
  }

  private applyStayReasonOperator(
    operator: string,
    value: string[],
  ): Prisma.EnumStayReasonPresetNullableFilter | null {
    const filtered = value.filter(isStayReasonPreset);
    if (!filtered.length) return null;
    const [firstValue] = filtered;
    switch (operator) {
      case "equals":
        return { equals: firstValue ?? null };
      case "not_equals":
        return { not: firstValue ?? null };
      case "in":
        return { in: filtered };
      case "not_in":
        return { notIn: filtered };
      default:
        return { equals: firstValue ?? null };
    }
  }

  private applyNumericOperator(operator: string, value: number): Prisma.IntFilter {
    switch (operator) {
      case "equals":
        return { equals: value };
      case "gt":
        return { gt: value };
      case "gte":
        return { gte: value };
      case "lt":
        return { lt: value };
      case "lte":
        return { lte: value };
      default:
        return { equals: value };
    }
  }

  private toStringArrayOrNull(value: SegmentCriteria["value"]): string[] | null {
    if (typeof value === "string") return [value];
    if (isStringArray(value)) return value;
    return null;
  }

  async seedGlobalTemplates() {
    const templates: Array<{
      name: string;
      description: string;
      criteria: SegmentCriteria[];
    }> = [
      {
        name: "Canadian Snowbirds",
        description: "Canadian guests who typically travel south during winter months",
        criteria: [{ type: "country", operator: "in", value: ["Canada", "CA", "CAN"] }],
      },
      {
        name: "Family Campers",
        description: "Guests traveling with children",
        criteria: [{ type: "has_children", operator: "equals", value: "true" }],
      },
      {
        name: "Pet Travelers",
        description: "Guests who travel with pets",
        criteria: [{ type: "has_pets", operator: "equals", value: "true" }],
      },
      {
        name: "Repeat Visitors",
        description: "Guests who have stayed 2+ times",
        criteria: [{ type: "repeat_stays", operator: "gte", value: 2 }],
      },
      {
        name: "Class A Owners",
        description: "Guests with Class A motorhomes",
        criteria: [{ type: "rig_type", operator: "equals", value: "class_a" }],
      },
      {
        name: "Texas Residents",
        description: "Guests from Texas",
        criteria: [{ type: "state", operator: "in", value: ["TX", "Texas"] }],
      },
      {
        name: "Florida Residents",
        description: "Guests from Florida",
        criteria: [{ type: "state", operator: "in", value: ["FL", "Florida"] }],
      },
    ];

    for (const template of templates) {
      const existing = await this.prisma.guestSegment.findFirst({
        where: {
          name: template.name,
          scope: "global",
          isTemplate: true,
        },
      });

      if (!existing) {
        await this.prisma.guestSegment.create({
          data: {
            id: randomUUID(),
            name: template.name,
            description: template.description,
            scope: "global",
            isTemplate: true,
            criteria: toCriteriaJson(template.criteria),
            createdById: "system",
            createdByEmail: "system@keeprstay.com",
          },
        });
      }
    }
  }
}
