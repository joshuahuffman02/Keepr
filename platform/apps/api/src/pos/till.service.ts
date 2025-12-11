import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CloseTillDto, OpenTillDto, TillMovementDto, ListTillsDto, DailyTillReportQueryDto } from "./till.dto";
import { AuditService } from "../audit/audit.service";

type Actor = { id?: string; campgroundId?: string };

const OVER_SHORT_ALERT_TOLERANCE_CENTS = 500; // $5 tolerance before alerting
const MOVEMENT_DUPLICATE_WINDOW_MINUTES = 10;

// Local enum stand-ins to decouple from generated Prisma enums at test/build time
export const TillMovementType = {
  cash_sale: "cash_sale",
  cash_refund: "cash_refund",
  paid_in: "paid_in",
  paid_out: "paid_out",
  adjustment: "adjustment"
} as const;
export type TillMovementType = (typeof TillMovementType)[keyof typeof TillMovementType];

export const TillSessionStatus = {
  open: "open",
  closed: "closed"
} as const;
export type TillSessionStatus = (typeof TillSessionStatus)[keyof typeof TillSessionStatus];

@Injectable()
export class TillService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async open(dto: OpenTillDto, actor: Actor) {
    if (!actor?.campgroundId || !actor?.id) throw new BadRequestException("Missing actor context");
    if (!dto.terminalId) throw new BadRequestException("Terminal is required to open a till");

    const existing = await this.prisma.tillSession.findFirst({
      where: {
        campgroundId: actor.campgroundId,
        status: TillSessionStatus.open,
        OR: [{ terminalId: dto.terminalId }, { openedByUserId: actor.id }]
      }
    });
    if (existing) throw new BadRequestException("A till is already open for this user or terminal");

    const session = await this.prisma.tillSession.create({
      data: {
        campgroundId: actor.campgroundId,
        terminalId: dto.terminalId,
        openingFloatCents: dto.openingFloatCents,
        currency: dto.currency,
        notes: dto.notes,
        openedByUserId: actor.id
      }
    });

    await this.audit.record({
      campgroundId: actor.campgroundId,
      actorId: actor.id,
      action: "till_opened",
      entity: "till_session",
      entityId: session.id,
      after: {
        openingFloatCents: dto.openingFloatCents,
        terminalId: dto.terminalId,
        currency: dto.currency,
        notes: dto.notes ?? null
      }
    });

