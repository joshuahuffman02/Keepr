import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

@Injectable()
export class GroupBookingsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    campgroundId: string;
    groupName: string;
    primaryGuestId: string;
    groupType: string;
    preferAdjacent?: boolean;
    preferSameFloor?: boolean;
    preferConnecting?: boolean;
    preferredZone?: string;
    billingType?: string;
    groupArrivalTime?: string;
    groupDepartureTime?: string;
  }) {
    return this.prisma.groupBooking
      .create({
        data: {
          id: randomUUID(),
          campgroundId: data.campgroundId,
          groupName: data.groupName,
          primaryGuestId: data.primaryGuestId,
          groupType: data.groupType,
          preferAdjacent: data.preferAdjacent ?? false,
          preferSameFloor: data.preferSameFloor ?? false,
          preferConnecting: data.preferConnecting ?? false,
          preferredZone: data.preferredZone,
          billingType: data.billingType ?? "individual",
          groupArrivalTime: data.groupArrivalTime,
          groupDepartureTime: data.groupDepartureTime,
          assignmentStatus: "pending",
          updatedAt: new Date(),
        },
        include: {
          Guest: {
            select: { primaryFirstName: true, primaryLastName: true, email: true },
          },
        },
      })
      .then(({ Guest, ...group }) => ({
        ...group,
        primaryGuest: Guest,
      }));
  }

  async findAll(
    campgroundId: string,
    filters?: {
      groupType?: string;
      assignmentStatus?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const where: Prisma.GroupBookingWhereInput = { campgroundId };

    if (filters?.groupType) {
      where.groupType = filters.groupType;
    }
    if (filters?.assignmentStatus) {
      where.assignmentStatus = filters.assignmentStatus;
    }

    const groups = await this.prisma.groupBooking.findMany({
      where,
      include: {
        Guest: {
          select: { primaryFirstName: true, primaryLastName: true },
        },
        Reservation: {
          include: {
            Site: { select: { name: true } },
            Guest: { select: { primaryFirstName: true, primaryLastName: true } },
          },
        },
        _count: { select: { Reservation: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return groups.map(({ Guest, Reservation, _count, ...group }) => ({
      ...group,
      primaryGuest: Guest,
      reservations: Reservation,
      _count: _count ? { reservations: _count.Reservation } : undefined,
    }));
  }

  async findOne(id: string) {
    const groupBooking = await this.prisma.groupBooking.findUnique({
      where: { id },
      include: {
        Guest: true,
        Campground: { select: { name: true } },
        Reservation: {
          include: {
            Site: { select: { name: true, zone: true } },
            Guest: { select: { primaryFirstName: true, primaryLastName: true, email: true } },
          },
          orderBy: { arrivalDate: "asc" },
        },
      },
    });

    if (!groupBooking) {
      throw new NotFoundException("Group booking not found");
    }

    const { Guest, Campground, Reservation, ...group } = groupBooking;
    return {
      ...group,
      primaryGuest: Guest,
      campground: Campground,
      reservations: Reservation,
    };
  }

  async update(
    id: string,
    data: Partial<{
      groupName: string;
      groupType: string;
      preferAdjacent: boolean;
      preferSameFloor: boolean;
      preferConnecting: boolean;
      preferredZone: string;
      billingType: string;
      groupArrivalTime: string;
      groupDepartureTime: string;
    }>,
  ) {
    return this.prisma.groupBooking.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    // Check if group has reservations
    const group = await this.prisma.groupBooking.findUnique({
      where: { id },
      include: { _count: { select: { Reservation: true } } },
    });

    if (!group) {
      throw new NotFoundException("Group booking not found");
    }

    if (group._count.Reservation > 0) {
      throw new BadRequestException(
        "Cannot delete a group with reservations. Remove reservations first.",
      );
    }

    return this.prisma.groupBooking.delete({ where: { id } });
  }

  async addReservationToGroup(groupId: string, reservationId: string) {
    const group = await this.prisma.groupBooking.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException("Group booking not found");
    }

    const reservation = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    if (reservation.campgroundId !== group.campgroundId) {
      throw new BadRequestException("Reservation must be at the same property as the group");
    }

    return this.prisma.reservation.update({
      where: { id: reservationId },
      data: { groupBookingId: groupId },
    });
  }

  async removeReservationFromGroup(reservationId: string) {
    return this.prisma.reservation.update({
      where: { id: reservationId },
      data: { groupBookingId: null },
    });
  }

  async optimizeRoomAssignments(groupId: string) {
    const group = await this.findOne(groupId);

    const unassignedReservations = group.reservations.filter((r) => !r.siteId);
    if (unassignedReservations.length === 0) {
      return { message: "All reservations already have site assignments", assignments: [] };
    }

    // Get available sites matching group preferences
    const availableSites = await this.prisma.site.findMany({
      where: {
        campgroundId: group.campgroundId,
        isActive: true,
        ...(group.preferredZone ? { zone: group.preferredZone } : {}),
      },
      include: {
        SiteClass: true,
        StructureAttributes: true,
      },
      orderBy: [{ zone: "asc" }, { siteNumber: "asc" }],
    });

    // Simple assignment algorithm - in production this would be more sophisticated
    const assignments: Array<{ reservationId: string; siteId: string; siteName: string }> = [];

    // Group sites by zone/floor for adjacency optimization
    const sitesByZone = new Map<string, typeof availableSites>();
    for (const site of availableSites) {
      const zone = site.zone ?? "default";
      if (!sitesByZone.has(zone)) {
        sitesByZone.set(zone, []);
      }
      sitesByZone.get(zone)!.push(site);
    }

    // Find zone with most available sites to keep group together
    let bestZone = "default";
    let maxSites = 0;
    for (const [zone, sites] of sitesByZone) {
      if (sites.length > maxSites) {
        maxSites = sites.length;
        bestZone = zone;
      }
    }

    const zoneSites = sitesByZone.get(bestZone) ?? availableSites;
    let siteIndex = 0;

    for (const reservation of unassignedReservations) {
      if (siteIndex >= zoneSites.length) break;

      // Check availability
      const site = zoneSites[siteIndex];
      const conflicting = await this.prisma.reservation.findFirst({
        where: {
          siteId: site.id,
          id: { not: reservation.id },
          status: { in: ["confirmed", "checked_in"] },
          arrivalDate: { lt: reservation.departureDate },
          departureDate: { gt: reservation.arrivalDate },
        },
      });

      if (!conflicting) {
        await this.prisma.reservation.update({
          where: { id: reservation.id },
          data: { siteId: site.id },
        });

        assignments.push({
          reservationId: reservation.id,
          siteId: site.id,
          siteName: site.name,
        });
      }

      siteIndex++;
    }

    // Update assignment status
    const allAssigned = assignments.length === unassignedReservations.length;
    await this.prisma.groupBooking.update({
      where: { id: groupId },
      data: {
        assignmentStatus: allAssigned ? "complete" : "partial",
      },
    });

    return {
      message: allAssigned
        ? "All rooms assigned successfully"
        : `Assigned ${assignments.length} of ${unassignedReservations.length} rooms`,
      assignments,
    };
  }

  async getGroupStats(campgroundId: string, dateRange?: { start: Date; end: Date }) {
    const where: Prisma.GroupBookingWhereInput = { campgroundId };

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    const groups = await this.prisma.groupBooking.findMany({
      where,
      include: {
        _count: { select: { Reservation: true } },
      },
    });

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalRooms = 0;

    for (const group of groups) {
      byType[group.groupType] = (byType[group.groupType] || 0) + 1;
      byStatus[group.assignmentStatus] = (byStatus[group.assignmentStatus] || 0) + 1;
      totalRooms += group._count.Reservation;
    }

    return {
      totalGroups: groups.length,
      totalRooms,
      averageGroupSize: groups.length > 0 ? Math.round(totalRooms / groups.length) : 0,
      byType,
      byStatus,
    };
  }
}
