import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReferralProgramDto } from "./dto/create-referral-program.dto";
import { UpdateReferralProgramDto } from "./dto/update-referral-program.dto";

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) { }

  listPrograms(campgroundId: string) {
    return this.prisma.referralProgram.findMany({
      where: { campgroundId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
    });
  }

  async createProgram(campgroundId: string, dto: CreateReferralProgramDto) {
    const exists = await this.prisma.referralProgram.findFirst({
      where: {
        campgroundId,
        OR: [{ code: dto.code }, dto.linkSlug ? { linkSlug: dto.linkSlug } : undefined].filter(Boolean) as any
      }
    });
    if (exists) {
      throw new BadRequestException("Referral code or link already exists");
    }
    return this.prisma.referralProgram.create({
      data: {
        campgroundId,
        code: dto.code,
        linkSlug: dto.linkSlug ?? null,
        source: dto.source ?? null,
        channel: dto.channel ?? null,
        incentiveType: dto.incentiveType,
        incentiveValue: dto.incentiveValue,
        isActive: dto.isActive ?? true,
        notes: dto.notes ?? null
      }
    });
  }

  async updateProgram(campgroundId: string, id: string, dto: UpdateReferralProgramDto) {
    const existing = await this.prisma.referralProgram.findUnique({ where: { id } });
    if (!existing || existing.campgroundId !== campgroundId) {
      throw new NotFoundException("Referral program not found");
    }
    if (dto.code || dto.linkSlug) {
      const conflict = await this.prisma.referralProgram.findFirst({
        where: {
          campgroundId,
          id: { not: id },
          OR: [
            dto.code ? { code: dto.code } : undefined,
            dto.linkSlug ? { linkSlug: dto.linkSlug } : undefined
          ].filter(Boolean) as any
        }
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
        notes: dto.notes ?? undefined
      }
    });
  }
}
