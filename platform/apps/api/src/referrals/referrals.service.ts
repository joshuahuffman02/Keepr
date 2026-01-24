import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { CreateReferralProgramDto } from "./dto/create-referral-program.dto";
import { UpdateReferralProgramDto } from "./dto/update-referral-program.dto";

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  listPrograms(campgroundId: string) {
    return this.prisma.referralProgram.findMany({
      where: { campgroundId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
  }

  async createProgram(campgroundId: string, dto: CreateReferralProgramDto) {
    const orConditions: Prisma.ReferralProgramWhereInput[] = [{ code: dto.code }];
    if (dto.linkSlug) {
      orConditions.push({ linkSlug: dto.linkSlug });
    }
    const exists = await this.prisma.referralProgram.findFirst({
      where: {
        campgroundId,
        OR: orConditions,
      },
    });
    if (exists) {
      throw new BadRequestException("Referral code or link already exists");
    }
    return this.prisma.referralProgram.create({
      data: {
        id: randomUUID(),
        campgroundId,
        code: dto.code,
        linkSlug: dto.linkSlug ?? null,
        source: dto.source ?? null,
        channel: dto.channel ?? null,
        incentiveType: dto.incentiveType,
        incentiveValue: dto.incentiveValue,
        isActive: dto.isActive ?? true,
        notes: dto.notes ?? null,
      },
    });
  }

  async updateProgram(campgroundId: string, id: string, dto: UpdateReferralProgramDto) {
    const existing = await this.prisma.referralProgram.findUnique({ where: { id } });
    if (!existing || existing.campgroundId !== campgroundId) {
      throw new NotFoundException("Referral program not found");
    }
    if (dto.code || dto.linkSlug) {
      const conflictConditions: Prisma.ReferralProgramWhereInput[] = [];
      if (dto.code) conflictConditions.push({ code: dto.code });
      if (dto.linkSlug) conflictConditions.push({ linkSlug: dto.linkSlug });
      const conflict = await this.prisma.referralProgram.findFirst({
        where: {
          campgroundId,
          id: { not: id },
          OR: conflictConditions,
        },
      });
      if (conflict) {
        throw new BadRequestException("Referral code or link already in use");
      }
    }
    return this.prisma.referralProgram.update({
      where: { id },
      data: {
        code: dto.code ?? undefined,
        linkSlug: dto.linkSlug ?? undefined,
        source: dto.source ?? undefined,
        channel: dto.channel ?? undefined,
        incentiveType: dto.incentiveType ?? undefined,
        incentiveValue: dto.incentiveValue ?? undefined,
        isActive: dto.isActive ?? undefined,
        notes: dto.notes ?? undefined,
      },
    });
  }
}
