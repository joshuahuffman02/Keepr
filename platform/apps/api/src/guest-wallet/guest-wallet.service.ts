import type { Request } from "express";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IdempotencyService } from "../idempotency/idempotency.service";
import {
  IdempotencyStatus,
  StoredValueDirection,
  StoredValueStatus,
  StoredValueType,
  type IdempotencyRecord,
  type Prisma,
} from "@prisma/client";
import { randomUUID } from "crypto";
import {
  AddWalletCreditDto,
  DebitWalletDto,
  TransferToWalletDto,
  WalletBalance,
  WalletCreditResult,
  WalletDebitResult,
  WalletTransaction,
} from "./guest-wallet.dto";

type WalletScopeType = "campground" | "organization" | "global";

type NormalizedScope = {
  scopeType: WalletScopeType;
  scopeId: string | null;
};

type WalletScopeCarrier = {
  scopeType?: string | null;
  scopeId?: string | null;
  campgroundId?: string | null;
};

type WalletCandidate = {
  id: string;
  guestId: string | null;
  campgroundId: string;
  scopeType: string | null;
  scopeId: string | null;
  currency: string;
  status: StoredValueStatus;
};

type WalletCandidateWithScope = WalletCandidate & NormalizedScope;

type WalletActor = {
  id?: string | null;
  role?: string | null;
};

type IdempotencyScope = {
  campgroundId?: string | null;
};

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isWalletCreditResult = (value: unknown): value is WalletCreditResult => {
  if (!isRecord(value)) {
    return false;
  }
  const walletId = value["walletId"];
  const balanceCents = value["balanceCents"];
  const transactionId = value["transactionId"];
  return (
    typeof walletId === "string" &&
    typeof balanceCents === "number" &&
    typeof transactionId === "string"
  );
};

