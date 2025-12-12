import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { GlAccountType } from "@prisma/client";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

type LedgerPostLine = {
  glAccountId: string;
  side: "debit" | "credit";
  amountCents: number;
  memo?: string;
  productCode?: string;
  channelCode?: string;
  taxJurisdiction?: string;
  taxRateBps?: number;
  taxableBaseCents?: number;
  reconciliationKey?: string;
  glCode?: string;
  accountName?: string;
};

type LedgerPostRequest = {
  campgroundId: string;
  reservationId?: string | null;
  periodId?: string | null;
  description?: string | null;
  occurredAt?: Date;
  sourceType?: string | null;
  sourceTxId?: string | null;
  sourceTs?: Date | null;
  externalRef?: string | null;
  dedupeKey?: string | null;
  adjustment?: boolean;
  lines: LedgerPostLine[];
};

class LedgerGuard {
  static ensureBalanced(lines: LedgerPostLine[]) {
    if (!lines || lines.length < 2) {
      throw new BadRequestException("At least two ledger lines are required for double-entry");
    }
    let debit = 0;
    let credit = 0;
    for (const line of lines) {
      if (!line.glAccountId) throw new BadRequestException("Ledger line missing GL account id");
      if (line.amountCents <= 0) throw new BadRequestException("Ledger line amount must be positive");
      if (line.side !== "debit" && line.side !== "credit") {
        throw new BadRequestException("Ledger line side must be debit or credit");
      }
      if (line.side === "debit") debit += line.amountCents;
      if (line.side === "credit") credit += line.amountCents;
    }
    if (debit !== credit) {
      throw new BadRequestException(`Ledger not balanced (debits=${debit} credits=${credit})`);
    }
  }
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  list(campgroundId: string, start?: Date, end?: Date, glCode?: string) {
    return this.prisma.ledgerEntry.findMany({
      where: {
        campgroundId,
        glCode: glCode || undefined,
        ...(start || end
          ? {
              occurredAt: {
                gte: start,
                lte: end
              }
            }
          : {})
      },
      orderBy: { occurredAt: "desc" }
    });
  }

  listByReservation(reservationId: string) {
    return this.prisma.ledgerEntry.findMany({
      where: { reservationId },
      orderBy: { occurredAt: "desc" }
    });
  }

  async summaryByGl(campgroundId: string, start?: Date, end?: Date) {
    const rows = await this.list(campgroundId, start, end);
    const map: Record<string, number> = {};
    for (const r of rows) {
      const key = r.glCode || "Unassigned";
      const sign = r.direction === "credit" ? 1 : -1;
      map[key] = (map[key] || 0) + sign * r.amountCents;
    }
    return Object.entries(map).map(([glCode, netCents]) => ({ glCode, netCents }));
  }

  async ensureAccount(campgroundId: string, code: string, name: string, type: GlAccountType) {
    const existing = await this.prisma.glAccount.findFirst({ where: { campgroundId, code }, select: { id: true } });
    if (existing) return existing.id;
    const created = await this.prisma.glAccount.create({
      data: { campgroundId, code, name, type }
    });
    return created.id;
  }

  private async resolvePeriodId(campgroundId: string, occurredAt: Date, allowAdjustment: boolean) {
    const period = await (this.prisma as any).glPeriod.findFirst({
      where: { campgroundId, startDate: { lte: occurredAt }, endDate: { gte: occurredAt } },
      orderBy: { startDate: "desc" }
    });
    if (!period) return null;
    if (period.status !== "open" && !allowAdjustment) {
      throw new ForbiddenException("GL period is closed or locked for this date");
    }
    return period.id;
  }

