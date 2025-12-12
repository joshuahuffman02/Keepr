import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReservationsService } from "./reservations.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { JobQueueService } from "../observability/job-queue.service";
import { AuditService } from "../audit/audit.service";
import { ObservabilityService } from "../observability/observability.service";
import {
  ReservationImportRecord,
  ReservationImportValidationError,
  reservationImportCsvColumns,
  reservationImportRecordSchema,
  reservationImportSchemaSummary,
} from "./dto/reservation-import.dto";
import { ReservationStatus } from "@prisma/client";

type ImportFormat = "csv" | "json";

type ImportRequest = {
  campgroundId: string;
  format: ImportFormat;
  payload: string | any[];
  dryRun?: boolean;
  idempotencyKey?: string | null;
  requestedById?: string | null;
  filename?: string | null;
};

type ExportParams = {
  campgroundId: string;
  paginationToken?: string;
  pageSize?: number;
  format?: "json" | "csv";
  includePII?: boolean;
  filters?: Record<string, any>;
  requestedById?: string | null;
};

@Injectable()
export class ReservationImportExportService {
  private readonly importQueueName = "reservation-import";
  private readonly exportResource = "reservations_export";
  private readonly importResource = "reservations_import";

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationsService,
    private readonly idempotency: IdempotencyService,
    private readonly jobQueue: JobQueueService,
    private readonly audit: AuditService,
    private readonly observability: ObservabilityService
  ) { }

  // ---------------------------------------------------------------------------
  // Schema helpers
  // ---------------------------------------------------------------------------

  importSchema() {
    return {
      formats: ["csv", "json"],
      csvColumns: reservationImportCsvColumns,
      jsonSchema: reservationImportRecordSchema.describe(),
      summary: reservationImportSchemaSummary,
    };
  }

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  private mask(value: any) {
    if (typeof value !== "string") return value;
    return value
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "***@redacted")
      .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "***-***-****");
  }

  private parseCsv(raw: string) {
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (!lines.length) return { records: [], errors: ["CSV has no rows"] };
    const headers = lines[0].split(",").map((h) => h.trim());
    const records: Record<string, any>[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const row: Record<string, any> = {};
      headers.forEach((h, idx) => {
        row[h] = cells[idx] ?? "";
      });
      if (Object.values(row).every((v) => (v === undefined || String(v).trim() === ""))) {
        continue;
      }
      records.push(row);
    }

    const missing = reservationImportSchemaSummary.requiredFields.filter((req) => !headers.includes(req));
    if (missing.length) {
      errors.push(`Missing required columns: ${missing.join(", ")}`);
    }

    return { records, errors };
  }

  private validateRecords(
    campgroundId: string,
    records: Record<string, any>[]
  ): { valid: ReservationImportRecord[]; errors: ReservationImportValidationError[] } {
    const valid: ReservationImportRecord[] = [];
    const errors: ReservationImportValidationError[] = [];

    records.forEach((row, idx) => {
      const parsed = reservationImportRecordSchema.safeParse({
        campgroundId,
        ...row,
      });
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) =>
          errors.push({
            row: idx + 2, // account for header
            field: issue.path?.[0] as string | undefined,
            message: issue.message,
            value: (row as any)[issue.path?.[0] as string],
          })
        );
        return;
      }
      if (parsed.data.campgroundId !== campgroundId) {
        errors.push({
          row: idx + 2,
          field: "campgroundId",
          message: "campgroundId must match request path",
          value: parsed.data.campgroundId,
        });
        return;
      }
      valid.push(parsed.data);
    });

    return { valid, errors };
  }

  private async enforceCapacityGuard() {
    const threshold = Number(process.env.RESERVATION_IMPORT_CAPACITY_GUARD ?? 75);
    const state = this.jobQueue.getQueueState(this.importQueueName);
    const queued = state?.pending ?? 0;
    const running = state?.running ?? 0;
    if (queued + running >= threshold) {
      const retryAfter = Number(process.env.RESERVATION_IMPORT_RETRY_AFTER_SEC ?? 120);
      const error = new ServiceUnavailableException({
        message: "Import queue is temporarily saturated",
        retryAfter,
        reason: "capacity_guard",
      });
      (error as any).retryAfter = retryAfter;
      throw error;
    }
  }

  private normalizeIdempotencyKey(input?: string | null) {
    if (input && input.trim().length > 0) return input.trim();
    return `import-${Date.now()}`;
  }

  async startImport(request: ImportRequest) {
    if (!["csv", "json"].includes(request.format)) {
      throw new BadRequestException("format must be csv or json");
    }
    const key = this.normalizeIdempotencyKey(request.idempotencyKey);
    await this.idempotency.throttleScope(request.campgroundId, null, "apply");

    const idemp = await this.idempotency.start(
      key,
      { format: request.format, dryRun: request.dryRun, filename: request.filename },
      request.campgroundId,
      { endpoint: "reservations.import", requestBody: { format: request.format, dryRun: request.dryRun, filename: request.filename } }
    );

    if ((idemp as any)?.status === "succeeded" && (idemp as any)?.responseJson) {
      return (idemp as any).responseJson;
    }

    await this.enforceCapacityGuard();

    const { records, errors: parseErrors } =
      request.format === "csv"
        ? this.parseCsv(typeof request.payload === "string" ? request.payload : "")
        : { records: Array.isArray(request.payload) ? request.payload : [], errors: [] as string[] };

    if (!records.length) {
      await this.idempotency.fail(key);
      throw new BadRequestException("No rows to import");
    }

    const validation = this.validateRecords(request.campgroundId, records);
    const responseBase = {
      dryRun: Boolean(request.dryRun),
      parseErrors: parseErrors.map((e) => this.mask(e)),
      validationErrors: validation.errors.slice(0, 25).map((e) => ({ ...e, value: this.mask(e.value) })),
      validCount: validation.valid.length,
      errorCount: validation.errors.length + parseErrors.length,
    };

    if (parseErrors.length) {
      await this.idempotency.fail(key);
      throw new BadRequestException({ ...responseBase, message: "Invalid import payload" });
    }

    if (request.dryRun) {
      await this.idempotency.complete(key, responseBase);
      return responseBase;
    }

    const job = await (this.prisma as any).integrationExportJob.create({
      data: {
        campgroundId: request.campgroundId,
        type: "api",
        resource: this.importResource,
        status: "queued",
        location: request.format,
        filters: {
          filename: request.filename,
          requestedById: request.requestedById,
          totalRows: validation.valid.length,
          errorCount: validation.errors.length,
        },
        requestedById: request.requestedById ?? null,
        lastError: validation.errors.length ? "Some rows failed validation; see status" : null,
      },
    });

    void this.jobQueue.enqueue(
      this.importQueueName,
      () => this.processImportJob(job.id, request.campgroundId, validation.valid, validation.errors),
      { jobName: `${this.importQueueName}:${request.campgroundId}` }
    );

    const response = { jobId: job.id, status: "queued", ...responseBase };
    await this.idempotency.complete(key, response);
    return response;
  }

  private async processImportJob(
    jobId: string,
    campgroundId: string,
    records: ReservationImportRecord[],
    validationErrors: ReservationImportValidationError[]
  ) {
    await (this.prisma as any).integrationExportJob.update({
      where: { id: jobId },
      data: { status: "processing", startedAt: new Date() },
    });

    const created: string[] = [];
    const failed: ReservationImportValidationError[] = [...validationErrors];

    for (const row of records) {
      try {
        await this.reservations.create({
          campgroundId,
          siteId: row.siteId,
          guestId: row.guestId,
          arrivalDate: row.arrivalDate,
          departureDate: row.departureDate,
          adults: row.adults,
          children: row.children ?? 0,
          status: row.status as ReservationStatus,
          totalAmount: row.totalAmount,
          paidAmount: row.paidAmount ?? 0,
          notes: row.notes,
          source: row.source,
          promoCode: row.promoCode,
          rigType: row.rigType,
          rigLength: row.rigLength,
          holdId: row.holdId,
          createdBy: row.createdBy,
          updatedBy: row.updatedBy,
        } as any);
        created.push(row.externalId || row.guestId);
      } catch (err: any) {
        failed.push({
          row: failed.length + created.length + 2,
          field: "create",
          message: err?.message || "Failed to create reservation",
        });
      }
    }

    const status = failed.length ? "failed" : "success";
    await (this.prisma as any).integrationExportJob.update({
      where: { id: jobId },
      data: {
        status,
        completedAt: new Date(),
        lastError: failed.length ? `${failed.length} rows failed` : null,
        filters: {
          createdCount: created.length,
          failedCount: failed.length,
          errors: failed.slice(0, 50).map((f) => ({ ...f, value: this.mask(f.value) })),
        },
      },
    });

    await this.audit.record({
      campgroundId,
      actorId: null,
      action: "reservation.import",
      entity: "reservation_import_job",
      entityId: jobId,
      after: { created: created.length, failed: failed.length },
    });

    this.observability.recordJobRun({
      name: this.importQueueName,
      durationMs: 0,
      success: status === "success",
      queueDepth: (this.jobQueue.getQueueState(this.importQueueName)?.pending ?? 0),
    });

    return { created: created.length, failed: failed.length };
  }

  async getImportStatus(campgroundId: string, jobId: string) {
    const job = await (this.prisma as any).integrationExportJob.findUnique({ where: { id: jobId } });
    if (!job || job.campgroundId !== campgroundId || job.resource !== this.importResource) {
      throw new BadRequestException("Import job not found for this campground");
    }
    return {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      format: job.location,
      metadata: job.filters,
      lastError: job.lastError,
    };
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  private exportMaxRows() {
    return Number(process.env.RESERVATION_EXPORT_MAX_ROWS ?? 50000);
  }

  private exportPageSize() {
    return Number(process.env.RESERVATION_EXPORT_PAGE_SIZE ?? 500);
  }

  private encodeToken(payload: Record<string, any>): string {
    return Buffer.from(JSON.stringify(payload)).toString("base64url");
  }

  private decodeToken<T>(token?: string): T | null {
    if (!token) return null;
    try {
      return JSON.parse(Buffer.from(token, "base64url").toString()) as T;
    } catch {
      return null;
    }
  }

  private redactRow(row: any, includePII: boolean) {
    if (includePII) return row;
    return {
      ...row,
      guestEmail: this.mask(row.guestEmail),
      guestPhone: this.mask(row.guestPhone),
      guestName: row.guestName ? this.mask(row.guestName) : undefined,
      notes: row.notes ? this.mask(row.notes) : undefined,
    };
  }

  private toCsv(rows: any[]) {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    rows.forEach((row) => {
      const values = headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        const str = String(val).replace(/"/g, '""');
        return str.includes(",") ? `"${str}"` : str;
      });
      lines.push(values.join(","));
    });
    return lines.join("\n");
  }

  async exportReservations(params: ExportParams) {
    await this.idempotency.throttleScope(params.campgroundId, null, "report");
    const decoded = this.decodeToken<{ lastId?: string; emitted?: number }>(params.paginationToken) || { emitted: 0 };
    const emitted = decoded.emitted ?? 0;
    const maxRows = this.exportMaxRows();
    if (emitted >= maxRows) {
      return { rows: [], nextToken: null, emitted, remaining: 0 };
    }

    const take = Math.min(Math.max(params.pageSize ?? this.exportPageSize(), 1), maxRows - emitted);
    const rows = await this.prisma.reservation.findMany({
      where: {
        campgroundId: params.campgroundId,
        ...(params.filters ?? {}),
      },
      orderBy: { createdAt: "asc" },
      ...(decoded.lastId ? { cursor: { id: decoded.lastId }, skip: 1 } : {}),
      take,
      select: {
        id: true,
        campgroundId: true,
        siteId: true,
        guestId: true,
        arrivalDate: true,
        departureDate: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
        source: true,
        notes: true,
        createdAt: true,
      },
    });

    const shaped = rows.map((r) =>
      this.redactRow(
        {
          id: r.id,
          campgroundId: r.campgroundId,
          siteId: r.siteId,
          guestId: r.guestId,
          arrivalDate: r.arrivalDate,
          departureDate: r.departureDate,
          totalAmount: r.totalAmount,
          paidAmount: r.paidAmount,
          status: r.status,
          source: r.source,
          notes: r.notes,
          createdAt: r.createdAt,
        },
        params.includePII ?? false
      )
    );

    const newEmitted = emitted + shaped.length;
    const nextToken =
      shaped.length === take && newEmitted < maxRows
        ? this.encodeToken({ lastId: rows[rows.length - 1].id, emitted: newEmitted })
        : null;

    const payload =
      (params.format ?? "json") === "csv"
        ? { csv: this.toCsv(shaped), nextToken, emitted: newEmitted, remaining: Math.max(0, maxRows - newEmitted) }
        : { rows: shaped, nextToken, emitted: newEmitted, remaining: Math.max(0, maxRows - newEmitted) };

    if (!params.paginationToken) {
      await this.audit.recordExport({
        campgroundId: params.campgroundId,
        requestedById: params.requestedById ?? "system",
        format: (params.format ?? "json") as any,
        filters: params.filters,
        recordCount: shaped.length,
      });
    }

    return payload;
  }

  async listExports(campgroundId: string, limit = 10) {
    const take = Math.min(Math.max(limit, 1), 50);
    return this.prisma.integrationExportJob.findMany({
      where: { campgroundId, resource: this.exportResource },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  async queueExport(campgroundId: string, filters?: Record<string, any>, format: "json" | "csv" = "json", requestedById?: string | null) {
    await this.idempotency.throttleScope(campgroundId, null, "apply");
    const job = await this.prisma.integrationExportJob.create({
      data: {
        campgroundId,
        type: "api",
        resource: this.exportResource,
        status: "queued",
        location: format,
        filters: filters ?? {},
        requestedById: requestedById ?? null,
      },
    });
    return job;
  }
}
