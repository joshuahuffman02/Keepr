import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { isRecord } from "../utils/type-guards";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

type FlexCheckPolicyUpdate = {
  earlyCheckInEnabled?: boolean;
  earlyCheckInMinHours?: number;
  earlyCheckInPricing?: unknown;
  earlyCheckInAutoApprove?: boolean;
  lateCheckoutEnabled?: boolean;
  lateCheckoutMaxHours?: number;
  lateCheckoutPricing?: unknown;
  lateCheckoutAutoApprove?: boolean;
};

type FlexCheckPricing =
  | { type: "flat"; amount: number }
  | { type: "hourly"; amountPerHour: number }
  | { type: "percentage"; percent?: number };

const parseFlexCheckPricing = (value: unknown): FlexCheckPricing | null => {
  if (!isRecord(value)) return null;
  const typeValue = value.type;
  if (typeValue === "flat" && typeof value.amount === "number") {
    return { type: "flat", amount: value.amount };
  }
  if (typeValue === "hourly" && typeof value.amountPerHour === "number") {
    return { type: "hourly", amountPerHour: value.amountPerHour };
  }
  if (typeValue === "percentage") {
    const percent = typeof value.percent === "number" ? value.percent : undefined;
    return { type: "percentage", percent };
  }
  return null;
};

const toNullableJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

@Injectable()
export class FlexCheckService {
  constructor(private prisma: PrismaService) {}

  // ==================== FLEX CHECK POLICY ====================

  async getPolicy(campgroundId: string) {
    const policy = await this.prisma.flexCheckPolicy.findUnique({
      where: { campgroundId },
    });

    if (!policy) {
      // Return default policy if none exists
      return {
        campgroundId,
        earlyCheckInEnabled: false,
        earlyCheckInMinHours: null,
        earlyCheckInPricing: null,
        earlyCheckInAutoApprove: false,
        lateCheckoutEnabled: false,
        lateCheckoutMaxHours: null,
        lateCheckoutPricing: null,
        lateCheckoutAutoApprove: false,
      };
    }

    return policy;
  }

  async upsertPolicy(campgroundId: string, data: FlexCheckPolicyUpdate) {
    const { earlyCheckInPricing, lateCheckoutPricing, ...rest } = data;
    return this.prisma.flexCheckPolicy.upsert({
      where: { campgroundId },
      update: {
        ...rest,
        earlyCheckInPricing: toNullableJsonInput(earlyCheckInPricing),
        lateCheckoutPricing: toNullableJsonInput(lateCheckoutPricing),
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        campgroundId,
        ...rest,
        earlyCheckInPricing: toNullableJsonInput(earlyCheckInPricing),
        lateCheckoutPricing: toNullableJsonInput(lateCheckoutPricing),
        updatedAt: new Date(),
      },
    });
  }

  // ==================== EARLY CHECK-IN ====================

  async requestEarlyCheckIn(reservationId: string, requestedTime: Date) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { Campground: true },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    const policy = await this.getPolicy(reservation.campgroundId);

    if (!policy.earlyCheckInEnabled) {
      throw new BadRequestException("Early check-in is not enabled for this property");
    }

    // Calculate hours before standard check-in
    const arrivalDate = new Date(reservation.arrivalDate);
    const standardCheckIn = new Date(arrivalDate);
    standardCheckIn.setHours(15, 0, 0, 0); // Assume 3 PM standard check-in

    const hoursEarly = (standardCheckIn.getTime() - requestedTime.getTime()) / (1000 * 60 * 60);

    if (policy.earlyCheckInMinHours && hoursEarly > policy.earlyCheckInMinHours) {
      throw new BadRequestException(
        `Early check-in requests cannot exceed ${policy.earlyCheckInMinHours} hours before standard check-in`,
      );
    }

    // Calculate charge based on pricing policy
    let charge = 0;
    if (policy.earlyCheckInPricing) {
      const pricing = parseFlexCheckPricing(policy.earlyCheckInPricing);
      if (pricing?.type === "flat") {
        charge = pricing.amount;
      } else if (pricing?.type === "hourly") {
        charge = Math.ceil(hoursEarly) * pricing.amountPerHour;
      } else if (pricing?.type === "percentage") {
        // Would need to calculate based on nightly rate
        charge = 0; // Simplified for now
      }
    }

    // Auto-approve if policy allows
    const autoApprove = policy.earlyCheckInAutoApprove;

