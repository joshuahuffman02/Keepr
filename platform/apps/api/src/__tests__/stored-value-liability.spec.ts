import { ConflictException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { StoredValueService } from "../stored-value/stored-value.service";
import { PrismaService } from "../prisma/prisma.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { ObservabilityService } from "../observability/observability.service";

describe("StoredValueService liability + taxable loads", () => {
  it("rejects reload when taxable flag mismatches existing account", async () => {
    const account = {
      id: "acct-tax",
      campgroundId: "camp-1",
      status: "active",
      currency: "usd",
      metadata: { taxableLoad: true },
    };

    const prisma = {
      storedValueAccount: { findUnique: jest.fn().mockResolvedValue(account) },
      $transaction: jest.fn(),
    };
    const idempotency = {
      start: jest.fn().mockResolvedValue(null),
      complete: jest.fn(),
      fail: jest.fn(),
    };
    const observability = { recordRedeemOutcome: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        StoredValueService,
        { provide: PrismaService, useValue: prisma },
        { provide: IdempotencyService, useValue: idempotency },
        { provide: ObservabilityService, useValue: observability },
      ],
    }).compile();
    const service = moduleRef.get(StoredValueService);

    await expect(
      service.reload(
        {
          accountId: account.id,
          amountCents: 5000,
          currency: "usd",
          taxableLoad: false,
        },
        "reload-key",
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    await moduleRef.close();
  });

  it("returns liability snapshot split by taxable flag", async () => {
    const prisma = {
      storedValueAccount: {
        findMany: jest.fn().mockResolvedValue([
          { id: "a1", metadata: { taxableLoad: true } },
          { id: "a2", metadata: { taxableLoad: false } },
        ]),
      },
      storedValueLedger: {
        findMany: jest.fn().mockResolvedValue([
          { accountId: "a1", direction: "issue", amountCents: 1000 },
          { accountId: "a1", direction: "redeem", amountCents: 200 },
          { accountId: "a2", direction: "issue", amountCents: 500 },
        ]),
      },
    };
    const idempotency = {
      start: jest.fn().mockResolvedValue(null),
      complete: jest.fn(),
      fail: jest.fn(),
    };
    const observability = { recordRedeemOutcome: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        StoredValueService,
        { provide: PrismaService, useValue: prisma },
        { provide: IdempotencyService, useValue: idempotency },
        { provide: ObservabilityService, useValue: observability },
      ],
    }).compile();
    const service = moduleRef.get(StoredValueService);

    const snapshot = await service.liabilitySnapshot("camp-1");
    expect(snapshot.taxableCents).toBe(800);
    expect(snapshot.nonTaxableCents).toBe(500);
    expect(snapshot.totalCents).toBe(1300);
    expect(snapshot.rollForwardCents).toBe(1300);
    expect(snapshot.driftCents).toBe(0);
    expect(snapshot.rollForwardOk).toBe(true);

    await moduleRef.close();
  });
});
