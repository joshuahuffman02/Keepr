import type { PrismaService } from "../prisma/prisma.service";

type PrismaLike = PrismaService | any;

export type LedgerEntryInput = {
  campgroundId: string;
  reservationId?: string | null;
  glCode?: string | null;
  account?: string | null;
  description?: string | null;
  amountCents: number;
  direction: "debit" | "credit";
  occurredAt?: Date;
  externalRef?: string | null;
  dedupeKey?: string | null;
};

export type PostLedgerOptions = {
  requireGlCode?: boolean;
  allowUnbalanced?: boolean;
  defaultGlCode?: string;
  batchDedupeKey?: string;
};

const DEFAULT_GL = "UNASSIGNED";

async function assertPeriodsOpen(prisma: PrismaLike, entries: LedgerEntryInput[]) {
  const byCampground: Record<string, { min: Date; max: Date }> = {};
  for (const entry of entries) {
    const occurredAt = entry.occurredAt ?? new Date();
    const existing = byCampground[entry.campgroundId];
    if (!existing) {
      byCampground[entry.campgroundId] = { min: occurredAt, max: occurredAt };
    } else {
      if (occurredAt < existing.min) existing.min = occurredAt;
      if (occurredAt > existing.max) existing.max = occurredAt;
    }
  }

  for (const [campgroundId, range] of Object.entries(byCampground)) {
    const blocked = await (prisma as any).glPeriod?.findFirst?.({
      where: {
        campgroundId,
        status: { in: ["closed", "locked"] },
        startDate: { lte: range.max },
        endDate: { gte: range.min }
      },
      select: { id: true, status: true, startDate: true, endDate: true }
    });
    if (blocked) {
      const rangeLabel = `${blocked.startDate?.toISOString?.() ?? "start"} → ${blocked.endDate?.toISOString?.() ?? "end"}`;
      throw new Error(`Ledger period is ${blocked.status} for campground ${campgroundId} (${rangeLabel}); posting blocked.`);
    }
  }
}

function normalizeEntries(entries: LedgerEntryInput[], opts?: PostLedgerOptions) {
  const requireGlCode = opts?.requireGlCode !== false;
  const defaultGl = opts?.defaultGlCode ?? DEFAULT_GL;

  return entries.map((entry, idx) => {
    const occurredAt = entry.occurredAt ?? new Date();
    const glCode = (entry.glCode ?? defaultGl).trim();
    if (requireGlCode && !glCode) {
      throw new Error("GL code is required for all ledger entries");
    }
    const dedupeKey =
      entry.dedupeKey ??
      (entry.externalRef ? `${entry.externalRef}:${entry.direction}:${entry.amountCents}` : null) ??
      (opts?.batchDedupeKey ? `${opts.batchDedupeKey}:${idx}` : null);

    return {
      campgroundId: entry.campgroundId,
      reservationId: entry.reservationId ?? null,
      glCode,
      account: entry.account ?? null,
      description: entry.description ?? null,
      amountCents: entry.amountCents,
      direction: entry.direction,
      occurredAt,
      externalRef: entry.externalRef ?? null,
      dedupeKey
    };
  });
}

export async function postBalancedLedgerEntries(
  prisma: PrismaLike,
  entries: LedgerEntryInput[],
  opts?: PostLedgerOptions
) {
  if (!entries.length) {
    throw new Error("No ledger entries to post");
  }

  const normalized = normalizeEntries(entries, opts);

  if (!opts?.allowUnbalanced) {
    const net = normalized.reduce(
      (sum, e) => sum + (e.direction === "credit" ? e.amountCents : -e.amountCents),
      0
    );
    if (net !== 0) {
      throw new Error(`Ledger batch must balance; net=${net}¢`);
    }
  }

  await assertPeriodsOpen(prisma, normalized);

  // Stronger dedupe than description/amount: prefer dedupeKey/externalRef when present.
  const dedupeKeys = normalized.map((e) => e.dedupeKey).filter(Boolean) as string[];
  const externalRefs = normalized.map((e) => e.externalRef).filter(Boolean) as string[];
  const dedupeWhere = [];
  if (dedupeKeys.length) dedupeWhere.push({ dedupeKey: { in: dedupeKeys } });
  if (externalRefs.length) dedupeWhere.push({ externalRef: { in: externalRefs } });

  if (dedupeWhere.length) {
    const existing = await (prisma as any).ledgerEntry.findMany({
      where: { OR: dedupeWhere }
    });
    if (existing.length) {
      return existing;
    }
  }

  return (prisma as any).$transaction(
    normalized.map((entry) =>
      (prisma as any).ledgerEntry.create({
        data: entry
      })
    )
  );
}
