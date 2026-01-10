import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { StripeService } from "../payments/stripe.service";
import { ReservationStatus, BackoffStrategy } from "@prisma/client";
import { postBalancedLedgerEntries } from "../ledger/ledger-posting.util";

@Injectable()
export class AutoCollectService {
  private readonly logger = new Logger(AutoCollectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly stripeService: StripeService
  ) {}

  /**
   * Cron job runs every hour to process auto-collect attempts.
   * Finds reservations with nextAutoCollectAttemptAt in the past
   * and balance due, then attempts to charge.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processAutoCollects() {
    const now = new Date();
    this.logger.log(`[AutoCollect] Starting sweep at ${now.toISOString()}`);

    // Find reservations due for auto-collect
    const dueReservations = await this.prisma.reservation.findMany({
      where: {
        status: { in: [ReservationStatus.pending, ReservationStatus.confirmed] },
        balanceAmount: { gt: 0 },
        nextAutoCollectAttemptAt: { lte: now }
      },
      include: {
        campground: {
          select: {
            id: true,
            stripeAccountId: true,
            defaultDepositPolicyId: true,
            applicationFeeFlatCents: true,
            perBookingFeeCents: true
          }
        },
        site: {
          select: { siteClassId: true }
        }
      },
      take: 100 // Process in batches
    });

    this.logger.log(`[AutoCollect] Found ${dueReservations.length} reservations due`);

    for (const reservation of dueReservations) {
      await this.attemptCollection(reservation);
    }
  }

  /**
   * Attempt to collect balance for a single reservation.
   */
  async attemptCollection(reservation: any) {
    const idempotencyKey = `auto-collect:${reservation.id}:${Date.now()}`;

    try {
      // Check idempotency
      const existing = await this.idempotency.start(idempotencyKey, {
        reservationId: reservation.id,
        amountCents: reservation.balanceAmount
      }, reservation.campgroundId);

      if (existing.status === "succeeded") {
        this.logger.log(`[AutoCollect] Already processed ${reservation.id}`);
        return existing.responseJson;
      }

      const stripeAccountId = reservation.campground?.stripeAccountId;
      if (!stripeAccountId) {
        this.logger.warn(`[AutoCollect] No Stripe account for campground ${reservation.campgroundId}`);
        await this.scheduleNextAttempt(reservation, "no_stripe_account");
        return;
      }

      // Get deposit policy for retry schedule
      const policy = await this.getDepositPolicy(reservation);
      const retryPlan = policy?.retryPlanId
        ? await this.prisma.autoCollectSchedule.findUnique({ where: { id: policy.retryPlanId } })
        : null;

      // Check cutoff (don't attempt too close to arrival)
      if (retryPlan?.cutoffHoursBeforeArrival) {
        const hoursUntilArrival = (reservation.arrivalDate.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilArrival < retryPlan.cutoffHoursBeforeArrival) {
          this.logger.warn(`[AutoCollect] Past cutoff for ${reservation.id}, skipping`);
          await this.clearNextAttempt(reservation.id);
          await this.idempotency.complete(idempotencyKey, { status: "past_cutoff" });
          return;
        }
      }

      // Calculate application fee
      const applicationFeeCents =
        reservation.campground?.perBookingFeeCents ??
        reservation.campground?.applicationFeeFlatCents ??
        200;

      // Create and confirm payment intent
      const intent = await this.stripeService.createPaymentIntent(
        reservation.balanceAmount,
        "usd",
        {
          reservationId: reservation.id,
          campgroundId: reservation.campgroundId,
          source: "auto_collect",
          type: "balance_due"
        },
        stripeAccountId,
        applicationFeeCents,
        "automatic",
        ["card"],
        idempotencyKey
      );

      this.logger.log(`[AutoCollect] Created intent ${intent.id} for ${reservation.id}`);

      // If successful, update reservation
      if (intent.status === "succeeded") {
        await this.recordSuccessfulPayment(reservation, intent);
        await this.idempotency.complete(idempotencyKey, {
          status: "succeeded",
          intentId: intent.id,
          amountCents: reservation.balanceAmount
        });
      } else {
        // Payment requires action or failed - schedule retry
        await this.scheduleNextAttempt(reservation, intent.status, retryPlan);
        await this.idempotency.complete(idempotencyKey, {
          status: "requires_action",
          intentId: intent.id
        });
      }
    } catch (error: any) {
      this.logger.error(`[AutoCollect] Failed for ${reservation.id}: ${error.message}`);
      await this.idempotency.fail(idempotencyKey);

      // Get retry plan and schedule next attempt with backoff
      const policy = await this.getDepositPolicy(reservation);
      const retryPlan = policy?.retryPlanId
        ? await this.prisma.autoCollectSchedule.findUnique({ where: { id: policy.retryPlanId } })
        : null;
      await this.scheduleNextAttempt(reservation, "error", retryPlan);
    }
  }

  private async getDepositPolicy(reservation: any) {
    // Try site-class specific, then campground default
    const siteClassId = reservation.site?.siteClassId;

    if (siteClassId) {
      const siteClassPolicy = await this.prisma.depositPolicy.findFirst({
        where: { campgroundId: reservation.campgroundId, siteClassId, active: true }
      });
      if (siteClassPolicy) return siteClassPolicy;
    }

    if (reservation.campground?.defaultDepositPolicyId) {
      return this.prisma.depositPolicy.findUnique({
        where: { id: reservation.campground.defaultDepositPolicyId }
      });
    }

    return this.prisma.depositPolicy.findFirst({
      where: { campgroundId: reservation.campgroundId, siteClassId: null, active: true }
    });
  }

