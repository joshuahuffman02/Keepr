import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSiteDto } from "./dto/create-site.dto";
import { ReservationStatus, SiteType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const SITE_TYPES = new Set<string>(Object.values(SiteType));

const isSiteType = (value: string): value is SiteType => SITE_TYPES.has(value);

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: {
        SiteClass: true,
        Campground: true,
      },
    });

    if (!site) {
      throw new NotFoundException("Site not found");
    }

    return site;
  }

  listByCampground(
    campgroundId: string,
    options?: { limit?: number; offset?: number; isActive?: boolean },
  ) {
    const limit = Math.min(options?.limit ?? 200, 500);
    const offset = options?.offset ?? 0;

    return this.prisma.site.findMany({
      where: {
        campgroundId,
        ...(options?.isActive !== undefined ? { isActive: options.isActive } : {}),
      },
      include: { SiteClass: true },
      orderBy: { siteNumber: "asc" },
      take: limit,
      skip: offset,
    });
  }

  create(data: CreateSiteDto) {
    const { siteType, ...rest } = data;
    if (!isSiteType(siteType)) {
      throw new BadRequestException("Invalid siteType");
    }
    return this.prisma.site.create({ data: { id: randomUUID(), ...rest, siteType } });
  }

  async update(id: string, data: Partial<CreateSiteDto>) {
    const existing = await this.prisma.site.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException("Site not found");
    }

    const { campgroundId, siteType, siteClassId, ...rest } = data;
    const siteTypeValue = siteType && isSiteType(siteType) ? siteType : undefined;
    if (siteType && !siteTypeValue) throw new BadRequestException("Invalid siteType");
    const updateData: Prisma.SiteUpdateInput = {
      ...rest,
      ...(siteTypeValue ? { siteType: siteTypeValue } : {}),
    };
    if (siteClassId !== undefined) {
      updateData.SiteClass = siteClassId ? { connect: { id: siteClassId } } : { disconnect: true };
    }
    return this.prisma.site.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.site.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException("Site not found");
    }

    return this.prisma.site.delete({ where: { id } });
  }

  async checkAvailability(id: string) {
    const now = new Date();
    // Check for any active reservation overlapping *now*
    const activeReservation = await this.prisma.reservation.findFirst({
      where: {
        siteId: id,
        status: { not: ReservationStatus.cancelled },
        arrivalDate: { lte: now },
        departureDate: { gt: now },
      },
      select: {
        id: true,
        status: true,
        arrivalDate: true,
        departureDate: true,
        guestId: true,
      },
    });

    if (activeReservation) {
      return { status: "occupied", reservation: activeReservation };
    }

    // Check for blocks? (omitted for prototype speed, can accept for now)

    return { status: "available" };
  }
}
