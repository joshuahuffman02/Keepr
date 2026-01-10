import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HousekeepingService } from '../housekeeping/housekeeping.service';

@Injectable()
export class RoomMovesService {
  constructor(
    private prisma: PrismaService,
    private housekeepingService: HousekeepingService,
  ) {}

  async createMoveRequest(data: {
    reservationId: string;
    toSiteId: string;
    moveDate: Date;
    moveReason: string;
    isComplimentary?: boolean;
    notes?: string;
    requestedById: string;
  }) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: data.reservationId },
      include: {
        site: true,
        campground: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.status !== 'checked_in') {
      throw new BadRequestException('Room moves can only be requested for checked-in reservations');
    }

    const toSite = await this.prisma.site.findUnique({
      where: { id: data.toSiteId },
      include: { SiteClass: true },
    });

    if (!toSite) {
      throw new NotFoundException('Destination site not found');
    }

    if (toSite.campgroundId !== reservation.campgroundId) {
      throw new BadRequestException('Destination site must be in the same property');
    }

    // Check availability of destination site
    const conflictingReservation = await this.prisma.reservation.findFirst({
      where: {
        siteId: data.toSiteId,
        id: { not: data.reservationId },
        status: { in: ['confirmed', 'checked_in'] },
        arrivalDate: { lte: reservation.departureDate },
        departureDate: { gte: data.moveDate },
      },
    });

    if (conflictingReservation) {
      throw new BadRequestException('Destination site is not available for the remaining stay');
    }

    // Calculate price difference
    const fromSiteClass = await this.prisma.siteClass.findUnique({
      where: { id: reservation.site.siteClassId },
    });

    let priceDifference = 0;
    if (fromSiteClass && toSite.siteClass) {
      // Simplified calculation - would need to consider actual pricing
      const remainingNights = Math.ceil(
        (new Date(reservation.departureDate).getTime() - data.moveDate.getTime()) /
        (1000 * 60 * 60 * 24)
      );
      const fromRate = fromSiteClass.defaultRate ?? 0;
      const toRate = toSite.siteClass.defaultRate ?? 0;
      priceDifference = (toRate - fromRate) * remainingNights;
    }

    const moveRequest = await this.prisma.roomMoveRequest.create({
      data: {
        reservationId: data.reservationId,
        fromSiteId: reservation.siteId,
        toSiteId: data.toSiteId,
        moveDate: data.moveDate,
        moveReason: data.moveReason,
        isComplimentary: data.isComplimentary ?? false,
        priceDifference: data.isComplimentary ? 0 : priceDifference,
        status: 'requested',
        requestedById: data.requestedById,
        notes: data.notes,
      },
      include: {
        fromSite: { select: { name: true } },
        toSite: { select: { name: true } },
      },
    });

    return moveRequest;
  }

  async approveMoveRequest(id: string, approvedById: string) {
    const moveRequest = await this.prisma.roomMoveRequest.findUnique({
      where: { id },
      include: { Reservation: true },
    });

    if (!moveRequest) {
      throw new NotFoundException('Move request not found');
    }

    if (moveRequest.status !== 'requested') {
      throw new BadRequestException(`Cannot approve a ${moveRequest.status} move request`);
    }

    return this.prisma.roomMoveRequest.update({
      where: { id },
      data: {
        status: 'approved',
        approvedById,
      },
    });
  }

  async completeMoveRequest(id: string, completedById: string) {
    const moveRequest = await this.prisma.roomMoveRequest.findUnique({
      where: { id },
      include: { Reservation: true, toSite: true },
    });

    if (!moveRequest) {
      throw new NotFoundException('Move request not found');
    }

    if (moveRequest.status !== 'approved') {
      throw new BadRequestException('Move request must be approved before completing');
    }

    // Update reservation with new site
    await this.prisma.reservation.update({
      where: { id: moveRequest.reservationId },
      data: { siteId: moveRequest.toSiteId },
    });

    // Update housekeeping status for old site
    await this.housekeepingService.updateSiteHousekeepingStatus(
      moveRequest.fromSiteId,
      'vacant_dirty'
    );

    // Update housekeeping status for new site
    await this.housekeepingService.updateSiteHousekeepingStatus(
      moveRequest.toSiteId,
      'occupied'
    );

    // Price difference is tracked on moveRequest; ledger integration would be added here for full accounting

    return this.prisma.roomMoveRequest.update({
      where: { id },
      data: {
        status: 'completed',
        completedById,
        completedAt: new Date(),
      },
    });
  }

  async cancelMoveRequest(id: string) {
    const moveRequest = await this.prisma.roomMoveRequest.findUnique({
      where: { id },
    });

    if (!moveRequest) {
      throw new NotFoundException('Move request not found');
    }

    if (moveRequest.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed move request');
    }

    return this.prisma.roomMoveRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  async getMoveRequest(id: string) {
    const moveRequest = await this.prisma.roomMoveRequest.findUnique({
      where: { id },
      include: {
        reservation: {
          include: {
            guest: { select: { primaryFirstName: true, primaryLastName: true } },
          },
        },
        fromSite: { select: { name: true, siteClass: true } },
        toSite: { select: { name: true, siteClass: true } },
      },
    });

    if (!moveRequest) {
      throw new NotFoundException('Move request not found');
    }

    return moveRequest;
  }

  async getMoveRequestsByReservation(reservationId: string) {
    return this.prisma.roomMoveRequest.findMany({
      where: { reservationId },
      include: {
        fromSite: { select: { name: true } },
        toSite: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingMoveRequests(campgroundId: string) {
    return this.prisma.roomMoveRequest.findMany({
      where: {
        reservation: { campgroundId },
        status: { in: ['requested', 'approved'] },
      },
      include: {
        reservation: {
          include: {
            guest: { select: { primaryFirstName: true, primaryLastName: true } },
          },
        },
        fromSite: { select: { name: true } },
        toSite: { select: { name: true } },
      },
      orderBy: { moveDate: 'asc' },
    });
  }

  async getTodaysMoves(campgroundId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.roomMoveRequest.findMany({
      where: {
        reservation: { campgroundId },
        moveDate: {
          gte: today,
          lt: tomorrow,
        },
        status: 'approved',
      },
      include: {
        reservation: {
          include: {
            guest: { select: { primaryFirstName: true, primaryLastName: true } },
          },
        },
        fromSite: { select: { name: true } },
        toSite: { select: { name: true } },
      },
      orderBy: { moveDate: 'asc' },
    });
  }
}
