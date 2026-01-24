import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsReconciliationService } from "./reconciliation.service";
import { JobQueueService } from "../observability/job-queue.service";
import { StripeService } from "./stripe.service";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : "Unknown error";

@Injectable()
export class PaymentsScheduler {
  private readonly logger = new Logger(PaymentsScheduler.name);
  private readonly capabilitiesTtlMs = Number(
    process.env.STRIPE_CAPABILITIES_TTL_MS ?? 6 * 60 * 60 * 1000,
  ); // default 6h
  constructor(
    private readonly prisma: PrismaService,
    private readonly recon: PaymentsReconciliationService,
    private readonly queue: JobQueueService,
    private readonly stripe: StripeService,
  ) {}

  @Cron("0 * * * *") // hourly
  async reconcilePayouts() {
    const accounts = await this.prisma.campground.findMany({
      where: { stripeAccountId: { not: null } },
      select: { stripeAccountId: true },
    });
    await Promise.all(
      accounts.map((cg) => {
        const stripeAccountId = cg.stripeAccountId;
        if (!stripeAccountId) return Promise.resolve();
        return this.queue
          .enqueue("payout-recon", () => this.recon.reconcileRecentPayouts(stripeAccountId), {
            jobName: `recon-${stripeAccountId}`,
            timeoutMs: 30000,
            concurrency: 2,
          })
          .catch((err) => {
            this.logger.warn(
              `Recon failed for account ${stripeAccountId}: ${err instanceof Error ? err.message : err}`,
            );
          });
      }),
    );
  }

  @Cron("15 * * * *") // hourly, offset
  async alertDisputesDue() {
    const horizonHours = Number(process.env.DISPUTE_DUE_HOURS_ALERT ?? 48);
    const now = new Date();
    const cutoff = new Date(now.getTime() + horizonHours * 60 * 60 * 1000);
    const disputes = await this.prisma.dispute.findMany({
      where: {
        status: { notIn: ["won", "lost", "charge_refunded"] },
        evidenceDueBy: { lte: cutoff, gte: now },
      },
      select: { stripeDisputeId: true, campgroundId: true, evidenceDueBy: true },
    });
    for (const d of disputes) {
      await this.recon.sendAlert(
        `Dispute due soon: ${d.stripeDisputeId} camp ${d.campgroundId} due ${d.evidenceDueBy?.toISOString?.() ?? ""}`,
      );
    }
  }

  @Cron("40 */6 * * *") // every 6 hours, staggered from payout recon
  async refreshStaleCapabilities() {
    if (!this.stripe.isConfigured()) {
      this.logger.log("Skipping capability refresh: Stripe keys not configured.");
      return;
    }

    const cutoff = new Date(Date.now() - this.capabilitiesTtlMs);
    const campgrounds = await this.prisma.campground.findMany({
      where: {
        stripeAccountId: { not: null },
        OR: [
          { stripeCapabilitiesFetchedAt: null },
          { stripeCapabilitiesFetchedAt: { lt: cutoff } },
        ],
      },
      select: { id: true, stripeAccountId: true },
    });

    for (const cg of campgrounds) {
      try {
        const stripeAccountId = cg.stripeAccountId;
        if (!stripeAccountId) continue;
        const capabilities = await this.stripe.retrieveAccountCapabilities(stripeAccountId);
        if (!capabilities) continue;
        await this.prisma.campground.update({
          where: { id: cg.id },
          data: {
            stripeCapabilities: capabilities,
            stripeCapabilitiesFetchedAt: new Date(),
          },
        });
      } catch (err: unknown) {
        this.logger.warn(`Capability refresh failed for ${cg.id}: ${getErrorMessage(err)}`);
      }
    }
  }
}
