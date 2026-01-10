import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface ReconciliationStatus {
  status: "reconciled" | "pending" | "discrepancy";
  lastReconciledAt: Date | null;
  discrepancyCents: number;
  details: {
    expectedCents: number;
    actualCents: number;
    difference: number;
  };
}

export interface MonthEndCloseStatus {
  month: string;
  status: "open" | "review" | "closed" | "locked";
  closedBy: string | null;
  closedAt: Date | null;
  metrics: {
    totalRevenueCents: number;
    totalRefundsCents: number;
    totalPayoutsCents: number;
    totalPlatformFeesCents: number;
    netRevenueCents: number;
  };
  checklistItems: Array<{
    name: string;
    status: "pending" | "completed" | "failed";
    note?: string;
  }>;
}

export interface ConfidenceScore {
  score: number; // 0-100
  level: "high" | "medium" | "low";
  factors: Array<{
    name: string;
    score: number;
    weight: number;
    status: "good" | "warning" | "error";
    message: string;
  }>;
}

@Injectable()
export class AccountingConfidenceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate overall accounting confidence score for a campground
   */
  async getConfidenceScore(campgroundId: string, month?: string): Promise<ConfidenceScore> {
    const targetMonth = month ?? this.getCurrentMonth();
    const { start, end } = this.getMonthBounds(targetMonth);

    const factors: ConfidenceScore["factors"] = [];
    let totalWeight = 0;
    let weightedScore = 0;

    // Factor 1: Payout Reconciliation (weight: 40)
    const payoutFactor = await this.checkPayoutReconciliation(campgroundId, start, end);
    factors.push(payoutFactor);
    totalWeight += payoutFactor.weight;
    weightedScore += payoutFactor.score * payoutFactor.weight;

    // Factor 2: Payment-Reservation Match (weight: 25)
    const paymentFactor = await this.checkPaymentReservationMatch(campgroundId, start, end);
    factors.push(paymentFactor);
    totalWeight += paymentFactor.weight;
    weightedScore += paymentFactor.score * paymentFactor.weight;

    // Factor 3: Pending Transactions (weight: 15)
    const pendingFactor = await this.checkPendingTransactions(campgroundId, start, end);
    factors.push(pendingFactor);
    totalWeight += pendingFactor.weight;
    weightedScore += pendingFactor.score * pendingFactor.weight;

    // Factor 4: Disputes and Refunds (weight: 10)
    const disputeFactor = await this.checkDisputesAndRefunds(campgroundId, start, end);
    factors.push(disputeFactor);
    totalWeight += disputeFactor.weight;
    weightedScore += disputeFactor.score * disputeFactor.weight;

    // Factor 5: Month-End Close Status (weight: 10)
    const closeFactor = await this.checkMonthEndClose(campgroundId, targetMonth);
    factors.push(closeFactor);
    totalWeight += closeFactor.weight;
    weightedScore += closeFactor.score * closeFactor.weight;

    const score = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
    const level = score >= 85 ? "high" : score >= 60 ? "medium" : "low";

    return { score, level, factors };
  }

  /**
   * Get payout reconciliation status
   */
  async getPayoutReconciliation(campgroundId: string, month?: string): Promise<ReconciliationStatus> {
    const targetMonth = month ?? this.getCurrentMonth();
    const { start, end } = this.getMonthBounds(targetMonth);

    // Get expected payouts from successful payments using raw SQL
    // This avoids Prisma 7 + PrismaPg adapter aggregate query issues
    const paymentSums = await this.prisma.$queryRaw<[{ total_amount: bigint | null; total_fees: bigint | null }]>`
      SELECT
        COALESCE(SUM(p."amountCents"), 0) as total_amount,
        COALESCE(SUM(COALESCE(p."stripeFeeCents", 0) + COALESCE(p."applicationFeeCents", 0)), 0) as total_fees
      FROM "Payment" p
      JOIN "Reservation" r ON p."reservationId" = r.id
      WHERE r."campgroundId" = ${campgroundId}
        AND p."createdAt" >= ${start}
        AND p."createdAt" <= ${end}
        AND p.direction = 'charge'
    `;

    const expectedCents = Number(paymentSums[0]?.total_amount ?? 0) - Number(paymentSums[0]?.total_fees ?? 0);

    // Get actual payouts using raw SQL
    const payoutSums = await this.prisma.$queryRaw<[{ total_amount: bigint | null }]>`
      SELECT COALESCE(SUM("amountCents"), 0) as total_amount
      FROM "Payout"
      WHERE "campgroundId" = ${campgroundId}
        AND "paidAt" >= ${start}
        AND "paidAt" <= ${end}
        AND status = 'paid'
    `;

    const actualCents = Number(payoutSums[0]?.total_amount ?? 0);
    const difference = actualCents - expectedCents;

    // Allow small discrepancy due to timing
    const threshold = Math.max(100, expectedCents * 0.01); // 1% or $1
    const status = Math.abs(difference) <= threshold ? "reconciled" : "discrepancy";

    const lastPayout = await this.prisma.payout.findFirst({
      where: { campgroundId, status: "paid" },
      orderBy: { paidAt: "desc" },
    });

    return {
      status,
      lastReconciledAt: lastPayout?.paidAt ?? null,
      discrepancyCents: difference,
      details: { expectedCents, actualCents, difference },
    };
  }

  /**
   * Get month-end close status
   */
  async getMonthEndCloseStatus(campgroundId: string, month: string): Promise<MonthEndCloseStatus> {
    const { start, end } = this.getMonthBounds(month);

    // Check if month is closed
    const closeRecord = await this.prisma.monthEndClose?.findFirst?.({
      where: { campgroundId, month },
    });

    // Calculate metrics using raw SQL to avoid Prisma 7 + PrismaPg aggregate issues
    const [revenueResult, refundsResult, payoutsResult, platformFees] = await Promise.all([
      this.prisma.$queryRaw<[{ total: bigint | null }]>`
        SELECT COALESCE(SUM(p."amountCents"), 0) as total
        FROM "Payment" p
        JOIN "Reservation" r ON p."reservationId" = r.id
        WHERE r."campgroundId" = ${campgroundId}
          AND p."createdAt" >= ${start}
          AND p."createdAt" <= ${end}
          AND p.direction = 'charge'
      `,
      this.prisma.$queryRaw<[{ total: bigint | null }]>`
        SELECT COALESCE(SUM(p."amountCents"), 0) as total
        FROM "Payment" p
        JOIN "Reservation" r ON p."reservationId" = r.id
        WHERE r."campgroundId" = ${campgroundId}
          AND p."createdAt" >= ${start}
          AND p."createdAt" <= ${end}
          AND p.direction = 'refund'
      `,
      this.prisma.$queryRaw<[{ total: bigint | null }]>`
        SELECT COALESCE(SUM("amountCents"), 0) as total
        FROM "Payout"
        WHERE "campgroundId" = ${campgroundId}
          AND "paidAt" >= ${start}
          AND "paidAt" <= ${end}
          AND status = 'paid'
      `,
      this.getPlatformFeesForPeriod(campgroundId, start, end),
    ]);

    const totalRevenueCents = Number(revenueResult[0]?.total ?? 0);
    const totalRefundsCents = Number(refundsResult[0]?.total ?? 0);
    const totalPayoutsCents = Number(payoutsResult[0]?.total ?? 0);
    const totalPlatformFeesCents = platformFees;
    const netRevenueCents = totalRevenueCents - totalRefundsCents - totalPlatformFeesCents;

    // Build checklist
    const checklistItems = await this.buildMonthEndChecklist(campgroundId, start, end);

    return {
      month,
      status: closeRecord?.status ?? "open",
      closedBy: closeRecord?.closedBy ?? null,
      closedAt: closeRecord?.closedAt ?? null,
      metrics: {
        totalRevenueCents,
        totalRefundsCents,
        totalPayoutsCents,
        totalPlatformFeesCents,
        netRevenueCents,
      },
      checklistItems,
    };
  }

  /**
   * Initiate month-end close process
   */
  async initiateMonthEndClose(campgroundId: string, month: string, userId: string) {
    // Validate all checklist items are complete
    const { start, end } = this.getMonthBounds(month);
    const checklist = await this.buildMonthEndChecklist(campgroundId, start, end);
    const incompleteTasks = checklist.filter(item => item.status !== "completed");

    if (incompleteTasks.length > 0) {
      return {
        success: false,
        message: "Cannot close month with incomplete tasks",
        incompleteTasks,
      };
    }

    // Create or update close record
    const existing = await this.prisma.monthEndClose?.findFirst?.({
      where: { campgroundId, month },
    });

    if (existing) {
      await this.prisma.monthEndClose?.update?.({
        where: { id: existing.id },
        data: { status: "review", initiatedBy: userId, initiatedAt: new Date() },
      });
    } else {
      await this.prisma.monthEndClose?.create?.({
        data: {
          campgroundId,
          month,
          status: "review",
          initiatedBy: userId,
          initiatedAt: new Date(),
        },
      });
    }

    return { success: true, message: "Month-end close initiated for review" };
  }

  /**
   * Approve and finalize month-end close
   */
  async approveMonthEndClose(campgroundId: string, month: string, userId: string) {
    const closeRecord = await this.prisma.monthEndClose?.findFirst?.({
      where: { campgroundId, month },
    });

    if (!closeRecord || closeRecord.status !== "review") {
      return { success: false, message: "Month must be in review status to approve" };
    }

    await this.prisma.monthEndClose?.update?.({
      where: { id: closeRecord.id },
      data: {
        status: "closed",
        closedBy: userId,
        closedAt: new Date(),
      },
    });

    return { success: true, message: "Month-end close approved and finalized" };
  }

  // Helper methods

  private async checkPayoutReconciliation(campgroundId: string, start: Date, end: Date): Promise<ConfidenceScore["factors"][0]> {
    const recon = await this.getPayoutReconciliation(campgroundId, `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`);

    if (recon.status === "reconciled") {
      return {
        name: "Payout Reconciliation",
        score: 100,
        weight: 40,
        status: "good",
        message: "All payouts reconciled successfully",
      };
    }

    const discrepancyPct = recon.details.expectedCents > 0
      ? Math.abs(recon.discrepancyCents) / recon.details.expectedCents
      : 0;

    if (discrepancyPct < 0.05) {
      return {
        name: "Payout Reconciliation",
        score: 75,
        weight: 40,
        status: "warning",
        message: `Minor discrepancy: $${(recon.discrepancyCents / 100).toFixed(2)}`,
      };
    }

    return {
      name: "Payout Reconciliation",
      score: 25,
      weight: 40,
      status: "error",
      message: `Significant discrepancy: $${(recon.discrepancyCents / 100).toFixed(2)}`,
    };
  }

  private async checkPaymentReservationMatch(campgroundId: string, start: Date, end: Date): Promise<ConfidenceScore["factors"][0]> {
    // Check if all payments have linked reservations using raw SQL
    const orphanResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM "Payment" p
      WHERE p."campgroundId" = ${campgroundId}
        AND p."createdAt" >= ${start}
        AND p."createdAt" <= ${end}
        AND (p."reservationId" IS NULL OR p."reservationId" = '')
    `;
    const orphanPayments = Number(orphanResult[0]?.count ?? 0);

    const totalResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM "Payment" p
      WHERE p."campgroundId" = ${campgroundId}
        AND p."createdAt" >= ${start}
        AND p."createdAt" <= ${end}
    `;
    const totalPayments = Number(totalResult[0]?.count ?? 0);

    if (orphanPayments === 0) {
      return {
        name: "Payment-Reservation Match",
        score: 100,
        weight: 25,
        status: "good",
        message: "All payments linked to reservations",
      };
    }

    const matchRate = totalPayments > 0 ? ((totalPayments - orphanPayments) / totalPayments) * 100 : 100;

    if (matchRate >= 95) {
      return {
        name: "Payment-Reservation Match",
        score: 80,
        weight: 25,
        status: "warning",
        message: `${orphanPayments} unlinked payment(s)`,
      };
    }

    return {
      name: "Payment-Reservation Match",
      score: 40,
      weight: 25,
      status: "error",
      message: `${orphanPayments} unlinked payments (${(100 - matchRate).toFixed(1)}% unmatched)`,
    };
  }

  private async checkPendingTransactions(campgroundId: string, start: Date, end: Date): Promise<ConfidenceScore["factors"][0]> {
    // Payment model doesn't have status - all payments in DB are captured
    // Only check pending payouts using raw SQL
    const pendingPayoutsResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM "Payout"
      WHERE "campgroundId" = ${campgroundId}
        AND "createdAt" >= ${start}
        AND "createdAt" <= ${end}
        AND status IN ('pending', 'in_transit')
    `;

    const total = Number(pendingPayoutsResult[0]?.count ?? 0);

    if (total === 0) {
      return {
        name: "Pending Transactions",
        score: 100,
        weight: 15,
        status: "good",
        message: "No pending transactions",
      };
    }

    if (total <= 5) {
      return {
        name: "Pending Transactions",
        score: 70,
        weight: 15,
        status: "warning",
        message: `${total} transaction(s) still pending`,
      };
    }

    return {
      name: "Pending Transactions",
      score: 30,
      weight: 15,
      status: "error",
      message: `${total} pending transactions need attention`,
    };
  }

  private async checkDisputesAndRefunds(campgroundId: string, start: Date, end: Date): Promise<ConfidenceScore["factors"][0]> {
    // Use raw SQL for consistency with other methods
    const openDisputesResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM "Dispute"
      WHERE "campgroundId" = ${campgroundId}
        AND "createdAt" >= ${start}
        AND "createdAt" <= ${end}
        AND status IN ('needs_response', 'under_review')
    `;
    const openDisputes = Number(openDisputesResult[0]?.count ?? 0);

    if (openDisputes === 0) {
      return {
        name: "Disputes & Refunds",
        score: 100,
        weight: 10,
        status: "good",
        message: "No open disputes",
      };
    }

    if (openDisputes <= 2) {
      return {
        name: "Disputes & Refunds",
        score: 60,
        weight: 10,
        status: "warning",
        message: `${openDisputes} open dispute(s) need response`,
      };
    }

    return {
      name: "Disputes & Refunds",
      score: 20,
      weight: 10,
      status: "error",
      message: `${openDisputes} open disputes require attention`,
    };
  }

  private async checkMonthEndClose(campgroundId: string, month: string): Promise<ConfidenceScore["factors"][0]> {
    const closeRecord = await this.prisma.monthEndClose?.findFirst?.({
      where: { campgroundId, month },
    });

    if (closeRecord?.status === "closed" || closeRecord?.status === "locked") {
      return {
        name: "Month-End Close",
        score: 100,
        weight: 10,
        status: "good",
        message: "Month closed and verified",
      };
    }

    if (closeRecord?.status === "review") {
      return {
        name: "Month-End Close",
        score: 70,
        weight: 10,
        status: "warning",
        message: "Pending approval",
      };
    }

    // For current month, it's okay to be open
    const currentMonth = this.getCurrentMonth();
    if (month === currentMonth) {
      return {
        name: "Month-End Close",
        score: 80,
        weight: 10,
        status: "good",
        message: "Current month (not yet closeable)",
      };
    }

    return {
      name: "Month-End Close",
      score: 30,
      weight: 10,
      status: "error",
      message: "Prior month not closed",
    };
  }

  private async buildMonthEndChecklist(campgroundId: string, start: Date, end: Date): Promise<MonthEndCloseStatus["checklistItems"]> {
    const items: MonthEndCloseStatus["checklistItems"] = [];

    // Check 1: All payments processed (Payment model has no status - all recorded are captured)
    // Always mark as completed since payments without status are assumed processed
    items.push({
      name: "All payments processed",
      status: "completed",
      note: undefined,
    });

    // Check 2: All payouts reconciled using raw SQL
    const unreconciledResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM "Payout"
      WHERE "campgroundId" = ${campgroundId}
        AND "createdAt" >= ${start}
        AND "createdAt" <= ${end}
        AND status != 'paid'
    `;
    const unreconciled = Number(unreconciledResult[0]?.count ?? 0);
    items.push({
      name: "All payouts reconciled",
      status: unreconciled === 0 ? "completed" : "pending",
      note: unreconciled > 0 ? `${unreconciled} pending` : undefined,
    });

    // Check 3: No open disputes using raw SQL
    const openDisputesResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM "Dispute"
      WHERE "campgroundId" = ${campgroundId}
        AND "createdAt" >= ${start}
        AND "createdAt" <= ${end}
        AND status IN ('needs_response', 'under_review')
    `;
    const openDisputes = Number(openDisputesResult[0]?.count ?? 0);
    items.push({
      name: "No open disputes",
      status: openDisputes === 0 ? "completed" : "failed",
      note: openDisputes > 0 ? `${openDisputes} open` : undefined,
    });

    // Check 4: Billing period invoiced
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { organizationId: true },
    });

    if (campground?.organizationId) {
      const billingPeriod = await this.prisma.organizationBillingPeriod.findFirst({
        where: {
          organizationId: campground.organizationId,
          periodStart: { lte: end },
          periodEnd: { gte: start },
        },
      });
      items.push({
        name: "Platform billing invoiced",
        status: billingPeriod?.status === "invoiced" || billingPeriod?.status === "paid" ? "completed" : "pending",
      });
    }

    return items;
  }

  private async getPlatformFeesForPeriod(campgroundId: string, start: Date, end: Date): Promise<number> {
    // Use raw SQL to avoid Prisma 7 + PrismaPg aggregate issues
    const result = await this.prisma.$queryRaw<[{ total: bigint | null }]>`
      SELECT COALESCE(SUM("unitCents"), 0) as total
      FROM "UsageEvent"
      WHERE "campgroundId" = ${campgroundId}
        AND "createdAt" >= ${start}
        AND "createdAt" <= ${end}
    `;
    return Number(result[0]?.total ?? 0);
  }

  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  private getMonthBounds(month: string): { start: Date; end: Date } {
    const [year, monthNum] = month.split("-").map(Number);
    const start = new Date(year, monthNum - 1, 1);
    const end = new Date(year, monthNum, 0, 23, 59, 59);
    return { start, end };
  }
}
