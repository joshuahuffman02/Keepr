import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StoredValueDirection, StoredValueStatus } from "@prisma/client";

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
  constructor(private readonly prisma: PrismaService) {}

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

  async redeemAgainstBooking(code: string, amountCents: number, bookingId: string) {
    return this.redeem(code, amountCents, { channel: "booking", referenceId: bookingId });
  }

  async redeemAgainstPosOrder(code: string, amountCents: number, orderId: string) {
    return this.redeem(code, amountCents, { channel: "pos", referenceId: orderId });
  }

  private async redeem(
    code: string,
    amountCents: number,
    context: { channel: RedemptionChannel; referenceId: string }
  ) {
    if (!code) throw new BadRequestException("code is required");
    if (!amountCents || amountCents <= 0) throw new BadRequestException("amount must be positive");

    const card = await this.loadCard(code);
    if (!card) throw new NotFoundException("Gift card or store credit not found");
    if (card.balanceCents < amountCents) throw new BadRequestException("Insufficient balance");

    // Use database transaction for proper persistence
    const result = await this.prisma.$transaction(async (tx) => {
      // Get current balance from ledger
      const ledgerAgg = await tx.storedValueLedger.aggregate({
        where: { accountId: card.accountId },
        _sum: {
          amountCents: true
        }
      });

      const currentBalance = ledgerAgg._sum.amountCents ?? 0;
      if (currentBalance < amountCents) {
        throw new BadRequestException("Insufficient balance");
      }

      const afterBalance = currentBalance - amountCents;

      // Create ledger entry for the redemption
      await tx.storedValueLedger.create({
        data: {
          campgroundId: card.accountId ? (await tx.storedValueAccount.findUnique({ where: { id: card.accountId } }))?.campgroundId ?? "unknown" : "unknown",
          accountId: card.accountId!,
          direction: StoredValueDirection.redeem,
          amountCents: -amountCents, // Negative for redemption
          currency: card.currency ?? "usd",
          beforeBalanceCents: currentBalance,
          afterBalanceCents: afterBalance,
          referenceType: context.channel === "booking" ? "reservation" : "pos_order",
          referenceId: context.referenceId,
          idempotencyKey: `redeem-${code}-${context.referenceId}-${Date.now()}`,
          channel: context.channel,
          reason: `Redeemed against ${context.channel}`
        }
      });

      return afterBalance;
    });

    return {
      code,
      balanceCents: result,
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
      // Calculate balance from ledger
      const ledgerAgg = await this.prisma.storedValueLedger.aggregate({
        where: { accountId: storedValueCode.accountId },
        _sum: {
          amountCents: true
        }
      });

      const balanceCents = ledgerAgg._sum.amountCents ?? 0;

      return {
        code,
        balanceCents,
        currency: storedValueCode.account.currency,
        kind: storedValueCode.account.type === "gift_card" ? "gift_card" : "store_credit",
        accountId: storedValueCode.accountId
      };
    }

    return null;
  }
}

