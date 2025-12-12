import { BadRequestException } from "@nestjs/common";
import { IdempotencyStatus } from "@prisma/client";
import { PaymentsController } from "../payments/payments.controller";
import { PosService } from "../pos/pos.service";

describe("PaymentsController public intents", () => {
  const stripeService: any = { createPaymentIntent: jest.fn() };
  const idempotency: any = { start: jest.fn(), complete: jest.fn(), fail: jest.fn() };
  const controller = new PaymentsController(
    {} as any,
    stripeService,
    {} as any,
    {} as any,
    idempotency,
    { getConfig: jest.fn().mockResolvedValue({ gateway: "stripe", mode: "test", feeMode: "absorb" }) } as any
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (controller as any).getPaymentContext = jest.fn().mockResolvedValue({
      stripeAccountId: "acct_123",
      applicationFeeCents: 0,
      feeMode: "absorb",
      reservation: {},
      campgroundId: "cg1",
      capabilities: {},
      gatewayConfig: { gateway: "stripe", mode: "test" },
      gatewayFeePercentBasisPoints: 0,
      gatewayFeeFlatCents: 0
    });
  });

  it("reuses idempotent response for public intents", async () => {
    idempotency.start.mockResolvedValue({ status: IdempotencyStatus.succeeded, responseJson: { ok: true } });
    const resp = await controller.createPublicIntent({ reservationId: "r1", amountCents: 100 } as any, "abc");
    expect(resp).toEqual({ ok: true });
    expect(stripeService.createPaymentIntent).not.toHaveBeenCalled();
  });

  it("applies 3DS policy for EU currencies", async () => {
    idempotency.start.mockResolvedValue({ status: IdempotencyStatus.failed });
    stripeService.createPaymentIntent.mockResolvedValue({ id: "pi_1", client_secret: "secret", status: "requires_action" });
    const resp = await controller.createPublicIntent({ reservationId: "r1", amountCents: 100, currency: "EUR" } as any, "abc2");
    expect(resp.threeDsPolicy).toBe("any");
    expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
      100,
      "eur",
      expect.any(Object),
      "acct_123",
      0,
      "automatic",
      expect.anything(),
      "abc2",
      "any"
    );
  });
});

describe("POS offline replay persistence", () => {
  const prisma: any = {
    posCart: { findUnique: jest.fn() },
    posOfflineReplay: { upsert: jest.fn(), create: jest.fn() },
    idempotencyRecord: {},
    $transaction: jest.fn()
  };
  const idempotency: any = {
    findBySequence: jest.fn().mockResolvedValue(null),
    start: jest.fn().mockResolvedValue({ status: IdempotencyStatus.failed }),
    complete: jest.fn(),
    fail: jest.fn()
  };
  const service = new PosService(
    prisma as any,
    idempotency as any,
    {} as any,
    { createPaymentIntent: jest.fn() } as any,
    { findOpenSessionForTerminal: jest.fn().mockResolvedValue({ id: "sess" }) } as any,
    { recordOfflineReplay: jest.fn() } as any,
    {} as any,
    {} as any,
    { sendPaymentReceipt: jest.fn() } as any
  );

  it("stores payload, tender, and hashes on offline replay", async () => {
    prisma.posCart.findUnique.mockResolvedValue({ id: "cart1", items: [{ totalCents: 100, taxCents: 0, feeCents: 0 }] });
    const dto: any = {
      clientTxId: "tx123",
      pricingVersion: "v1",
      taxVersion: "t1",
      payload: { cartId: "cart1", payments: [{ method: "cash", amountCents: 100 }], items: [{ productId: "p1", qty: 1, totalCents: 100 }] },
      recordedTotalsHash: "abc"
    };
    await service.replayOffline(dto, "idem", { campgroundId: "cg1" });
    expect(prisma.posOfflineReplay.upsert).toHaveBeenCalled();
    const args = prisma.posOfflineReplay.upsert.mock.calls[0][0];
    expect(args.create?.payload).toBeDefined();
    expect(args.create?.tender?.[0]?.method).toBe("cash");
  });
});

describe("Stored value taxable load validation", () => {
  const prisma: any = {
    taxRule: { findFirst: jest.fn().mockResolvedValue(null) },
    storedValueAccount: { findMany: jest.fn(), findUnique: jest.fn() },
    storedValueLedger: { findMany: jest.fn(), create: jest.fn() },
    storedValueCode: { create: jest.fn() },
    $transaction: jest.fn()
  };
  const service = new StoredValueService(prisma as any, { start: jest.fn(), complete: jest.fn(), fail: jest.fn() } as any, { recordRedeemOutcome: jest.fn() } as any);

  it("rejects taxable load without active tax rule", async () => {
    await expect(
      service.issue({ amountCents: 1000, currency: "usd", taxableLoad: true } as any, undefined, { campgroundId: "cg1" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("POS checkout receipts", () => {
  it("sends itemized receipt when email is present", async () => {
    const prisma: any = {
      posCart: {
        findUnique: jest.fn().mockResolvedValue({
          id: "cart1",
          items: [{ productId: "p1", totalCents: 100, taxCents: 0, feeCents: 0, qty: 1, product: { name: "Soda" } }],
          payments: []
        })
      },
      $transaction: jest.fn(async (fn: any) =>
        fn({
          posPayment: { create: jest.fn().mockResolvedValue({ currency: "usd" }) },
          tillMovement: { create: jest.fn() },
          posCart: { update: jest.fn() }
        })
      )
    };
    const email = { sendPaymentReceipt: jest.fn() };
    const service = new PosService(
      prisma as any,
      { start: jest.fn().mockResolvedValue(null), complete: jest.fn(), fail: jest.fn() } as any,
      {} as any,
      { createPaymentIntent: jest.fn() } as any,
      { findOpenSessionForTerminal: jest.fn().mockResolvedValue({ id: "sess" }) } as any,
      { recordOfflineReplay: jest.fn() } as any,
      {} as any,
      {} as any,
      email as any
    );

    await service.checkout(
      "cart1",
      { payments: [{ method: "cash", amountCents: 100, currency: "usd" }] } as any,
      "idem-pos",
      { campgroundId: "cg1", email: "guest@example.com", name: "Guest" }
    );
    expect(email.sendPaymentReceipt).toHaveBeenCalled();
    expect(email.sendPaymentReceipt.mock.calls[0][0].lineItems[0].label).toBe("Soda");
  });
});
