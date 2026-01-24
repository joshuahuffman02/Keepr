import { Test, type TestingModule } from "@nestjs/testing";
import { ReservationsService } from "../reservations/reservations.service";
import { PrismaService } from "../prisma/prisma.service";
import { postBalancedLedgerEntries } from "../ledger/ledger-posting.util";
import { LockService } from "../redis/lock.service";
import { PromotionsService } from "../promotions/promotions.service";
import { EmailService } from "../email/email.service";
import { WaitlistService } from "../waitlist/waitlist.service";
import { LoyaltyService } from "../loyalty/loyalty.service";
import { TaxRulesService } from "../tax-rules/tax-rules.service";
import { MatchScoreService } from "../reservations/match-score.service";
import { GamificationService } from "../gamification/gamification.service";
import { PricingV2Service } from "../pricing-v2/pricing-v2.service";
import { DepositPoliciesService } from "../deposit-policies/deposit-policies.service";
import { AccessControlService } from "../access-control/access-control.service";
import { SignaturesService } from "../signatures/signatures.service";
import { AuditService } from "../audit/audit.service";
import { ApprovalsService } from "../approvals/approvals.service";
import { UsageTrackerService } from "../org-billing/usage-tracker.service";
import { RepeatChargesService } from "../repeat-charges/repeat-charges.service";
import { PoliciesService } from "../policies/policies.service";
import { GuestWalletService } from "../guest-wallet/guest-wallet.service";
import { StripeService } from "../payments/stripe.service";
import { RealtimeService } from "../realtime";

jest.mock("../ledger/ledger-posting.util", () => ({
  postBalancedLedgerEntries: jest.fn().mockResolvedValue(undefined),
}));

type ReservationTx = {
  $queryRaw: jest.Mock;
  site: { findUnique: jest.Mock };
  guest: { findUnique: jest.Mock };
  campground: { findUnique: jest.Mock };
  reservation: { update: jest.Mock };
  payment: { findMany: jest.Mock; update: jest.Mock; create: jest.Mock; findFirst: jest.Mock };
};

type PrismaMock = {
  $transaction: jest.Mock;
};

describe("ReservationsService refundPayment", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
  let tx: ReservationTx;
  let service: ReservationsService;

  beforeEach(async () => {
    tx = {
      $queryRaw: jest.fn(),
      site: { findUnique: jest.fn() },
      guest: { findUnique: jest.fn() },
      campground: { findUnique: jest.fn() },
      reservation: { update: jest.fn() },
      payment: { findMany: jest.fn(), update: jest.fn(), create: jest.fn(), findFirst: jest.fn() },
    };

    prisma = {
      $transaction: jest.fn(async (fn: (client: ReservationTx) => Promise<unknown>) => fn(tx)),
    };

    moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LockService, useValue: {} },
        { provide: PromotionsService, useValue: {} },
        {
          provide: EmailService,
          useValue: { sendPaymentReceipt: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: WaitlistService, useValue: {} },
        { provide: LoyaltyService, useValue: {} },
        { provide: TaxRulesService, useValue: {} },
        { provide: MatchScoreService, useValue: { calculateMatchScore: jest.fn() } },
        { provide: GamificationService, useValue: {} },
        { provide: PricingV2Service, useValue: {} },
        { provide: DepositPoliciesService, useValue: { calculateDeposit: jest.fn() } },
        { provide: AccessControlService, useValue: {} },
        { provide: SignaturesService, useValue: {} },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: ApprovalsService, useValue: {} },
        { provide: UsageTrackerService, useValue: {} },
        { provide: RepeatChargesService, useValue: {} },
        { provide: PoliciesService, useValue: {} },
        { provide: GuestWalletService, useValue: { creditFromRefund: jest.fn() } },
        { provide: StripeService, useValue: {} },
        { provide: RealtimeService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(ReservationsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("throws when refund exceeds paid amount", async () => {
    tx.$queryRaw.mockResolvedValue([
      {
        id: "res1",
        campgroundId: "cg1",
        guestId: "guest1",
        siteId: "site1",
        paidAmount: 5000,
        totalAmount: 5000,
        arrivalDate: new Date(),
        departureDate: new Date(),
        source: "admin",
      },
    ]);

    await expect(service.refundPayment("res1", 6000)).rejects.toThrow("Refund exceeds paid amount");
  });

  it("updates paid amount and posts ledger entries", async () => {
    tx.$queryRaw.mockResolvedValue([
      {
        id: "res1",
        campgroundId: "cg1",
        guestId: "guest1",
        siteId: "site1",
        paidAmount: 5000,
        totalAmount: 5000,
        arrivalDate: new Date(),
        departureDate: new Date(),
        source: "admin",
      },
    ]);
    tx.site.findUnique.mockResolvedValue({ siteClass: { glCode: "GL", clientAccount: "Revenue" } });
    tx.guest.findUnique.mockResolvedValue({
      email: "guest@example.com",
      primaryFirstName: "Test",
      primaryLastName: "Guest",
    });
    tx.campground.findUnique.mockResolvedValue({ name: "Campground" });
    tx.reservation.update.mockResolvedValue({ id: "res1", paidAmount: 3000 });
    tx.payment.findMany.mockResolvedValue([
      { id: "pay1", amountCents: 5000, refundedAmountCents: 0, createdAt: new Date() },
    ]);
    tx.payment.update.mockResolvedValue({});
    tx.payment.create.mockResolvedValue({});

    await service.refundPayment("res1", 2000);

    expect(tx.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: 3000,
          balanceAmount: 2000,
          paymentStatus: "partial",
        }),
      }),
    );
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountCents: 2000,
          direction: "refund",
        }),
      }),
    );
    expect(postBalancedLedgerEntries).toHaveBeenCalled();
  });
});
