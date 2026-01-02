import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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

  /**
   * Merge two guests into one. The primary guest is kept, and all related records
   * from the secondary guest are transferred to the primary guest.
   */
  async merge(
    primaryId: string,
    secondaryId: string,
    options?: { actorId?: string; campgroundId?: string }
  ) {
    if (primaryId === secondaryId) {
      throw new BadRequestException("Cannot merge a guest with itself");
    }

    const [primary, secondary] = await Promise.all([
      this.prisma.guest.findUnique({
        where: { id: primaryId },
        include: { loyaltyProfile: true }
      }),
      this.prisma.guest.findUnique({
        where: { id: secondaryId },
        include: { loyaltyProfile: true }
      })
    ]);

    if (!primary) throw new NotFoundException("Primary guest not found");
    if (!secondary) throw new NotFoundException("Secondary guest not found");

    const campgroundId = options?.campgroundId ||
      (primary.tags as string[] | null)?.find((t) => t.startsWith("campground:"))?.replace("campground:", "");

    // Use a transaction to ensure data integrity
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Transfer all reservations from secondary to primary
      await tx.reservation.updateMany({
        where: { guestId: secondaryId },
        data: { guestId: primaryId }
      });

      // 2. Transfer all messages from secondary to primary
      await tx.message.updateMany({
        where: { guestId: secondaryId },
        data: { guestId: primaryId }
      });

      // 3. Transfer all equipment from secondary to primary
      await tx.guestEquipment.updateMany({
        where: { guestId: secondaryId },
        data: { guestId: primaryId }
      });

      // 4. Merge loyalty profiles if both exist
      if (secondary.loyaltyProfile && primary.loyaltyProfile) {
        // Add secondary's points to primary
        await tx.loyaltyProfile.update({
          where: { id: primary.loyaltyProfile.id },
          data: {
            pointsBalance: primary.loyaltyProfile.pointsBalance + secondary.loyaltyProfile.pointsBalance,
            lifetimePoints: primary.loyaltyProfile.lifetimePoints + secondary.loyaltyProfile.lifetimePoints
          }
        });
        // Delete secondary's loyalty profile
        await tx.loyaltyProfile.delete({ where: { id: secondary.loyaltyProfile.id } });
      } else if (secondary.loyaltyProfile && !primary.loyaltyProfile) {
        // Transfer loyalty profile to primary
        await tx.loyaltyProfile.update({
          where: { id: secondary.loyaltyProfile.id },
          data: { guestId: primaryId }
        });
      }

      // 5. Merge tags (combine unique tags from both)
      const primaryTags = (primary.tags as string[]) || [];
      const secondaryTags = (secondary.tags as string[]) || [];
      const mergedTags = [...new Set([...primaryTags, ...secondaryTags])];

      // 6. Update primary guest with merged notes
      const mergedNotes = [primary.notes, secondary.notes].filter(Boolean).join("\n---\n");

      const updatedPrimary = await tx.guest.update({
        where: { id: primaryId },
        data: {
          tags: mergedTags,
          notes: mergedNotes || primary.notes,
          // Use secondary's data if primary is missing it
          address1: primary.address1 || secondary.address1,
          address2: primary.address2 || secondary.address2,
          city: primary.city || secondary.city,
          state: primary.state || secondary.state,
          postalCode: primary.postalCode || secondary.postalCode,
          country: primary.country || secondary.country,
          preferredContact: primary.preferredContact || secondary.preferredContact,
          preferredLanguage: primary.preferredLanguage || secondary.preferredLanguage,
          rigType: primary.rigType || secondary.rigType,
          rigLength: primary.rigLength ?? secondary.rigLength,
          vehiclePlate: primary.vehiclePlate || secondary.vehiclePlate,
          vehicleState: primary.vehicleState || secondary.vehicleState,
          leadSource: primary.leadSource || secondary.leadSource,
          // Keep VIP status if either guest had it
          vip: primary.vip || secondary.vip,
          // Keep marketing opt-in if either guest had it
          marketingOptIn: primary.marketingOptIn || secondary.marketingOptIn,
          // Sum repeat stays
          repeatStays: (primary.repeatStays || 0) + (secondary.repeatStays || 0)
        }
      });

      // 7. Delete the secondary guest
      await tx.guest.delete({ where: { id: secondaryId } });

      return updatedPrimary;
    });

    // Audit the merge
    if (campgroundId) {
      await this.audit.record({
        campgroundId,
        actorId: options?.actorId ?? null,
        action: "guest.merge",
        entity: "guest",
        entityId: primaryId,
        before: {
          primaryGuest: {
            id: primary.id,
            name: `${primary.primaryFirstName} ${primary.primaryLastName}`,
            email: primary.email
          },
          secondaryGuest: {
            id: secondary.id,
            name: `${secondary.primaryFirstName} ${secondary.primaryLastName}`,
            email: secondary.email
          }
        },
        after: {
          mergedGuest: {
            id: result.id,
            name: `${result.primaryFirstName} ${result.primaryLastName}`,
            email: result.email
          }
        }
      });
    }

    return result;
  }
}
