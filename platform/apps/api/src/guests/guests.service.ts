import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateGuestDto } from "./dto/create-guest.dto";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class GuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) { }

  findOne(id: string, campgroundId?: string) {
    const campgroundTag = campgroundId ? `campground:${campgroundId}` : null;
    return this.prisma.guest.findFirst({
      where: {
        id,
        ...(campgroundId
          ? {
              OR: [
                { reservations: { some: { campgroundId } } },
                { tags: { has: campgroundTag } }
              ]
            }
          : {})
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

  findAll(options?: { limit?: number; offset?: number; search?: string }) {
    const limit = Math.min(options?.limit ?? 100, 500);
    const offset = options?.offset ?? 0;

    return this.prisma.guest.findMany({
      where: options?.search ? {
        OR: [
          { primaryFirstName: { contains: options.search, mode: 'insensitive' } },
          { primaryLastName: { contains: options.search, mode: 'insensitive' } },
          { email: { contains: options.search, mode: 'insensitive' } }
        ]
      } : undefined,
      orderBy: { primaryLastName: "asc" },
      take: limit,
      skip: offset,
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

  findAllByCampground(
    campgroundId: string,
    options?: { limit?: number; offset?: number; search?: string }
  ) {
    const limit = Math.min(options?.limit ?? 100, 500);
    const offset = options?.offset ?? 0;
    const campgroundTag = `campground:${campgroundId}`;

    return this.prisma.guest.findMany({
      where: {
        AND: [
          {
            OR: [
              { reservations: { some: { campgroundId } } },
              { tags: { has: campgroundTag } }
            ]
          },
          ...(options?.search ? [{
            OR: [
              { primaryFirstName: { contains: options.search, mode: 'insensitive' as const } },
              { primaryLastName: { contains: options.search, mode: 'insensitive' as const } },
              { email: { contains: options.search, mode: 'insensitive' as const } }
            ]
          }] : [])
        ]
      },
      orderBy: { primaryLastName: "asc" },
      take: limit,
      skip: offset,
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

  async create(data: CreateGuestDto, options?: { actorId?: string; campgroundId?: string }) {
    const { rigLength, repeatStays, tags, ...rest } = data as any;
    const emailNormalized = rest.email ? rest.email.trim().toLowerCase() : null;
    const phoneNormalized = rest.phone ? rest.phone.replace(/\D/g, "").slice(-10) : null;
    const incomingTags = Array.isArray(tags) ? tags.filter((tag) => typeof tag === "string" && tag.trim()) : [];

    // Extract campgroundId from tags if not provided
    const campgroundId = options?.campgroundId || incomingTags.find((t: string) => t.startsWith("campground:"))?.replace("campground:", "");

    // Global guest lookup: if email or phone already exists, reuse that guest.
    const existing = await this.prisma.guest.findFirst({
      where: {
        OR: [
          ...(emailNormalized ? [{ emailNormalized }] : []),
          ...(phoneNormalized ? [{ phoneNormalized }] : [])
        ]
      }
    });
    if (existing) {
      if (incomingTags.length > 0) {
        const nextTags = Array.from(new Set([...(existing.tags ?? []), ...incomingTags]));
        if (nextTags.length !== (existing.tags ?? []).length) {
          const updated = await this.prisma.guest.update({
            where: { id: existing.id },
            data: { tags: nextTags }
          });

          // Audit tag update on existing guest
          if (campgroundId) {
            await this.audit.record({
              campgroundId,
              actorId: options?.actorId ?? null,
              action: "guest.update",
              entity: "guest",
              entityId: existing.id,
              before: { tags: existing.tags },
              after: { tags: nextTags }
            });
          }

          return updated;
        }
      }
      return existing;
    }

    const guest = await this.prisma.guest.create({
      data: {
        ...rest,
        ...(incomingTags.length ? { tags: incomingTags } : {}),
        emailNormalized,
        phoneNormalized,
        rigLength: rigLength !== undefined ? Number(rigLength) : null,
        repeatStays: repeatStays !== undefined ? Number(repeatStays) : undefined
      }
    });

    // Audit guest creation
    if (campgroundId) {
      await this.audit.record({
        campgroundId,
        actorId: options?.actorId ?? null,
        action: "guest.create",
        entity: "guest",
        entityId: guest.id,
        before: null,
        after: {
          id: guest.id,
          primaryFirstName: guest.primaryFirstName,
          primaryLastName: guest.primaryLastName,
          email: guest.email,
          phone: guest.phone
        }
      });
    }

    return guest;
  }

  async update(id: string, data: Partial<CreateGuestDto>, options?: { actorId?: string; campgroundId?: string }) {
    const { rigLength, repeatStays, ...rest } = data as any;
    const emailNormalized = rest.email ? rest.email.trim().toLowerCase() : undefined;
    const phoneNormalized = rest.phone ? rest.phone.replace(/\D/g, "").slice(-10) : undefined;

    // Get before state for audit
    const before = await this.prisma.guest.findUnique({ where: { id } });

    const updated = await this.prisma.guest.update({
      where: { id },
      data: {
        ...rest,
        ...(emailNormalized !== undefined ? { emailNormalized } : {}),
        ...(phoneNormalized !== undefined ? { phoneNormalized } : {}),
        ...(rigLength !== undefined ? { rigLength: rigLength === null ? null : Number(rigLength) } : {}),
        ...(repeatStays !== undefined ? { repeatStays: repeatStays === null ? null : Number(repeatStays) } : {})
      }
    });

    // Determine campgroundId from options or guest's tags
    const campgroundId = options?.campgroundId ||
      (before?.tags as string[] | null)?.find((t) => t.startsWith("campground:"))?.replace("campground:", "");

    // Audit guest update
    if (campgroundId && before) {
      await this.audit.record({
        campgroundId,
        actorId: options?.actorId ?? null,
        action: "guest.update",
        entity: "guest",
        entityId: id,
        before: {
          primaryFirstName: before.primaryFirstName,
          primaryLastName: before.primaryLastName,
          email: before.email,
          phone: before.phone,
          rigLength: before.rigLength,
          vehicleInfo: before.vehicleInfo,
          notes: before.notes
        },
        after: {
          primaryFirstName: updated.primaryFirstName,
          primaryLastName: updated.primaryLastName,
          email: updated.email,
          phone: updated.phone,
          rigLength: updated.rigLength,
          vehicleInfo: updated.vehicleInfo,
          notes: updated.notes
        }
      });
    }

    return updated;
  }

  async remove(id: string, options?: { actorId?: string; campgroundId?: string }) {
    // Get before state for audit
    const before = await this.prisma.guest.findUnique({ where: { id } });

    // Determine campgroundId from options or guest's tags
    const campgroundId = options?.campgroundId ||
      (before?.tags as string[] | null)?.find((t) => t.startsWith("campground:"))?.replace("campground:", "");

    const deleted = await this.prisma.guest.delete({ where: { id } });

    // Audit guest deletion
    if (campgroundId && before) {
      await this.audit.record({
        campgroundId,
        actorId: options?.actorId ?? null,
        action: "guest.delete",
        entity: "guest",
        entityId: id,
        before: {
          id: before.id,
          primaryFirstName: before.primaryFirstName,
          primaryLastName: before.primaryLastName,
          email: before.email,
          phone: before.phone
        },
        after: null
      });
    }

    return deleted;
  }
}
