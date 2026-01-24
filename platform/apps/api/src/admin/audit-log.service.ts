import { Injectable } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

type AuditLogCreateInput = Omit<Prisma.PlatformAuditLogCreateInput, "id">;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditLogCreateInput) {
    return this.prisma.platformAuditLog.create({
      data: {
        id: randomUUID(),
        ...params,
      },
    });
  }

  async findAll(params: {
    limit?: number;
    offset?: number;
    action?: AuditAction;
    resource?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const { limit = 100, offset = 0, action, resource, userId, startDate, endDate } = params;

    const where: Prisma.PlatformAuditLogWhereInput = {};
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
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