  async postEntries(request: LedgerPostRequest) {
    LedgerGuard.ensureBalanced(request.lines);
    const occurredAt = request.occurredAt ?? new Date();
    const allowAdjustment = request.adjustment ?? false;
    const periodId = request.periodId ?? (await this.resolvePeriodId(request.campgroundId, occurredAt, allowAdjustment));
    const payloadForHash = {
      campgroundId: request.campgroundId,
      reservationId: request.reservationId ?? null,
      occurredAt: occurredAt.toISOString(),
      sourceType: request.sourceType ?? null,
      sourceTxId: request.sourceTxId ?? null,
      description: request.description ?? null,
      lines: request.lines.map((l) => ({ side: l.side, amountCents: l.amountCents, glAccountId: l.glAccountId, memo: l.memo }))
    };
    const hash = createHash("sha256").update(JSON.stringify(payloadForHash)).digest("hex");
    const dedupeKey = request.dedupeKey ?? hash;
    const dedupeFilters = [
      dedupeKey ? { dedupeKey } : null,
      request.sourceTxId ? { sourceTxId: request.sourceTxId } : null
    ].filter(Boolean) as any[];

    if (dedupeFilters.length > 0) {
      const exists = await this.prisma.ledgerEntry.findFirst({
        where: {
          campgroundId: request.campgroundId,
          OR: dedupeFilters
        },
        select: { id: true }
      });
      if (exists) {
        return { duplicated: true, entryIds: [exists.id] };
      }
    }

    const entryIds: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const line of request.lines) {
        const entry = await tx.ledgerEntry.create({
          data: {
            campgroundId: request.campgroundId,
            reservationId: request.reservationId ?? null,
            periodId,
            glCode: line.glCode ?? null,
            account: line.accountName ?? request.description ?? null,
            description: line.memo ?? request.description ?? null,
            amountCents: line.amountCents,
            direction: line.side === "credit" ? "credit" : "debit",
            occurredAt,
            externalRef: request.externalRef ?? null,
            dedupeKey,
            sourceType: request.sourceType ?? null,
            sourceTxId: request.sourceTxId ?? null,
            sourceTs: request.sourceTs ?? occurredAt,
            hash,
            adjustment: allowAdjustment
          }
        });
        entryIds.push(entry.id);
        await tx.ledgerLine.create({
          data: {
            ledgerEntryId: entry.id,
            glAccountId: line.glAccountId,
            side: line.side,
            amountCents: line.amountCents,
            memo: line.memo ?? request.description ?? null,
            productCode: line.productCode ?? null,
            channelCode: line.channelCode ?? null,
            taxJurisdiction: line.taxJurisdiction ?? null,
            taxRateBps: line.taxRateBps ?? null,
            taxableBaseCents: line.taxableBaseCents ?? null,
            reconciliationKey: line.reconciliationKey ?? request.sourceTxId ?? null
          }
        });
      }
    });

    return { duplicated: false, entryIds };
  }

  async listPeriods(campgroundId: string) {
    return (this.prisma as any).glPeriod.findMany({
      where: { campgroundId },
      orderBy: [{ startDate: "asc" }, { endDate: "asc" }]
    });
  }

  private async assertNoOverlap(campgroundId: string, startDate: Date, endDate: Date) {
    const overlap = await (this.prisma as any).glPeriod.findFirst({
      where: {
        campgroundId,
        startDate: { lte: endDate },
        endDate: { gte: startDate }
      },
      select: { id: true, status: true, startDate: true, endDate: true }
    });
    if (overlap) {
      throw new BadRequestException(
        `GL period overlaps existing period (${overlap.startDate.toISOString()} - ${overlap.endDate.toISOString()})`
      );
    }
  }

  async createPeriod(campgroundId: string, startDate: Date, endDate: Date, name?: string) {
    if (endDate <= startDate) {
      throw new BadRequestException("endDate must be after startDate");
    }
    await this.assertNoOverlap(campgroundId, startDate, endDate);
    return (this.prisma as any).glPeriod.create({
      data: {
        campgroundId,
        startDate,
        endDate,
        name: name ?? `${startDate.toISOString().slice(0, 10)}-${endDate.toISOString().slice(0, 10)}`,
        status: "open"
      }
    });
  }

  async closePeriod(id: string, actorId?: string) {
    const period = await (this.prisma as any).glPeriod.findUnique({ where: { id } });
    if (!period) throw new NotFoundException("GL period not found");
    if (period.status === "locked") {
      throw new BadRequestException("GL period is locked");
    }
    if (period.status === "closed") return period;
    return (this.prisma as any).glPeriod.update({
      where: { id },
      data: { status: "closed", closedAt: new Date(), closedBy: actorId ?? null }
    });
  }

  async lockPeriod(id: string, actorId?: string) {
    const period = await (this.prisma as any).glPeriod.findUnique({ where: { id } });
    if (!period) throw new NotFoundException("GL period not found");
    if (period.status === "locked") return period;
    return (this.prisma as any).glPeriod.update({
      where: { id },
      data: {
        status: "locked",
        lockedAt: new Date(),
        lockedBy: actorId ?? null,
        closedAt: period.closedAt ?? new Date(),
        closedBy: period.closedBy ?? actorId ?? null
      }
    });
  }

  /**
   * Ensure a GL account exists; currently just returns the glCode as identifier.
   * Placeholder until a full chart-of-accounts model is added.
   */
  async ensureAccount(_campgroundId: string, glCode: string, _name: string, _type: GlAccountType): Promise<string> {
    return glCode;
  }

  /**
   * Post balanced ledger entries using the lightweight helper. Supports the newer LedgerPostRequest shape.
   */
  async postEntries(request: LedgerPostRequest) {
    const occurredAt = request.occurredAt ?? new Date();
    const entries = request.lines.map((line, idx) => ({
      campgroundId: request.campgroundId,
      reservationId: request.reservationId ?? null,
      glCode: line.glCode ?? line.glAccountId,
      account: line.accountName ?? line.glAccountId ?? null,
      description: request.description ?? line.memo ?? undefined,
      amountCents: line.amountCents,
      direction: line.side,
      occurredAt,
      externalRef: request.externalRef ?? request.sourceTxId ?? undefined,
      dedupeKey:
        request.dedupeKey ??
        (line.reconciliationKey ? `recon:${line.reconciliationKey}:${line.side}:${line.amountCents}` : undefined) ??
        `post:${request.sourceType ?? "ledger"}:${request.sourceTxId ?? ""}:${idx}`
    }));

    return postBalancedLedgerEntries(this.prisma, entries, { requireGlCode: true });
  }
}
