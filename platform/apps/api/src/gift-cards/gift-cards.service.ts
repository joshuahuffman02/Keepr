import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StoredValueStatus } from "@prisma/client";
import { StoredValueService } from "../stored-value/stored-value.service";
import { postBalancedLedgerEntries } from "../ledger/ledger-posting.util";
import type { AuthUser } from "../auth/auth.types";
import { randomUUID } from "crypto";

type RedemptionChannel = "booking" | "pos";

export type GiftCardRecord = {
  code: string;
  balanceCents: number;
  currency?: string;
  kind?: "gift_card" | "store_credit";
  accountId?: string;
};

type LedgerEntryInput = {
  campgroundId: string;
  reservationId?: string;
  glCode: string;
  account: string;
  description: string;
  amountCents: number;
  direction: "debit" | "credit";
  externalRef?: string | null;
  dedupeKey?: string;
};

type GiftCardActor = AuthUser & {
  campgroundId: string;
  tenantId?: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

@Injectable()
export class GiftCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storedValue: StoredValueService,
  ) {}

  /**
   * Get balance for a gift card code
   */
  async getBalance(code: string): Promise<number | null> {
    const card = await this.loadCard(code);
    return card?.balanceCents ?? null;
  }

  /**
   * Lookup a gift card by code
   */
  async lookup(code: string): Promise<GiftCardRecord | null> {
    return this.loadCard(code);
  }

  async redeemAgainstBooking(
    code: string,
    amountCents: number,
    bookingId: string,
    actor?: GiftCardActor,
  ) {
    if (!code) throw new BadRequestException("Gift card code is required to process redemption");
    if (!amountCents || amountCents <= 0)
      throw new BadRequestException("Redemption amount must be greater than zero");
    if (!actor?.campgroundId) {
      throw new BadRequestException("campground context required");
    }

    const card = await this.loadCard(code);
    if (!card)
      throw new NotFoundException(
        "Gift card or store credit not found. Please verify the code and try again",
      );
    if (card.balanceCents < amountCents)
      throw new BadRequestException(
        `Gift card has insufficient balance. Available: $${(card.balanceCents / 100).toFixed(2)}, Required: $${(amountCents / 100).toFixed(2)}`,
      );

    // Wrap everything in a transaction: redeem stored value + create payment + update reservation + post ledger entries
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock the reservation to prevent concurrent modifications
      const [lockedReservation] = await tx.$queryRaw<
        Array<{
          id: string;
          campgroundId: string;
          guestId: string;
          siteId: string;
          paidAmount: number | null;
          totalAmount: number;
          status: string;
        }>
      >`
        SELECT id, "campgroundId", "guestId", "siteId", "paidAmount", "totalAmount", status
        FROM "Reservation"
        WHERE id = ${bookingId}
        FOR UPDATE
      `;
      if (!lockedReservation) throw new NotFoundException("Reservation not found");
      if (lockedReservation.campgroundId !== actor.campgroundId) {
        throw new ForbiddenException("You do not have access to this campground");
      }

      // 2. Redeem the stored value (debits the gift card balance)
      const redeemResult = await this.storedValue.redeem(
        {
          code,
          amountCents,
          currency: card.currency ?? "usd",
          redeemCampgroundId: actor?.campgroundId ?? undefined,
          referenceType: "reservation",
          referenceId: bookingId,
          channel: "booking",
        },
        undefined,
        actor,
      );
      const redeemedBalanceCents =
        isRecord(redeemResult) && typeof redeemResult.balanceCents === "number"
          ? redeemResult.balanceCents
          : card.balanceCents - amountCents;

      // 3. Calculate new paid amount
      const newPaid = (lockedReservation.paidAmount ?? 0) + amountCents;
      const newBalance = lockedReservation.totalAmount - newPaid;

      // 4. Determine payment status fields based on new balance
      const paymentFields = this.buildPaymentFields(lockedReservation.totalAmount, newPaid);

      // 5. Update reservation with new paid amount and status
      await tx.reservation.update({
        where: { id: bookingId },
        data: {
          paidAmount: newPaid,
          ...paymentFields,
        },
      });

      // 6. Create Payment record
      const paymentRef = `GIFT-${code}-${Date.now()}`;
      await tx.payment.create({
        data: {
          id: randomUUID(),
          campgroundId: lockedReservation.campgroundId,
          reservationId: bookingId,
          amountCents,
          method: "gift_card",
          direction: "charge",
          note: `Gift card redemption: ${code}`,
          capturedAt: new Date(),
        },
      });

      // 7. Get site info for GL codes
      const site = await tx.site.findUnique({
        where: { id: lockedReservation.siteId },
        include: { SiteClass: true },
      });

      const revenueGl = site?.SiteClass?.glCode ?? "REVENUE_UNMAPPED";
      const revenueAccount = site?.SiteClass?.clientAccount ?? "Revenue";

      // 8. Post balanced ledger entries
      // Debit: Stored Value Liability (decrease liability as card is redeemed)
      // Credit: Site Revenue (recognize revenue)
      const ledgerEntries: LedgerEntryInput[] = [
        {
          campgroundId: lockedReservation.campgroundId,
          reservationId: bookingId,
          glCode: "STORED_VALUE_LIABILITY",
          account: "Gift Card Liability",
          description: `Gift card redemption: ${code}`,
          amountCents,
          direction: "debit",
          externalRef: paymentRef,
          dedupeKey: `res:${bookingId}:gift-card:${paymentRef}:debit`,
        },
        {
          campgroundId: lockedReservation.campgroundId,
          reservationId: bookingId,
          glCode: revenueGl,
          account: revenueAccount,
          description: `Gift card redemption: ${code}`,
          amountCents,
          direction: "credit",
          externalRef: paymentRef,
          dedupeKey: `res:${bookingId}:gift-card:${paymentRef}:credit`,
        },
      ];

      await postBalancedLedgerEntries(tx, ledgerEntries);

      return {
        code,
        balanceCents: redeemedBalanceCents,
        redeemedCents: amountCents,
        channel: "booking",
        referenceId: bookingId,
        reservationPaidAmount: newPaid,
        reservationBalance: newBalance,
      };
    });
  }

  async redeemAgainstPosOrder(
    code: string,
    amountCents: number,
    orderId: string,
    actor?: GiftCardActor,
  ) {
    if (!actor?.campgroundId) {
      throw new BadRequestException("campground context required");
    }
    const order = await this.prisma.storeOrder.findUnique({
      where: { id: orderId },
      select: { id: true, campgroundId: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.campgroundId !== actor.campgroundId) {
      throw new ForbiddenException("You do not have access to this campground");
    }
    return this.redeem(code, amountCents, { channel: "pos", referenceId: orderId }, actor);
  }

  private async redeem(
    code: string,
    amountCents: number,
    context: { channel: RedemptionChannel; referenceId: string },
    actor?: GiftCardActor,
  ) {
    if (!code) throw new BadRequestException("Gift card code is required to process purchase");
    if (!amountCents || amountCents <= 0)
      throw new BadRequestException("Purchase amount must be greater than zero");

    const card = await this.loadCard(code);
    if (!card)
      throw new NotFoundException(
        "Gift card or store credit not found. Please verify the code and try again",
      );
    if (card.balanceCents < amountCents)
      throw new BadRequestException(
        `Gift card has insufficient balance. Available: $${(card.balanceCents / 100).toFixed(2)}, Required: $${(amountCents / 100).toFixed(2)}`,
      );

    const result = await this.storedValue.redeem(
      {
        code,
        amountCents,
        currency: card.currency ?? "usd",
        redeemCampgroundId: actor?.campgroundId ?? undefined,
        referenceType: context.channel === "booking" ? "reservation" : "pos_order",
        referenceId: context.referenceId,
        channel: context.channel,
      },
      undefined,
      actor,
    );

    return {
      code,
      balanceCents:
        isRecord(result) && typeof result.balanceCents === "number"
          ? result.balanceCents
          : card.balanceCents - amountCents,
      redeemedCents: amountCents,
      channel: context.channel,
      referenceId: context.referenceId,
    };
  }

  private async loadCard(code: string): Promise<GiftCardRecord | null> {
    // Look up in StoredValueCode table
    const storedValueCode = await this.prisma.storedValueCode.findUnique({
      where: { code },
      include: {
        StoredValueAccount: true,
      },
    });

    if (
      storedValueCode &&
      storedValueCode.active &&
      storedValueCode.StoredValueAccount.status === StoredValueStatus.active
    ) {
      const { balanceCents } = await this.storedValue.balanceByAccount(storedValueCode.accountId);
      const kind =
        storedValueCode.StoredValueAccount.type === "gift" ? "gift_card" : "store_credit";

      return {
        code,
        balanceCents,
        currency: storedValueCode.StoredValueAccount.currency,
        kind,
        accountId: storedValueCode.accountId,
      };
    }

    return null;
  }

  /**
   * Build payment status fields based on total and paid amounts
   * Follows same logic as ReservationsService.buildPaymentFields
   */
  private buildPaymentFields(totalAmount: number, paidAmount: number) {
    const balanceAmount = totalAmount - paidAmount;

    if (paidAmount <= 0) {
      return {
        balanceAmount,
        paymentStatus: "unpaid",
        paymentStatusAt: null,
      };
    } else if (balanceAmount <= 0) {
      return {
        balanceAmount: 0,
        paymentStatus: "paid",
        paymentStatusAt: new Date(),
      };
    } else {
      return {
        balanceAmount,
        paymentStatus: "partial",
        paymentStatusAt: new Date(),
      };
    }
  }
}
