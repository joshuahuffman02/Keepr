import { ConflictException } from "@nestjs/common";
import { StoredValueService } from "../stored-value/stored-value.service";

type Direction = "issue" | "redeem" | "expire" | "adjust" | "hold_capture";
type Status = "active" | "inactive" | "expired" | string;

describe("StoredValueService redeem double guard", () => {
  it("returns conflict on double redeem for same reference", async () => {
    const account = { id: "acct-1", campgroundId: "camp-1", status: "active" as Status, currency: "usd", expiresAt: null };

    const tx = {
      storedValueLedger: {
        findMany: jest.fn().mockResolvedValue([
          { direction: "issue" as Direction, amountCents: 1000 },
          { direction: "redeem" as Direction, amountCents: 200 }
        ]),
        findFirst: jest.fn().mockResolvedValue({ id: "existing" }),
        create: jest.fn()
      },
      storedValueHold: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 0 } })
      }
    };

    const prisma = {
      storedValueAccount: { findUnique: jest.fn().mockResolvedValue(account) },
      storedValueCode: { findUnique: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
      storedValueHold: { findUnique: jest.fn(), update: jest.fn() },
      storedValueLedger: { create: jest.fn() },
      $transaction: jest.fn(async (cb: any) => cb(tx))
    };

    const idempotency = {
      start: jest.fn().mockResolvedValue(null),
      complete: jest.fn(),
      fail: jest.fn(),
      findBySequence: jest.fn()
    };

    const observability = { recordRedeemOutcome: jest.fn() };

    const service = new StoredValueService(prisma as any, idempotency as any, observability as any);

    await expect(
      service.redeem(
        {
          accountId: account.id,
          amountCents: 100,
          currency: "usd",
          referenceType: "pos_cart",
          referenceId: "cart-1"
        } as any,
        "redeem-key",
        { campgroundId: "camp-1" }
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("returns conflict when idempotency record is inflight (parallel redeem)", async () => {
    const account = { id: "acct-2", campgroundId: "camp-2", status: "active" as Status, currency: "usd", expiresAt: null };
    const prisma = {
      storedValueAccount: { findUnique: jest.fn().mockResolvedValue(account) },
      storedValueCode: { findUnique: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
      storedValueHold: { aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 0 } }) },
      storedValueLedger: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), create: jest.fn() },
      $transaction: jest.fn(async (cb: any) => cb({
        storedValueLedger: {
          findMany: jest.fn().mockResolvedValue([{ direction: "issue" as Direction, amountCents: 1000 }]),
          findFirst: jest.fn(),
          create: jest.fn()
        },
        storedValueHold: { aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 0 } }) }
      }))
    };

    const idempotency = {
      start: jest.fn().mockResolvedValue({
        status: "inflight",
        createdAt: new Date(),
        responseJson: null
      }),
      complete: jest.fn(),
      fail: jest.fn(),
      findBySequence: jest.fn()
    };

    const observability = { recordRedeemOutcome: jest.fn() };
    const service = new StoredValueService(prisma as any, idempotency as any, observability as any);

    await expect(
      service.redeem(
        {
          accountId: account.id,
          amountCents: 100,
          currency: "usd",
          referenceType: "pos_cart",
          referenceId: "cart-2"
        } as any,
        "redeem-key-2",
        { campgroundId: "camp-2" }
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
