import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { postBalancedLedgerEntries } from "../ledger/ledger-posting.util";

type UtilityCharge = {
  type: string;
  meterId: string;
  usage: number;
  ratePlanId?: string | null;
  rateCents?: number;
  amountCents: number;
  description: string;
  meta?: Record<string, unknown>;
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createMeter(
    campgroundId: string,
    siteId: string,
    type: string,
    serialNumber?: string,
    ratePlanId?: string,
    config?: { billingMode?: string; billTo?: string; multiplier?: number; autoEmail?: boolean }
  ) {
    return this.prisma.utilityMeter.create({
      data: {
        campgroundId,
        siteId,
        type,
        serialNumber,
        ratePlanId: ratePlanId || null,
        billingMode: config?.billingMode || "cycle",
        billTo: config?.billTo || "reservation",
        multiplier: config?.multiplier ?? 1.0,
        autoEmail: config?.autoEmail ?? false
      }
    });
  }

  async listMeters(campgroundId: string) {
    return this.prisma.utilityMeter.findMany({
      where: { campgroundId },
      include: { ratePlan: true }
    });
  }

  async listRatePlans(campgroundId: string) {
    return this.prisma.utilityRatePlan.findMany({
      where: { campgroundId },
      orderBy: { effectiveFrom: "desc" }
    });
  }

  async addMeterRead(meterId: string, readingValue: number, readAt: Date, readBy?: string, note?: string, source: string = "manual") {
    return this.prisma.utilityMeterRead.create({
      data: {
        meterId,
        readingValue,
        readAt,
        readBy: readBy || null,
        note: note || null,
        source
      }
    });
  }

  async importMeterReads(
    campgroundId: string,
    reads: Array<{ meterId: string; readingValue: number; readAt: Date; note?: string; readBy?: string; source?: string }>
  ) {
    const meterIds = Array.from(new Set(reads.map((r) => r.meterId)));
    const meters = await this.prisma.utilityMeter.findMany({ where: { id: { in: meterIds }, campgroundId } });
    const allowed = new Set(meters.map((m) => m.id));
    const validReads = reads.filter((r) => allowed.has(r.meterId));
    await this.prisma.$transaction(
      validReads.map((r) =>
        this.prisma.utilityMeterRead.create({
          data: {
            meterId: r.meterId,
            readingValue: r.readingValue,
            readAt: r.readAt,
            note: r.note || null,
            readBy: r.readBy || null,
            source: r.source || "import"
          }
        })
      )
    );
    return { imported: validReads.length, skipped: reads.length - validReads.length };
  }

  async listReads(meterId: string, start?: Date, end?: Date) {
    return this.prisma.utilityMeterRead.findMany({
      where: {
        meterId,
        ...(start || end
          ? {
              readAt: {
                gte: start,
                lte: end
              }
            }
          : {})
      },
      orderBy: { readAt: "asc" }
    });
  }

  async updateMeter(
    meterId: string,
    data: {
      ratePlanId?: string | null;
      billingMode?: string;
      billTo?: string;
      multiplier?: number;
      autoEmail?: boolean;
      active?: boolean;
      serialNumber?: string | null;
    }
  ) {
    return this.prisma.utilityMeter.update({
      where: { id: meterId },
      data: {
        ratePlanId: data.ratePlanId ?? undefined,
        billingMode: data.billingMode ?? undefined,
        billTo: data.billTo ?? undefined,
        multiplier: data.multiplier ?? undefined,
        autoEmail: data.autoEmail ?? undefined,
        active: data.active ?? undefined,
        serialNumber: data.serialNumber ?? undefined
      }
    });
  }

  async billMeterNow(meterId: string) {
    const meter = await this.prisma.utilityMeter.findUnique({
      where: { id: meterId },
      include: {
        reads: { orderBy: { readAt: "asc" } },
        ratePlan: true
      }
    });
    if (!meter) throw new NotFoundException("Meter not found");
    if (!meter.active) throw new BadRequestException("Meter inactive");

    const reservation = await this.prisma.reservation.findFirst({
      where: {
        siteId: meter.siteId,
        status: { in: ["pending", "confirmed", "checked_in"] }
      },
      orderBy: { arrivalDate: "desc" }
    });
    if (!reservation) throw new NotFoundException("No active reservation on this site");

    const reads = meter.reads;
    if (!reads || reads.length < 2) throw new BadRequestException("Need at least two reads to bill");

    const lastBilledAt = meter.lastBilledReadAt ? new Date(meter.lastBilledReadAt) : null;
    const candidates = lastBilledAt ? reads.filter((r) => r.readAt > lastBilledAt) : reads.slice(-1);
    const endRead = candidates[candidates.length - 1];
    const prevReadCandidates = reads.filter((r) => r.readAt < endRead.readAt);
    const startRead = prevReadCandidates.length > 0 ? prevReadCandidates[prevReadCandidates.length - 1] : reads[0];

    const usage = Math.max(0, Number(endRead.readingValue) - Number(startRead.readingValue));
    const multiplier = Number((meter as any).multiplier ?? 1);
    const billedUsage = usage * (Number.isFinite(multiplier) ? multiplier : 1);
    const rate = meter.ratePlan?.baseRateCents ?? 0;
    const amountCents = Math.round(billedUsage * rate);
    if (amountCents <= 0) throw new BadRequestException("No billable usage");

    const cadence = meter.billingMode || "per_reading";
    const cycle = await this.prisma.billingCycle.create({
      data: {
        reservationId: reservation.id,
        campgroundId: meter.campgroundId,
        cadence,
        periodStart: startRead.readAt,
        periodEnd: endRead.readAt,
        status: "closed",
        generatedAt: new Date(),
        closedAt: new Date()
      }
    });

    const invoice = await this.prisma.invoice.create({
      data: {
        billingCycleId: cycle.id,
        campgroundId: reservation.campgroundId,
        reservationId: reservation.id,
        number: this.buildInvoiceNumber(reservation.campgroundId),
        dueDate: endRead.readAt,
        subtotalCents: amountCents,
        totalCents: amountCents,
        balanceCents: amountCents,
        lines: {
          create: [
            {
              type: "utility",
              description: `${meter.type} usage ${billedUsage.toFixed(2)} @ ${rate}c`,
              quantity: billedUsage,
              unitCents: rate,
              amountCents,
              meta: {
                meterId: meter.id,
                usage: billedUsage,
                utilityType: meter.type,
                ratePlanId: meter.ratePlanId ?? undefined,
                readStartAt: startRead.readAt,
                readEndAt: endRead.readAt
              }
            }
          ]
        }
      },
      include: { lines: true }
    });

    const line = invoice.lines[0];
    await this.createLedgerPair({
      campgroundId: reservation.campgroundId,
      reservationId: reservation.id,
      invoiceId: invoice.id,
      invoiceLineId: line.id,
      amountCents: line.amountCents,
      revenueGl: "UTILITY",
      description: line.description
    });

    await this.prisma.utilityMeter.update({
      where: { id: meter.id },
      data: { lastBilledReadAt: endRead.readAt }
    });

    return this.getInvoice(invoice.id);
  }

  async seedMetersForSiteClass(siteClassId: string) {
    const siteClass = await this.prisma.siteClass.findUnique({
      where: { id: siteClassId },
      include: { sites: true }
    });
    if (!siteClass) throw new NotFoundException("Site class not found");
    if (!siteClass.meteredEnabled || !siteClass.meteredType) {
      throw new BadRequestException("Site class is not marked as metered");
    }
    const type = siteClass.meteredType;
    const sites = siteClass.sites;
    if (!sites || sites.length === 0) return { created: 0 };

    const existing = await this.prisma.utilityMeter.findMany({
      where: { siteId: { in: sites.map((s) => s.id) }, type, active: true }
    });
    const existingBySite = new Set(existing.map((m) => m.siteId));

    let created = 0;
    for (const site of sites) {
      if (existingBySite.has(site.id)) continue;
      await this.prisma.utilityMeter.create({
        data: {
          campgroundId: site.campgroundId,
          siteId: site.id,
          type,
          ratePlanId: siteClass.meteredRatePlanId || null,
          billingMode: siteClass.meteredBillingMode || "cycle",
          billTo: siteClass.meteredBillTo || "reservation",
          multiplier: (siteClass as any).meteredMultiplier ?? 1.0,
          autoEmail: siteClass.meteredAutoEmail ?? false
        }
      });
      created += 1;
    }
    return { created, totalSites: sites.length };
  }

  async createBillingCycle(reservationId: string, cadence: string, periodStart: Date, periodEnd: Date) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new NotFoundException("Reservation not found");
    return this.prisma.billingCycle.create({
      data: {
        reservationId,
        campgroundId: reservation.campgroundId,
        cadence,
        periodStart,
        periodEnd
      }
    });
  }

  async upsertCurrentCycle(reservationId: string, cadence: string) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new NotFoundException("Reservation not found");

    const now = new Date();
    const anchor = reservation.billingAnchorDate || reservation.arrivalDate;
    const lengthDays = cadence === "weekly" ? 7 : 30;
    const periodsSinceStart = Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / (lengthDays * 24 * 3600 * 1000)));
    const periodStart = new Date(anchor.getTime() + periodsSinceStart * lengthDays * 24 * 3600 * 1000);
    const periodEnd = new Date(periodStart.getTime() + lengthDays * 24 * 3600 * 1000);

    const existing = await this.prisma.billingCycle.findFirst({
      where: {
        reservationId,
        periodStart,
        periodEnd
      }
    });
    if (existing) return existing;

    return this.createBillingCycle(reservationId, cadence, periodStart, periodEnd);
  }

  private buildInvoiceNumber(campgroundId: string) {
    return `INV-${campgroundId.slice(0, 6)}-${Date.now()}`;
  }

  private async calcUtilityCharges(
    reservation: any,
    cycle: any
  ): Promise<UtilityCharge[]> {
    const meters = await this.prisma.utilityMeter.findMany({
      where: {
        campgroundId: reservation.campgroundId,
        siteId: reservation.siteId,
        active: true
      },
      include: {
        reads: {
          where: {
            readAt: {
              lte: cycle.periodEnd
            }
          },
          orderBy: { readAt: "asc" }
        },
        ratePlan: true
      }
    });

    const charges: UtilityCharge[] = [];
    for (const meter of meters) {
      if (meter.billingMode && meter.billingMode !== "cycle") continue;
      const reads = meter.reads;
      if (!reads || reads.length === 0) continue;

      const startRead = [...reads].filter((r) => r.readAt <= cycle.periodStart).pop() || reads[0];
      const endRead = [...reads].filter((r) => r.readAt <= cycle.periodEnd).pop() || reads[reads.length - 1];
      const usage = Math.max(0, Number(endRead.readingValue) - Number(startRead.readingValue));
      const multiplier = Number((meter as any).multiplier ?? 1);
      const billedUsage = usage * (Number.isFinite(multiplier) ? multiplier : 1);

      const plan = meter.ratePlan;
      const rate = plan?.baseRateCents ?? 0;
      const amountCents = Math.round(billedUsage * rate);

      charges.push({
        type: meter.type,
        meterId: meter.id,
        usage: billedUsage,
        ratePlanId: plan?.id ?? null,
        rateCents: rate,
        amountCents,
        description: `${meter.type} usage ${billedUsage.toFixed(2)} @ ${rate}c`,
        meta: { meterId: meter.id, usage: billedUsage, planId: plan?.id ?? null }
      });
    }

    return charges;
  }

  private estimateRentPerCycle(reservation: any, cadence: string) {
    const start = reservation.arrivalDate instanceof Date ? reservation.arrivalDate : new Date(reservation.arrivalDate);
    const end = reservation.departureDate instanceof Date ? reservation.departureDate : new Date(reservation.departureDate);
    const stayDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 3600 * 1000)));
    const divisor = cadence === "weekly" ? Math.max(1, Math.ceil(stayDays / 7)) : Math.max(1, Math.ceil(stayDays / 30));
    return Math.round((reservation.baseSubtotal ?? reservation.totalAmount ?? 0) / divisor);
  }

  private async createLedgerPair(opts: {
    campgroundId: string;
    reservationId?: string | null;
    invoiceId: string;
    invoiceLineId?: string | null;
    amountCents: number;
    revenueGl: string;
    description: string;
    occurredAt?: Date;
  }) {
    const occurredAt = opts.occurredAt ?? new Date();
    const entries = await postBalancedLedgerEntries(
      this.prisma,
      [
        {
          campgroundId: opts.campgroundId,
          reservationId: opts.reservationId || null,
          glCode: "AR",
          account: "Accounts Receivable",
          description: opts.description,
          amountCents: opts.amountCents,
          direction: "debit",
          occurredAt,
          externalRef: opts.invoiceLineId ?? opts.invoiceId,
          dedupeKey: `inv:${opts.invoiceId}:${opts.invoiceLineId ?? "line"}:ar`
        },
        {
          campgroundId: opts.campgroundId,
          reservationId: opts.reservationId || null,
          glCode: opts.revenueGl,
          account: opts.revenueGl,
          description: `${opts.description} revenue`,
          amountCents: opts.amountCents,
          direction: "credit",
          occurredAt,
          externalRef: opts.invoiceLineId ?? opts.invoiceId,
          dedupeKey: `inv:${opts.invoiceId}:${opts.invoiceLineId ?? "line"}:rev`
        }
      ],
      { requireGlCode: true }
    );

    const debit = entries.find((e: any) => e.direction === "debit");
    if (debit) {
      await this.prisma.arLedgerEntry.create({
        data: {
          ledgerEntryId: debit.id,
          invoiceId: opts.invoiceId,
          invoiceLineId: opts.invoiceLineId || null,
          type: "ar_open"
        }
      });
    }
  }

  async generateInvoiceForCycle(cycleId: string) {
    const cycle = await this.prisma.billingCycle.findUnique({
      where: { id: cycleId },
      include: { reservation: true }
    });
    if (!cycle) throw new NotFoundException("Cycle not found");

    const existing = await this.prisma.invoice.findFirst({ where: { billingCycleId: cycleId } });
    if (existing) return existing;

    const reservation = cycle.reservation;
    const cadence = cycle.cadence || reservation.billingCadence || "monthly";
    const rentCents = this.estimateRentPerCycle(reservation, cadence);
    const utilityCharges = await this.calcUtilityCharges(reservation, cycle);

    const lines = [];
    if (rentCents > 0) {
      lines.push({
        type: "rent",
        description: `Rent ${cadence}`,
        quantity: 1,
        unitCents: rentCents,
        amountCents: rentCents,
        meta: {}
      });
    }

    for (const charge of utilityCharges) {
      if (charge.amountCents <= 0) continue;
      lines.push({
        type: "utility",
        description: charge.description,
        quantity: charge.usage,
        unitCents: charge.rateCents ?? charge.amountCents,
        amountCents: charge.amountCents,
        meta: {
          meterId: charge.meterId,
          usage: charge.usage,
          utilityType: charge.type,
          ratePlanId: charge.ratePlanId ?? undefined
        }
      });
    }

    const subtotal = lines.reduce((acc, l) => acc + l.amountCents, 0);
    const total = subtotal;

    const invoice = await this.prisma.invoice.create({
      data: {
        billingCycleId: cycleId,
        campgroundId: reservation.campgroundId,
        reservationId: reservation.id,
        number: this.buildInvoiceNumber(reservation.campgroundId),
        dueDate: cycle.periodEnd,
        subtotalCents: subtotal,
        totalCents: total,
        balanceCents: total,
        lines: {
          create: lines
        }
      },
      include: { lines: true }
    });

    // Ledger posting
    for (const line of invoice.lines) {
      const gl = line.type === "rent" ? "RENT" : line.type === "late_fee" ? "LATE_FEE" : "UTILITY";
      await this.createLedgerPair({
        campgroundId: reservation.campgroundId,
        reservationId: reservation.id,
        invoiceId: invoice.id,
        invoiceLineId: line.id,
        amountCents: line.amountCents,
        revenueGl: gl,
        description: line.description
      });
    }

    await this.prisma.billingCycle.update({
      where: { id: cycleId },
      data: { generatedAt: new Date(), status: "closed" }
    });

    return invoice;
  }

  private async recalcInvoiceTotals(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { lines: true } });
    if (!invoice) return;
    const subtotal = invoice.lines.reduce((acc: number, l: any) => acc + l.amountCents, 0);
    const total = subtotal;
    const paid = invoice.totalCents - invoice.balanceCents;
    const balance = Math.max(0, total - paid);
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        subtotalCents: subtotal,
        totalCents: total,
        balanceCents: balance
      }
    });
  }

  async applyLateFeesForOverdue() {
    const now = new Date();
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: "open",
        dueDate: { lt: now },
        balanceCents: { gt: 0 }
      },
      include: {
        billingCycle: true,
        lines: true,
        reservation: true
      }
    });

    for (const invoice of invoices) {
      const hasLateFee = invoice.lines.some((l: any) => l.type === "late_fee");
      if (hasLateFee) continue;

      const rule = await this.prisma.lateFeeRule.findFirst({
        where: {
          campgroundId: invoice.campgroundId,
          cadence: invoice.billingCycle?.cadence ?? "monthly",
          active: true
        },
        orderBy: { effectiveFrom: "desc" }
      });
      if (!rule) continue;

      const amount =
        rule.feeType === "percent"
          ? Math.round((invoice.balanceCents * (rule.feePercentBp ?? 0)) / 10000)
          : rule.feeCents ?? 0;
      if (amount <= 0) continue;

      const lateLine = await this.prisma.invoiceLine.create({
        data: {
          invoiceId: invoice.id,
          type: "late_fee",
          description: "Late fee",
          quantity: 1,
          unitCents: amount,
          amountCents: amount
        }
      });

      await this.createLedgerPair({
        campgroundId: invoice.campgroundId,
        reservationId: invoice.reservationId,
        invoiceId: invoice.id,
        invoiceLineId: lateLine.id,
        amountCents: amount,
        revenueGl: "LATE_FEE",
        description: "Late fee"
      });

      await this.recalcInvoiceTotals(invoice.id);
    }
  }

  async writeOffInvoice(invoiceId: string, reason: string, actorId?: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.status === "written_off") return invoice;

    const amount = invoice.balanceCents;
    const beforeSnapshot = { status: invoice.status, balanceCents: invoice.balanceCents };

    await this.prisma.invoiceLine.create({
      data: {
        invoiceId,
        type: "adjustment",
        description: `Write-off: ${reason}`,
        quantity: 1,
        unitCents: -amount,
        amountCents: -amount,
        meta: { reason }
      }
    });

    await this.prisma.ledgerEntry.create({
      data: {
        campgroundId: invoice.campgroundId,
        reservationId: invoice.reservationId,
        glCode: "BAD_DEBT",
        account: "Bad Debt",
        description: `Write-off ${invoice.number}`,
        amountCents: amount,
        direction: "debit"
      }
    });

    const credit = await this.prisma.ledgerEntry.create({
      data: {
        campgroundId: invoice.campgroundId,
        reservationId: invoice.reservationId,
        glCode: "AR",
        account: "Accounts Receivable",
        description: `Write-off ${invoice.number}`,
        amountCents: amount,
        direction: "credit"
      }
    });

    await this.prisma.arLedgerEntry.create({
      data: {
        ledgerEntryId: credit.id,
        invoiceId,
        type: "writeoff"
      }
    });

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "written_off", balanceCents: 0, closedAt: new Date() }
    });

    await this.recalcInvoiceTotals(invoiceId);

    await this.prisma.auditLog.create({
      data: {
        campgroundId: invoice.campgroundId,
        actorId: actorId || null,
        action: "invoice.writeoff",
        entity: "invoice",
        entityId: invoiceId,
        before: beforeSnapshot,
        after: { status: "written_off", reason }
      }
    });

    return this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { lines: true } });
  }

  async overrideInvoiceLine(invoiceId: string, lineId: string, amountCents: number, note: string, actorId?: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException("Invoice not found");
    const line = await this.prisma.invoiceLine.findUnique({ where: { id: lineId } });
    if (!line || line.invoiceId !== invoiceId) throw new NotFoundException("Line not found");

    const before = { ...line };
    await this.prisma.invoiceLine.update({
      where: { id: lineId },
      data: {
        amountCents,
        unitCents: amountCents,
        meta: {
          ...(line.meta as any),
          overrideNote: note,
          overriddenBy: actorId || "system"
        }
      }
    });

    await this.recalcInvoiceTotals(invoiceId);

    await this.prisma.auditLog.create({
      data: {
        campgroundId: invoice.campgroundId,
        actorId: actorId || null,
        action: "invoice.override_line",
        entity: "invoice_line",
        entityId: lineId,
        before,
        after: { amountCents, note }
      }
    });

    return this.getInvoice(invoiceId);
  }

  async listInvoicesByReservation(reservationId: string) {
    return this.prisma.invoice.findMany({
      where: { reservationId },
      include: { lines: true, billingCycle: true }
    });
  }

  async getInvoice(id: string) {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: { lines: true, billingCycle: true }
    });
  }

  async generateCyclesAndInvoices() {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        billingCadence: { in: ["weekly", "monthly"] },
        status: { in: ["pending", "confirmed", "checked_in"] }
      }
    });

    for (const reservation of reservations) {
      const cadence = reservation.billingCadence || "monthly";
      const cycle = await this.upsertCurrentCycle(reservation.id, cadence);
      const now = new Date();
      if (cycle.periodEnd <= now) {
        await this.generateInvoiceForCycle(cycle.id).catch((err) => {
          this.logger.warn(`Failed to generate invoice for cycle ${cycle.id}: ${err instanceof Error ? err.message : err}`);
        });
      }
    }
  }
}
