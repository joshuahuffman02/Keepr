import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LockCodeType, LockCodeRotationSchedule } from "@prisma/client";
import { randomUUID } from "crypto";

@Injectable()
export class LockCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    campgroundId: string;
    name: string;
    code: string;
    type: LockCodeType;
    rotationSchedule?: LockCodeRotationSchedule;
    showOnConfirmation?: boolean;
    showAtCheckin?: boolean;
    appliesTo?: string[];
    notes?: string;
  }) {
    return this.prisma.lockCode.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        campgroundId: data.campgroundId,
        name: data.name,
        code: data.code,
        type: data.type,
        rotationSchedule: data.rotationSchedule ?? "none",
        showOnConfirmation: data.showOnConfirmation ?? true,
        showAtCheckin: data.showAtCheckin ?? true,
        appliesTo: data.appliesTo ?? [],
        notes: data.notes,
      },
    });
  }

  async findAllByCampground(campgroundId: string) {
    return this.prisma.lockCode.findMany({
      where: { campgroundId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, campgroundId: string) {
    const lockCode = await this.prisma.lockCode.findUnique({
      where: { id, campgroundId },
    });
    if (!lockCode) throw new NotFoundException("Lock code not found");
    return lockCode;
  }

  async update(
    id: string,
    campgroundId: string,
    data: Partial<{
      name: string;
      code: string;
      type: LockCodeType;
      rotationSchedule: LockCodeRotationSchedule;
      showOnConfirmation: boolean;
      showAtCheckin: boolean;
      appliesTo: string[];
      isActive: boolean;
      notes: string;
    }>,
  ) {
    // Verify lock code belongs to this campground before updating
    const existing = await this.prisma.lockCode.findUnique({
      where: { id, campgroundId },
    });
    if (!existing) throw new NotFoundException("Lock code not found");

    return this.prisma.lockCode.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, campgroundId: string) {
    // Verify lock code belongs to this campground before deleting
    const existing = await this.prisma.lockCode.findUnique({
      where: { id, campgroundId },
    });
    if (!existing) throw new NotFoundException("Lock code not found");

    return this.prisma.lockCode.delete({ where: { id } });
  }

  async rotate(id: string, campgroundId: string) {
    // Verify lock code belongs to this campground before rotating
    const existing = await this.prisma.lockCode.findUnique({
      where: { id, campgroundId },
    });
    if (!existing) throw new NotFoundException("Lock code not found");

    // Generate a new random 4-digit code
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();

    return this.prisma.lockCode.update({
      where: { id },
      data: {
        code: newCode,
        lastRotatedAt: new Date(),
      },
    });
  }

  // Get lock codes that should be shown to guests (for check-in/confirmation)
  async getGuestVisibleCodes(campgroundId: string, context: "confirmation" | "checkin") {
    const where = {
      campgroundId,
      isActive: true,
      type: { not: LockCodeType.master }, // Never show master codes to guests
    };

    if (context === "confirmation") {
      return this.prisma.lockCode.findMany({
        where: { ...where, showOnConfirmation: true },
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
        },
      });
    }

    return this.prisma.lockCode.findMany({
      where: { ...where, showAtCheckin: true },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
      },
    });
  }
}