  private async recordSuccessfulPayment(reservation: any, intent: any) {
    const newPaid = (reservation.paidAmount ?? 0) + reservation.balanceAmount;
    const amountCents = reservation.balanceAmount;

    await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        paidAmount: newPaid,
        balanceAmount: 0,
        paymentStatus: newPaid >= reservation.totalAmount ? "paid" : "partial",
        nextAutoCollectAttemptAt: null
      }
    });

    await this.prisma.payment.create({
      data: {
        campgroundId: reservation.campgroundId,
        reservationId: reservation.id,
        amountCents,
        method: "card",
        direction: "charge",
        note: "Auto-collected balance",
        stripePaymentIntentId: intent.id
      }
    });

    // Post balanced ledger entries (debit Cash, credit Revenue)
    const dedupeKey = `auto_collect_${reservation.id}_${intent.id}`;
    await postBalancedLedgerEntries(this.prisma, [
      {
        campgroundId: reservation.campgroundId,
        reservationId: reservation.id,
        glCode: "CASH",
        account: "Cash",
        description: `Auto-collect payment ${intent.id}`,
        amountCents,
        direction: "debit" as const,
        dedupeKey: `${dedupeKey}:debit`
      },
      {
        campgroundId: reservation.campgroundId,
        reservationId: reservation.id,
        glCode: "SITE_REVENUE",
        account: "Site Revenue",
        description: `Auto-collect payment ${intent.id}`,
        amountCents,
        direction: "credit" as const,
        dedupeKey: `${dedupeKey}:credit`
      }
    ]);

    this.logger.log(`[AutoCollect] Successfully collected ${amountCents} cents for ${reservation.id}`);
  }

  private async scheduleNextAttempt(reservation: any, reason: string, retryPlan?: any) {
    const maxAttempts = retryPlan?.maxAttempts ?? 3;
    const backoffStrategy = retryPlan?.backoffStrategy ?? BackoffStrategy.exponential;
    const baseDelayHours = retryPlan?.retryDelayHours ?? 24;

    // Count previous attempts (could track in a separate field)
    const attemptCount = 1; // Simplified - would track this properly

    if (attemptCount >= maxAttempts) {
      this.logger.warn(`[AutoCollect] Max attempts reached for ${reservation.id}`);
      await this.clearNextAttempt(reservation.id);

      // Send notification about failed collection
      await this.sendFailedCollectionNotification(reservation, reason);
      return;
    }

    let delayHours: number;
    switch (backoffStrategy) {
      case BackoffStrategy.exponential:
        delayHours = baseDelayHours * Math.pow(2, attemptCount - 1);
        break;
      case BackoffStrategy.linear:
        delayHours = baseDelayHours * attemptCount;
        break;
      case BackoffStrategy.fixed:
      default:
        delayHours = baseDelayHours;
    }

    const nextAttempt = new Date(Date.now() + delayHours * 60 * 60 * 1000);

    await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: { nextAutoCollectAttemptAt: nextAttempt }
    });

    this.logger.log(`[AutoCollect] Scheduled retry for ${reservation.id} at ${nextAttempt.toISOString()} (reason: ${reason})`);
  }

  private async clearNextAttempt(reservationId: string) {
    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { nextAutoCollectAttemptAt: null }
    });
  }

  /**
   * Manual trigger for a specific reservation (e.g., from admin UI)
   */
  async runAttempt(reservationId: string, attemptNo: number, payload: any = {}) {
    const key = `auto-collect:${reservationId}:${attemptNo}`;
    const existing = await this.idempotency.start(key, payload, payload?.campgroundId);
    if (existing.status === "succeeded") {
      return existing.responseJson;
    }

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        campground: { select: { id: true, stripeAccountId: true } },
        site: { select: { siteClassId: true } }
      }
    });

    if (!reservation) {
      await this.idempotency.fail(key);
      return { error: "Reservation not found" };
    }

    await this.attemptCollection(reservation);
    return { reservationId, attemptNo, status: "processed" };
  }

  /**
   * Send notification when all auto-collect attempts have failed
   */
  private async sendFailedCollectionNotification(reservation: any, reason: string) {
    try {
      const balanceFormatted = (reservation.balanceAmount / 100).toFixed(2);

      // Create guest notification
      await this.prisma.communication.create({
        data: {
          campgroundId: reservation.campgroundId,
          guestId: reservation.guestId,
          reservationId: reservation.id,
          type: 'email',
          subject: 'Payment Required for Your Reservation',
          body: `We were unable to automatically collect your outstanding balance of $${balanceFormatted}. Please update your payment method or contact us to resolve this before your arrival.`,
          status: 'queued',
          direction: 'outbound',
          metadata: {
            template: 'failed_auto_collect',
            balanceAmount: reservation.balanceAmount,
            reason
          }
        }
      });

      // Create internal alert for staff
      await this.prisma.communication.create({
        data: {
          campgroundId: reservation.campgroundId,
          reservationId: reservation.id,
          type: 'internal_alert',
          subject: 'Auto-Collect Failed - Manual Review Required',
          body: `Auto-collect failed for reservation ${reservation.id} after maximum attempts. Outstanding balance: $${balanceFormatted}. Reason: ${reason}`,
          status: 'queued',
          direction: 'internal',
          metadata: {
            alertType: 'payment_failed',
            balanceAmount: reservation.balanceAmount,
            reason
          }
        }
      });

      this.logger.log(`[AutoCollect] Sent failed collection notifications for ${reservation.id}`);
    } catch (err) {
      this.logger.error(`[AutoCollect] Failed to send notification for ${reservation.id}: ${err}`);
    }
  }
}

