import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { TillService } from "../pos/till.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

// Local enum stand-ins to avoid depending on generated Prisma enums in tests
const TillMovementType = {
  cash_sale: "cash_sale",
  cash_refund: "cash_refund",
  paid_in: "paid_in",
  paid_out: "paid_out",
  adjustment: "adjustment",
};

const TillSessionStatus = {
  open: "open",
  closed: "closed",
};

type PrismaMock = {
  tillSession: {
    findFirst: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  tillMovement: {
    create: jest.Mock;
  };
};

const createService = async (prisma: PrismaMock, audit: { record: jest.Mock }) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      TillService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuditService, useValue: audit },
    ],
  }).compile();

  return { service: moduleRef.get(TillService), close: () => moduleRef.close() };
};

describe("TillService", () => {
  const prisma: PrismaMock = {
    tillSession: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tillMovement: {
      create: jest.fn(),
    },
  };

  let audit: { record: jest.Mock };
  let service: TillService;
  let close: () => Promise<void>;
  const actor = { id: "user-1", campgroundId: "camp-1" };

  beforeEach(async () => {
    jest.clearAllMocks();
    audit = { record: jest.fn() };
    const result = await createService(prisma, audit);
    service = result.service;
    close = result.close;
  });

  afterEach(async () => {
    await close();
  });

  it("prevents opening a till when one is already open for the terminal", async () => {
    prisma.tillSession.findFirst.mockResolvedValue({ id: "existing" });

    await expect(
      service.open({ terminalId: "term-1", openingFloatCents: 1000, currency: "usd" }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.tillSession.create).not.toHaveBeenCalled();
  });

  it("rejects cash movement when currency does not match the till", async () => {
    prisma.tillSession.findUnique.mockResolvedValue({
      id: "session-1",
      status: TillSessionStatus.open,
      currency: "usd",
      terminalId: "term-1",
      openingFloatCents: 0,
      TillMovement: [],
    });

    await expect(
      service.recordCashSale("session-1", 5000, "eur", "cart-1", actor),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.tillMovement.create).not.toHaveBeenCalled();
  });

  it("requires reason and non-negative balance for paid-out", async () => {
    prisma.tillSession.findUnique.mockResolvedValue({
      id: "session-1",
      status: TillSessionStatus.open,
      currency: "usd",
      terminalId: "term-1",
      openingFloatCents: 1000,
      TillMovement: [{ type: TillMovementType.cash_sale, amountCents: 500, currency: "usd" }],
    });

    await expect(
      service.paidOut("session-1", { amountCents: 200, note: "petty cash" }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.paidOut(
        "session-1",
        { amountCents: 2000, reasonCode: "petty", note: "petty cash" },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("flags over/short tolerance breach on close and records audit", async () => {
    prisma.tillSession.findFirst.mockResolvedValue({
      id: "session-1",
      campgroundId: actor.campgroundId,
      status: TillSessionStatus.open,
      openingFloatCents: 10000,
      expectedCloseCents: 0,
      countedCloseCents: null,
      overShortCents: 0,
      currency: "usd",
      notes: null,
      openedByUserId: actor.id,
      closedByUserId: null,
      openedAt: new Date("2025-12-10T08:00:00Z"),
      closedAt: null,
      createdAt: new Date("2025-12-10T08:00:00Z"),
      updatedAt: new Date("2025-12-10T08:00:00Z"),
      terminalId: "term-1",
      TillMovement: [{ type: TillMovementType.cash_sale, amountCents: 1000, currency: "usd" }],
    });
    prisma.tillSession.update.mockResolvedValue({
      id: "session-1",
      status: TillSessionStatus.closed,
      expectedCloseCents: 11000,
      countedCloseCents: 10200,
      overShortCents: -800,
    });

    const result = await service.close("session-1", { countedCloseCents: 10200 }, actor);

    expect(result.overShortToleranceBreached).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "till_closed_alert", entityId: "session-1" }),
    );
  });

  it("prevents opening multiple sessions per user", async () => {
    prisma.tillSession.findFirst.mockResolvedValue({
      id: "existing",
      openedByUserId: actor.id,
      terminalId: "term-1",
    });

    await expect(
      service.open({ terminalId: "term-2", openingFloatCents: 1000, currency: "usd" }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("aggregates daily report totals and per-session over/short", async () => {
    prisma.tillSession.findMany.mockResolvedValue([
      {
        id: "sess-1",
        campgroundId: "camp-1",
        terminalId: "term-A",
        status: TillSessionStatus.closed,
        openingFloatCents: 10000,
        expectedCloseCents: 0,
        countedCloseCents: 10750,
        overShortCents: 0,
        currency: "usd",
        notes: null,
        openedByUserId: actor.id,
        closedByUserId: actor.id,
        openedAt: new Date("2025-12-10T08:00:00Z"),
        closedAt: new Date("2025-12-10T18:00:00Z"),
        createdAt: new Date("2025-12-10T08:00:00Z"),
        updatedAt: new Date("2025-12-10T18:00:00Z"),
        terminal: { id: "term-A", locationId: "loc-1" },
        openedBy: { id: actor.id, email: "open@example.com" },
        closedBy: { id: actor.id, email: "close@example.com" },
        TillMovement: [
          { type: TillMovementType.cash_sale, amountCents: 1000, currency: "usd" },
          { type: TillMovementType.paid_out, amountCents: 200, currency: "usd" },
        ],
      },
      {
        id: "sess-2",
        campgroundId: "camp-1",
        terminalId: "term-B",
        status: TillSessionStatus.open,
        openingFloatCents: 2000,
        expectedCloseCents: 0,
        countedCloseCents: null,
        overShortCents: 0,
        currency: "usd",
        notes: null,
        openedByUserId: actor.id,
        closedByUserId: null,
        openedAt: new Date("2025-12-10T09:00:00Z"),
        closedAt: null,
        createdAt: new Date("2025-12-10T09:00:00Z"),
        updatedAt: new Date("2025-12-10T09:00:00Z"),
        terminal: { id: "term-B", locationId: null },
        openedBy: { id: actor.id, email: "open2@example.com" },
        closedBy: null,
        TillMovement: [{ type: TillMovementType.cash_sale, amountCents: 500, currency: "USD" }],
      },
    ]);

    const report = await service.dailyReport({ date: "2025-12-10T00:00:00Z" }, actor);

    expect(report.date).toBe("2025-12-10");
    expect(report.totals).toEqual({
      openingFloatCents: 12000,
      cashSalesCents: 1500,
      cashRefundsCents: 0,
      paidInCents: 0,
      paidOutCents: 200,
      expectedCloseCents: 13300,
      countedCloseCents: 10750,
      overShortCents: -50,
    });

    const sess1 = report.sessions.find((session) => session.id === "sess-1");
    expect(sess1?.expectedCloseCents).toBe(10800);
    expect(sess1?.overShortCents).toBe(-50);

    const sess2 = report.sessions.find((session) => session.id === "sess-2");
    expect(sess2?.expectedCloseCents).toBe(2500);
    expect(sess2?.overShortCents).toBeNull();
  });
});