    return session;
  }

  async get(id: string, actor: Actor) {
    if (!actor?.campgroundId) throw new BadRequestException("Missing actor context");
    const session = await this.prisma.tillSession.findFirst({
      where: { id, campgroundId: actor.campgroundId },
      include: { movements: true, openedBy: true, closedBy: true, terminal: true }
    });
    if (!session) throw new NotFoundException("Till session not found");
    const expected = this.computeExpected(session.openingFloatCents, session.movements);
    return { ...session, computedExpectedCloseCents: expected, overShortCents: session.overShortCents };
  }

  async list(params: ListTillsDto, actor: Actor) {
    if (!actor?.campgroundId) throw new BadRequestException("Missing actor context");
    return this.prisma.tillSession.findMany({
      where: {
        campgroundId: actor.campgroundId,
        status: params.status
      },
      orderBy: { openedAt: "desc" },
      take: 50
    });
  }

  async close(id: string, dto: CloseTillDto, actor: Actor) {
    if (!actor?.campgroundId || !actor?.id) throw new BadRequestException("Missing actor context");
    const session = await this.prisma.tillSession.findFirst({
      where: { id, campgroundId: actor.campgroundId },
      include: { movements: true }
    });
    if (!session) throw new NotFoundException("Till session not found");
    if (session.status === TillSessionStatus.closed) throw new BadRequestException("Till already closed");

    const expected = this.computeExpected(session.openingFloatCents, session.movements);
    const overShort = dto.countedCloseCents - expected;
    const toleranceBreached = Math.abs(overShort) > OVER_SHORT_ALERT_TOLERANCE_CENTS;

    const updated = await this.prisma.tillSession.update({
      where: { id },
      data: {
        status: TillSessionStatus.closed,
        expectedCloseCents: expected,
        countedCloseCents: dto.countedCloseCents,
        overShortCents: overShort,
        closedAt: new Date(),
        closedByUserId: actor.id,
        notes: dto.notes ?? session.notes
      }
    });

    await this.audit.record({
      campgroundId: actor.campgroundId,
      actorId: actor.id,
      action: toleranceBreached ? "till_closed_alert" : "till_closed",
      entity: "till_session",
      entityId: id,
      before: {
        status: session.status,
        expectedCloseCents: session.expectedCloseCents ?? expected,
        countedCloseCents: session.countedCloseCents ?? null,
        overShortCents: session.overShortCents ?? null
      },
      after: {
        status: updated.status,
        expectedCloseCents: expected,
        countedCloseCents: dto.countedCloseCents,
        overShortCents: overShort,
        toleranceBreached
      }
    });

    return { ...updated, overShortToleranceBreached: toleranceBreached };
  }

  async paidIn(id: string, dto: TillMovementDto, actor: Actor) {
    return this.recordMovement(id, TillMovementType.paid_in, dto, actor, undefined, undefined, {
      requireReason: true,
      preventDuplicate: true
    });
  }

  async paidOut(id: string, dto: TillMovementDto, actor: Actor) {
    return this.recordMovement(id, TillMovementType.paid_out, dto, actor, undefined, undefined, {
      requireReason: true,
      preventDuplicate: true,
      enforceNonNegative: true
    });
  }

  async recordCashSale(sessionId: string, amountCents: number, currency: string, cartId: string | null, actor: Actor) {
    return this.recordMovement(
      sessionId,
      TillMovementType.cash_sale,
      { amountCents, note: cartId ? `cart:${cartId}` : undefined },
      actor,
      currency,
      cartId ?? undefined
    );
  }

  async recordCashRefund(sessionId: string, amountCents: number, currency: string, cartId: string | null, actor: Actor) {
    return this.recordMovement(
      sessionId,
      TillMovementType.cash_refund,
      { amountCents, note: cartId ? `cart:${cartId}` : undefined },
      actor,
      currency,
      cartId ?? undefined,
      { enforceNonNegative: true, preventDuplicate: true }
    );
  }

  async findOpenSessionForTerminal(campgroundId: string | null | undefined, terminalId?: string | null) {
    if (!campgroundId || !terminalId) return null;
    return this.prisma.tillSession.findFirst({
      where: { campgroundId, terminalId, status: TillSessionStatus.open }
    });
  }

  private async recordMovement(
    sessionId: string,
    type: TillMovementType,
    dto: TillMovementDto,
    actor: Actor,
    currencyOverride?: string,
    sourceCartId?: string,
    options?: {
      requireReason?: boolean;
      preventDuplicate?: boolean;
      enforceNonNegative?: boolean;
    }
  ) {
    if (!actor?.id) throw new BadRequestException("Missing actor context");
    const session = await this.prisma.tillSession.findUnique({ where: { id: sessionId }, include: { movements: true } });
    if (!session) throw new NotFoundException("Till session not found");
    if (session.status !== TillSessionStatus.open) throw new BadRequestException("Till is not open");
    if (!session.terminalId) throw new BadRequestException("Till is not assigned to a terminal");
    const currency = currencyOverride ?? session.currency;
    if (currency.toLowerCase() !== session.currency.toLowerCase()) {
      throw new BadRequestException("Till currency mismatch");
    }

    if ((type === TillMovementType.paid_in || type === TillMovementType.paid_out) && options?.requireReason && !dto.reasonCode) {
      throw new BadRequestException("reasonCode is required for paid-in/out movements");
    }

    const noteParts: string[] = [];
    if (dto.reasonCode) noteParts.push(`reason:${dto.reasonCode}`);
    if (dto.note) noteParts.push(dto.note);
    if (dto.referenceId) noteParts.push(`ref:${dto.referenceId}`);
    const finalNote = noteParts.length ? noteParts.join(" | ") : dto.note;

    const movements = session.movements ?? [];
    const expectedBefore = this.computeExpected(session.openingFloatCents, movements);
    const subtractive = type === TillMovementType.cash_refund || type === TillMovementType.paid_out;
    const nextExpected = subtractive ? expectedBefore - dto.amountCents : expectedBefore + dto.amountCents;

    if (options?.enforceNonNegative && nextExpected < 0) {
      throw new BadRequestException("Movement would result in negative till balance");
    }

    if (options?.preventDuplicate) {
      const duplicate = movements.find((m: any) => {
        if (sourceCartId && m.sourceCartId === sourceCartId && m.type === type) return true;
        if (dto.reasonCode && m.type === type && (m.note ?? "").includes(`reason:${dto.reasonCode}`)) return true;
        if (dto.referenceId && m.type === type && (m.note ?? "").includes(`ref:${dto.referenceId}`)) return true;
        return false;
      });
      if (duplicate) throw new BadRequestException("Duplicate or reversal movement detected");

      const recentCutoff = Date.now() - MOVEMENT_DUPLICATE_WINDOW_MINUTES * 60 * 1000;
      const hasRecentSameAmount = movements.some(
        (m: any) =>
          m.type === type &&
          m.amountCents === dto.amountCents &&
          m.createdAt &&
          new Date(m.createdAt).getTime() >= recentCutoff
      );
      if (hasRecentSameAmount) throw new BadRequestException("Recent duplicate movement detected");
    }

    const movement = await this.prisma.tillMovement.create({
      data: {
        sessionId,
        type,
        amountCents: dto.amountCents,
        currency,
        actorUserId: actor.id,
        note: finalNote,
        sourceCartId
      }
    });

    const anomaly = nextExpected < 0 || dto.amountCents > expectedBefore + OVER_SHORT_ALERT_TOLERANCE_CENTS;

    await this.audit.record({
      campgroundId: session.campgroundId,
      actorId: actor.id,
      action: anomaly ? "till_movement_alert" : "till_movement",
      entity: "till_session",
      entityId: session.id,
      before: { expected: expectedBefore },
      after: {
        type,
        amountCents: dto.amountCents,
        currency,
        note: finalNote,
        sourceCartId,
        expectedAfter: nextExpected,
        anomaly
      }
    });

    return movement;
  }

  private computeExpected(openingFloat: number, movements: { type: TillMovementType; amountCents: number }[]) {
    let expected = openingFloat;
    for (const m of movements) {
      switch (m.type) {
        case TillMovementType.cash_sale:
        case TillMovementType.paid_in:
        case TillMovementType.adjustment:
          expected += m.amountCents;
          break;
        case TillMovementType.cash_refund:
        case TillMovementType.paid_out:
          expected -= m.amountCents;
          break;
      }
    }
    return expected;
  }

  async dailyReport(query: DailyTillReportQueryDto, actor: Actor) {
    if (!actor?.campgroundId) throw new BadRequestException("Missing actor context");
    const targetDate = new Date(query.date);
    if (isNaN(targetDate.getTime())) throw new BadRequestException("Invalid date");
    const start = new Date(targetDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const sessions = await this.prisma.tillSession.findMany({
      where: {
        campgroundId: actor.campgroundId,
        openedAt: { gte: start, lt: end },
        terminalId: query.terminalId ?? undefined
      },
      include: { movements: true, openedBy: true, closedBy: true, terminal: true },
      orderBy: { openedAt: "asc" }
    });

    let totalOpeningFloat = 0;
    let totalCashSales = 0;
    let totalCashRefunds = 0;
    let totalPaidIn = 0;
    let totalPaidOut = 0;
    let totalExpected = 0;
    let totalCounted = 0;
    let totalOverShort = 0;

    const sessionSummaries = sessions.map((s: any) => {
      const currency = s.currency;
      const movements = (s.movements as any[]).filter((m: any) => m.currency.toLowerCase() === currency.toLowerCase());
      const expected = this.computeExpected(s.openingFloatCents, movements);
      const cashSales = movements
        .filter((m: any) => m.type === TillMovementType.cash_sale)
        .reduce((n: number, m: any) => n + m.amountCents, 0);
      const cashRefunds = movements
        .filter((m: any) => m.type === TillMovementType.cash_refund)
        .reduce((n: number, m: any) => n + m.amountCents, 0);
      const paidIn = movements
        .filter((m: any) => m.type === TillMovementType.paid_in)
        .reduce((n: number, m: any) => n + m.amountCents, 0);
      const paidOut = movements
        .filter((m: any) => m.type === TillMovementType.paid_out)
        .reduce((n: number, m: any) => n + m.amountCents, 0);
      const counted = s.countedCloseCents ?? null;
      const overShort = counted !== null ? counted - expected : null;

      totalOpeningFloat += s.openingFloatCents;
      totalCashSales += cashSales;
      totalCashRefunds += cashRefunds;
      totalPaidIn += paidIn;
      totalPaidOut += paidOut;
      totalExpected += expected;
      if (counted !== null) {
        totalCounted += counted;
        totalOverShort += overShort ?? 0;
      }

      return {
        id: s.id,
        terminalId: s.terminalId,
        status: s.status,
        currency,
        openingFloatCents: s.openingFloatCents,
        cashSalesCents: cashSales,
        cashRefundsCents: cashRefunds,
        paidInCents: paidIn,
        paidOutCents: paidOut,
        expectedCloseCents: expected,
        countedCloseCents: counted,
        overShortCents: overShort,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        openedBy: s.openedBy ? { id: s.openedBy.id, email: s.openedBy.email } : null,
        closedBy: s.closedBy ? { id: s.closedBy.id, email: s.closedBy.email } : null,
        terminal: s.terminal ? { id: s.terminal.id, locationId: s.terminal.locationId } : null
      };
    });

    return {
      date: start.toISOString().slice(0, 10),
      totals: {
        openingFloatCents: totalOpeningFloat,
        cashSalesCents: totalCashSales,
        cashRefundsCents: totalCashRefunds,
        paidInCents: totalPaidIn,
        paidOutCents: totalPaidOut,
        expectedCloseCents: totalExpected,
        countedCloseCents: totalCounted,
        overShortCents: totalOverShort
      },
      sessions: sessionSummaries
    };
  }

  async dailyReportCsv(query: DailyTillReportQueryDto, actor: Actor) {
    const report = await this.dailyReport(query, actor);
    const header = [
      "date",
      "terminalId",
      "status",
      "currency",
      "openingFloatCents",
      "cashSalesCents",
      "cashRefundsCents",
      "paidInCents",
      "paidOutCents",
      "expectedCloseCents",
      "countedCloseCents",
      "overShortCents",
      "openedAt",
      "closedAt",
      "openedByEmail",
      "closedByEmail"
    ];

    const rows = report.sessions.map((s: any) => [
      report.date,
      s.terminalId ?? "",
      s.status,
      s.currency,
      s.openingFloatCents,
      s.cashSalesCents,
      s.cashRefundsCents,
      s.paidInCents,
      s.paidOutCents,
      s.expectedCloseCents,
      s.countedCloseCents ?? "",
      s.overShortCents ?? "",
      s.openedAt?.toISOString?.() ?? "",
      s.closedAt?.toISOString?.() ?? "",
      s.openedBy?.email ?? "",
      s.closedBy?.email ?? ""
    ]);

    const totalRow = [
      report.date,
      "TOTAL",
      "",
      "",
      report.totals.openingFloatCents,
      report.totals.cashSalesCents,
      report.totals.cashRefundsCents,
      report.totals.paidInCents,
      report.totals.paidOutCents,
      report.totals.expectedCloseCents,
      report.totals.countedCloseCents,
      report.totals.overShortCents,
      "",
      "",
      "",
      ""
    ];

    const csvLines = [header, ...rows, totalRow].map((r) => r.join(","));
    return {
      filename: `till-daily-${report.date}.csv`,
      csv: csvLines.join("\n")
    };
  }
}
