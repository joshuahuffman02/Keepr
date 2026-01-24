import express = require("express");
import { Test, type TestingModule } from "@nestjs/testing";
import type { Request } from "express";
import { ReservationsService } from "../reservations/reservations.service";
import { StripeService } from "../payments/stripe.service";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsReconciliationService } from "../payments/reconciliation.service";
import { PaymentsController } from "../payments/payments.controller";
import { PermissionsService } from "../permissions/permissions.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { GatewayConfigService } from "../payments/gateway-config.service";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import type { AuthUser } from "../auth/auth.types";
import { buildAuthMembership, buildAuthUser } from "../test-helpers/auth";

describe("Payments finance smoke", () => {
  let moduleRef: TestingModule;
  const campgroundId = "camp-finance-smoke";

  const payoutRows = [
    {
      id: "po_1",
      campgroundId,
      stripePayoutId: "po_stripe_1",
      stripeAccountId: "acct_123",
      amountCents: 55000,
      feeCents: 1500,
      currency: "usd",
      status: "paid",
      createdAt: new Date().toISOString(),
      arrivalDate: new Date().toISOString(),
      PayoutLine: [
        {
          id: "line_1",
          type: "charge",
          amountCents: 40000,
          currency: "usd",
          description: "Booking payment",
          reservationId: "resv_1",
          paymentIntentId: "pi_1",
          chargeId: "ch_1",
          balanceTransactionId: "bt_1",
          createdAt: new Date().toISOString(),
        },
      ],
    },
  ];

  const disputeRows = [
    {
      id: "disp_1",
      campgroundId,
      stripeDisputeId: "dp_1",
      stripeChargeId: "ch_2",
      stripePaymentIntentId: "pi_2",
      reservationId: "resv_2",
      payoutId: "po_1",
      amountCents: 12000,
      currency: "usd",
      reason: "fraudulent",
      status: "needs_response",
      evidenceDueBy: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: null,
    },
  ];

  const payoutFindMany = jest.fn().mockResolvedValue(payoutRows);
  const disputeFindMany = jest.fn().mockResolvedValue(disputeRows);
  const idempotencyMock = {
    withLock: async (_key: string, fn: () => unknown) => fn(),
    start: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
  };
  type AuthedRequest = Request & { user?: AuthUser };
  const requestApp = express();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: ReservationsService,
          useValue: {},
        },
        {
          provide: StripeService,
          useValue: {},
        },
        {
          provide: PaymentsReconciliationService,
          useValue: {
            reconcilePayout: jest.fn(),
            upsertDispute: jest.fn(),
            sendAlert: jest.fn(),
            computeReconSummary: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            payout: { findMany: payoutFindMany },
            dispute: { findMany: disputeFindMany },
          },
        },
        {
          provide: PermissionsService,
          useValue: { checkAccess: async () => ({ allowed: true }), isPlatformStaff: () => true },
        },
        {
          provide: IdempotencyService,
          useValue: idempotencyMock,
        },
        {
          provide: GatewayConfigService,
          useValue: {
            getConfig: jest.fn().mockResolvedValue({
              gateway: "stripe",
              mode: "test",
              feeMode: "absorb",
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ScopeGuard)
      .useValue({ canActivate: () => true })
      .compile();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("lists payouts with lines", async () => {
    const req: AuthedRequest = Object.assign(requestApp.request, {
      user: buildAuthUser({
        id: "tester",
        role: "finance",
        memberships: [buildAuthMembership({ campgroundId, role: "finance" })],
      }),
    });
    const res = await moduleRef
      .get(PaymentsController)
      .listPayouts(campgroundId, undefined, undefined, undefined, req);

    expect(payoutFindMany).toHaveBeenCalledWith({
      where: { campgroundId, status: undefined },
      orderBy: { createdAt: "desc" },
      take: 100,
      skip: 0,
      include: { PayoutLine: true },
    });
    expect(Array.isArray(res)).toBe(true);
    expect(res[0].id).toBe(payoutRows[0].id);
    expect(res[0].status).toBe("paid");
    expect(Array.isArray(res[0].lines)).toBe(true);
    expect(res[0].lines[0].amountCents).toBe(40000);
  });

  it("lists disputes with status and due dates", async () => {
    const req: AuthedRequest = Object.assign(requestApp.request, {
      user: buildAuthUser({
        id: "tester",
        role: "finance",
        memberships: [buildAuthMembership({ campgroundId, role: "finance" })],
      }),
    });
    const res = await moduleRef
      .get(PaymentsController)
      .listDisputes(campgroundId, undefined, undefined, undefined, req);

    expect(disputeFindMany).toHaveBeenCalledWith({
      where: { campgroundId, status: undefined },
      orderBy: { createdAt: "desc" },
      take: 100,
      skip: 0,
    });
    expect(Array.isArray(res)).toBe(true);
    expect(res[0].stripeDisputeId).toBe(disputeRows[0].stripeDisputeId);
    expect(res[0].status).toBe(disputeRows[0].status);
    expect(res[0].evidenceDueBy).toBe(disputeRows[0].evidenceDueBy);
  });
});
