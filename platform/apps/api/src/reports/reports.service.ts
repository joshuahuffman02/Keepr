import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ObservabilityService } from "../observability/observability.service";
import { AlertingService } from "../observability/alerting.service";
import { DashboardService } from "../dashboard/dashboard.service";
import { UploadsService } from "../uploads/uploads.service";
import { AuditService } from "../audit/audit.service";
import { JobQueueService } from "../observability/job-queue.service";
import { EmailService } from "../email/email.service";
import { ReportDimensionSpec, ReportQueryInput, ReportRunResult, ReportSpec } from "./report.types";
import { getReportCatalog, getReportSpec, resolveDimension, resolveFilters, resolveMetric } from "./report.registry";
import * as XLSX from "xlsx";

@Injectable()
export class ReportsService {
    constructor(
      private prisma: PrismaService,
      private readonly observability: ObservabilityService,
      private readonly alerting: AlertingService,
      private readonly dashboard: DashboardService,
      private readonly uploads: UploadsService,
      private readonly audit: AuditService,
      private readonly jobQueue: JobQueueService,
      private readonly email: EmailService
    ) { }

    private activeRuns = 0;
    private heavyRuns = 0;
    private readonly queryLimit = Number(process.env.REPORT_QUERY_MAX_CONCURRENCY ?? 10);
    private readonly heavyQueryLimit = Number(process.env.REPORT_HEAVY_MAX_CONCURRENCY ?? 2);
    private readonly defaultCacheTtlSec = Number(process.env.REPORT_QUERY_CACHE_TTL ?? 120);
    private readonly defaultSampleLimit = Number(process.env.REPORT_QUERY_SAMPLE_LIMIT ?? 5000);
    private readonly exportQueueName = "reports-export";

    private encodeToken(payload: Record<string, any>): string {
      return Buffer.from(JSON.stringify(payload)).toString("base64url");
    }

    private decodeToken<T>(token?: string): T | null {
      if (!token) return null;
      try {
        return JSON.parse(Buffer.from(token, "base64url").toString()) as T;
      } catch (err) {
        return null;
      }
    }

    private exportMaxRows() {
      return Number(process.env.REPORT_EXPORT_MAX_ROWS ?? 50000);
    }

    private exportPageSize() {
      return Number(process.env.REPORT_EXPORT_PAGE_SIZE ?? 1000);
    }

    private capacityGuardThreshold() {
      return Number(process.env.REPORT_EXPORT_CAPACITY_GUARD ?? 150);
    }

    private capacityGuardRetryAfterSec() {
      return Number(process.env.REPORT_EXPORT_RETRY_AFTER_SEC ?? 60);
    }

