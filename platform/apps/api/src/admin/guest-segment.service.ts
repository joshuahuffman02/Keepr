import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SegmentScope, SegmentStatus, Prisma } from "@prisma/client";

interface SegmentCriteria {
    type: string;
    operator: string;
    value: string | string[] | number | boolean;
}

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
    constructor(private readonly prisma: PrismaService) { }

    async create(data: CreateSegmentDto) {
        const segment = await this.prisma.guestSegment.create({
            data: {
                name: data.name,
                description: data.description,
                scope: data.scope,
                criteria: data.criteria as any,
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
        return this.prisma.guestSegment.findUnique({
            where: { id },
            include: {
                campground: {
                    select: { id: true, name: true },
                },
            },
        });
    }

    async update(id: string, data: UpdateSegmentDto) {
        const segment = await this.prisma.guestSegment.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.criteria && { criteria: data.criteria as any }),
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
            criteria: original.criteria as SegmentCriteria[],
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

        const criteria = segment.criteria as SegmentCriteria[];
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

    async getSegmentGuests(segmentId: string, options?: {
        skip?: number;
        take?: number;
    }) {
        const segment = await this.prisma.guestSegment.findUnique({
            where: { id: segmentId },
        });

        if (!segment) return { guests: [], total: 0 };

        const criteria = segment.criteria as SegmentCriteria[];
        const whereConditions = this.buildGuestWhereFromCriteria(criteria);

        const [guests, total] = await Promise.all([
            this.prisma.guest.findMany({
                where: whereConditions,
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
            this.prisma.guest.count({ where: whereConditions }),
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
            case "country":
                return { country: this.applyOperator(operator, value) };

            case "state":
                return { state: this.applyOperator(operator, value) };

            case "city":
                return { city: this.applyOperator(operator, value) };

            case "has_children":
                // This would need to be checked via reservations
                return {
                    reservations: {
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

            case "rig_type":
                return { rigType: this.applyOperator(operator, value) };

            case "repeat_stays":
                return {
                    repeatStays: this.applyNumericOperator(operator, Number(value)),
                };

            case "stay_length":
                // Would need to calculate from reservations
                return null;

            case "stay_reason":
                return {
                    reservations: {
                        some: {
                            stayReasonPreset: this.applyOperator(operator, value),
                        },
                    },
                };

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

    private applyOperator(operator: string, value: any): any {
        switch (operator) {
            case "equals":
                return { equals: value };
            case "not_equals":
                return { not: value };
            case "contains":
                return { contains: value, mode: "insensitive" };
            case "in":
                return { in: Array.isArray(value) ? value : [value] };
            case "not_in":
                return { notIn: Array.isArray(value) ? value : [value] };
            default:
                return { equals: value };
        }
    }

    private applyNumericOperator(operator: string, value: number): any {
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

    async seedGlobalTemplates() {
        const templates = [
            {
                name: "Canadian Snowbirds",
                description: "Canadian guests who typically travel south during winter months",
                criteria: [
                    { type: "country", operator: "in", value: ["Canada", "CA", "CAN"] },
                ],
            },
            {
                name: "Family Campers",
                description: "Guests traveling with children",
                criteria: [
                    { type: "has_children", operator: "equals", value: "true" },
                ],
            },
            {
                name: "Pet Travelers",
                description: "Guests who travel with pets",
                criteria: [
                    { type: "has_pets", operator: "equals", value: "true" },
                ],
            },
            {
                name: "Repeat Visitors",
                description: "Guests who have stayed 2+ times",
                criteria: [
                    { type: "repeat_stays", operator: "gte", value: 2 },
                ],
            },
            {
                name: "Class A Owners",
                description: "Guests with Class A motorhomes",
                criteria: [
                    { type: "rig_type", operator: "equals", value: "class_a" },
                ],
            },
            {
                name: "Texas Residents",
                description: "Guests from Texas",
                criteria: [
                    { type: "state", operator: "in", value: ["TX", "Texas"] },
                ],
            },
            {
                name: "Florida Residents",
                description: "Guests from Florida",
                criteria: [
                    { type: "state", operator: "in", value: ["FL", "Florida"] },
                ],
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
                        name: template.name,
                        description: template.description,
                        scope: "global",
                        isTemplate: true,
                        criteria: template.criteria as any,
                        createdById: "system",
                        createdByEmail: "system@campreserv.com",
                    },
                });
            }
        }
    }
}