    const updated = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        earlyCheckInRequested: requestedTime,
        earlyCheckInApproved: autoApprove ? true : null,
        earlyCheckInCharge: charge,
      },
    });

    return {
      reservation: updated,
      approved: autoApprove,
      charge,
      message: autoApprove
        ? "Early check-in approved automatically"
        : "Early check-in request submitted for approval",
    };
  }

  async approveEarlyCheckIn(reservationId: string, approvedById: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    if (!reservation.earlyCheckInRequested) {
      throw new BadRequestException("No early check-in request found");
    }

    // Charge is stored on reservation; ledger integration would be added here for full accounting
    return this.prisma.reservation.update({
      where: { id: reservationId },
      data: { earlyCheckInApproved: true },
    });
  }

  async denyEarlyCheckIn(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    return this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        earlyCheckInApproved: false,
        earlyCheckInCharge: 0,
      },
    });
  }

  // ==================== LATE CHECKOUT ====================

  async requestLateCheckout(reservationId: string, requestedTime: Date) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { Campground: true, Site: true },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    const policy = await this.getPolicy(reservation.campgroundId);

    if (!policy.lateCheckoutEnabled) {
      throw new BadRequestException("Late checkout is not enabled for this property");
    }

    // Calculate hours after standard checkout
    const departureDate = new Date(reservation.departureDate);
    const standardCheckout = new Date(departureDate);
    standardCheckout.setHours(11, 0, 0, 0); // Assume 11 AM standard checkout

    const hoursLate = (requestedTime.getTime() - standardCheckout.getTime()) / (1000 * 60 * 60);

    if (policy.lateCheckoutMaxHours && hoursLate > policy.lateCheckoutMaxHours) {
      throw new BadRequestException(
        `Late checkout requests cannot exceed ${policy.lateCheckoutMaxHours} hours after standard checkout`,
      );
    }

    // Check if there's a same-day arrival that would conflict
    const conflictingReservation = await this.prisma.reservation.findFirst({
      where: {
        siteId: reservation.siteId,
        arrivalDate: departureDate,
        status: { in: ["confirmed", "pending"] },
        id: { not: reservationId },
      },
    });

    if (conflictingReservation) {
      throw new BadRequestException("Late checkout not available - incoming guest on same day");
    }

    // Calculate charge based on pricing policy
    let charge = 0;
    if (policy.lateCheckoutPricing) {
      const pricing = parseFlexCheckPricing(policy.lateCheckoutPricing);
      if (pricing?.type === "flat") {
        charge = pricing.amount;
      } else if (pricing?.type === "hourly") {
        charge = Math.ceil(hoursLate) * pricing.amountPerHour;
      }
    }

    // Auto-approve if policy allows and no conflict
    const autoApprove = policy.lateCheckoutAutoApprove && !conflictingReservation;

    const updated = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        lateCheckoutRequested: requestedTime,
        lateCheckoutApproved: autoApprove ? true : null,
        lateCheckoutCharge: charge,
      },
    });

    return {
      reservation: updated,
      approved: autoApprove,
      charge,
      message: autoApprove
        ? "Late checkout approved automatically"
        : "Late checkout request submitted for approval",
    };
  }

  async approveLateCheckout(reservationId: string, approvedById: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    if (!reservation.lateCheckoutRequested) {
      throw new BadRequestException("No late checkout request found");
    }

    // Charge is stored on reservation; ledger integration would be added here for full accounting
    return this.prisma.reservation.update({
      where: { id: reservationId },
      data: { lateCheckoutApproved: true },
    });
  }

  async denyLateCheckout(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    return this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        lateCheckoutApproved: false,
        lateCheckoutCharge: 0,
      },
    });
  }

  // ==================== PENDING REQUESTS ====================

  async getPendingRequests(campgroundId: string) {
    const earlyCheckInRequests = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        earlyCheckInRequested: { not: null },
        earlyCheckInApproved: null,
      },
      include: {
        Guest: { select: { primaryFirstName: true, primaryLastName: true } },
        Site: { select: { name: true } },
      },
    });

    const lateCheckoutRequests = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        lateCheckoutRequested: { not: null },
        lateCheckoutApproved: null,
      },
      include: {
        Guest: { select: { primaryFirstName: true, primaryLastName: true } },
        Site: { select: { name: true } },
      },
    });

    return {
      earlyCheckIn: earlyCheckInRequests.map((r) => ({
        reservationId: r.id,
        guestName: `${r.Guest.primaryFirstName} ${r.Guest.primaryLastName}`,
        siteName: r.Site.name,
        requestedTime: r.earlyCheckInRequested,
        arrivalDate: r.arrivalDate,
        proposedCharge: r.earlyCheckInCharge,
      })),
      lateCheckout: lateCheckoutRequests.map((r) => ({
        reservationId: r.id,
        guestName: `${r.Guest.primaryFirstName} ${r.Guest.primaryLastName}`,
        siteName: r.Site.name,
        requestedTime: r.lateCheckoutRequested,
        departureDate: r.departureDate,
        proposedCharge: r.lateCheckoutCharge,
      })),
    };
  }
}
