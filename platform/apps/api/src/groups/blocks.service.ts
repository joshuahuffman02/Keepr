import { Injectable, ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "crypto";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const normalizeSites = (value: unknown): string[] => (isStringArray(value) ? value : []);

@Injectable()
export class BlocksService {
  constructor(private prisma: PrismaService) {}

  /**
   * Check for availability conflicts with existing reservations or blocks
   */
  async checkConflicts(
    tenantId: string,
    siteIds: string[],
    windowStart: Date,
    windowEnd: Date,
    excludeBlockId?: string,
  ): Promise<{ hasConflict: boolean; conflictingSites: string[] }> {
    // Check for conflicting reservations
    const conflictingReservations = await this.prisma.reservation.findMany({
      where: {
        siteId: { in: siteIds },
        status: { in: ["confirmed", "checked_in"] },
        arrivalDate: { lt: windowEnd },
        departureDate: { gt: windowStart },
      },
      select: { siteId: true },
    });

    // Check for conflicting blocks
    const conflictingBlocks = await this.prisma.inventoryBlock.findMany({
      where: {
        tenantId,
        state: "active",
        windowStart: { lt: windowEnd },
        windowEnd: { gt: windowStart },
        blockId: excludeBlockId ? { not: excludeBlockId } : undefined,
      },
    });

    const conflictingSitesFromBlocks = conflictingBlocks
      .flatMap((b) => normalizeSites(b.sites))
      .filter((s) => siteIds.includes(s));

    const allConflicts = [
      ...new Set([...conflictingReservations.map((r) => r.siteId), ...conflictingSitesFromBlocks]),
    ];

    return {
      hasConflict: allConflicts.length > 0,
      conflictingSites: allConflicts,
    };
  }

  async create(data: {
    tenantId: string;
    sites: string[];
    windowStart: string;
    windowEnd: string;
    reason: string;
    lockId: string;
    createdBy: string;
  }) {
    const windowStart = new Date(data.windowStart);
    const windowEnd = new Date(data.windowEnd);

    // Check for conflicts
    const conflicts = await this.checkConflicts(data.tenantId, data.sites, windowStart, windowEnd);

    if (conflicts.hasConflict) {
      throw new ConflictException({
        error: "conflict",
        sites: conflicts.conflictingSites,
        window: { start: windowStart, end: windowEnd },
      });
    }

    // Check for idempotency - if same lockId exists, return existing
    const existing = await this.prisma.inventoryBlock.findUnique({
      where: { lockId: data.lockId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.inventoryBlock.create({
      data: {
        blockId: randomUUID(),
        tenantId: data.tenantId,
        sites: data.sites,
        windowStart,
        windowEnd,
        reason: data.reason,
        state: "active",
        lockId: data.lockId,
        createdBy: data.createdBy,
        updatedAt: new Date(),
      },
    });
  }

  async findAll(tenantId: string, state?: string) {
    return this.prisma.inventoryBlock.findMany({
      where: {
        tenantId,
        state: state ?? undefined,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(blockId: string) {
    return this.prisma.inventoryBlock.findUnique({ where: { blockId } });
  }

  async update(
    blockId: string,
    data: {
      state?: "active" | "released";
      windowStart?: string;
      windowEnd?: string;
      reason?: string;
    },
  ) {
    const existing = await this.prisma.inventoryBlock.findUnique({
      where: { blockId },
    });

    if (!existing) {
      throw new NotFoundException("Block not found");
    }

    // If extending window, check for new conflicts
    if (data.windowStart || data.windowEnd) {
      const newStart = data.windowStart ? new Date(data.windowStart) : existing.windowStart;
      const newEnd = data.windowEnd ? new Date(data.windowEnd) : existing.windowEnd;

      const conflicts = await this.checkConflicts(
        existing.tenantId,
        normalizeSites(existing.sites),
        newStart,
        newEnd,
        blockId,
      );

      if (conflicts.hasConflict) {
        throw new ConflictException({
          error: "conflict",
          sites: conflicts.conflictingSites,
          window: { start: newStart, end: newEnd },
        });
      }
    }

    return this.prisma.inventoryBlock.update({
      where: { blockId },
      data: {
        state: data.state,
        windowStart: data.windowStart ? new Date(data.windowStart) : undefined,
        windowEnd: data.windowEnd ? new Date(data.windowEnd) : undefined,
        reason: data.reason,
      },
    });
  }

  async release(blockId: string) {
    return this.prisma.inventoryBlock.update({
      where: { blockId },
      data: { state: "released" },
    });
  }

  async remove(blockId: string) {
    return this.prisma.inventoryBlock.delete({ where: { blockId } });
  }
}
