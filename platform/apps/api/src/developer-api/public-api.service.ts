import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookService, WebhookEvent } from "./webhook.service";
import { GuestsService } from "../guests/guests.service";
import { PricingV2Service } from "../pricing-v2/pricing-v2.service";
import { evaluatePricingV2 } from "../reservations/reservation-pricing";
import { DepositPoliciesService } from "../deposit-policies/deposit-policies.service";
import { calculateReservationDepositV2 } from "../reservations/reservation-deposit";
import { AuditService } from "../audit/audit.service";
import { postBalancedLedgerEntries } from "../ledger/ledger-posting.util";

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
  // Pricing override (requires validation)
  totalAmountOverride?: number;
  overrideReason?: string;
  promoCode?: string;
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
    private readonly guests: GuestsService,
    private readonly pricingV2Service: PricingV2Service,
    private readonly depositPoliciesService: DepositPoliciesService,
    private readonly audit: AuditService
  ) { }

  private computePaymentStatus(total: number, paid: number): string {
    if (!total || total <= 0) return "unpaid";
    if (paid >= total) return "paid";
    if (paid > 0) return "partial";
    return "unpaid";
  }

  private buildPaymentFields(totalAmount: number, paidAmount: number) {
    const balanceAmount = Math.max(0, totalAmount - paidAmount);
    const paymentStatus = this.computePaymentStatus(totalAmount, paidAmount);
    return { balanceAmount, paymentStatus };
  }

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

  /**
   * Calculate occupancy percentage for demand-based pricing
   */
  private async calculateOccupancy(campgroundId: string, arrivalDate: Date): Promise<number> {
    const totalSites = await this.prisma.site.count({
      where: { campgroundId, isActive: true }
    });
    if (totalSites === 0) return 0;

    const occupiedSites = await this.prisma.reservation.count({
      where: {
        campgroundId,
        arrivalDate: { lte: arrivalDate },
        departureDate: { gt: arrivalDate },
        status: { in: ["confirmed", "checked_in", "pending"] }
      }
    });

    return Math.round((occupiedSites / totalSites) * 100);
  }

  async createReservation(campgroundId: string, input: ApiReservationInput) {
    await this.assertSiteInCampground(input.siteId, campgroundId);

    const arrival = new Date(input.arrivalDate);
    const departure = new Date(input.departureDate);

    // Calculate occupancy for demand-based pricing
    const occupancyPct = await this.calculateOccupancy(campgroundId, arrival);

    // Calculate pricing using the shared pricing engine
    const pricing = await evaluatePricingV2(
      this.prisma,
      this.pricingV2Service,
      campgroundId,
      input.siteId,
      arrival,
      departure,
      occupancyPct
    );

    // Get campground discount cap setting
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { maxDiscountFraction: true }
    });
    const maxDiscountFraction = (campground as any)?.maxDiscountFraction ?? 0.4;

    // Determine final amount and validate override if provided
    let totalAmount = pricing.totalCents;
    let pricingSource = "calculated";

    if (input.totalAmountOverride !== undefined && input.totalAmountOverride !== null) {
      const overrideDelta = input.totalAmountOverride - pricing.totalCents;
      const discountPct = overrideDelta < 0
        ? Math.abs(overrideDelta) / pricing.totalCents
        : 0;

      // Validate against discount cap
      if (discountPct > maxDiscountFraction) {
        throw new BadRequestException(
          `Override exceeds maximum discount cap of ${Math.round(maxDiscountFraction * 100)}%`
        );
      }

      if (!input.overrideReason) {
        throw new BadRequestException(
          "overrideReason is required when providing totalAmountOverride"
        );
      }

      totalAmount = input.totalAmountOverride;
      pricingSource = "api_override";

      // Audit the override
      await this.audit.record({
        campgroundId,
        actorId: null,
        action: "api_pricing_override",
        entity: "reservation",
        entityId: null,
        before: { calculatedTotal: pricing.totalCents },
        after: {
          overrideTotal: totalAmount,
          reason: input.overrideReason,
          discountPercent: Math.round(discountPct * 100)
        }
      });
    }

    // Calculate deposit
    const site = await this.prisma.site.findUnique({
      where: { id: input.siteId },
      select: { siteClassId: true }
    });

    const depositCalc = await calculateReservationDepositV2(this.depositPoliciesService, {
      campgroundId,
      siteClassId: site?.siteClassId ?? null,
      totalAmountCents: totalAmount,
      lodgingOnlyCents: pricing.baseSubtotalCents,
      nights: pricing.nights
    });

    const created = await this.prisma.reservation.create({
      data: {
        campgroundId,
        siteId: input.siteId,
        siteLocked: input.siteLocked ?? false,
        guestId: input.guestId,
        arrivalDate: arrival,
        departureDate: departure,
        adults: input.adults,
        children: input.children ?? 0,
        status: (input.status as any) || "confirmed",
        notes: input.notes || null,
        source: "api",
        // PRICING FIELDS (previously missing!)
        totalAmount,
        baseSubtotal: pricing.baseSubtotalCents,
        feesAmount: 0,
        taxesAmount: 0,
        discountsAmount: pricing.rulesDeltaCents < 0 ? Math.abs(pricing.rulesDeltaCents) : 0,
        paidAmount: 0,
        balanceAmount: totalAmount,
        paymentStatus: "unpaid",
        depositAmount: depositCalc.depositAmount,
        depositPolicyVersion: depositCalc.depositPolicyVersion ?? null,
        pricingRuleVersion: pricingSource === "api_override" ? "api_override" : pricing.pricingRuleVersion,
        promoCode: input.promoCode ?? null
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
    if (amountCents <= 0) {
      throw new BadRequestException("Payment amount must be positive");
    }

    const paymentRef = `api-${method}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Wrap entire operation in transaction with row-level locking to prevent race conditions
    const { payment, updated } = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Lock the reservation row using SELECT FOR UPDATE to prevent concurrent modifications
      const [lockedReservation] = await tx.$queryRaw<Array<{
        id: string;
        campgroundId: string;
        siteId: string;
        paidAmount: number | null;
        totalAmount: number;
      }>>`
        SELECT id, "campgroundId", "siteId", "paidAmount", "totalAmount"
        FROM "Reservation"
        WHERE id = ${reservationId} AND "campgroundId" = ${campgroundId}
        FOR UPDATE
      `;
      if (!lockedReservation) {
        throw new NotFoundException("Reservation not found for this campground");
      }

      // Calculate new paid amount atomically with the locked row
      const newPaid = (lockedReservation.paidAmount ?? 0) + amountCents;
      const paymentFields = this.buildPaymentFields(lockedReservation.totalAmount, newPaid);

      // Get site class for GL code mapping
      const site = await tx.site.findUnique({
        where: { id: lockedReservation.siteId },
        include: { SiteClass: true }
      });

      const revenueGl = site?.siteClass?.glCode ?? "REVENUE_UNMAPPED";
      const revenueAccount = site?.siteClass?.clientAccount ?? "Revenue";

      // Update reservation with new payment totals
      const updatedReservation = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          paidAmount: newPaid,
          ...paymentFields
        }
      });

      // Create payment record
      const paymentRecord = await tx.payment.create({
        data: {
          campgroundId,
          reservationId,
          amountCents,
          method,
          direction: "charge",
          note: "API payment"
        }
      });

      // Post balanced ledger entries (debit cash, credit revenue)
      await postBalancedLedgerEntries(tx, [
        {
          campgroundId,
          reservationId,
          glCode: "CASH",
          account: "Cash",
          description: `API payment (${method})`,
          amountCents,
          direction: "debit",
          externalRef: paymentRef,
          dedupeKey: `api:${reservationId}:payment:${paymentRef}:debit`
        },
        {
          campgroundId,
          reservationId,
          glCode: revenueGl,
          account: revenueAccount,
          description: `API payment (${method})`,
          amountCents,
          direction: "credit",
          externalRef: paymentRef,
          dedupeKey: `api:${reservationId}:payment:${paymentRef}:credit`
        }
      ]);

      return { payment: paymentRecord, updated: updatedReservation };
    });

    // Audit the payment
    try {
      await this.audit.record({
        campgroundId,
        actorId: null,
        action: "api.payment.recorded",
        entity: "reservation",
        entityId: reservationId,
        before: {
          paidAmount: updated.paidAmount ? updated.paidAmount - amountCents : 0
        },
        after: {
          paidAmount: updated.paidAmount,
          paymentMethod: method,
          paymentAmount: amountCents,
          paymentId: payment.id
        }
      });
    } catch {
      // Audit failures shouldn't fail the payment
    }

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
          include: { Site: { select: { id: true, name: true, siteNumber: true } } }
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
