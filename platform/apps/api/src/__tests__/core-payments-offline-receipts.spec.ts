import { BadRequestException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { IdempotencyStatus, PosCartStatus } from "@prisma/client";
import { PaymentsController } from "../payments/payments.controller";
import { PosService } from "../pos/pos.service";
import { StoredValueService } from "../stored-value/stored-value.service";
import { ReservationsService } from "../reservations/reservations.service";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsReconciliationService } from "../payments/reconciliation.service";
import { StripeService } from "../payments/stripe.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { GatewayConfigService } from "../payments/gateway-config.service";
import { GuestWalletService } from "../guest-wallet/guest-wallet.service";
import { TillService } from "../pos/till.service";
import { ObservabilityService } from "../observability/observability.service";
import { PosProviderService } from "../pos/pos-provider.service";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { BatchInventoryService } from "../inventory/batch-inventory.service";
import { MarkdownRulesService } from "../inventory/markdown-rules.service";
import { ScopeGuard } from "../permissions/scope.guard";

jest.mock("../ledger/ledger-posting.util", () => ({
  postBalancedLedgerEntries: jest.fn().mockResolvedValue([]),
}));

// Mock crypto module for default export compatibility
jest.mock("crypto", () => {
  const actual = jest.requireActual("crypto");
  return {
    ...actual,
    default: actual,
    __esModule: true,
  };
});

type IdempotencyMock = {
  findBySequence: jest.Mock;
  start: jest.Mock;
  complete: jest.Mock;
  fail: jest.Mock;
};

type PosPrismaMock = {
  posCart: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  posOfflineReplay: {
    upsert: jest.Mock;
    create: jest.Mock;
  };
  $transaction: jest.Mock;
};

type PosTransactionMock = {
  posPayment: { create: jest.Mock };
  tillMovement: { create: jest.Mock };
  posCart: { update: jest.Mock };
};

type PosModuleMocks = {
  prisma: PosPrismaMock;
  idempotency: IdempotencyMock;
  observability: { recordOfflineReplay: jest.Mock };
  email: { sendPaymentReceipt: jest.Mock };
  till: { findOpenSessionForTerminal: jest.Mock };
  moduleRef: TestingModule;
  service: PosService;
};

const createPosModule = async (): Promise<PosModuleMocks> => {
  const prisma: PosPrismaMock = {
    posCart: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    posOfflineReplay: { upsert: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };
  const idempotency: IdempotencyMock = {
    findBySequence: jest.fn().mockResolvedValue(null),
    start: jest.fn().mockResolvedValue({ status: IdempotencyStatus.failed }),
    complete: jest.fn(),
    fail: jest.fn(),
  };
  const observability = { recordOfflineReplay: jest.fn() };
  const email = { sendPaymentReceipt: jest.fn() };
  const till = { findOpenSessionForTerminal: jest.fn().mockResolvedValue({ id: "sess" }) };

  const moduleRef = await Test.createTestingModule({
    providers: [
      PosService,
      { provide: PrismaService, useValue: prisma },
      { provide: IdempotencyService, useValue: idempotency },
      { provide: StoredValueService, useValue: { redeem: jest.fn() } },
      { provide: GuestWalletService, useValue: { debitForPayment: jest.fn() } },
      {
        provide: StripeService,
        useValue: {
          createPaymentIntent: jest.fn(),
          isConfigured: jest.fn().mockReturnValue(false),
        },
      },
      { provide: TillService, useValue: till },
      { provide: ObservabilityService, useValue: observability },
      { provide: PosProviderService, useValue: { routePayment: jest.fn() } },
      { provide: AuditService, useValue: { record: jest.fn() } },
      { provide: EmailService, useValue: email },
      { provide: BatchInventoryService, useValue: {} },
      { provide: MarkdownRulesService, useValue: {} },
    ],
  }).compile();

  return {
    prisma,
    idempotency,
    observability,
    email,
    till,
    moduleRef,
    service: moduleRef.get(PosService),
  };
};

describe("PaymentsController public intents", () => {
  let moduleRef: TestingModule;
  let controller: PaymentsController;
  let stripeService: { createPaymentIntent: jest.Mock };
  let idempotency: { start: jest.Mock; complete: jest.Mock; fail: jest.Mock };

  const isThreeDsResponse = (value: unknown): value is { threeDsPolicy?: string } =>
    typeof value === "object" && value !== null && "threeDsPolicy" in value;
  let gatewayConfigService: { getConfig: jest.Mock };

  beforeEach(async () => {
    stripeService = { createPaymentIntent: jest.fn() };
    idempotency = { start: jest.fn(), complete: jest.fn(), fail: jest.fn() };
    gatewayConfigService = {
      getConfig: jest
        .fn()
        .mockResolvedValue({ gateway: "stripe", mode: "test", feeMode: "absorb" }),
    };

    moduleRef = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: ReservationsService, useValue: {} },
        { provide: StripeService, useValue: stripeService },
        { provide: PrismaService, useValue: {} },
        { provide: PaymentsReconciliationService, useValue: {} },
        { provide: IdempotencyService, useValue: idempotency },
        { provide: GatewayConfigService, useValue: gatewayConfigService },
      ],
    })
      .overrideGuard(ScopeGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(PaymentsController);

    const getPaymentContext = jest.fn().mockResolvedValue({
      stripeAccountId: "acct_123",
      applicationFeeCents: 0,
      feeMode: "absorb",
      reservation: { balanceAmount: 1000 },
      campgroundId: "cg1",
      capabilities: {},
      gatewayConfig: { gateway: "stripe", mode: "test" },
      gatewayFeePercentBasisPoints: 0,
      gatewayFeeFlatCents: 0,
    });
    Object.defineProperty(controller, "getPaymentContext", { value: getPaymentContext });
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("reuses idempotent response for public intents", async () => {
    idempotency.start.mockResolvedValue({
      status: IdempotencyStatus.succeeded,
      responseJson: { ok: true },
    });
    const resp = await controller.createPublicIntent({ reservationId: "r1" }, "abc");
    expect(resp).toEqual({ ok: true });
    expect(stripeService.createPaymentIntent).not.toHaveBeenCalled();
  });

  it("applies 3DS policy for EU currencies", async () => {
    idempotency.start.mockResolvedValue({ status: IdempotencyStatus.failed });
    stripeService.createPaymentIntent.mockResolvedValue({
      id: "pi_1",
      client_secret: "secret",
      status: "requires_action",
    });
    const resp = await controller.createPublicIntent(
      { reservationId: "r1", currency: "EUR" },
      "abc2",
    );
    if (!isThreeDsResponse(resp)) {
      throw new Error("Expected public intent response to be an object");
    }
    expect(resp.threeDsPolicy).toBe("any");
    // Verify the 3DS policy is passed as "any" for EU currency
    expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
      expect.any(Number), // amount comes from reservation balance
      "eur",
      expect.any(Object),
      "acct_123",
      0,
      "automatic",
      expect.anything(),
      "abc2",
      "any", // 3DS policy for EU
    );
  });
});

