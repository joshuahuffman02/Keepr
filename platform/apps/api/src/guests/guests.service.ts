import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateGuestDto } from "./dto/create-guest.dto";

@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService) { }

  findOne(id: string, campgroundId?: string) {
    return this.prisma.guest.findFirst({
      where: {
        id,
        ...(campgroundId ? { reservations: { some: { campgroundId } } } : {})
      },
      include: {
        loyaltyProfile: true,
        reservations: {
          orderBy: { arrivalDate: "desc" },
          ...(campgroundId ? { where: { campgroundId } } : {}),
          include: {
            site: { include: { siteClass: true } }
          }
        }
      }
    });
  }

  findAll() {
    return this.prisma.guest.findMany({
      orderBy: { primaryLastName: "asc" },
      include: {
        loyaltyProfile: true,
        reservations: {
          orderBy: { departureDate: "desc" },
          take: 1,
          select: {
            departureDate: true,
            site: {
              select: { id: true, name: true, siteNumber: true, siteClassId: true }
            }
          }
        }
      }
    });
  }

  findAllByCampground(campgroundId: string) {
    return this.prisma.guest.findMany({
      where: { reservations: { some: { campgroundId } } },
      orderBy: { primaryLastName: "asc" },
      include: {
        loyaltyProfile: true,
        reservations: {
          orderBy: { departureDate: "desc" },
          take: 1,
          where: { campgroundId },
          select: {
            departureDate: true,
            site: {
              select: { id: true, name: true, siteNumber: true, siteClassId: true }
            }
          }
        }
      }
    });
  }

  async create(data: CreateGuestDto) {
    const { rigLength, repeatStays, ...rest } = data as any;
    const emailNormalized = rest.email ? rest.email.trim().toLowerCase() : null;
    const phoneNormalized = rest.phone ? rest.phone.replace(/\D/g, "").slice(-10) : null;

    // Global guest lookup: if email or phone already exists, reuse that guest.
    const existing = await this.prisma.guest.findFirst({
      where: {
        OR: [
          ...(emailNormalized ? [{ emailNormalized }] : []),
          ...(phoneNormalized ? [{ phoneNormalized }] : [])
        ]
      }
    });
    if (existing) return existing;

    return this.prisma.guest.create({
      data: {
        ...rest,
        emailNormalized,
        phoneNormalized,
        rigLength: rigLength !== undefined ? Number(rigLength) : null,
        repeatStays: repeatStays !== undefined ? Number(repeatStays) : undefined
      }
    });
  }

  update(id: string, data: Partial<CreateGuestDto>) {
    const { rigLength, repeatStays, ...rest } = data as any;
    const emailNormalized = rest.email ? rest.email.trim().toLowerCase() : undefined;
    const phoneNormalized = rest.phone ? rest.phone.replace(/\D/g, "").slice(-10) : undefined;
    return this.prisma.guest.update({
      where: { id },
      data: {
        ...rest,
        ...(emailNormalized !== undefined ? { emailNormalized } : {}),
        ...(phoneNormalized !== undefined ? { phoneNormalized } : {}),
        ...(rigLength !== undefined ? { rigLength: rigLength === null ? null : Number(rigLength) } : {}),
        ...(repeatStays !== undefined ? { repeatStays: repeatStays === null ? null : Number(repeatStays) } : {})
      }
    });
  }

  remove(id: string) {
    return this.prisma.guest.delete({ where: { id } });
  }
}
