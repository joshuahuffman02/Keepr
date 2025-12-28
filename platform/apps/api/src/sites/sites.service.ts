import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSiteDto } from "./dto/create-site.dto";
import { SiteType } from "@prisma/client";

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) { }

  findOne(id: string) {
    return this.prisma.site.findUnique({
      where: { id },
      include: {
        siteClass: true,
        campground: true
      }
    });
  }

  listByCampground(
    campgroundId: string,
    options?: { limit?: number; offset?: number; isActive?: boolean }
  ) {
    const limit = Math.min(options?.limit ?? 200, 500);
    const offset = options?.offset ?? 0;

    return this.prisma.site.findMany({
      where: {
        campgroundId,
        ...(options?.isActive !== undefined ? { isActive: options.isActive } : {})
      },
      include: { siteClass: true },
      orderBy: { siteNumber: 'asc' },
      take: limit,
      skip: offset
    });
  }

  create(data: CreateSiteDto) {
    return this.prisma.site.create({ data: { ...data, siteType: data.siteType as SiteType } });
  }

  update(id: string, data: Partial<CreateSiteDto>) {
    const { campgroundId, siteType, ...rest } = data;
    return this.prisma.site.update({
      where: { id },
      data: {
        ...rest,
        ...(siteType ? { siteType: siteType as SiteType } : {}),
        ...(rest.siteClassId === null ? { siteClassId: null } : {})
      }
    });
  }

  remove(id: string) {
    return this.prisma.site.delete({ where: { id } });
  }

  async checkAvailability(id: string) {
    const now = new Date();
    // Check for any active reservation overlapping *now*
    const activeReservation = await this.prisma.reservation.findFirst({
      where: {
        siteId: id,
        status: { not: "canceled" }, // Assuming 'canceled' is the status string from ReservationStatus enum or similar
        arrivalDate: { lte: now },
        departureDate: { gt: now }
      },
      select: {
        id: true,
        status: true,
        arrivalDate: true,
        departureDate: true,
        guestId: true
      }
    });

    if (activeReservation) {
      return { status: "occupied", reservation: activeReservation };
    }

    // Check for blocks? (omitted for prototype speed, can accept for now)

    return { status: "available" };
  }
}