describe("POS offline replay persistence", () => {
  let moduleRef: TestingModule;
  let service: PosService;
  let prisma: PosPrismaMock;

  beforeEach(async () => {
    const module = await createPosModule();
    moduleRef = module.moduleRef;
    service = module.service;
    prisma = module.prisma;
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("stores payload, tender, and hashes on offline replay", async () => {
    prisma.posCart.findUnique.mockResolvedValue({
      id: "cart1",
      status: PosCartStatus.open,
      PosCartItem: [{ totalCents: 100, taxCents: 0, feeCents: 0 }],
    });
    const dto = {
      clientTxId: "tx123",
      pricingVersion: "v1",
      taxVersion: "t1",
      payload: {
        cartId: "cart1",
        payments: [{ method: "cash", amountCents: 100 }],
        items: [{ productId: "p1", qty: 1, totalCents: 100 }],
      },
      recordedTotalsHash: "abc",
    };
    await service.replayOffline(dto, "idem", { campgroundId: "cg1" });
    expect(prisma.posOfflineReplay.upsert).toHaveBeenCalled();
    const args = prisma.posOfflineReplay.upsert.mock.calls[0][0];
    expect(args.create?.payload).toBeDefined();
    expect(args.create?.tender?.[0]?.method).toBe("cash");
  });
});

describe("Stored value taxable load validation", () => {
  let moduleRef: TestingModule;
  let service: StoredValueService;

  beforeEach(async () => {
    const prisma = {
      taxRule: { findFirst: jest.fn().mockResolvedValue(null) },
      storedValueAccount: { findMany: jest.fn(), findUnique: jest.fn() },
      storedValueLedger: { findMany: jest.fn(), create: jest.fn() },
      storedValueCode: { create: jest.fn() },
      $transaction: jest.fn(),
    };

    moduleRef = await Test.createTestingModule({
      providers: [
        StoredValueService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: IdempotencyService,
          useValue: { start: jest.fn(), complete: jest.fn(), fail: jest.fn() },
        },
        { provide: ObservabilityService, useValue: { recordRedeemOutcome: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(StoredValueService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("rejects taxable load without active tax rule", async () => {
    await expect(
      service.issue(
        { amountCents: 1000, currency: "usd", taxableLoad: true, tenantId: "t1", type: "gift" },
        undefined,
        {
          campgroundId: "cg1",
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("POS checkout receipts", () => {
  let moduleRef: TestingModule;
  let service: PosService;
  let prisma: PosPrismaMock;
  let email: { sendPaymentReceipt: jest.Mock };

  beforeEach(async () => {
    const module = await createPosModule();
    moduleRef = module.moduleRef;
    service = module.service;
    prisma = module.prisma;
    email = module.email;
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("sends itemized receipt when email is present", async () => {
    prisma.posCart.findUnique.mockResolvedValue({
      id: "cart1",
      status: PosCartStatus.open,
      campgroundId: "cg1",
      terminalId: null,
      currency: "usd",
      PosCartItem: [
        {
          productId: "p1",
          totalCents: 100,
          taxCents: 0,
          feeCents: 0,
          qty: 1,
          Product: { name: "Soda" },
        },
      ],
      PosPayment: [],
    });

    const tx: PosTransactionMock = {
      posPayment: { create: jest.fn().mockResolvedValue({ currency: "usd" }) },
      tillMovement: { create: jest.fn() },
      posCart: { update: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      async (fn: (client: PosTransactionMock) => Promise<unknown>) => fn(tx),
    );

    await service.checkout(
      "cart1",
      { payments: [{ method: "cash", amountCents: 100, currency: "usd", idempotencyKey: "p1" }] },
      "idem-pos",
      { campgroundId: "cg1", email: "guest@example.com", name: "Guest" },
    );
    expect(email.sendPaymentReceipt).toHaveBeenCalled();
    expect(email.sendPaymentReceipt.mock.calls[0][0].lineItems[0].label).toBe("Soda");
  });
});