@Injectable()
export class GuestWalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * Get or create a wallet for a guest at a campground
   */
  async getOrCreateWallet(
    campgroundId: string,
    guestId: string,
    currency: string = "usd",
    scopeType?: "campground" | "organization" | "global",
    scopeId?: string,
  ): Promise<{ id: string; isNew: boolean }> {
    const scope = await this.resolveWalletScope(campgroundId, scopeType, scopeId);

    // Check if wallet already exists
    const existing = await this.prisma.storedValueAccount.findFirst({
      where: {
        guestId,
        status: StoredValueStatus.active,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
      },
    });

    if (existing) {
      return { id: existing.id, isNew: false };
    }

    // Create new wallet
    const wallet = await this.prisma.storedValueAccount.create({
      data: {
        id: randomUUID(),
        campgroundId,
        guestId,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        type: StoredValueType.credit, // Guest wallets are always "credit" type
        currency: currency.toLowerCase(),
        status: StoredValueStatus.active,
        issuedAt: new Date(),
        createdVia: "guest_wallet",
        metadata: { isGuestWallet: true },
        updatedAt: new Date(),
      },
    });

    return { id: wallet.id, isNew: true };
  }

  /**
   * Find wallet for a guest at a campground
   */
  async findWallet(
    campgroundId: string,
    guestId: string,
  ): Promise<{
    id: string;
    currency: string;
    scopeType: WalletScopeType;
    scopeId: string | null;
  } | null> {
    const organizationId = await this.getOrganizationIdForCampground(campgroundId);
    const wallets = await this.fetchWalletCandidates(
      this.prisma,
      campgroundId,
      guestId,
      organizationId,
    );
    const preferred = this.selectPreferredWallet(wallets, campgroundId, organizationId);
    if (!preferred) return null;
    return {
      id: preferred.id,
      currency: preferred.currency,
      scopeType: preferred.scopeType,
      scopeId: preferred.scopeId ?? preferred.campgroundId ?? null,
    };
  }

  /**
   * Get wallet balance
   */
  async getBalance(walletId: string): Promise<WalletBalance> {
    const wallet = await this.prisma.storedValueAccount.findUnique({
      where: { id: walletId },
      select: {
        id: true,
        guestId: true,
        campgroundId: true,
        scopeType: true,
        scopeId: true,
        currency: true,
        status: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException("Wallet not found");
    }

    if (!wallet.guestId) {
      throw new BadRequestException("Not a guest wallet");
    }

    const { balanceCents, availableCents } = await this.computeBalance(walletId);

    return {
      walletId: wallet.id,
      guestId: wallet.guestId,
      campgroundId: wallet.campgroundId,
      scopeType: wallet.scopeType ?? "campground",
      scopeId: wallet.scopeId ?? wallet.campgroundId ?? null,
      balanceCents,
      availableCents,
      currency: wallet.currency,
    };
  }

  /**
   * Get balance for a guest at a campground (creates wallet if needed)
   */
  async getGuestBalance(campgroundId: string, guestId: string): Promise<WalletBalance> {
    const { id: walletId } = await this.getOrCreateWallet(
      campgroundId,
      guestId,
      "usd",
      "campground",
      campgroundId,
    );
    return this.getBalance(walletId);
  }

  async resolveWalletForGuest(guestId: string, walletId: string, campgroundId?: string) {
    const wallet = await this.prisma.storedValueAccount.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.guestId !== guestId || wallet.status !== StoredValueStatus.active) {
      return null;
    }
    if (campgroundId) {
      const organizationId = await this.getOrganizationIdForCampground(campgroundId);
      this.assertWalletRedeemable(wallet, campgroundId, organizationId);
    }
    return wallet;
  }

  /**
   * Add credit to a guest's wallet (staff action)
   */
  async addCredit(
    campgroundId: string,
    dto: AddWalletCreditDto,
    idempotencyKey?: string,
    actor?: WalletActor,
  ): Promise<WalletCreditResult> {
    const scope = { campgroundId };
    const key = idempotencyKey ?? `wallet-credit-${dto.guestId}-${Date.now()}`;

    // Check idempotency
    const existing = await this.guardIdempotency(key, dto, scope, "guest-wallet/credit");
    if (existing?.status === IdempotencyStatus.succeeded && existing.responseJson) {
      const cached = isWalletCreditResult(existing.responseJson) ? existing.responseJson : null;
      if (cached) {
        return cached;
      }
    }
    if (
      existing?.status === IdempotencyStatus.inflight &&
      existing.createdAt &&
      Date.now() - new Date(existing.createdAt).getTime() < 60000
    ) {
      throw new ConflictException("Request already in progress");
    }

    const currency = dto.currency?.toLowerCase() ?? "usd";
    const walletScope = await this.resolveWalletScope(campgroundId, dto.scopeType, dto.scopeId);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Get or create wallet
        let wallet = await tx.storedValueAccount.findFirst({
          where: {
            guestId: dto.guestId,
            status: StoredValueStatus.active,
            scopeType: walletScope.scopeType,
            scopeId: walletScope.scopeId,
          },
        });

        if (!wallet) {
          wallet = await tx.storedValueAccount.create({
            data: {
              id: randomUUID(),
              campgroundId,
              guestId: dto.guestId,
              scopeType: walletScope.scopeType,
              scopeId: walletScope.scopeId,
              type: StoredValueType.credit,
              currency,
              status: StoredValueStatus.active,
              issuedAt: new Date(),
              createdBy: actor?.id,
              createdVia: "guest_wallet",
              metadata: { isGuestWallet: true },
              updatedAt: new Date(),
            },
          });
        } else if (wallet.currency !== currency) {
          throw new ConflictException("Currency mismatch");
        }

        // Compute current balance
        const { balanceCents: before } = await this.computeBalanceInTx(tx, wallet.id);
        const after = before + dto.amountCents;

        // Create ledger entry
        const ledgerEntry = await tx.storedValueLedger.create({
          data: {
            id: randomUUID(),
            campgroundId,
            issuerCampgroundId: wallet.campgroundId,
            scopeType: wallet.scopeType ?? walletScope.scopeType,
            scopeId: wallet.scopeId ?? walletScope.scopeId,
            accountId: wallet.id,
            direction: StoredValueDirection.issue,
            amountCents: dto.amountCents,
            currency,
            beforeBalanceCents: before,
            afterBalanceCents: after,
            referenceType: dto.referenceId ? "external" : "staff_credit",
            referenceId: dto.referenceId ?? wallet.id,
            idempotencyKey: key,
            actorType: actor?.role ?? "staff",
            actorId: actor?.id,
            channel: "staff",
            reason: dto.reason ?? "Staff added credit",
          },
        });

        return {
          walletId: wallet.id,
          balanceCents: after,
          transactionId: ledgerEntry.id,
        };
      });

      // Mark idempotency as succeeded
      await this.completeIdempotency(key, result);

      return result;
    } catch (error) {
      await this.failIdempotency(key, error);
      throw error;
    }
  }

  /**
   * Credit from reservation refund
   */
  async creditFromRefund(
    campgroundId: string,
    reservationId: string,
    guestId: string,
    amountCents: number,
    reason: string,
    idempotencyKey?: string,
    actor?: WalletActor,
  ): Promise<WalletCreditResult> {
    const key = idempotencyKey ?? `wallet-refund-${reservationId}-${Date.now()}`;
    const walletScope = await this.resolveWalletScope(campgroundId, "campground");

    return this.prisma.$transaction(async (tx) => {
      // Get or create wallet
      let wallet = await tx.storedValueAccount.findFirst({
        where: {
          guestId,
          status: StoredValueStatus.active,
          scopeType: walletScope.scopeType,
          scopeId: walletScope.scopeId,
        },
      });

      if (!wallet) {
        wallet = await tx.storedValueAccount.create({
          data: {
            id: randomUUID(),
            campgroundId,
            guestId,
            scopeType: walletScope.scopeType,
            scopeId: walletScope.scopeId,
            type: StoredValueType.credit,
            currency: "usd",
            status: StoredValueStatus.active,
            issuedAt: new Date(),
            createdVia: "refund_to_wallet",
            metadata: { isGuestWallet: true },
            updatedAt: new Date(),
          },
        });
      }

      const { balanceCents: before } = await this.computeBalanceInTx(tx, wallet.id);
      const after = before + amountCents;

      const ledgerEntry = await tx.storedValueLedger.create({
        data: {
          id: randomUUID(),
          campgroundId,
          issuerCampgroundId: wallet.campgroundId,
          scopeType: wallet.scopeType ?? walletScope.scopeType,
          scopeId: wallet.scopeId ?? walletScope.scopeId,
          accountId: wallet.id,
          direction: StoredValueDirection.refund,
          amountCents,
          currency: wallet.currency,
          beforeBalanceCents: before,
          afterBalanceCents: after,
          referenceType: "reservation",
          referenceId: reservationId,
          idempotencyKey: key,
          actorType: actor?.role ?? "system",
          actorId: actor?.id,
          channel: "refund",
          reason,
        },
      });

      return {
        walletId: wallet.id,
        balanceCents: after,
        transactionId: ledgerEntry.id,
      };
    });
  }

  /**
   * Debit wallet for payment (POS or reservation)
   */
  async debitForPayment(
    campgroundId: string,
    dto: DebitWalletDto,
    idempotencyKey?: string,
    actor?: WalletActor,
  ): Promise<WalletDebitResult> {
    const key = idempotencyKey ?? `wallet-debit-${dto.referenceId}-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      const organizationId = await this.getOrganizationIdForCampground(campgroundId, tx);
      let wallet = null;

      if (dto.walletId) {
        wallet = await tx.storedValueAccount.findUnique({ where: { id: dto.walletId } });
        if (
          !wallet ||
          wallet.guestId !== dto.guestId ||
          wallet.status !== StoredValueStatus.active
        ) {
          throw new NotFoundException("Guest wallet not found");
        }
      } else {
        const candidates = await this.fetchWalletCandidates(
          tx,
          campgroundId,
          dto.guestId,
          organizationId,
        );
        wallet = this.selectPreferredWallet(candidates, campgroundId, organizationId);
        if (!wallet) {
          throw new NotFoundException("Guest wallet not found");
        }
      }

      this.assertWalletRedeemable(wallet, campgroundId, organizationId);
      if (dto.currency && wallet.currency !== dto.currency.toLowerCase()) {
        throw new BadRequestException("Currency mismatch");
      }

      const { balanceCents, availableCents } = await this.computeBalanceInTx(tx, wallet.id);

      if (availableCents < dto.amountCents) {
        throw new BadRequestException(
          `Insufficient wallet balance. Available: ${availableCents}, requested: ${dto.amountCents}`,
        );
      }

      const after = balanceCents - dto.amountCents;

      const ledgerEntry = await tx.storedValueLedger.create({
        data: {
          id: randomUUID(),
          campgroundId,
          issuerCampgroundId: wallet.campgroundId,
          scopeType: wallet.scopeType ?? "campground",
          scopeId: wallet.scopeId ?? wallet.campgroundId ?? null,
          accountId: wallet.id,
          direction: StoredValueDirection.redeem,
          amountCents: dto.amountCents,
          currency: wallet.currency,
          beforeBalanceCents: balanceCents,
          afterBalanceCents: after,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          idempotencyKey: key,
          actorType: actor?.role ?? "system",
          actorId: actor?.id,
          channel: dto.referenceType === "pos_cart" ? "pos" : "web",
          reason: `Payment for ${dto.referenceType}`,
        },
      });

      return {
        walletId: wallet.id,
        balanceCents: after,
        transactionId: ledgerEntry.id,
      };
    });
  }

  /**
   * List transactions for a wallet
   */
  async listTransactions(
    walletId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ transactions: WalletTransaction[]; total: number }> {
    const [transactions, total] = await Promise.all([
      this.prisma.storedValueLedger.findMany({
        where: { accountId: walletId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          direction: true,
          amountCents: true,
          beforeBalanceCents: true,
          afterBalanceCents: true,
          referenceType: true,
          referenceId: true,
          reason: true,
          createdAt: true,
        },
      }),
      this.prisma.storedValueLedger.count({
        where: { accountId: walletId },
      }),
    ]);

    return { transactions, total };
  }

  /**
   * Get wallets for a guest that are redeemable at a campground
   */
  async getGuestWalletsForCampground(
    campgroundId: string,
    guestId: string,
  ): Promise<WalletBalance[]> {
    const organizationId = await this.getOrganizationIdForCampground(campgroundId);
    const wallets = await this.prisma.storedValueAccount.findMany({
      where: {
        guestId,
        status: StoredValueStatus.active,
        OR: this.buildScopeFilters(campgroundId, organizationId),
      },
      include: {
        Campground: { select: { name: true, slug: true } },
      },
    });

    if (!wallets.length) return [];

    const balances = await Promise.all(
      wallets.map(async (wallet) => {
        const scope = this.normalizeScope(wallet);
        const { balanceCents, availableCents } = await this.computeBalance(wallet.id);
        return {
          walletId: wallet.id,
          guestId: wallet.guestId!,
          campgroundId: wallet.campgroundId,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          balanceCents,
          availableCents,
          currency: wallet.currency,
          campgroundName: wallet.Campground?.name,
          campgroundSlug: wallet.Campground?.slug,
        };
      }),
    );

    const scopeRank = (wallet: WalletBalance) => {
      if (wallet.scopeType === "campground" && wallet.scopeId === campgroundId) return 0;
      if (wallet.scopeType === "organization" && wallet.scopeId === organizationId) return 1;
      if (wallet.scopeType === "global") return 2;
      return 3;
    };

    return balances.sort((a, b) => scopeRank(a) - scopeRank(b));
  }

  /**
   * Get all wallets for a guest (across campgrounds)
   */
  async getGuestWallets(guestId: string): Promise<WalletBalance[]> {
    const wallets = await this.prisma.storedValueAccount.findMany({
      where: {
        guestId,
        status: StoredValueStatus.active,
      },
      include: {
        Campground: { select: { name: true, slug: true } },
      },
    });

    const balances = await Promise.all(
      wallets.map(async (wallet) => {
        const scope = this.normalizeScope(wallet);
        const { balanceCents, availableCents } = await this.computeBalance(wallet.id);
        return {
          walletId: wallet.id,
          guestId: wallet.guestId!,
          campgroundId: wallet.campgroundId,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          balanceCents,
          availableCents,
          currency: wallet.currency,
          campgroundName: wallet.Campground?.name,
          campgroundSlug: wallet.Campground?.slug,
        };
      }),
    );

    return balances;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async computeBalance(accountId: string): Promise<{
    balanceCents: number;
    availableCents: number;
  }> {
    const ledger = await this.prisma.storedValueLedger.findMany({
      where: { accountId },
      select: { direction: true, amountCents: true },
    });

    const balanceCents = ledger.reduce(
      (sum, row) => sum + this.directionToSigned(row.direction, row.amountCents),
      0,
    );

    const openHolds = await this.prisma.storedValueHold.aggregate({
      where: { accountId, status: "open" },
      _sum: { amountCents: true },
    });

    const held = openHolds._sum.amountCents ?? 0;

    return { balanceCents, availableCents: balanceCents - held };
  }

  private async computeBalanceInTx(
    tx: Prisma.TransactionClient,
    accountId: string,
  ): Promise<{ balanceCents: number; availableCents: number }> {
    const ledger = await tx.storedValueLedger.findMany({
      where: { accountId },
      select: { direction: true, amountCents: true },
    });

    const balanceCents = ledger.reduce(
      (sum, row) => sum + this.directionToSigned(row.direction, row.amountCents),
      0,
    );

    const openHolds = await tx.storedValueHold.aggregate({
      where: { accountId, status: "open" },
      _sum: { amountCents: true },
    });

    const held = openHolds._sum.amountCents ?? 0;

    return { balanceCents, availableCents: balanceCents - held };
  }

  private directionToSigned(direction: StoredValueDirection, amount: number): number {
    // Positive directions (add to balance)
    if (
      direction === StoredValueDirection.issue ||
      direction === StoredValueDirection.refund ||
      direction === StoredValueDirection.adjust
    ) {
      return amount;
    }
    // Negative directions (subtract from balance)
    if (
      direction === StoredValueDirection.redeem ||
      direction === StoredValueDirection.expire ||
      direction === StoredValueDirection.hold_capture
    ) {
      return -Math.abs(amount);
    }
    return 0;
  }

  private normalizeScope(wallet: WalletScopeCarrier): NormalizedScope {
    const scopeType: WalletScopeType =
      wallet?.scopeType === "global" ||
      wallet?.scopeType === "organization" ||
      wallet?.scopeType === "campground"
        ? wallet.scopeType
        : "campground";
    if (scopeType === "global") {
      return { scopeType: "global", scopeId: null };
    }
    if (scopeType === "organization") {
      return { scopeType: "organization", scopeId: wallet?.scopeId ?? null };
    }
    const scopeId = wallet?.scopeId ?? wallet?.campgroundId ?? null;
    return { scopeType: "campground", scopeId };
  }

  private async resolveWalletScope(
    campgroundId: string,
    scopeType?: "campground" | "organization" | "global",
    scopeId?: string,
  ): Promise<NormalizedScope> {
    const normalized = scopeType ?? "campground";
    if (normalized === "global") {
      return { scopeType: "global", scopeId: null };
    }
    if (normalized === "organization") {
      const organizationId = scopeId ?? (await this.getOrganizationIdForCampground(campgroundId));
      if (!organizationId) {
        throw new BadRequestException("organization scope requires scopeId");
      }
      return { scopeType: "organization", scopeId: organizationId };
    }
    return { scopeType: "campground", scopeId: scopeId ?? campgroundId };
  }

  private buildScopeFilters(campgroundId: string, organizationId?: string | null) {
    const filters: NormalizedScope[] = [{ scopeType: "campground", scopeId: campgroundId }];
    if (organizationId) {
      filters.push({ scopeType: "organization", scopeId: organizationId });
    }
    filters.push({ scopeType: "global", scopeId: null });
    return filters;
  }

  private async fetchWalletCandidates(
    tx: PrismaClientLike,
    campgroundId: string,
    guestId: string,
    organizationId?: string | null,
  ): Promise<WalletCandidate[]> {
    return tx.storedValueAccount.findMany({
      where: {
        guestId,
        status: StoredValueStatus.active,
        OR: this.buildScopeFilters(campgroundId, organizationId),
      },
      select: {
        id: true,
        guestId: true,
        campgroundId: true,
        scopeType: true,
        scopeId: true,
        currency: true,
        status: true,
      },
    });
  }

  private selectPreferredWallet(
    wallets: WalletCandidate[],
    campgroundId: string,
    organizationId?: string | null,
  ): WalletCandidateWithScope | null {
    const normalized: WalletCandidateWithScope[] = wallets.map((wallet) => ({
      ...wallet,
      ...this.normalizeScope(wallet),
    }));
    const campWallet = normalized.find(
      (wallet) => wallet.scopeType === "campground" && wallet.scopeId === campgroundId,
    );
    if (campWallet) return campWallet;
    if (organizationId) {
      const orgWallet = normalized.find(
        (wallet) => wallet.scopeType === "organization" && wallet.scopeId === organizationId,
      );
      if (orgWallet) return orgWallet;
    }
    return normalized.find((wallet) => wallet.scopeType === "global") ?? null;
  }

  private assertWalletRedeemable(
    wallet: WalletScopeCarrier,
    campgroundId: string,
    organizationId?: string | null,
  ) {
    const scope = this.normalizeScope(wallet);
    if (scope.scopeType === "campground" && scope.scopeId !== campgroundId) {
      throw new ForbiddenException("Wallet not valid for this campground");
    }
    if (scope.scopeType === "organization") {
      if (!organizationId || scope.scopeId !== organizationId) {
        throw new ForbiddenException("Wallet not valid for this organization");
      }
    }
  }

  private async getOrganizationIdForCampground(campgroundId: string, tx?: PrismaClientLike) {
    const store = tx ?? this.prisma;
    const campground = await store.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });
    return campground?.organizationId ?? null;
  }

  private async guardIdempotency(
    key: string | undefined,
    payload: unknown,
    scope: IdempotencyScope,
    operation: string,
  ): Promise<IdempotencyRecord | null> {
    if (!key) return null;
    try {
      return await this.idempotency.start(key, payload, scope.campgroundId ?? null, {
        endpoint: operation,
        campgroundId: scope.campgroundId ?? null,
      });
    } catch {
      return null;
    }
  }

  private async completeIdempotency(key: string, result: WalletCreditResult) {
    try {
      await this.idempotency.complete(key, result);
    } catch {
      // Ignore errors
    }
  }

  private async failIdempotency(key: string, _error: unknown) {
    try {
      await this.idempotency.fail(key);
    } catch {
      // Ignore errors
    }
  }
}
