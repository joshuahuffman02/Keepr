import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StoredValueStatus } from "@prisma/client";
import { StoredValueService } from "../stored-value/stored-value.service";

type RedemptionChannel = "booking" | "pos";

export type GiftCardRecord = {
  code: string;
  balanceCents: number;
  currency?: string;
  kind?: "gift_card" | "store_credit";
  accountId?: string;
};

@Injectable()
export class GiftCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storedValue: StoredValueService
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

  async redeemAgainstBooking(code: string, amountCents: number, bookingId: string, actor?: any) {
    return this.redeem(code, amountCents, { channel: "booking", referenceId: bookingId }, actor);
  }

  async redeemAgainstPosOrder(code: string, amountCents: number, orderId: string, actor?: any) {
    return this.redeem(code, amountCents, { channel: "pos", referenceId: orderId }, actor);
  }

  private async redeem(
    code: string,
    amountCents: number,
    context: { channel: RedemptionChannel; referenceId: string },
    actor?: any
  ) {
    if (!code) throw new BadRequestException("code is required");
    if (!amountCents || amountCents <= 0) throw new BadRequestException("amount must be positive");

    const card = await this.loadCard(code);
    if (!card) throw new NotFoundException("Gift card or store credit not found");
    if (card.balanceCents < amountCents) throw new BadRequestException("Insufficient balance");

    const result = await this.storedValue.redeem(
      {
        code,
        amountCents,
        currency: card.currency ?? "usd",
        redeemCampgroundId: actor?.campgroundId ?? null,
        referenceType: context.channel === "booking" ? "reservation" : "pos_order",
        referenceId: context.referenceId,
        channel: context.channel
      },
      undefined,
      actor
    );

    return {
      code,
      balanceCents: result.balanceCents ?? card.balanceCents - amountCents,
      redeemedCents: amountCents,
      channel: context.channel,
      referenceId: context.referenceId
    };
  }

  private async loadCard(code: string): Promise<GiftCardRecord | null> {
    // Look up in StoredValueCode table
    const storedValueCode = await this.prisma.storedValueCode.findUnique({
      where: { code },
      include: {
        account: true
      }
    });

    if (storedValueCode && storedValueCode.active && storedValueCode.account.status === StoredValueStatus.active) {
      const { balanceCents } = await this.storedValue.balanceByAccount(storedValueCode.accountId);
      const kind = storedValueCode.account.type === "gift" ? "gift_card" : "store_credit";

      return {
        code,
        balanceCents,
        currency: storedValueCode.account.currency,
        kind,
        accountId: storedValueCode.accountId
      };
    }

    return null;
  }
}
