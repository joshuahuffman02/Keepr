import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { GlAccountType, type Payout } from "@prisma/client";
import fetch from "node-fetch";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "./stripe.service";
import { LedgerService } from "../ledger/ledger.service";

type StripePayoutLike = {
  id: string;
  amount?: number | null;
  fee?: number | null;
  status?: string | null;
  arrival_date?: number | null;
  currency?: string | null;
  destination?: string | null;
  stripe_account?: string | null;
  statement_descriptor?: string | null;
};

type StripeBalanceTransactionLike = {
  id: string;
  amount: number;
  currency?: string | null;
  fee?: number | null;
  type?: string | null;
  reporting_category?: string | null;
  source?: unknown;
  payment_intent?: string | null;
  created: number;
};

type StripeDisputeLike = {
  id: string;
  amount: number;
  charge?: string | null;
  payment_intent?: string | null;
  account?: string | null;
  metadata?: Record<string, string> | null;
  status?: string | null;
  reason?: string | null;
  currency?: string | null;
  evidence_details?: { due_by?: number | null } | null;
  evidence?: { product_description?: string | null } | null;
};

type AsyncResult<T> = jest.MockedFunction<(...args: unknown[]) => Promise<T>>;

type PayoutLineSummary = { amountCents: number; reservationId?: string | null };
type PayoutRecord = Pick<Payout, "id" | "campgroundId"> & {
  amountCents?: number | null;
  feeCents?: number | null;
  stripePayoutId?: string | null;
  paidAt?: Date | null;
  arrivalDate?: Date | null;
};
type PayoutWithLines = PayoutRecord & { lines?: PayoutLineSummary[] };
type LedgerEntrySummary = { direction: "credit" | "debit"; amountCents: number };

export type PaymentsReconciliationStore = {
  campground: { findFirst: AsyncResult<{ id: string } | null> };
  payment: {
    findFirst: AsyncResult<{ reservationId: string | null; campgroundId: string } | null>;
    create: AsyncResult<unknown>;
  };
  payout: {
    upsert: AsyncResult<PayoutRecord>;
    findFirst: AsyncResult<PayoutWithLines | null>;
    update: AsyncResult<PayoutRecord>;
  };
  payoutLine: { create: AsyncResult<unknown> };
  payoutRecon: { upsert: AsyncResult<{ id: string }> };
  payoutReconLine: { create: AsyncResult<unknown> };
  dispute: {
    upsert: AsyncResult<unknown>;
    findUnique: AsyncResult<{ reason?: string | null } | null>;
  };
  reservation: {
    findUnique: AsyncResult<{ id: string; paidAmount?: number | null; totalAmount: number } | null>;
    update: AsyncResult<unknown>;
  };
  ledgerEntry: {
    findFirst: AsyncResult<{ id: string } | null>;
    findMany: AsyncResult<LedgerEntrySummary[]>;
  };
};

export type StripeServiceLike = {
  listBalanceTransactionsForPayout: AsyncResult<{ data: StripeBalanceTransactionLike[] }>;
  listPayouts: AsyncResult<{ data: StripePayoutLike[] }>;
};

export type LedgerServiceLike = {
  ensureAccount: AsyncResult<string>;
  postEntries: AsyncResult<{ entryIds: string[] }>;
};

export function mapReconLineType(
  tx: StripeBalanceTransactionLike,
): "payout" | "fee" | "chargeback" | "reserve" | "adjustment" | "other" {
  const txType = tx.type;
  if (txType === "payout") return "payout";
  if (txType === "application_fee" || tx.reporting_category === "fee") return "fee";
  if (tx.reporting_category === "charge_dispute" || txType === "dispute") return "chargeback";
  if (txType === "reserve_transaction") return "reserve";
  if (txType === "adjustment") return "adjustment";
  return "other";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringId = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.id === "string") return value.id;
  return null;
};

@Injectable()
export class PaymentsReconciliationService {
  private readonly logger = new Logger(PaymentsReconciliationService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PaymentsReconciliationStore,
    @Inject(StripeService) private readonly stripeService: StripeServiceLike,
    @Inject(LedgerService) private readonly ledger: LedgerServiceLike,
  ) {}

