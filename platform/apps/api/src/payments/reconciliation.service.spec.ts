import { PaymentsReconciliationService, mapReconLineType } from "./reconciliation.service";
import type {
  LedgerServiceLike,
  PaymentsReconciliationStore,
  StripeServiceLike,
} from "./reconciliation.service";

describe("PaymentsReconciliationService", () => {
  let service: PaymentsReconciliationService;
  let mockPrisma: jest.Mocked<PaymentsReconciliationStore>;
  let mockStripeService: jest.Mocked<StripeServiceLike>;
  let mockLedger: jest.Mocked<LedgerServiceLike>;

  beforeEach(() => {
    mockPrisma = {
      campground: {
        findFirst: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      payout: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      payoutLine: {
        create: jest.fn(),
      },
      payoutRecon: {
        upsert: jest.fn(),
      },
      payoutReconLine: {
        create: jest.fn(),
      },
      dispute: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      reservation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      ledgerEntry: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    mockStripeService = {
      listBalanceTransactionsForPayout: jest.fn().mockResolvedValue({ data: [] }),
      listPayouts: jest.fn().mockResolvedValue({ data: [] }),
    };

    mockLedger = {
      ensureAccount: jest.fn().mockResolvedValue("account-id"),
      postEntries: jest.fn().mockResolvedValue({ entryIds: ["entry-1"] }),
    };

    service = new PaymentsReconciliationService(mockPrisma, mockStripeService, mockLedger);
  });

  describe("mapReconLineType", () => {
    const baseTxn = { id: "txn_base", amount: 0, created: 0 };

    it("should map payout type", () => {
      expect(mapReconLineType({ ...baseTxn, type: "payout" })).toBe("payout");
    });

    it("should map application_fee to fee", () => {
      expect(mapReconLineType({ ...baseTxn, type: "application_fee" })).toBe("fee");
    });

    it("should map fee reporting_category to fee", () => {
      expect(mapReconLineType({ ...baseTxn, type: "other", reporting_category: "fee" })).toBe(
        "fee",
      );
    });

    it("should map dispute to chargeback", () => {
      expect(mapReconLineType({ ...baseTxn, type: "dispute" })).toBe("chargeback");
      expect(
        mapReconLineType({ ...baseTxn, type: "other", reporting_category: "charge_dispute" }),
      ).toBe("chargeback");
    });

    it("should map reserve_transaction to reserve", () => {
      expect(mapReconLineType({ ...baseTxn, type: "reserve_transaction" })).toBe("reserve");
    });

    it("should map adjustment to adjustment", () => {
      expect(mapReconLineType({ ...baseTxn, type: "adjustment" })).toBe("adjustment");
    });

    it("should map unknown types to other", () => {
      expect(mapReconLineType({ ...baseTxn, type: "unknown" })).toBe("other");
      expect(mapReconLineType({ ...baseTxn, type: "charge" })).toBe("other");
    });
  });

  describe("lookupCampgroundIdByStripeAccount", () => {
    it("should return campground ID for valid stripe account", async () => {
      mockPrisma.campground.findFirst.mockResolvedValue({ id: "cg-123" });

      const result = await service.lookupCampgroundIdByStripeAccount("acct_123");

      expect(result).toBe("cg-123");
    });

    it("should return empty string for unknown stripe account", async () => {
      mockPrisma.campground.findFirst.mockResolvedValue(null);

      const result = await service.lookupCampgroundIdByStripeAccount("acct_unknown");

      expect(result).toBe("");
    });

    it("should return empty string for null/undefined account", async () => {
      expect(await service.lookupCampgroundIdByStripeAccount(null)).toBe("");
      expect(await service.lookupCampgroundIdByStripeAccount(undefined)).toBe("");
    });
  });

  describe("upsertPayoutFromStripe", () => {
    it("should upsert payout record from Stripe data", async () => {
      const payout = {
        id: "po_123",
        destination: "acct_456",
        amount: 100000,
        fee: 500,
        currency: "usd",
        status: "paid",
        arrival_date: Math.floor(Date.now() / 1000),
        statement_descriptor: "CAMPGROUND PAYOUT",
      };

      mockPrisma.campground.findFirst.mockResolvedValue({ id: "cg-1" });
      mockPrisma.payout.upsert.mockResolvedValue({
        id: "internal-payout-1",
        stripePayoutId: "po_123",
        campgroundId: "cg-1",
      });

      const result = await service.upsertPayoutFromStripe(payout);

      expect(mockPrisma.payout.upsert).toHaveBeenCalledWith({
        where: { stripePayoutId: "po_123" },
        update: expect.objectContaining({
          amountCents: 100000,
          feeCents: 500,
          status: "paid",
        }),
        create: expect.objectContaining({
          stripePayoutId: "po_123",
          amountCents: 100000,
          currency: "usd",
        }),
      });
      expect(result.stripePayoutId).toBe("po_123");
    });
  });

  describe("upsertDispute", () => {
    it("should upsert dispute from Stripe webhook", async () => {
      const dispute = {
        id: "dp_123",
        charge: "ch_456",
        payment_intent: "pi_789",
        account: "acct_123",
        amount: 5000,
        currency: "usd",
        status: "needs_response",
        reason: "fraudulent",
        metadata: { reservationId: "res-1" },
        evidence_details: {
          due_by: Math.floor(Date.now() / 1000) + 86400,
        },
        evidence: {
          product_description: "Campsite reservation",
        },
      };

      mockPrisma.campground.findFirst.mockResolvedValue({ id: "cg-1" });
      mockPrisma.dispute.findUnique.mockResolvedValue(null); // No existing dispute
      mockPrisma.dispute.upsert.mockResolvedValue({ id: "dispute-1" });
      mockPrisma.ledgerEntry.findFirst.mockResolvedValue(null); // No existing ledger
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: "res-1",
        paidAmount: 10000,
        totalAmount: 10000,
      });
      mockPrisma.reservation.update.mockResolvedValue({ id: "res-1" });
      mockPrisma.payment.create.mockResolvedValue({ id: "payment-1" });

      await service.upsertDispute(dispute);

      expect(mockPrisma.dispute.upsert).toHaveBeenCalledWith({
        where: { stripeDisputeId: "dp_123" },
        update: expect.objectContaining({
          amountCents: 5000,
          status: "needs_response",
          reason: "fraudulent",
        }),
        create: expect.objectContaining({
          stripeDisputeId: "dp_123",
          stripeChargeId: "ch_456",
          stripePaymentIntentId: "pi_789",
          reservationId: "res-1",
        }),
      });
    });

    it("should adjust reservation balance on first dispute creation", async () => {
      const dispute = {
        id: "dp_new",
        charge: "ch_456",
        payment_intent: "pi_789",
        account: "acct_123",
        amount: 5000, // $50 dispute
        currency: "usd",
        status: "needs_response",
        reason: "fraudulent",
        metadata: { reservationId: "res-1" },
        evidence_details: {},
        evidence: {},
      };

      mockPrisma.campground.findFirst.mockResolvedValue({ id: "cg-1" });
      mockPrisma.dispute.findUnique.mockResolvedValue(null); // New dispute
      mockPrisma.dispute.upsert.mockResolvedValue({
        id: "dispute-1",
        stripeDisputeId: "dp_new",
        reason: "fraudulent",
      });
      mockPrisma.ledgerEntry.findFirst.mockResolvedValue(null); // No existing ledger entries
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: "res-1",
        paidAmount: 10000, // $100 paid
        totalAmount: 10000, // $100 total
      });
      mockPrisma.reservation.update.mockResolvedValue({ id: "res-1" });
      mockPrisma.payment.create.mockResolvedValue({ id: "payment-1" });

      await service.upsertDispute(dispute);

      // Should update reservation balance
      expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
        where: { id: "res-1" },
        data: {
          paidAmount: 5000, // Reduced from 10000 to 5000
          balanceAmount: 5000, // Now has $50 balance
          paymentStatus: "partial", // Changed from paid to partial
        },
      });

      // Should create a chargeback payment record
      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: {
          campgroundId: "cg-1",
          reservationId: "res-1",
          amountCents: 5000,
          method: "chargeback",
          direction: "refund",
          note: "Chargeback/dispute: dp_new",
        },
      });

      // Should post ledger entries
      expect(mockLedger.postEntries).toHaveBeenCalledWith(
        expect.objectContaining({
          campgroundId: "cg-1",
          reservationId: "res-1",
          description: "Chargeback: dispute dp_new",
        }),
      );
    });

    it("should not adjust balance if dispute already exists (idempotency)", async () => {
      const dispute = {
        id: "dp_existing",
        charge: "ch_456",
        payment_intent: "pi_789",
        account: "acct_123",
        amount: 5000,
        currency: "usd",
        status: "under_review", // Status update
        reason: "fraudulent",
        metadata: { reservationId: "res-1" },
        evidence_details: {},
        evidence: {},
      };

      mockPrisma.campground.findFirst.mockResolvedValue({ id: "cg-1" });
      mockPrisma.dispute.findUnique.mockResolvedValue({ reason: "fraudulent" }); // Already exists
      mockPrisma.dispute.upsert.mockResolvedValue({ id: "dispute-1" });

      await service.upsertDispute(dispute);

      // Should NOT update reservation or create payment (already processed)
      expect(mockPrisma.reservation.update).not.toHaveBeenCalled();
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
      expect(mockLedger.postEntries).not.toHaveBeenCalled();
    });

    it("should find reservation via payment if not in metadata", async () => {
      const dispute = {
        id: "dp_lookup",
        charge: "ch_456",
        payment_intent: null, // No payment intent
        account: "acct_123",
        amount: 3000,
        currency: "usd",
        status: "needs_response",
        reason: "product_not_received",
        metadata: {}, // No reservationId in metadata
        evidence_details: {},
        evidence: {},
      };

      mockPrisma.campground.findFirst.mockResolvedValue({ id: "cg-1" });
      mockPrisma.dispute.findUnique.mockResolvedValue(null);
      // Payment lookup returns the reservation ID
      mockPrisma.payment.findFirst.mockResolvedValue({
        reservationId: "res-found",
        campgroundId: "cg-1",
      });
      mockPrisma.dispute.upsert.mockResolvedValue({
        id: "dispute-1",
        stripeDisputeId: "dp_lookup",
        reason: "product_not_received",
      });
      mockPrisma.ledgerEntry.findFirst.mockResolvedValue(null);
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: "res-found",
        paidAmount: 5000,
        totalAmount: 5000,
      });
      mockPrisma.reservation.update.mockResolvedValue({ id: "res-found" });
      mockPrisma.payment.create.mockResolvedValue({ id: "payment-1" });

      await service.upsertDispute(dispute);

      // Should lookup payment by charge ID
      expect(mockPrisma.payment.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ stripeChargeId: "ch_456" }],
        },
        select: { reservationId: true },
      });

      // Should adjust the found reservation
      expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
        where: { id: "res-found" },
        data: expect.objectContaining({
          paidAmount: 2000, // 5000 - 3000
        }),
      });
    });

    it("should skip ledger entries if they already exist (double idempotency)", async () => {
      const dispute = {
        id: "dp_ledger_exists",
        charge: "ch_456",
        payment_intent: "pi_789",
        account: "acct_123",
        amount: 5000,
        currency: "usd",
        status: "needs_response",
        reason: "fraudulent",
        metadata: { reservationId: "res-1" },
        evidence_details: {},
        evidence: {},
      };

      mockPrisma.campground.findFirst.mockResolvedValue({ id: "cg-1" });
      mockPrisma.dispute.findUnique.mockResolvedValue(null); // Dispute record doesn't exist yet
      mockPrisma.dispute.upsert.mockResolvedValue({ id: "dispute-1" });
      // Ledger entry already exists (e.g., from partial processing)
      mockPrisma.ledgerEntry.findFirst.mockResolvedValue({ id: "ledger-1" });

      await service.upsertDispute(dispute);

      // Should NOT update reservation or create payment or post ledger
      expect(mockPrisma.reservation.update).not.toHaveBeenCalled();
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
      expect(mockLedger.postEntries).not.toHaveBeenCalled();
    });
  });

  describe("computeReconSummary", () => {
    it("should compute reconciliation summary", async () => {
      mockPrisma.payout.findFirst.mockResolvedValue({
        id: "payout-1",
        campgroundId: "cg-1",
        amountCents: 100000,
        feeCents: 500,
        lines: [
          { amountCents: 50000, reservationId: "res-1" },
          { amountCents: 49500, reservationId: "res-2" },
        ],
      });
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        { direction: "credit", amountCents: 50000 },
        { direction: "credit", amountCents: 49500 },
      ]);
      mockPrisma.payout.update.mockResolvedValue({
        id: "payout-1",
        campgroundId: "cg-1",
      });

      const result = await service.computeReconSummary("payout-1", "cg-1");

      expect(result.payoutAmountCents).toBe(100000);
      expect(result.payoutFeeCents).toBe(500);
      expect(result.payoutNetCents).toBe(99500);
      expect(result.lineSumCents).toBe(99500);
    });

    it("should throw when payout not found", async () => {
      mockPrisma.payout.findFirst.mockResolvedValue(null);

      await expect(service.computeReconSummary("invalid", "cg-1")).rejects.toThrow(
        "Payout not found",
      );
    });

    it("should detect drift and update recon status", async () => {
      mockPrisma.payout.findFirst.mockResolvedValue({
        id: "payout-1",
        campgroundId: "cg-1",
        amountCents: 100000,
        feeCents: 0,
        lines: [{ amountCents: 90000, reservationId: "res-1" }],
      });
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        { direction: "credit", amountCents: 80000 },
      ]);
      mockPrisma.payout.update.mockResolvedValue({
        id: "payout-1",
        campgroundId: "cg-1",
      });

      const result = await service.computeReconSummary("payout-1", "cg-1");

      // 100000 net - 80000 ledger = 20000 drift
      expect(result.driftVsLedgerCents).toBe(20000);
    });
  });

  describe("sendAlert", () => {
    it("should log warning when no webhook configured", async () => {
      const originalEnv = process.env.ALERT_WEBHOOK_URL;
      delete process.env.ALERT_WEBHOOK_URL;

      // Should not throw
      await expect(service.sendAlert("Test alert")).resolves.toBeUndefined();

      process.env.ALERT_WEBHOOK_URL = originalEnv;
    });
  });

  describe("reconcileRecentPayouts", () => {
    it("should reconcile multiple payouts", async () => {
      mockStripeService.listPayouts.mockResolvedValue({
        data: [
          { id: "po_1", destination: "acct_1", amount: 10000, status: "paid" },
          { id: "po_2", destination: "acct_1", amount: 20000, status: "paid" },
        ],
      });

      // Mock the full reconciliation flow
      mockPrisma.campground.findFirst.mockResolvedValue({ id: "cg-1" });
      mockPrisma.payout.upsert.mockResolvedValue({
        id: "internal-1",
        campgroundId: "cg-1",
        stripePayoutId: "po_1",
      });
      mockPrisma.payoutRecon.upsert.mockResolvedValue({ id: "recon-1" });
      mockPrisma.payout.findFirst.mockResolvedValue({
        id: "internal-1",
        campgroundId: "cg-1",
        amountCents: 10000,
        feeCents: 0,
        lines: [],
      });
      mockPrisma.ledgerEntry.findFirst.mockResolvedValue(null);
      mockPrisma.payout.update.mockResolvedValue({
        id: "internal-1",
        campgroundId: "cg-1",
      });

      const results = await service.reconcileRecentPayouts("acct_1", 86400);

      expect(results.length).toBe(2);
    });

    it("should handle errors gracefully", async () => {
      mockStripeService.listPayouts.mockResolvedValue({
        data: [{ id: "po_1", destination: "acct_1" }],
      });
      mockPrisma.payout.upsert.mockRejectedValue(new Error("DB error"));

      // Should not throw, just return empty results
      const results = await service.reconcileRecentPayouts("acct_1");

      expect(results).toHaveLength(0);
    });
  });

  describe("ingestPayoutTransactions", () => {
    it("should skip when no stripe account", async () => {
      const payout = { id: "po_1", destination: null };
      const payoutRecord = { id: "internal-1", campgroundId: "cg-1" };

      await service.ingestPayoutTransactions(payout, payoutRecord);

      expect(mockStripeService.listBalanceTransactionsForPayout).not.toHaveBeenCalled();
    });

    it("should process balance transactions", async () => {
      const payout = {
        id: "po_1",
        destination: "acct_1",
        amount: 10000,
        currency: "usd",
      };
      const payoutRecord = {
        id: "internal-1",
        campgroundId: "cg-1",
      };

      mockPrisma.payoutRecon.upsert.mockResolvedValue({ id: "recon-1" });
      mockStripeService.listBalanceTransactionsForPayout.mockResolvedValue({
        data: [
          {
            id: "txn_1",
            type: "charge",
            source: "ch_1",
            amount: 10000,
            fee: 290,
            currency: "usd",
            created: Math.floor(Date.now() / 1000),
          },
        ],
      });
      mockPrisma.payment.findFirst.mockResolvedValue({
        reservationId: "res-1",
        campgroundId: "cg-1",
      });

      await service.ingestPayoutTransactions(payout, payoutRecord);

      expect(mockPrisma.payoutLine.create).toHaveBeenCalled();
      expect(mockLedger.postEntries).toHaveBeenCalled(); // For the fee
    });

    it("should post double entry for chargebacks", async () => {
      const payout = { id: "po_1", destination: "acct_1", amount: 10000 };
      const payoutRecord = { id: "internal-1", campgroundId: "cg-1" };

      mockPrisma.payoutRecon.upsert.mockResolvedValue({ id: "recon-1" });
      mockStripeService.listBalanceTransactionsForPayout.mockResolvedValue({
        data: [
          {
            id: "txn_1",
            type: "dispute",
            reporting_category: "charge_dispute",
            source: "ch_1",
            amount: -5000,
            fee: 0,
            currency: "usd",
            created: Math.floor(Date.now() / 1000),
          },
        ],
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await service.ingestPayoutTransactions(payout, payoutRecord);

      expect(mockLedger.postEntries).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining("Chargeback"),
        }),
      );
    });
  });
});
