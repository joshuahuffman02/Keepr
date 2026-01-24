import { Injectable, ConflictException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { randomUUID } from "crypto";

type GroupNotificationPayload = {
  id: string;
  name?: string | null;
  reservations?: Array<{
    guest?: {
      email?: string | null;
    };
  }>;
};

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async create(data: {
    tenantId: string;
    name?: string;
    sharedPayment?: boolean;
    sharedComm?: boolean;
    reservationIds?: string[];
    primaryReservationId?: string;
  }) {
    const group = await this.prisma.group.create({
      data: {
        id: randomUUID(),
        tenantId: data.tenantId,
        sharedPayment: data.sharedPayment ?? false,
        sharedComm: data.sharedComm ?? false,
        primaryReservationId: data.primaryReservationId,
        updatedAt: new Date(),
      },
    });

    // Link reservations to group
    if (data.reservationIds?.length) {
      await this.prisma.reservation.updateMany({
        where: { id: { in: data.reservationIds } },
        data: {
          groupId: group.id,
          groupRole: "member",
        },
      });

      // Set primary role
      if (data.primaryReservationId) {
        await this.prisma.reservation.update({
          where: { id: data.primaryReservationId },
          data: { groupRole: "primary" },
        });
      }
    }

    return this.findOne(group.id);
  }

  async findAll(tenantId: string) {
    const groups = await this.prisma.group.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with reservation counts
    const enriched = await Promise.all(
      groups.map(async (group) => {
        const count = await this.prisma.reservation.count({
          where: { groupId: group.id },
        });
        return { ...group, reservationCount: count };
      }),
    );

    return enriched;
  }

  async findOne(id: string) {
    const group = await this.prisma.group.findUnique({
      where: { id },
    });

    if (!group) return null;

    // Get linked reservations
    const reservations = await this.prisma.reservation.findMany({
      where: { groupId: id },
      select: {
        id: true,
        groupRole: true,
        arrivalDate: true,
        departureDate: true,
        status: true,
        guestId: true,
        siteId: true,
      },
    });

    // Fetch guest and site info separately
    const guestIds = reservations.map((r) => r.guestId);
    const siteIds = reservations.map((r) => r.siteId);

    const guests = await this.prisma.guest.findMany({
      where: { id: { in: guestIds } },
      select: { id: true, primaryFirstName: true, primaryLastName: true, email: true },
    });

    const sites = await this.prisma.site.findMany({
      where: { id: { in: siteIds } },
      select: { id: true, name: true, siteNumber: true },
    });

    const guestMap = new Map(guests.map((g) => [g.id, g]));
    const siteMap = new Map(sites.map((s) => [s.id, s]));

    const enrichedReservations = reservations.map((r) => ({
      ...r,
      guest: guestMap.get(r.guestId),
      site: siteMap.get(r.siteId),
    }));

    return { ...group, reservations: enrichedReservations };
  }

  async update(
    id: string,
    data: {
      sharedPayment?: boolean;
      sharedComm?: boolean;
      addReservationIds?: string[];
      removeReservationIds?: string[];
    },
  ) {
    // Update group settings
    await this.prisma.group.update({
      where: { id },
      data: {
        sharedPayment: data.sharedPayment,
        sharedComm: data.sharedComm,
      },
    });

    // Add reservations
    if (data.addReservationIds?.length) {
      await this.prisma.reservation.updateMany({
        where: { id: { in: data.addReservationIds } },
        data: {
          groupId: id,
          groupRole: "member",
        },
      });
    }

    // Remove reservations
    if (data.removeReservationIds?.length) {
      await this.prisma.reservation.updateMany({
        where: { id: { in: data.removeReservationIds } },
        data: {
          groupId: null,
          groupRole: null,
        },
      });
    }

    // Notify group members of changes if sharedComm is enabled
    const group = await this.findOne(id);
    if (
      group?.sharedComm &&
      (data.addReservationIds?.length || data.removeReservationIds?.length)
    ) {
      await this.notifyGroupChange(group, data.addReservationIds, data.removeReservationIds);
    }

    return group;
  }

  /**
   * Notify group members when reservations are added or removed
   */
  private async notifyGroupChange(
    group: GroupNotificationPayload,
    addedIds: string[] | undefined,
    removedIds: string[] | undefined,
  ) {
    try {
      if (!group.reservations?.length) return;

      // Get emails of all guests in the group
      const guestEmails: string[] = [];
      for (const res of group.reservations) {
        if (res.guest?.email) {
          guestEmails.push(res.guest.email);
        }
      }

      if (!guestEmails.length) {
        this.logger.debug("No guest emails found for group notification");
        return;
      }

      const addedCount = addedIds?.length || 0;
      const removedCount = removedIds?.length || 0;
      const changes: string[] = [];
      if (addedCount) changes.push(`${addedCount} reservation(s) added`);
      if (removedCount) changes.push(`${removedCount} reservation(s) removed`);

      const groupName = group.name || `Group #${group.id.slice(-6)}`;

      for (const email of guestEmails) {
        await this.emailService.sendEmail({
          to: email,
          subject: `Your Group Booking Has Been Updated`,
          html: `
            <h2>Group Booking Update</h2>
            <p>Your group booking <strong>${groupName}</strong> has been updated.</p>
            <p><strong>Changes:</strong> ${changes.join(", ")}</p>
            <p><strong>Current Group Size:</strong> ${group.reservations.length} reservation(s)</p>
            <p>If you have any questions about these changes, please contact the campground directly.</p>
          `,
        });
      }

      this.logger.log(`Sent group change notifications to ${guestEmails.length} guests`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send group change notification: ${message}`);
    }
  }

  async remove(id: string) {
    // Unlink all reservations first
    await this.prisma.reservation.updateMany({
      where: { groupId: id },
      data: { groupId: null, groupRole: null },
    });

    return this.prisma.group.delete({ where: { id } });
  }
}