    private resolveRangeFromFilters(filters?: Record<string, any>) {
      const now = new Date();
      const range = filters?.range ?? filters?.timeRange;
      const days = filters?.days ? Number(filters.days) : undefined;
      if (range === "last_7_days") {
        return { start: this.daysAgo(7), end: now, days: 7, label: range };
      }
      if (range === "last_30_days") {
        return { start: this.daysAgo(30), end: now, days: 30, label: range };
      }
      if (range === "last_90_days") {
        return { start: this.daysAgo(90), end: now, days: 90, label: range };
      }
      if (typeof days === "number" && days > 0) {
        return { start: this.daysAgo(days), end: now, days, label: `last_${days}_days` };
      }
      if (filters?.startDate || filters?.endDate) {
        const start = filters?.startDate ? new Date(filters.startDate) : undefined;
        const end = filters?.endDate ? new Date(filters.endDate) : now;
        const computedDays = start && end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000)) : undefined;
        return { start, end, days: computedDays, label: "custom" };
      }
      // default to 30d
      return { start: this.daysAgo(30), end: now, days: 30, label: "last_30_days" };
    }

    private reservationDateWhere(range?: { start?: Date; end?: Date }) {
      if (!range?.start && !range?.end) return {};
      const startDate = range.start;
      const endDate = range.end ?? new Date();
      return {
        OR: [
          { arrivalDate: { gte: startDate ?? undefined, lte: endDate ?? undefined } },
          { departureDate: { gte: startDate ?? undefined, lte: endDate ?? undefined } },
          { arrivalDate: { lte: startDate ?? endDate }, departureDate: { gte: endDate } }
        ]
      };
    }

    private async computeAttachRate(campgroundId: string, range?: { start?: Date; end?: Date }) {
      const where = {
        campgroundId,
        status: { notIn: ["cancelled"] as any },
        ...(this.reservationDateWhere(range) as any)
      };
      const reservations = await this.prisma.reservation.findMany({
        where,
        select: { id: true }
      });
      if (!reservations.length) return 0;
      const reservationIds = reservations.map((r) => r.id);
      const withUpsell = await this.prisma.reservationUpsell.count({
        where: { reservationId: { in: reservationIds } },
        distinct: ["reservationId"]
      });
      return Math.round((withUpsell / reservations.length) * 100);
    }

    private computeNextRun(cadence: string | undefined, from: Date = new Date()) {
      const base = new Date(from);
      switch ((cadence ?? "daily").toLowerCase()) {
        case "hourly":
          base.setHours(base.getHours() + 1);
          return base;
        case "weekly":
          base.setDate(base.getDate() + 7);
          return base;
        case "monthly":
          base.setMonth(base.getMonth() + 1);
          return base;
        case "daily":
        default:
          base.setDate(base.getDate() + 1);
          return base;
      }
    }

    async getBookingSources(campgroundId: string, startDate?: string, endDate?: string) {
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
        const end = endDate ? new Date(endDate) : new Date();

        const reservations = await this.prisma.reservation.findMany({
            where: {
                campgroundId,
                status: { not: 'cancelled' },
                createdAt: {
                    gte: start,
                    lte: end,
                },
            },
            select: {
                id: true,
                source: true,
                leadTimeDays: true,
                totalAmount: true,
                createdAt: true,
                arrivalDate: true,
            },
        });

        // Aggregate by Source
        const bySource = {
            online: { count: 0, revenue: 0 },
            admin: { count: 0, revenue: 0 },
            kiosk: { count: 0, revenue: 0 },
            phone: { count: 0, revenue: 0 },
            walk_in: { count: 0, revenue: 0 },
            other: { count: 0, revenue: 0 },
        };

        // Aggregate by Lead Time
        const byLeadTime = {
            sameDay: 0, // 0 days
            nextDay: 0, // 1 day
            twoDays: 0, // 2 days
            threeToSeven: 0, // 3-7 days
            oneToTwoWeeks: 0, // 8-14 days
            twoToFourWeeks: 0, // 15-30 days
            oneToThreeMonths: 0, // 31-90 days
            threeMonthsPlus: 0, // 91+ days
        };

        let totalBookings = 0;
        let totalRevenue = 0;

        reservations.forEach((res) => {
            totalBookings++;
            const revenue = (res.totalAmount || 0) / 100; // Convert cents to dollars
            totalRevenue += revenue;

            // Source Aggregation
            const source = res.source?.toLowerCase() || 'other';
            if (source.includes('online')) {
                bySource.online.count++;
                bySource.online.revenue += revenue;
            } else if (source.includes('admin') || source.includes('staff')) {
                bySource.admin.count++;
                bySource.admin.revenue += revenue;
            } else if (source.includes('kiosk')) {
                bySource.kiosk.count++;
                bySource.kiosk.revenue += revenue;
            } else if (source.includes('phone')) {
                bySource.phone.count++;
                bySource.phone.revenue += revenue;
            } else if (source.includes('walk') || source.includes('walk-in')) {
                bySource.walk_in.count++;
                bySource.walk_in.revenue += revenue;
            } else {
                bySource.other.count++;
                bySource.other.revenue += revenue;
            }

            // Lead Time Aggregation
            // Use stored leadTimeDays or calculate it
            let days = res.leadTimeDays;
            if (typeof days !== 'number') {
                const arrival = new Date(res.arrivalDate);
                const created = new Date(res.createdAt);
                days = Math.floor((arrival.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
            }

            // Safe guard against negative lead times (e.g. timezone issues or backdated bookings)
            days = Math.max(0, days || 0);

            if (days === 0) byLeadTime.sameDay++;
            else if (days === 1) byLeadTime.nextDay++;
            else if (days === 2) byLeadTime.twoDays++;
            else if (days <= 7) byLeadTime.threeToSeven++;
            else if (days <= 14) byLeadTime.oneToTwoWeeks++;
            else if (days <= 30) byLeadTime.twoToFourWeeks++;
            else if (days <= 90) byLeadTime.oneToThreeMonths++;
            else byLeadTime.threeMonthsPlus++;
        });

        return {
            period: { start, end },
            totalBookings,
            totalRevenue,
            bySource,
            byLeadTime,
        };
    }

    async getGuestOrigins(campgroundId: string, startDate?: string, endDate?: string) {
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
        const end = endDate ? new Date(endDate) : new Date();

        // Fetch guests via reservations to respect the date range
        const reservations = await this.prisma.reservation.findMany({
            where: {
                campgroundId,
                status: { not: 'cancelled' },
                createdAt: {
                    gte: start,
                    lte: end,
                },
            },
            include: {
                guest: {
                    select: {
                        postalCode: true,
                        city: true,
                        state: true,
                        country: true,
                    },
                },
            },
        });

        const byZipCode: Record<string, { zipCode: string, city?: string, state?: string, count: number, revenue: number }> = {};
        const byState: Record<string, { state: string, count: number, revenue: number }> = {};

        reservations.forEach((res) => {
            const revenue = (res.totalAmount || 0) / 100;
            const guest = res.guest;
            if (!guest) return;

            // By Zip Code
            if (guest.postalCode) {
                const zip = guest.postalCode;
                if (!byZipCode[zip]) {
                    byZipCode[zip] = {
                        zipCode: zip,
                        city: guest.city || undefined,
                        state: guest.state || undefined,
                        count: 0,
                        revenue: 0
                    };
                }
                byZipCode[zip].count++;
                byZipCode[zip].revenue += revenue;
            }

            // By State
            if (guest.state) {
                const state = guest.state.toUpperCase();
                if (!byState[state]) {
                    byState[state] = { state, count: 0, revenue: 0 };
                }
                byState[state].count++;
                byState[state].revenue += revenue;
            }
        });

        const sortedZips = Object.values(byZipCode).sort((a, b) => b.count - a.count).slice(0, 50); // Top 50
        const sortedStates = Object.values(byState).sort((a, b) => b.count - a.count);

        return {
            period: { start, end },
            byZipCode: sortedZips,
            byState: sortedStates,
        };
    }

    async getReferralPerformance(campgroundId: string, startDate?: string, endDate?: string) {
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
        const end = endDate ? new Date(endDate) : new Date();

        const reservations = await this.prisma.reservation.findMany({
            where: {
                campgroundId,
                status: { not: 'cancelled' },
                createdAt: { gte: start, lte: end },
                OR: [
                    { referralProgramId: { not: null } },
                    { referralCode: { not: null } }
                ]
            },
            select: {
                totalAmount: true,
                discountsAmount: true,
                referralProgramId: true,
                referralCode: true,
                referralIncentiveType: true,
                referralIncentiveValue: true,
                referralSource: true,
                referralChannel: true
            }
        });

        const programIds = Array.from(new Set(reservations.map((r: any) => r.referralProgramId).filter(Boolean)));
        const programMap: Record<string, any> = {};
        if (programIds.length) {
            const programs = await this.prisma.referralProgram.findMany({
                where: { id: { in: programIds } }
            });
            for (const p of programs as any[]) {
                programMap[p.id] = p;
            }
        }

        const byProgram: Record<string, any> = {};
        let totalRevenueCents = 0;
        let totalReferralDiscountCents = 0;

        reservations.forEach((res) => {
            const revenue = res.totalAmount || 0;
            totalRevenueCents += revenue;
            totalReferralDiscountCents += res.referralIncentiveValue ?? 0;

            const key = res.referralProgramId || res.referralCode || "unmapped";
            if (!byProgram[key]) {
                const program = res.referralProgramId ? programMap[res.referralProgramId] : null;
                byProgram[key] = {
                    programId: res.referralProgramId ?? null,
                    code: program?.code ?? res.referralCode ?? "unknown",
                    source: res.referralSource ?? program?.source ?? null,
                    channel: res.referralChannel ?? program?.channel ?? null,
                    bookings: 0,
                    revenueCents: 0,
                    referralDiscountCents: 0
                };
            }

            byProgram[key].bookings += 1;
            byProgram[key].revenueCents += revenue;
            byProgram[key].referralDiscountCents += res.referralIncentiveValue ?? 0;
        });

        return {
            period: { start, end },
            totalBookings: reservations.length,
            totalRevenueCents,
            totalReferralDiscountCents,
            programs: Object.values(byProgram)
        };
    }

    async getStayReasonBreakdown(campgroundId: string, startDate?: string, endDate?: string) {
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
        const end = endDate ? new Date(endDate) : new Date();

        const reservations = await this.prisma.reservation.findMany({
            where: {
                campgroundId,
                status: { not: 'cancelled' },
                createdAt: { gte: start, lte: end }
            },
            select: {
                stayReasonPreset: true,
                stayReasonOther: true
            }
        });

        const byReason: Record<string, { reason: string; count: number }> = {};
        const otherReasons: string[] = [];

        reservations.forEach((res) => {
            const reason = res.stayReasonPreset || "unknown";
            if (!byReason[reason]) {
                byReason[reason] = { reason, count: 0 };
            }
            byReason[reason].count += 1;
            if (reason === "other" && res.stayReasonOther) {
                otherReasons.push(res.stayReasonOther);
            }
        });

        return {
            period: { start, end },
            breakdown: Object.values(byReason).sort((a, b) => b.count - a.count),
            otherReasons
        };
    }

  async listExports(campgroundId: string, limit = 10) {
    const take = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const jobs = await this.prisma.integrationExportJob.findMany({
      where: { campgroundId, resource: "reports" },
      orderBy: { createdAt: "desc" },
      take
    });
    return jobs.map((j) => this.decorateExport(j));
  }

  private decorateExport(job: any) {
    const filters = (job as any)?.filters ?? {};
    const downloadUrl = (filters as any)?.downloadUrl ?? job.downloadUrl ?? null;
    const summary = (filters as any)?.summary ?? null;
    return { ...job, downloadUrl, summary };
  }

  private async enforceCapacityGuard() {
    const depth = await this.prisma.integrationExportJob.count({
      where: { resource: "reports", status: { in: ["queued", "processing"] as any } }
    });
    const threshold = this.capacityGuardThreshold();
    if (depth >= threshold) {
      const payload = { reason: "capacity_guard", queueDepth: depth, threshold };
      this.observability.recordReportResult(false, undefined, payload);
      // Fire-and-forget alert; do not block request path.
      this.alerting.dispatch(
        "Report export capacity guard",
        `Queued exports=${depth} (threshold ${threshold})`,
        "warning",
        "reports-capacity-guard",
        payload
      ).catch(() => undefined);
      const error = new ServiceUnavailableException({
        message: "Report exports temporarily limited due to capacity",
        retryAfter: this.capacityGuardRetryAfterSec(),
        reason: "capacity_guard"
      });
      (error as any).retryAfter = this.capacityGuardRetryAfterSec();
      throw error;
    }
    return depth;
  }

  async queueExport(params: { campgroundId: string; filters?: Record<string, any>; format?: string; requestedById?: string; emailTo?: string[] }) {
    const { campgroundId, filters, format, requestedById, emailTo } = params;
    await this.enforceCapacityGuard();
    const exportFormat = (format ?? "csv").toLowerCase();

    const recurring = (filters as any)?.recurring;
    if (recurring) {
      await this.scheduleRecurringExport({
        campgroundId,
        filters,
        format: exportFormat,
        requestedById,
        emailTo
      });
    }

    const job = await this.prisma.integrationExportJob.create({
      data: {
        campgroundId,
        type: "api",
        resource: "reports",
        status: "queued",
        location: exportFormat,
        filters: { ...(filters ?? {}), emailTo: emailTo ?? undefined, format: exportFormat },
        requestedById: requestedById ?? null
      }
    });
    this.observability.recordReportResult(true, undefined, { reason: "queued" });

    // Kick off processing asynchronously
    void this.jobQueue.enqueue(this.exportQueueName, () => this.processExportJob(job.id), {
      jobName: `${this.exportQueueName}:${campgroundId}`
    }).catch(() => undefined);

    return this.decorateExport(job);
  }

  private async scheduleRecurringExport(params: {
    campgroundId: string;
    filters?: Record<string, any>;
    format?: string;
    requestedById?: string;
    emailTo?: string[];
  }) {
    const existing = await this.prisma.integrationExportJob.findFirst({
      where: { campgroundId: params.campgroundId, resource: "reports", status: "scheduled" }
    });
    if (existing) return existing;
    const recurring = (params.filters as any)?.recurring;
    const nextRunAt = recurring?.nextRunAt ? new Date(recurring.nextRunAt) : this.computeNextRun(recurring?.cadence ?? "daily");
    return this.prisma.integrationExportJob.create({
      data: {
        campgroundId: params.campgroundId,
        type: "api",
        resource: "reports",
        status: "scheduled",
        location: params.format ?? "csv",
        filters: {
          ...(params.filters ?? {}),
          emailTo: params.emailTo ?? (params.filters as any)?.emailTo,
          recurring: { ...(recurring ?? {}), nextRunAt: nextRunAt.toISOString() }
        },
        requestedById: params.requestedById ?? null
      }
    });
  }

  async rerunExport(campgroundId: string, exportId: string, requestedById?: string) {
    const previous = await this.prisma.integrationExportJob.findUnique({ where: { id: exportId } });
    if (!previous || previous.campgroundId !== campgroundId) {
      throw new NotFoundException("Export not found for campground");
    }
    return this.queueExport({
      campgroundId,
      filters: previous.filters as Record<string, any> | undefined,
      format: previous.location ?? undefined,
      emailTo: (previous.filters as any)?.emailTo ?? undefined,
      requestedById: requestedById ?? previous.requestedById ?? undefined
    });
  }

  async getExport(campgroundId: string, exportId: string) {
    const job = await this.prisma.integrationExportJob.findUnique({ where: { id: exportId } });
    if (!job || job.campgroundId !== campgroundId || job.resource !== "reports") {
      throw new NotFoundException("Export not found for campground");
    }
    return this.decorateExport(job);
  }

  /**
   * Background processor for report exports (cron-backed queue)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processQueuedExports() {
    const queued = await this.prisma.integrationExportJob.findMany({
      where: { resource: "reports", status: "queued" },
      take: 25
    });

    let processed = 0;
    for (const job of queued) {
      try {
        await this.processExportJob(job.id);
        processed += 1;
      } catch (err: any) {
        await this.prisma.integrationExportJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            completedAt: new Date(),
            lastError: err?.message ?? "Failed to process export"
          }
        }).catch(() => undefined);
      }
    }

    return { processed };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledExports() {
    const schedules = await this.prisma.integrationExportJob.findMany({
      where: { resource: "reports", status: "scheduled" },
      take: 50
    });
    const now = new Date();
    let triggered = 0;

    for (const sched of schedules) {
      const filters = (sched.filters as any) ?? {};
      const recurring = filters.recurring ?? {};
      const nextRunAt = recurring?.nextRunAt ? new Date(recurring.nextRunAt) : this.computeNextRun(recurring?.cadence ?? "daily", now);
      if (nextRunAt > now) continue;

      const { recurring: _rec, ...restFilters } = filters;
      try {
        await this.queueExport({
          campgroundId: sched.campgroundId!,
          filters: restFilters,
          format: sched.location ?? "csv",
          requestedById: sched.requestedById ?? undefined,
          emailTo: filters.emailTo
        });
      } catch (err: any) {
        this.alerting.dispatch(
          "Report export capacity guard",
          "Scheduled export skipped due to capacity guard",
          "warning",
          "reports-capacity-guard",
          { reason: "capacity_guard" }
        ).catch(() => undefined);
        continue;
      }

      const updatedNext = this.computeNextRun(recurring?.cadence ?? "daily", now);
      await this.prisma.integrationExportJob.update({
        where: { id: sched.id },
        data: {
          filters: {
            ...filters,
            recurring: { ...(recurring ?? {}), nextRunAt: updatedNext.toISOString() }
          }
        }
      });
      triggered += 1;
    }

    return { triggered };
  }

  private async processExportJob(jobId: string) {
    const job = await this.prisma.integrationExportJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== "queued" || job.resource !== "reports") return null;

    const started = Date.now();
    let success = false;
    const filters = (job.filters as any) ?? {};
    const exportFormat = (job.location ?? filters.format ?? "csv").toLowerCase();

    await this.prisma.integrationExportJob.update({
      where: { id: jobId },
      data: {
        status: "processing",
        startedAt: job.startedAt ?? new Date(),
        lastError: null
      }
    });

    try {
      const summary = await this.buildExportSummary(job.campgroundId!, filters);

      const pages: any[] = [];
      let token: string | null | undefined = undefined;
      do {
        const page = await this.generateExportPage({
          campgroundId: job.campgroundId!,
          paginationToken: token ?? undefined,
          pageSize: this.exportPageSize(),
          filters,
          summary
        });
        pages.push(...page.rows);
        token = page.nextToken;
      } while (token);

      const csv = this.toCsv(pages);
      let fileBuffer: Buffer;
      if (exportFormat === "xlsx") {
        const sheet = XLSX.utils.json_to_sheet(pages);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, "reports");
        fileBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
      } else {
        fileBuffer = Buffer.from(csv, "utf8");
      }

      const upload = await this.uploads.uploadBuffer(fileBuffer, {
        contentType: exportFormat === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv",
        extension: exportFormat === "xlsx" ? "xlsx" : "csv",
        prefix: "exports/reports"
      });

      const updated = await this.prisma.integrationExportJob.update({
        where: { id: jobId },
        data: {
          status: "success",
          completedAt: new Date(),
          location: upload.url,
          filters: {
            ...filters,
            downloadUrl: upload.url,
            summary,
            recordCount: pages.length,
            format: exportFormat
          }
        }
      });

      await this.audit.recordExport({
        campgroundId: job.campgroundId!,
        requestedById: job.requestedById ?? "system",
        format: (exportFormat as any) ?? "csv",
        filters,
        recordCount: pages.length
      });

      const recipients: string[] = Array.isArray(filters?.emailTo)
        ? filters.emailTo
        : filters?.emailTo
        ? [filters.emailTo]
        : [];
      if (filters?.email) recipients.push(filters.email as string);
      if (recipients.length) {
        await this.sendExportEmail(recipients, upload.url, job.campgroundId!, summary);
      }

      success = true;
      this.observability.recordReportResult(true, Date.now() - started, { reason: "export_success", exportId: job.id, rows: pages.length, format: exportFormat });
      return this.decorateExport(updated);
    } catch (err: any) {
      await this.prisma.integrationExportJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          completedAt: new Date(),
          lastError: err?.message ?? "Failed to process export"
        }
      }).catch(() => undefined);
      this.observability.recordReportResult(false, Date.now() - started, { reason: "export_failed", exportId: jobId, error: err?.message });
      throw err;
    } finally {
      this.observability.recordJobRun({
        name: this.exportQueueName,
        durationMs: Date.now() - started,
        success,
        queueDepth: this.jobQueue.getQueueState(this.exportQueueName)?.pending ?? 0
      });
    }
  }

  private async sendExportEmail(recipients: string[], downloadUrl: string, campgroundId: string, summary?: any) {
    const uniqueRecipients = Array.from(new Set(recipients.filter((r) => typeof r === "string" && r.includes("@"))));
    if (!uniqueRecipients.length) return;

    const summaryBlock = summary
      ? `
        <ul>
          ${summary.revenue !== undefined ? `<li><strong>Revenue:</strong> ${summary.revenue}</li>` : ""}
          ${summary.adr !== undefined ? `<li><strong>ADR:</strong> ${summary.adr}</li>` : ""}
          ${summary.revpar !== undefined ? `<li><strong>RevPAR:</strong> ${summary.revpar}</li>` : ""}
          ${summary.occupancy !== undefined ? `<li><strong>Occupancy:</strong> ${summary.occupancy}%</li>` : ""}
          ${summary.liability !== undefined ? `<li><strong>Liability:</strong> ${summary.liability}</li>` : ""}
          ${summary.attachRate !== undefined ? `<li><strong>Attach Rate:</strong> ${summary.attachRate}%</li>` : ""}
        </ul>
      `
      : "";

    await Promise.all(
      uniqueRecipients.map((to) =>
        this.email.sendEmail({
          to,
          subject: "Campground report export is ready",
          html: `
            <p>Your report export for campground ${campgroundId} is ready.</p>
            <p><a href="${downloadUrl}">Download export</a></p>
            ${summaryBlock}
            <p>This link was generated automatically. If you did not request this export, you can ignore this email.</p>
          `
        })
      )
    );
  }

  /**
   * Stream reservations for export with resumable pagination and per-tenant cap.
   * Returns a nextToken if more rows remain within the cap.
   */
  async generateExportPage(params: {
    campgroundId: string;
    paginationToken?: string;
    pageSize?: number;
    filters?: Record<string, any>;
    summary?: any;
  }) {
    const { campgroundId, paginationToken, pageSize, filters, summary } = params;
    const decoded = this.decodeToken<{ lastId?: string; emitted?: number }>(paginationToken) || { emitted: 0 };
    const emitted = decoded.emitted ?? 0;
    const maxRows = this.exportMaxRows();
    if (emitted >= maxRows) {
      return {
        rows: [],
        nextToken: null,
        emitted,
        remaining: 0,
        summary: summary ?? await this.buildExportSummary(campgroundId, filters)
      };
    }

    const take = Math.min(
      Math.max(pageSize ?? this.exportPageSize(), 1),
      maxRows - emitted
    );

    const range = this.resolveRangeFromFilters(filters);
    const dateWhere = this.reservationDateWhere({ start: range.start, end: range.end });
    const filterWhere = { ...(filters ?? {}) };
    // strip non-column filters
    delete (filterWhere as any).range;
    delete (filterWhere as any).days;
    delete (filterWhere as any).startDate;
    delete (filterWhere as any).endDate;
    delete (filterWhere as any).emailTo;
    delete (filterWhere as any).format;

    const rows = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { not: "cancelled" },
        ...(filterWhere ?? {}),
        ...(Object.keys(dateWhere).length ? { AND: [dateWhere] } : {})
      },
      orderBy: { createdAt: "asc" },
      ...(decoded.lastId ? { cursor: { id: decoded.lastId }, skip: 1 } : {}),
      take,
      select: {
        id: true,
        arrivalDate: true,
        departureDate: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
        source: true,
        createdAt: true,
        siteId: true
      }
    });

    const newEmitted = emitted + rows.length;
    const nextToken =
      rows.length === take && newEmitted < maxRows
        ? this.encodeToken({ lastId: rows[rows.length - 1].id, emitted: newEmitted })
        : null;

    return {
      rows,
      nextToken,
      emitted: newEmitted,
      remaining: Math.max(0, maxRows - newEmitted),
      summary: summary ?? await this.buildExportSummary(campgroundId, filters)
    };
  }

  private async buildExportSummary(campgroundId: string, filters?: Record<string, any>) {
    const range = this.resolveRangeFromFilters(filters);
    const metrics = await this.getDashboardMetrics(campgroundId, { start: range.start, end: range.end, days: range.days });
    const sources = await this.getBookingSources(campgroundId, range.start?.toISOString(), range.end?.toISOString());
    const attachRate = await this.computeAttachRate(campgroundId, { start: range.start, end: range.end });

    return {
      revenue: Math.round((metrics.revenue.totalCents ?? 0) / 100),
      adr: Math.round((metrics.revenue.adrCents ?? 0) / 100),
      revpar: Math.round((metrics.revenue.revparCents ?? 0) / 100),
      occupancy: metrics.occupancy.pct,
      liability: Math.round((metrics.balances.outstandingCents ?? 0) / 100),
      attachRate,
      channelMix: sources.bySource,
      period: metrics.period
        ? {
            ...metrics.period,
            start: metrics.period.start?.toISOString?.() ?? metrics.period.start,
            end: metrics.period.end?.toISOString?.() ?? metrics.period.end
          }
        : undefined
    };
  }

  // ---------------------------------------------------------------------------
  // Phase 3: Dashboard Metrics
  // ---------------------------------------------------------------------------

  async getDashboardMetrics(
    campgroundId: string,
    range: number | { start?: Date; end?: Date; days?: number } = 30
  ) {
    // Get campground timezone for accurate "today" calculations
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { timezone: true }
    });
    const tz = campground?.timezone || "America/Chicago";

    const now = typeof range === "object" && range.end ? new Date(range.end) : new Date();
    let startDate: Date;
    let days: number;

    if (typeof range === "number") {
      days = range;
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    } else {
      const inferredStart = range.start ? new Date(range.start) : new Date(now.getTime() - (range.days ?? 30) * 24 * 60 * 60 * 1000);
      startDate = inferredStart;
      const computedDays = Math.max(1, Math.round((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      days = range.days ?? computedDays;
    }

    // Get sites for occupancy calculation
    const sites = await this.prisma.site.findMany({
      where: { campgroundId, isActive: true },
      select: { id: true }
    });
    const totalSites = sites.length;

    // Get reservations in date range
    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { notIn: ['cancelled'] },
        OR: [
          { arrivalDate: { gte: startDate, lte: now } },
          { departureDate: { gte: startDate, lte: now } },
          { arrivalDate: { lte: startDate }, departureDate: { gte: now } }
        ]
      },
      select: {
        id: true,
        arrivalDate: true,
        departureDate: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
        createdAt: true
      }
    });

    // Calculate total nights and revenue
    let totalNights = 0;
    let totalRevenueCents = 0;
    let totalRoomNights = 0;

    type ReservationRangeRow = {
      arrivalDate: Date;
      departureDate: Date;
      totalAmount: number | null;
    };

    reservations.forEach((r: ReservationRangeRow) => {
      const arrival = new Date(r.arrivalDate);
      const departure = new Date(r.departureDate);
      const nights = Math.max(1, Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Count nights within the date range
      const effectiveStart = arrival < startDate ? startDate : arrival;
      const effectiveEnd = departure > now ? now : departure;
      const effectiveNights = Math.max(0, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)));
      
      totalNights += effectiveNights;
      totalRevenueCents += r.totalAmount || 0;
      totalRoomNights += nights;
    });

    // ADR = Total Revenue / Total Rooms Sold
    const adrCents = totalRoomNights > 0 ? Math.round(totalRevenueCents / totalRoomNights) : 0;

    // RevPAR = Total Revenue / (Total Sites * Days)
    const availableNights = totalSites * days;
    const revparCents = availableNights > 0 ? Math.round(totalRevenueCents / availableNights) : 0;

    // Occupancy = Total Room Nights / Available Nights
    const occupancyPct = availableNights > 0 ? Math.round((totalNights / availableNights) * 100) : 0;

    // Compare to previous period
    const prevStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);
    const prevReservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { notIn: ['cancelled'] },
        OR: [
          { arrivalDate: { gte: prevStartDate, lte: startDate } },
          { departureDate: { gte: prevStartDate, lte: startDate } },
          { arrivalDate: { lte: prevStartDate }, departureDate: { gte: startDate } }
        ]
      },
      select: { totalAmount: true }
    });

    const prevRevenueCents = prevReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    const revenueChangePct = prevRevenueCents > 0 
      ? Math.round(((totalRevenueCents - prevRevenueCents) / prevRevenueCents) * 100) 
      : 0;

    // Outstanding balances
    const allActive = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { notIn: ['cancelled', 'checked_out'] }
      },
      select: { totalAmount: true, paidAmount: true }
    });
    const outstandingCents = allActive.reduce((sum, r) => {
      const balance = (r.totalAmount || 0) - (r.paidAmount || 0);
      return sum + (balance > 0 ? balance : 0);
    }, 0);

    // Today's stats - using campground's local timezone
    // Get "today" in the campground's timezone, not server UTC
    const nowInTz = new Date().toLocaleString("en-US", { timeZone: tz });
    const localNow = new Date(nowInTz);
    const todayStart = new Date(localNow.getFullYear(), localNow.getMonth(), localNow.getDate());
    // Convert back to UTC for database comparison
    const todayStartUtc = new Date(todayStart.toLocaleString("en-US", { timeZone: "UTC" }));
    // Calculate the offset and create proper UTC boundaries
    const tzOffset = todayStart.getTime() - todayStartUtc.getTime();
    const todayStartForQuery = new Date(todayStart.getTime() - tzOffset);
    const todayEndForQuery = new Date(todayStartForQuery.getTime() + 24 * 60 * 60 * 1000);

    const todayArrivals = await this.prisma.reservation.count({
      where: {
        campgroundId,
        status: { notIn: ['cancelled'] },
        arrivalDate: { gte: todayStartForQuery, lt: todayEndForQuery }
      }
    });

    const todayDepartures = await this.prisma.reservation.count({
      where: {
        campgroundId,
        status: { notIn: ['cancelled'] },
        departureDate: { gte: todayStartForQuery, lt: todayEndForQuery }
      }
    });

    // Future bookings
    const futureBookings = await this.prisma.reservation.count({
      where: {
        campgroundId,
        status: { notIn: ['cancelled'] },
        arrivalDate: { gt: now }
      }
    });

    return {
      period: { start: startDate, end: now, days },
      revenue: {
        totalCents: totalRevenueCents,
        adrCents,
        revparCents,
        changePct: revenueChangePct
      },
      occupancy: {
        pct: occupancyPct,
        totalNights,
        availableNights
      },
      balances: {
        outstandingCents
      },
      today: {
        arrivals: todayArrivals,
        departures: todayDepartures
      },
      futureBookings,
      totalSites
    };
  }

  async getRevenueTrend(campgroundId: string, months: number = 12) {
    const now = new Date();
    const results: Array<{ month: string; year: number; revenueCents: number; bookings: number }> = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      const reservations = await this.prisma.reservation.findMany({
        where: {
          campgroundId,
          status: { notIn: ['cancelled'] },
          arrivalDate: { gte: startOfMonth, lte: endOfMonth }
        },
        select: { totalAmount: true }
      });

      const revenueCents = reservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
      
      results.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        year: date.getFullYear(),
        revenueCents,
        bookings: reservations.length
      });
    }

    return results;
  }

  async getOccupancyForecast(campgroundId: string, days: number = 30) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const sites = await this.prisma.site.count({
      where: { campgroundId, isActive: true }
    });

    const results: Array<{ date: string; occupiedSites: number; totalSites: number; pct: number }> = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const occupiedCount = await this.prisma.reservation.count({
        where: {
          campgroundId,
          status: { notIn: ['cancelled'] },
          arrivalDate: { lte: date },
          departureDate: { gt: date }
        }
      });

      results.push({
        date: date.toISOString().split('T')[0],
        occupiedSites: occupiedCount,
        totalSites: sites,
        pct: sites > 0 ? Math.round((occupiedCount / sites) * 100) : 0
      });
    }

    return results;
  }

  async getTaskMetrics(campgroundId: string) {
    const pending = await this.prisma.task.count({
      where: { tenantId: campgroundId, state: 'pending' }
    });
    const inProgress = await this.prisma.task.count({
      where: { tenantId: campgroundId, state: 'in_progress' }
    });
    const breached = await this.prisma.task.count({
      where: { tenantId: campgroundId, slaStatus: 'breached', state: { in: ['pending', 'in_progress'] } }
    });
    const atRisk = await this.prisma.task.count({
      where: { tenantId: campgroundId, slaStatus: 'at_risk', state: { in: ['pending', 'in_progress'] } }
    });
    const completedToday = await this.prisma.task.count({
      where: {
        tenantId: campgroundId,
        state: 'done',
        updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }
    });

    return {
      pending,
      inProgress,
      breached,
      atRisk,
      completedToday
    };
  }

  // ---------------------------------------------------------------------------
  // Phase 4: Metadata-driven reporting catalog + executor
  // ---------------------------------------------------------------------------

  listReportCatalog(params: { category?: string; search?: string; includeHeavy?: boolean } = {}) {
    const catalog = getReportCatalog(params).map((def) => ({
      ...def,
      dimensions: def.dimensions.map((d) => resolveDimension(def.source, d)).filter(Boolean),
      metrics: def.metrics.map((m) => resolveMetric(def.source, m)).filter(Boolean),
      filters: resolveFilters(def.source),
    }));
    return {
      size: catalog.length,
      total: catalog.length,
      catalog,
    };
  }

  async runReport(campgroundId: string, input: ReportQueryInput): Promise<ReportRunResult> {
    const spec = getReportSpec(input.reportId);
    if (!spec) throw new NotFoundException("Report not found");

    const started = Date.now();
    await this.withCapacityGuard(!!spec.heavy);
    try {
      const result = await this.executeReportQuery(campgroundId, spec, input);
      this.observability.recordReportResult(true, Date.now() - started, { reportId: spec.id, rows: result.rows.length });
      return result;
    } catch (err: any) {
      this.observability.recordReportResult(false, Date.now() - started, { reportId: spec.id, error: err?.message });
      throw err;
    } finally {
      this.releaseCapacity(!!spec.heavy);
    }
  }

  private async executeReportQuery(campgroundId: string, spec: ReportSpec, input: ReportQueryInput): Promise<ReportRunResult> {
    const dimensions = (input.dimensions?.length ? input.dimensions : spec.defaultDimensions ?? spec.dimensions).filter((d) =>
      spec.dimensions.includes(d)
    );
    if (!dimensions.length) {
      throw new BadRequestException("At least one dimension is required");
    }

    const metricDefs = spec.metrics
      .map((m) => resolveMetric(spec.source, m))
      .filter(Boolean);
    if (!metricDefs.length) throw new BadRequestException("No metrics resolved for report");

    const range = this.resolveRange(input.timeRange ?? spec.defaultTimeRange);
    const where = this.buildWhereFromFilters(spec, campgroundId, input.filters ?? {}, range);
    const take = Math.min(
      Math.max(Math.round((spec.sampling?.limit ?? this.defaultSampleLimit) * (input.sample ? spec.sampling?.rate ?? 1 : 1)), 50),
      20000
    );

    const rows = await this.fetchSourceRows(spec, campgroundId, where, take);
    const reduced = this.reduceRows(rows, spec, dimensions, metricDefs);
    const pageSize = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const offset = Math.max(input.offset ?? 0, 0);
    const paged = reduced.slice(offset, offset + pageSize);
    const nextToken = reduced.length > offset + pageSize ? this.encodeToken({ offset: offset + pageSize }) : null;

    const series = metricDefs.map((metric) => ({
      label: metric.label,
      chart: spec.defaultChart ?? spec.chartTypes[0] ?? "table",
      points: paged.map((row) => ({
        x: dimensions.length === 1 ? row[dimensions[0]] ?? "total" : dimensions.map((d) => row[d] ?? "total").join(" · "),
        y: Number(row[metric.id] ?? 0),
      })),
    }));

    return {
      meta: {
        id: spec.id,
        name: spec.name,
        category: spec.category,
        dimensions,
        metrics: metricDefs.map((m) => m.id),
        defaultChart: spec.defaultChart,
        cacheHint: spec.cacheTtlSec ?? this.defaultCacheTtlSec,
        sampling: { ...(spec.sampling ?? {}), applied: !!input.sample },
      },
      rows: paged,
      series,
      paging: {
        returned: paged.length,
        nextToken,
      },
    };
  }

  private async fetchSourceRows(spec: ReportSpec, campgroundId: string, where: any, take: number) {
    switch (spec.source) {
      case "reservation": {
        const rows = await this.prisma.reservation.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take,
          select: {
            id: true,
            createdAt: true,
            arrivalDate: true,
            departureDate: true,
            status: true,
            source: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
            stayType: true,
            rigType: true,
            promoCode: true,
            leadTimeDays: true,
          },
        });
        return rows.map((r) => ({
          ...r,
          nights: this.computeNights(r.arrivalDate, r.departureDate),
          leadTimeDays: typeof r.leadTimeDays === "number" ? r.leadTimeDays : this.computeLeadTime(r.arrivalDate, r.createdAt),
        }));
      }
      case "payment":
        return this.prisma.payment.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take,
          select: {
            id: true,
            createdAt: true,
            amountCents: true,
            method: true,
            direction: true,
            stripeFeeCents: true,
          },
        });
      case "ledger":
        return this.prisma.ledgerEntry.findMany({
          where,
          orderBy: { occurredAt: "desc" },
          take,
          select: { id: true, occurredAt: true, amountCents: true, glCode: true, direction: true },
        });
      case "payout":
        return this.prisma.payout.findMany({
          where,
          orderBy: { arrivalDate: "desc" },
          take,
          select: { id: true, arrivalDate: true, status: true, amountCents: true, feeCents: true, currency: true },
        });
      case "support":
        return this.prisma.supportReport.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take,
          select: { id: true, createdAt: true, status: true, path: true, language: true },
        });
      case "task":
        return this.prisma.task.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take,
          select: { id: true, createdAt: true, state: true, slaStatus: true, type: true },
        });
      case "marketing": {
        const events = await this.prisma.analyticsEvent.findMany({
          where,
          orderBy: { occurredAt: "desc" },
          take,
          select: { id: true, occurredAt: true, referrer: true, page: true, region: true, reservationId: true },
        });
        return events.map((e) => ({
          id: e.id,
          createdAt: e.occurredAt,
          channel: e.referrer ?? "direct",
          campaign: e.page ?? "site",
          medium: e.region ?? "unspecified",
          conversions: e.reservationId ? 1 : 0,
        }));
      }
      case "pos": {
        const carts = await this.prisma.posCart.findMany({
          where: { ...where, status: "checked_out" },
          orderBy: { createdAt: "desc" },
          take,
          include: {
            items: {
              include: {
                product: {
                  include: { category: true }
                }
              }
            },
            payments: true
          }
        });
        // Flatten for item-level and payment-level analysis
        const rows: any[] = [];
        carts.forEach((cart) => {
          const baseRow = {
            id: cart.id,
            createdAt: cart.createdAt,
            status: cart.status,
            terminalId: cart.terminalId,
            grossCents: cart.grossCents,
            netCents: cart.netCents,
            taxCents: cart.taxCents,
            feeCents: cart.feeCents,
            itemCount: cart.items.length,
          };
          // For payment method analysis
          if (cart.payments.length) {
            cart.payments.forEach((p) => {
              rows.push({
                ...baseRow,
                method: p.method,
                paymentAmountCents: p.amountCents,
              });
            });
          } else {
            rows.push({ ...baseRow, method: "unknown", paymentAmountCents: 0 });
          }
          // For product/category analysis, also emit item rows
          cart.items.forEach((item) => {
            rows.push({
              id: `${cart.id}-${item.id}`,
              createdAt: cart.createdAt,
              status: cart.status,
              terminalId: cart.terminalId,
              productName: item.product?.name ?? "unknown",
              categoryName: item.product?.category?.name ?? "uncategorized",
              qty: item.qty,
              discountCents: item.discountCents,
              totalCents: item.totalCents,
              taxCents: item.taxCents,
            });
          });
        });
        return rows;
      }
      case "till": {
        // For session-based reports
        const sessions = await this.prisma.tillSession.findMany({
          where,
          orderBy: { openedAt: "desc" },
          take,
          select: {
            id: true,
            openedAt: true,
            closedAt: true,
            status: true,
            terminalId: true,
            openingFloatCents: true,
            expectedCloseCents: true,
            countedCloseCents: true,
            overShortCents: true,
            openedByUserId: true,
          },
        });
        // For movement-based reports, also fetch movements
        const movements = await this.prisma.tillMovement.findMany({
          where: { session: where },
          orderBy: { createdAt: "desc" },
          take,
          include: { session: { select: { terminalId: true } } },
        });
        // Combine both for flexible reporting
        const sessionRows = sessions.map((s) => ({
          ...s,
          type: "session",
        }));
        const movementRows = movements.map((m) => ({
          id: m.id,
          createdAt: m.createdAt,
          type: m.type,
          amountCents: m.amountCents,
          terminalId: m.session?.terminalId,
          sessionId: m.sessionId,
        }));
        return [...sessionRows, ...movementRows];
      }
      default:
        throw new BadRequestException(`Unsupported source ${spec.source}`);
    }
  }

  private buildWhereFromFilters(spec: ReportSpec, campgroundId: string, filters: Record<string, any>, range: { gte?: Date; lte?: Date }) {
    const allowedFilters = resolveFilters(spec.source);
    const timeField = spec.timeField ?? this.defaultTimeField(spec.source);
    const base: any =
      spec.source === "task"
        ? { tenantId: campgroundId }
        : spec.source === "marketing"
        ? { campgroundId }
        : { campgroundId };

    const where: any = { ...base };
    if (range.gte || range.lte) {
      where[timeField] = { ...(range.gte ? { gte: range.gte } : {}), ...(range.lte ? { lte: range.lte } : {}) };
    }

    for (const filter of allowedFilters) {
      if (filters[filter.id] === undefined) continue;
      const value = filters[filter.id];
      if (filter.operators.includes("in") && Array.isArray(value)) {
        where[filter.field] = { in: value };
      } else if (filter.operators.includes("eq")) {
        where[filter.field] = value;
      }
    }

    return where;
  }

  private resolveRange(range?: ReportQueryInput["timeRange"]) {
    if (!range) return { gte: this.daysAgo(30), lte: new Date() };
    if ("preset" in range) {
      const now = new Date();
      switch (range.preset) {
        case "last_7_days":
          return { gte: this.daysAgo(7), lte: now };
        case "last_30_days":
          return { gte: this.daysAgo(30), lte: now };
        case "last_60_days":
          return { gte: this.daysAgo(60), lte: now };
        case "last_90_days":
          return { gte: this.daysAgo(90), lte: now };
        case "last_180_days":
          return { gte: this.daysAgo(180), lte: now };
        case "last_12_months":
          return { gte: this.daysAgo(365), lte: now };
        case "all_time":
          return {};
        default:
          return { gte: this.daysAgo(30), lte: now };
      }
    }
    return { gte: new Date(range.from), lte: range.to ? new Date(range.to) : undefined };
  }

  private reduceRows(rows: any[], spec: ReportSpec, dimensions: string[], metrics: Array<{ id: string; field: string; aggregation: string }>) {
    const dimSpecs = dimensions.map((d) => resolveDimension(spec.source, d));
    const grouped = new Map<string, any>();

    rows.forEach((row) => {
      const dimValues = dimSpecs.map((dim) => this.formatDimValue(row, dim));
      const key = dimValues.join("|");
      if (!grouped.has(key)) {
        const initial: any = {};
        dimSpecs.forEach((dim, idx) => (initial[dim.id] = dimValues[idx]));
        metrics.forEach((metric) => {
          initial[metric.id] = 0;
        });
        initial.__count = 0;
        grouped.set(key, initial);
      }
      const target = grouped.get(key);
      target.__count = (target.__count ?? 0) + 1;
      metrics.forEach((metric) => {
        const raw = row[metric.field] ?? 0;
        if (metric.aggregation === "count") {
          target[metric.id] += 1;
        } else {
          target[metric.id] += Number(raw || 0);
        }
      });
    });

    // For averages we divide by counts
    metrics.forEach((metric) => {
      if (metric.aggregation === "avg") {
        grouped.forEach((value) => {
          const count = value.__count ?? value.count ?? (rows.length || 1);
          value[metric.id] = count ? Math.round((value[metric.id] / count) * 100) / 100 : 0;
        });
      }
    });

    return Array.from(grouped.values());
  }

  private toCsv(rows: any[]) {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    rows.forEach((row) => {
      const values = headers.map((h) => {
        const val = (row as any)[h];
        if (val === null || val === undefined) return "";
        const str = String(val).replace(/"/g, '""');
        return str.includes(",") ? `"${str}"` : str;
      });
      lines.push(values.join(","));
    });
    return lines.join("\n");
  }

  private formatDimValue(row: any, dim?: ReportDimensionSpec | undefined) {
    if (!dim) return "total";
    const value = row[dim.field];
    if (dim.kind === "date" && value) {
      return this.dateBucket(value, dim.timeGrain ?? "day");
    }
    if (dim.id === "lead_time_bucket") {
      const days = typeof value === "number" ? value : 0;
      if (days <= 1) return "0-1d";
      if (days <= 3) return "2-3d";
      if (days <= 7) return "4-7d";
      if (days <= 14) return "8-14d";
      if (days <= 30) return "15-30d";
      if (days <= 90) return "31-90d";
      return "90d+";
    }
    if (dim.id === "length_of_stay") {
      const nights = typeof value === "number" ? value : 0;
      if (nights <= 1) return "1 night";
      if (nights <= 3) return "2-3 nights";
      if (nights <= 7) return "4-7 nights";
      if (nights <= 14) return "8-14 nights";
      return "15+ nights";
    }
    return value ?? dim.fallback ?? "unknown";
  }

  private dateBucket(dateInput: string | Date, grain: "day" | "week" | "month" | "quarter") {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    if (grain === "day") return date.toISOString().slice(0, 10);
    if (grain === "week") {
      const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
      const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
      const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getUTCDay() + 1) / 7);
      return `${year}-W${String(week).padStart(2, "0")}`;
    }
    if (grain === "quarter") {
      const q = Math.floor(month / 3) + 1;
      return `${year}-Q${q}`;
    }
    return `${year}-${String(month + 1).padStart(2, "0")}`;
  }

  private computeNights(arrival?: Date | null, departure?: Date | null) {
    if (!arrival || !departure) return 0;
    const diff = Math.ceil((departure.getTime() - arrival.getTime()) / 86400000);
    return Math.max(diff, 1);
  }

  private computeLeadTime(arrival?: Date | null, createdAt?: Date | null) {
    if (!arrival || !createdAt) return 0;
    return Math.max(Math.floor((arrival.getTime() - createdAt.getTime()) / 86400000), 0);
  }

  private daysAgo(days: number) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  private defaultTimeField(source: ReportSpec["source"]) {
    switch (source) {
      case "reservation":
      case "payment":
      case "support":
      case "task":
      case "pos":
        return "createdAt";
      case "ledger":
        return "occurredAt";
      case "payout":
        return "arrivalDate";
      case "marketing":
        return "occurredAt";
      case "till":
        return "openedAt";
      default:
        return "createdAt";
    }
  }

  private async withCapacityGuard(isHeavy: boolean) {
    if (isHeavy) {
      if (this.heavyRuns >= this.heavyQueryLimit) {
        const error = new ServiceUnavailableException({
          message: "Report queries temporarily limited (heavy)",
          retryAfter: this.capacityGuardRetryAfterSec(),
          reason: "capacity_guard",
        });
        (error as any).retryAfter = this.capacityGuardRetryAfterSec();
        this.observability.recordReportResult(false, undefined, { reason: "capacity_guard", kind: "heavy_query" });
        this.alerting.dispatch(
          "Report query capacity guard (heavy)",
          `Heavy report queries at limit ${this.heavyQueryLimit}`,
          "warning",
          "reports-capacity-guard",
          { reason: "capacity_guard", scope: "heavy" }
        ).catch(() => undefined);
        throw error;
      }
      this.heavyRuns += 1;
    }
    if (this.activeRuns >= this.queryLimit) {
      const error = new ServiceUnavailableException({
        message: "Report queries temporarily limited",
        retryAfter: this.capacityGuardRetryAfterSec(),
        reason: "capacity_guard",
      });
      (error as any).retryAfter = this.capacityGuardRetryAfterSec();
      this.observability.recordReportResult(false, undefined, { reason: "capacity_guard", kind: "query_limit" });
      this.alerting.dispatch(
        "Report query capacity guard",
        `Report queries at limit ${this.queryLimit}`,
        "warning",
        "reports-capacity-guard",
        { reason: "capacity_guard", scope: "standard" }
      ).catch(() => undefined);
      throw error;
    }
    this.activeRuns += 1;
  }

  private releaseCapacity(isHeavy: boolean) {
    this.activeRuns = Math.max(0, this.activeRuns - 1);
    if (isHeavy) this.heavyRuns = Math.max(0, this.heavyRuns - 1);
  }
}
