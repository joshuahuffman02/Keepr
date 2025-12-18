import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookService, WebhookEvent } from "./webhook.service";
import { GuestsService } from "../guests/guests.service";

export interface ApiReservationInput {
  siteId: string;
  guestId: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children?: number;
  status?: string;
  notes?: string;
  siteLocked?: boolean;
}

export interface ApiGuestInput {
  primaryFirstName: string;
  primaryLastName: string;
  email: string;
  phone?: string;
}

export interface ApiSiteInput {
  name: string;
  siteNumber: string;
  siteType: string;
  maxOccupancy: number;
  rigMaxLength?: number | null;
}

@Injectable()
export class PublicApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhook: WebhookService,
    private readonly guests: GuestsService
  ) { }

  private async assertSiteInCampground(siteId: string, campgroundId: string) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId }, select: { campgroundId: true } });
    if (!site || site.campgroundId !== campgroundId) {
      throw new BadRequestException("Site does not belong to this campground");
    }
  }

  private async assertReservationCampground(reservationId: string, campgroundId: string) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id: reservationId }, select: { campgroundId: true } });
    if (!reservation || reservation.campgroundId !== campgroundId) {
      throw new NotFoundException("Reservation not found for this campground");
    }
  }

  async listReservations(campgroundId: string) {
    return this.prisma.reservation.findMany({
      where: { campgroundId },
      orderBy: { createdAt: "desc" },
      include: {
        site: { select: { id: true, name: true, siteNumber: true } },
        guest: { select: { id: true, primaryFirstName: true, primaryLastName: true, email: true } }
      }
    });
  }

  async getReservation(campgroundId: string, id: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, campgroundId },
      include: {
        site: { select: { id: true, name: true, siteNumber: true } },
        guest: { select: { id: true, primaryFirstName: true, primaryLastName: true, email: true } },
        payments: true
      }
    });
    if (!reservation) throw new NotFoundException("Reservation not found");
    return reservation;
  }

  async createReservation(campgroundId: string, input: ApiReservationInput) {
    await this.assertSiteInCampground(input.siteId, campgroundId);
    const created = await this.prisma.reservation.create({
      data: {
        campgroundId,
        siteId: input.siteId,
        siteLocked: input.siteLocked ?? false,
        guestId: input.guestId,
        arrivalDate: new Date(input.arrivalDate),
        departureDate: new Date(input.departureDate),
        adults: input.adults,
        children: input.children ?? 0,
        status: (input.status as any) || "confirmed",
        notes: input.notes || null
      }
    });
    await this.webhook.emit("reservation.created", campgroundId, { reservationId: created.id });
    return created;
  }

  async updateReservation(campgroundId: string, id: string, input: Partial<ApiReservationInput>) {
    await this.assertReservationCampground(id, campgroundId);
    if (input.siteId) {
      await this.assertSiteInCampground(input.siteId, campgroundId);
    }
    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        ...(input.siteId ? { siteId: input.siteId } : {}),
        ...(input.arrivalDate ? { arrivalDate: new Date(input.arrivalDate) } : {}),
        ...(input.departureDate ? { departureDate: new Date(input.departureDate) } : {}),
        ...(input.adults !== undefined ? { adults: input.adults } : {}),
        ...(input.children !== undefined ? { children: input.children } : {}),
        ...(input.status ? { status: input.status as any } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.siteLocked !== undefined ? { siteLocked: input.siteLocked } : {})
      }
    });
    await this.webhook.emit("reservation.updated", campgroundId, { reservationId: id });
    return updated;
  }

  async deleteReservation(campgroundId: string, id: string) {
    await this.assertReservationCampground(id, campgroundId);
    const deleted = await this.prisma.reservation.delete({ where: { id } });
    await this.webhook.emit("reservation.deleted", campgroundId, { reservationId: id });
    return deleted;
  }

  async recordPayment(campgroundId: string, reservationId: string, amountCents: number, method = "card") {
    await this.assertReservationCampground(reservationId, campgroundId);
    const payment = await this.prisma.payment.create({
      data: {
        campgroundId,
        reservationId,
        amountCents,
        method
      }
    });
    await this.webhook.emit("payment.created", campgroundId, { reservationId, paymentId: payment.id });
    return payment;
  }

  async listGuests(campgroundId: string) {
    return this.prisma.guest.findMany({
      where: { reservations: { some: { campgroundId } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async getGuest(campgroundId: string, id: string) {
    const guest = await this.prisma.guest.findUnique({
      where: { id },
      include: {
        reservations: {
          where: { campgroundId },
          orderBy: { arrivalDate: "desc" },
          include: { site: { select: { id: true, name: true, siteNumber: true } } }
        }
      }
    });
    if (!guest) throw new NotFoundException("Guest not found");
    return guest;
  }

  async createGuest(campgroundId: string, input: ApiGuestInput) {
    const guest = await this.guests.create({
      primaryFirstName: input.primaryFirstName,
      primaryLastName: input.primaryLastName,
      email: input.email,
      phone: input.phone
    } as any);
    await this.webhook.emit("guest.created", campgroundId, { guestId: guest.id });
    return guest;
  }

  async updateGuest(campgroundId: string, id: string, input: Partial<ApiGuestInput>) {
    await this.getGuest(campgroundId, id);
    return this.guests.update(id, input as any);
  }

  async deleteGuest(campgroundId: string, id: string) {
    await this.getGuest(campgroundId, id);
    return this.guests.remove(id);
  }

  async listSites(campgroundId: string) {
    return this.prisma.site.findMany({
      where: { campgroundId },
      orderBy: { siteNumber: "asc" }
    });
  }

  async getSite(campgroundId: string, id: string) {
    const site = await this.prisma.site.findUnique({ where: { id } });
    if (!site || site.campgroundId !== campgroundId) throw new NotFoundException("Site not found");
    return site;
  }

  async createSite(campgroundId: string, input: ApiSiteInput) {
    const created = await this.prisma.site.create({
      data: {
        campgroundId,
        name: input.name,
        siteNumber: input.siteNumber,
        siteType: input.siteType as any,
        maxOccupancy: input.maxOccupancy,
        rigMaxLength: input.rigMaxLength ?? null
      }
    });
    await this.webhook.emit("site.created", campgroundId, { siteId: created.id });
    return created;
  }

  async updateSite(campgroundId: string, id: string, input: Partial<ApiSiteInput>) {
    await this.getSite(campgroundId, id);
    const updated = await this.prisma.site.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.siteNumber ? { siteNumber: input.siteNumber } : {}),
        ...(input.siteType ? { siteType: input.siteType as any } : {}),
        ...(input.maxOccupancy !== undefined ? { maxOccupancy: input.maxOccupancy } : {}),
        ...(input.rigMaxLength !== undefined ? { rigMaxLength: input.rigMaxLength } : {})
      }
    });
    await this.webhook.emit("site.updated", campgroundId, { siteId: updated.id });
    return updated;
  }

  async deleteSite(campgroundId: string, id: string) {
    await this.getSite(campgroundId, id);
    const deleted = await this.prisma.site.delete({ where: { id } });
    await this.webhook.emit("site.deleted", campgroundId, { siteId: id });
    return deleted;
  }
}
