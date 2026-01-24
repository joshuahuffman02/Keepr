import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "crypto";

/**
 * Seeds sample finance data (payouts, disputes, gift cards) for UI validation.
 * Safe to run in dev/staging. Idempotent-ish: uses fixed IDs to avoid dupes.
 */
async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL,
  });
  // @ts-ignore Prisma 7 adapter signature
  const prisma = new PrismaClient({ adapter });
  const campgroundId = process.env.SEED_CAMPGROUND_ID || "camp-finance-ui";

  // Sample payout with one line
  const payoutId = "po_ui_sample_1";
  await prisma.payout.upsert({
    where: { id: payoutId },
    create: {
      id: payoutId,
      campgroundId,
      stripePayoutId: "po_ui_stripe_1",
      stripeAccountId: "acct_ui_123",
      amountCents: 125000,
      feeCents: 3500,
      currency: "usd",
      status: "paid",
      arrivalDate: new Date(),
      createdAt: new Date(),
      PayoutLine: {
        create: [
          {
            id: randomUUID(),
            type: "charge",
            amountCents: 90000,
            currency: "usd",
            description: "Booking payment",
            reservationId: "resv_ui_1",
            paymentIntentId: "pi_ui_1",
            chargeId: "ch_ui_1",
            balanceTransactionId: "bt_ui_1",
            createdAt: new Date(),
          },
        ],
      },
    },
    update: {},
  });

  // Sample dispute
  const disputeId = "disp_ui_sample_1";
  await prisma.dispute.upsert({
    where: { id: disputeId },
    create: {
      id: disputeId,
      campgroundId,
      stripeDisputeId: "dp_ui_1",
      stripeChargeId: "ch_ui_2",
      stripePaymentIntentId: "pi_ui_2",
      reservationId: "resv_ui_2",
      payoutId,
      amountCents: 4200,
      currency: "usd",
      reason: "fraudulent",
      status: "needs_response",
      evidenceDueBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      notes: "UI sample dispute",
    },
    update: {},
  });

  console.log("Seeded finance fixtures for campground:", campgroundId);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