  async sendAlert(message: string) {
    const webhook = process.env.ALERT_WEBHOOK_URL;
    if (!webhook) {
      this.logger.warn(`Alert (no webhook configured): ${message}`);
      return;
    }
    let webhookUrl: URL;
    try {
      webhookUrl = new URL(webhook);
    } catch {
      this.logger.warn(`Alert webhook URL invalid, skipping: ${webhook}`);
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    timeoutId.unref?.();
    try {
      await fetch(webhookUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
        signal: controller.signal,
      });
    } catch (err) {
      this.logger.warn(`Failed to send alert: ${err instanceof Error ? err.message : err}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async lookupCampgroundIdByStripeAccount(accountId?: string | null) {
    if (!accountId) return "";
    const cg = await this.prisma.campground.findFirst({
      where: { stripeAccountId: accountId },
      select: { id: true },
    });
    return cg?.id ?? "";
  }

  private async postDoubleEntry(opts: {
    campgroundId: string;
    reservationId?: string | null;
    glDebit: { code: string; name: string; type: GlAccountType };
    glCredit: { code: string; name: string; type: GlAccountType };
    amountCents: number;
    description: string;
    sourceTxId?: string | null;
    occurredAt?: Date;
    reconciliationKey?: string | null;
  }) {
    const occurredAt = opts.occurredAt ?? new Date();
    const debitId = await this.ledger.ensureAccount(
      opts.campgroundId,
      opts.glDebit.code,
      opts.glDebit.name,
      opts.glDebit.type,
    );
    const creditId = await this.ledger.ensureAccount(
      opts.campgroundId,
      opts.glCredit.code,
      opts.glCredit.name,
      opts.glCredit.type,
    );
    return this.ledger.postEntries({
      campgroundId: opts.campgroundId,
      reservationId: opts.reservationId ?? null,
      description: opts.description,
      occurredAt,
      sourceType: "payout_recon",
      sourceTxId: opts.sourceTxId ?? null,
      dedupeKey: `payout_recon:${opts.sourceTxId ?? ""}:${opts.description}:${opts.amountCents}`,
      lines: [
        {
          glAccountId: debitId,
          side: "debit",
          amountCents: opts.amountCents,
          memo: opts.description,
          glCode: opts.glDebit.code,
          accountName: opts.glDebit.name,
          reconciliationKey: opts.reconciliationKey ?? opts.sourceTxId ?? undefined,
        },
        {
          glAccountId: creditId,
          side: "credit",
          amountCents: opts.amountCents,
          memo: `${opts.description} (offset)`,
          glCode: opts.glCredit.code,
          accountName: opts.glCredit.name,
          reconciliationKey: opts.reconciliationKey ?? opts.sourceTxId ?? undefined,
        },
      ],
    });
  }

  private async createPayoutLine(opts: {
    payoutId: string;
    type: string;
    amount: number;
    currency?: string;
    description?: string;
    reservationId?: string | null;
    paymentIntentId?: string | null;
    chargeId?: string | null;
    balanceTransactionId?: string | null;
  }) {
    return this.prisma.payoutLine.create({
      data: {
        payoutId: opts.payoutId,
        type: opts.type,
        amountCents: opts.amount,
        currency: opts.currency || "usd",
        description: opts.description,
        reservationId: opts.reservationId || null,
        paymentIntentId: opts.paymentIntentId || null,
        chargeId: opts.chargeId || null,
        balanceTransactionId: opts.balanceTransactionId || null,
      },
    });
  }

  private async createPayoutReconLine(opts: {
    payoutReconId: string;
    type: "payout" | "fee" | "chargeback" | "reserve" | "adjustment" | "other";
    amountCents: number;
    currency?: string;
    sourceTxId?: string | null;
    sourceTs?: Date | null;
    glEntryId?: string | null;
    notes?: string | null;
  }) {
    return this.prisma.payoutReconLine.create({
      data: {
        payoutReconId: opts.payoutReconId,
        type: opts.type,
        status: "matched",
        sourceTxId: opts.sourceTxId ?? null,
        sourceTs: opts.sourceTs ?? null,
        amountCents: opts.amountCents,
        currency: opts.currency ?? "usd",
        glEntryId: opts.glEntryId ?? null,
        notes: opts.notes ?? null,
      },
    });
  }

  private async upsertPayoutReconEnvelope(payoutRecord: PayoutRecord, payout: StripePayoutLike) {
    const payoutDate = payout.arrival_date ? new Date(payout.arrival_date * 1000) : null;
    const expected = payout.amount ?? 0;
    const actual = (payout.amount ?? 0) - (payout.fee ?? 0);
    return this.prisma.payoutRecon.upsert({
      where: { id: payoutRecord.id },
      update: {
        provider: "stripe",
        status: "matched",
        expectedAmountCents: expected,
        actualAmountCents: actual,
        varianceCents: actual - expected,
        currency: payout.currency || "usd",
        payoutDate,
      },
      create: {
        id: payoutRecord.id,
        campgroundId: payoutRecord.campgroundId,
        provider: "stripe",
        status: "matched",
        expectedAmountCents: expected,
        actualAmountCents: actual,
        varianceCents: actual - expected,
        currency: payout.currency || "usd",
        payoutDate,
      },
    });
  }

  async upsertDispute(dispute: StripeDisputeLike) {
    const disputeId = dispute.id;
    const amountCents = dispute.amount;
    const chargeId = dispute.charge ?? null;
    const paymentIntentId = dispute.payment_intent ?? null;

    // Check if we've already processed this dispute (idempotency)
    const existingDispute = await this.prisma.dispute.findUnique({
      where: { stripeDisputeId: disputeId },
    });

    // Lookup campground from the Stripe connected account
    const campgroundId = await this.lookupCampgroundIdByStripeAccount(dispute.account);

    // Find the reservation via the payment's stripeChargeId or stripePaymentIntentId
    // This is more reliable than metadata since disputes may not have reservationId in metadata
    let reservationId = dispute.metadata?.reservationId ?? null;

    if (!reservationId && (chargeId || paymentIntentId)) {
      // Try to find the payment that matches this charge or payment intent
      const orConditions: Array<{ stripeChargeId?: string; stripePaymentIntentId?: string }> = [];
      if (chargeId) orConditions.push({ stripeChargeId: chargeId });
      if (paymentIntentId) orConditions.push({ stripePaymentIntentId: paymentIntentId });
      const payment =
        orConditions.length > 0
          ? await this.prisma.payment.findFirst({
              where: { OR: orConditions },
              select: { reservationId: true },
            })
          : null;
      if (payment?.reservationId) {
        reservationId = payment.reservationId;
      }
    }

    // Upsert the dispute record
    const disputeRecord = await this.prisma.dispute.upsert({
      where: { stripeDisputeId: disputeId },
      update: {
        amountCents,
        status: dispute.status ?? "needs_response",
        reason: dispute.reason ?? null,
        evidenceDueBy: dispute.evidence_details?.due_by
          ? new Date(dispute.evidence_details.due_by * 1000)
          : null,
        notes: dispute.evidence?.product_description ?? null,
      },
      create: {
        stripeDisputeId: disputeId,
        stripeChargeId: chargeId,
        stripePaymentIntentId: paymentIntentId,
        campgroundId,
        reservationId,
        payoutId: null,
        amountCents,
        currency: dispute.currency || "usd",
        status: dispute.status ?? "needs_response",
        reason: dispute.reason ?? null,
        evidenceDueBy: dispute.evidence_details?.due_by
          ? new Date(dispute.evidence_details.due_by * 1000)
          : null,
        notes: dispute.evidence?.product_description ?? null,
      },
    });

    // Only adjust reservation balance on first creation (idempotency)
    // If existingDispute exists, we've already processed this dispute
    if (!existingDispute && reservationId && amountCents > 0 && campgroundId) {
      await this.adjustReservationForDispute(reservationId, campgroundId, amountCents, disputeId);
    }

    return disputeRecord;
  }

  /**
   * Adjust reservation balance when a chargeback/dispute occurs.
   * This reduces paidAmount and increases balanceAmount.
   * Uses dedupeKey for idempotency so re-processing webhooks won't double-adjust.
   */
  private async adjustReservationForDispute(
    reservationId: string,
    campgroundId: string,
    amountCents: number,
    stripeDisputeId: string,
  ) {
    const dedupeKey = `dispute:${stripeDisputeId}:balance_adjustment`;

    // Check if we've already created ledger entries for this dispute (idempotency)
    const existingLedger = await this.prisma.ledgerEntry.findFirst({
      where: { dedupeKey },
    });
    if (existingLedger) {
      this.logger.log(
        `[Dispute] Ledger entries already exist for dispute ${stripeDisputeId}, skipping balance adjustment`,
      );
      return;
    }

    // Find the reservation
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        paidAmount: true,
        totalAmount: true,
      },
    });

    if (!reservation) {
      this.logger.warn(
        `[Dispute] Reservation ${reservationId} not found for dispute ${stripeDisputeId}`,
      );
      return;
    }

    // Calculate new paid amount (reduce by disputed amount)
    const currentPaid = reservation.paidAmount ?? 0;
    const newPaid = Math.max(0, currentPaid - amountCents);
    const newBalance = Math.max(0, reservation.totalAmount - newPaid);

    // Determine payment status
    let paymentStatus: string;
    if (newPaid >= reservation.totalAmount) {
      paymentStatus = "paid";
    } else if (newPaid > 0) {
      paymentStatus = "partial";
    } else {
      paymentStatus = "unpaid";
    }

    // Update the reservation balance
    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        paidAmount: newPaid,
        balanceAmount: newBalance,
        paymentStatus,
      },
    });

    // Record a payment entry for the chargeback
    await this.prisma.payment.create({
      data: {
        campgroundId,
        reservationId,
        amountCents,
        method: "chargeback",
        direction: "refund",
        note: `Chargeback/dispute: ${stripeDisputeId}`,
      },
    });

    // Post balanced ledger entries: debit Chargeback Expense, credit Cash
    // This is the accounting entry for the money leaving the account
    await this.postDoubleEntry({
      campgroundId,
      reservationId,
      glDebit: { code: "CHARGEBACK", name: "Chargebacks", type: GlAccountType.expense },
      glCredit: { code: "CASH", name: "Cash", type: GlAccountType.asset },
      amountCents,
      description: `Chargeback: dispute ${stripeDisputeId}`,
      sourceTxId: stripeDisputeId,
      occurredAt: new Date(),
      reconciliationKey: dedupeKey,
    });

    this.logger.log(
      `[Dispute] Adjusted reservation ${reservationId} for dispute ${stripeDisputeId}: ` +
        `paidAmount ${currentPaid} -> ${newPaid}, balanceAmount -> ${newBalance}`,
    );

    // Send alert about the chargeback
    await this.sendAlert(
      `Chargeback received for reservation ${reservationId}: $${(amountCents / 100).toFixed(2)} ` +
        `(dispute ${stripeDisputeId}, reason: ${(await this.prisma.dispute.findUnique({ where: { stripeDisputeId } }))?.reason ?? "unknown"})`,
    );
  }

  async upsertPayoutFromStripe(payout: StripePayoutLike) {
    const payoutRecord = await this.prisma.payout.upsert({
      where: { stripePayoutId: payout.id },
      update: {
        amountCents: payout.amount,
        feeCents: payout.fee,
        status: payout.status ?? "pending",
        arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
        paidAt:
          payout.status === "paid" && payout.arrival_date
            ? new Date(payout.arrival_date * 1000)
            : null,
        statementDescriptor: payout.statement_descriptor ?? null,
      },
      create: {
        stripePayoutId: payout.id,
        stripeAccountId: payout.destination || payout.stripe_account || "",
        campgroundId: await this.lookupCampgroundIdByStripeAccount(
          payout.destination || payout.stripe_account,
        ),
        amountCents: payout.amount,
        feeCents: payout.fee,
        currency: payout.currency || "usd",
        status: payout.status ?? "pending",
        arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
        paidAt:
          payout.status === "paid" && payout.arrival_date
            ? new Date(payout.arrival_date * 1000)
            : null,
        statementDescriptor: payout.statement_descriptor ?? null,
      },
    });
    return payoutRecord;
  }

  async ingestPayoutTransactions(payout: StripePayoutLike, payoutRecord: PayoutRecord) {
    const stripeAccountId = payout.destination || payout.stripe_account;
    if (!stripeAccountId) return;

    const recon = await this.upsertPayoutReconEnvelope(payoutRecord, payout);
    const txns = await this.stripeService.listBalanceTransactionsForPayout(
      payout.id,
      stripeAccountId,
    );
    const transactions: StripeBalanceTransactionLike[] = txns.data;
    for (const tx of transactions) {
      const chargeId = toStringId(tx.source);
      const payment = chargeId
        ? await this.prisma.payment.findFirst({
            where: { stripeChargeId: chargeId },
            select: { reservationId: true, campgroundId: true },
          })
        : null;
      const reservationId = payment?.reservationId ?? null;
      const campgroundId = payment?.campgroundId ?? payoutRecord.campgroundId;

      const txType = tx.type ?? "unknown";
      const paymentIntentId = toStringId(tx.payment_intent);
      await this.createPayoutLine({
        payoutId: payoutRecord.id,
        type: txType,
        amount: tx.amount,
        currency: tx.currency ?? undefined,
        description: `BTX ${tx.id} (${txType})`,
        reservationId,
        paymentIntentId: paymentIntentId ?? null,
        chargeId,
        balanceTransactionId: tx.id,
      });

      const createdAt = new Date(tx.created * 1000);
      const amountAbs = Math.abs(tx.amount);
      let glEntryId: string | undefined;

      // Stripe processing fees: debit expense, credit cash
      if (tx.fee && tx.fee > 0) {
        const feeLedger = await this.postDoubleEntry({
          campgroundId,
          reservationId,
          glDebit: { code: "STRIPE_FEES", name: "Stripe Fees", type: GlAccountType.expense },
          glCredit: { code: "CASH", name: "Cash", type: GlAccountType.asset },
          amountCents: tx.fee,
          description: `Stripe fee BTX ${tx.id}`,
          sourceTxId: tx.id,
          occurredAt: createdAt,
          reconciliationKey: tx.id,
        });
        glEntryId = feeLedger?.entryIds?.[0] ?? glEntryId;
      }

      // Chargebacks/disputes: debit chargebacks, credit cash
      if (tx.reporting_category === "charge_dispute" || txType === "dispute") {
        const cbLedger = await this.postDoubleEntry({
          campgroundId,
          reservationId,
          glDebit: { code: "CHARGEBACK", name: "Chargebacks", type: GlAccountType.expense },
          glCredit: { code: "CASH", name: "Cash", type: GlAccountType.asset },
          amountCents: amountAbs,
          description: `Chargeback BTX ${tx.id}`,
          sourceTxId: tx.id,
          occurredAt: createdAt,
          reconciliationKey: tx.id,
        });
        glEntryId = glEntryId ?? cbLedger?.entryIds?.[0];
      }

      // Platform/application fees withheld from payout (treat as expense for tie-out)
      if (txType === "application_fee" || tx.reporting_category === "fee") {
        const platformLedger = await this.postDoubleEntry({
          campgroundId,
          reservationId,
          glDebit: { code: "PLATFORM_FEE", name: "Platform Fees", type: GlAccountType.expense },
          glCredit: { code: "CASH", name: "Cash", type: GlAccountType.asset },
          amountCents: amountAbs,
          description: `Platform fee BTX ${tx.id}`,
          sourceTxId: tx.id,
          occurredAt: createdAt,
          reconciliationKey: tx.id,
        });
        glEntryId = glEntryId ?? platformLedger?.entryIds?.[0];
      }

      await this.createPayoutReconLine({
        payoutReconId: recon.id,
        type: mapReconLineType(tx),
        amountCents: tx.amount,
        currency: tx.currency ?? undefined,
        sourceTxId: tx.id,
        sourceTs: createdAt,
        glEntryId: glEntryId ?? null,
        notes: `BTX ${tx.id} (${txType})`,
      });
    }
  }

  async reconcilePayout(payout: StripePayoutLike) {
    const payoutRecord = await this.upsertPayoutFromStripe(payout);
    await this.ingestPayoutTransactions(payout, payoutRecord);
    await this.postNetCashMovement(payoutRecord);
    return this.computeReconSummary(payoutRecord.id, payoutRecord.campgroundId);
  }

  async computeReconSummary(payoutId: string, campgroundId: string) {
    const payout = await this.prisma.payout.findFirst({
      where: { id: payoutId, campgroundId },
      include: { lines: true },
    });
    if (!payout) throw new NotFoundException("Payout not found");

    const lineSum = (payout.lines || []).reduce((acc, line) => acc + line.amountCents, 0);
    const reservationIds = Array.from(
      new Set((payout.lines || []).map((line) => line.reservationId).filter(Boolean)),
    );

    let ledgerNet = 0;
    if (reservationIds.length > 0) {
      const ledgerEntries = await this.prisma.ledgerEntry.findMany({
        where: { reservationId: { in: reservationIds } },
      });
      ledgerNet = ledgerEntries.reduce(
        (acc, entry) =>
          acc + (entry.direction === "credit" ? entry.amountCents : -entry.amountCents),
        0,
      );
    }

    const payoutNet = (payout.amountCents ?? 0) - (payout.feeCents ?? 0);
    const driftVsLines = payoutNet - lineSum;
    const driftVsLedger = payoutNet - ledgerNet;

    const driftThreshold = Number(process.env.PAYOUT_DRIFT_THRESHOLD_CENTS ?? 100);
    const status =
      Math.abs(driftVsLedger) === 0 && Math.abs(driftVsLines) === 0
        ? "matched"
        : Math.abs(driftVsLedger) > driftThreshold
          ? "drift"
          : "pending";

    await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        reconStatus: status,
        reconDriftCents: driftVsLedger,
        reconLedgerNetCents: ledgerNet,
        reconLineSumCents: lineSum,
        reconAt: new Date(),
      },
    });

    if (Math.abs(driftVsLedger) > driftThreshold) {
      await this.sendAlert(
        `Payout drift detected: payout ${payout.stripePayoutId} camp ${campgroundId} drift_vs_ledger=${driftVsLedger} cents`,
      );
    }

    return {
      payoutId,
      campgroundId,
      payoutAmountCents: payout.amountCents,
      payoutFeeCents: payout.feeCents ?? 0,
      payoutNetCents: payoutNet,
      lineSumCents: lineSum,
      ledgerNetCents: ledgerNet,
      driftVsLinesCents: driftVsLines,
      driftVsLedgerCents: driftVsLedger,
    };
  }

  private async postNetCashMovement(payoutRecord: PayoutRecord) {
    const net = (payoutRecord?.amountCents ?? 0) - (payoutRecord?.feeCents ?? 0);
    if (!payoutRecord?.campgroundId || net === 0) return;
    const externalRef = payoutRecord.stripePayoutId ?? payoutRecord.id;
    const occurredAt = payoutRecord.paidAt ?? payoutRecord.arrivalDate ?? new Date();

    // Skip if already posted
    const existing = await this.prisma.ledgerEntry.findFirst({
      where: { externalRef, glCode: "BANK" },
      select: { id: true },
    });
    if (existing) return;

    await this.postDoubleEntry({
      campgroundId: payoutRecord.campgroundId,
      glDebit: { code: "BANK", name: "Operating Bank", type: GlAccountType.asset },
      glCredit: { code: "CASH", name: "Cash", type: GlAccountType.asset },
      amountCents: Math.abs(net),
      description: `Payout ${externalRef} transfer`,
      sourceTxId: externalRef,
      occurredAt,
      reconciliationKey: externalRef,
    });

    await this.prisma.payout.update({
      where: { id: payoutRecord.id },
      data: { cashPostedAt: new Date() },
    });
  }

  async reconcileRecentPayouts(stripeAccountId: string, sinceSeconds: number = 7 * 24 * 3600) {
    const payouts = await this.stripeService.listPayouts(stripeAccountId, sinceSeconds);
    const results = [];
    for (const p of payouts.data) {
      try {
        const summary = await this.reconcilePayout(p);
        if (Math.abs(summary.driftVsLedgerCents) > 0) {
          this.logger.warn(`Payout ${p.id} drift detected: ${summary.driftVsLedgerCents} cents`);
          await this.sendAlert(
            `Payout drift detected: payout ${p.id} drift_vs_ledger=${summary.driftVsLedgerCents} cents`,
          );
        }
        results.push(summary);
      } catch (err) {
        this.logger.warn(
          `Failed recon for payout ${p.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return results;
  }
}
