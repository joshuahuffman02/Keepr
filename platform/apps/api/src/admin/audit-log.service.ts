import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "SYNC" | "EXPORT" | "IMPORT";

@Injectable()
export class AuditLogService {
    constructor(private readonly prisma: PrismaService) { }

    async log(params: {
        userId?: string;
        userEmail?: string;
        action: AuditAction;
        resource: string;
        resourceId?: string;
        details?: string;
        metadata?: Record<string, any>;
        ipAddress?: string;
        userAgent?: string;
    }) {
        return this.prisma.platformAuditLog.create({
            data: params as any,
        });
    }

    async findAll(params: {
        limit?: number;
        offset?: number;
        action?: string;
        resource?: string;
        userId?: string;
        startDate?: Date;
        endDate?: Date;
    }) {
        const { limit = 100, offset = 0, action, resource, userId, startDate, endDate } = params;

        const where: any = {};
        if (action) where.action = action;
        if (resource) where.resource = resource;
        if (userId) where.userId = userId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startDate;
            if (endDate) where.createdAt.lte = endDate;
        }

        const [items, total] = await Promise.all([
            this.prisma.platformAuditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset,
            }),
            this.prisma.platformAuditLog.count({ where }),
        ]);

        return { items, total, limit, offset };
    }

    async findOne(id: string) {
        return this.prisma.platformAuditLog.findUnique({ where: { id } });
    }
}
