import { ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { StoredValueService } from "../stored-value/stored-value.service";
import { PrismaService } from "../prisma/prisma.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { ObservabilityService } from "../observability/observability.service";

type PrismaMock = {
  storedValueAccount: { findUnique: jest.Mock };
  storedValueCode: { findUnique: jest.Mock; findFirst: jest.Mock };
  storedValueHold: { findUnique?: jest.Mock; update?: jest.Mock; aggregate: jest.Mock };
  storedValueLedger: { findMany?: jest.Mock; findFirst?: jest.Mock; create: jest.Mock };
  $transaction: jest.Mock;
};

const createService = async (
  prisma: PrismaMock,
  idempotency: Record<string, jest.Mock>,
  observability: { recordRedeemOutcome: jest.Mock },
) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      StoredValueService,
      { provide: PrismaService, useValue: prisma },
      { provide: IdempotencyService, useValue: idempotency },
      { provide: ObservabilityService, useValue: observability },
    ],
  }).compile();

  return { service: moduleRef.get(StoredValueService), close: () => moduleRef.close() };
};

describe("StoredValueService redeem double guard", () => {
  it("returns conflict on double redeem for same reference", async () => {
    const account = {
      id: "acct-1",
      campgroundId: "camp-1",
      status: "active",
      currency: "usd",
      expiresAt: null,
    };

    const tx = {
      storedValueLedger: {
        findMany: jest.fn().mockResolvedValue([
          { direction: "issue", amountCents: 1000 },
          { direction: "redeem", amountCents: 200 },
        ]),
        findFirst: jest.fn().mockResolvedValue({ id: "existing" }),
        create: jest.fn(),
      },
      storedValueHold: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 0 } }),
      },
    };

    const prisma: PrismaMock = {
      storedValueAccount: { findUnique: jest.fn().mockResolvedValue(account) },
      storedValueCode: { findUnique: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
      storedValueHold: { findUnique: jest.fn(), update: jest.fn(), aggregate: jest.fn() },
      storedValueLedger: { create: jest.fn() },
      $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
    };

    const idempotency = {
      start: jest.fn().mockResolvedValue(null),
      complete: jest.fn(),
      fail: jest.fn(),
      findBySequence: jest.fn(),
    };

    const observability = { recordRedeemOutcome: jest.fn() };

    const { service, close } = await createService(prisma, idempotency, observability);

    try {
      await expect(
        service.redeem(
          {
            accountId: account.id,
            amountCents: 100,
            currency: "usd",
            referenceType: "pos_cart",
            referenceId: "cart-1",
          },
          "redeem-key",
          { campgroundId: "camp-1" },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    } finally {
      await close();
    }
  });

  it("returns conflict when idempotency record is inflight (parallel redeem)", async () => {
    const account = {
      id: "acct-2",
      campgroundId: "camp-2",
      status: "active",
      currency: "usd",
      expiresAt: null,
    };
    const prisma: PrismaMock = {
      storedValueAccount: { findUnique: jest.fn().mockResolvedValue(account) },
      storedValueCode: { findUnique: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
      storedValueHold: { aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 0 } }) },
      storedValueLedger: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(
        async (
          cb: (client: {
            storedValueLedger: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
            storedValueHold: { aggregate: jest.Mock };
          }) => Promise<unknown>,
        ) =>
          cb({
            storedValueLedger: {
              findMany: jest.fn().mockResolvedValue([{ direction: "issue", amountCents: 1000 }]),
              findFirst: jest.fn(),
              create: jest.fn(),
            },
            storedValueHold: {
              aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 0 } }),
            },
          }),
      ),
    };

    const idempotency = {
      start: jest.fn().mockResolvedValue({
        status: "inflight",
        createdAt: new Date(),
        responseJson: null,
      }),
      complete: jest.fn(),
      fail: jest.fn(),
      findBySequence: jest.fn(),
    };

    const observability = { recordRedeemOutcome: jest.fn() };
    const { service, close } = await createService(prisma, idempotency, observability);

    try {
      await expect(
        service.redeem(
          {
            accountId: account.id,
            amountCents: 100,
            currency: "usd",
            referenceType: "pos_cart",
            referenceId: "cart-2",
          },
          "redeem-key-2",
          { campgroundId: "camp-2" },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    } finally {
      await close();
    }
  });
});
