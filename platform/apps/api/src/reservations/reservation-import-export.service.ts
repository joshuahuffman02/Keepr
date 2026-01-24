import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
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
import {
  parseNewbookCsv,
  mapNewbookToInternal,
  NewbookImportResult,
} from "./integrations/newbook.adapter";
import { randomUUID } from "crypto";

type ImportFormat = "csv" | "json" | "newbook";

type ImportRequest = {
  campgroundId: string;
  format: ImportFormat;
  payload: string | unknown[];
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
  filters?: Record<string, unknown>;
  requestedById?: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const toNullableJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
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
    private readonly observability: ObservabilityService,
  ) {}

  // ---------------------------------------------------------------------------
  // Schema helpers
  // ---------------------------------------------------------------------------

  importSchema() {
    return {
      formats: ["csv", "json", "newbook"],
      csvColumns: reservationImportCsvColumns,
      jsonSchema: reservationImportRecordSchema.describe("Reservation import record"),
      summary: reservationImportSchemaSummary,
      newbookFormat: {
        description: "NewBook PMS CSV export format",
        columns: [
          "Booking Name",
          "Site",
          "Arrival",
          "Departure",
          "Calculated Stay Cost",
          "Default Client Account",
          "Booking Client Account Balance",
          "Booking Duration",
          "Category Name",
        ],
        notes: [
          "Site class is extracted from 'Category Name'",
          "Site number is extracted from 'Site' field suffix",
          "Guests are created with placeholder emails",
          "Amounts are converted from dollars to cents",
        ],
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  private mask(value: unknown) {
    if (typeof value !== "string") return value;
    return value
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "***@redacted")
      .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "***-***-****");
  }

  private parseCsv(raw: string) {
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (!lines.length) return { records: [], errors: ["CSV has no rows"] };
    const headers = lines[0].split(",").map((h) => h.trim());
    const records: Record<string, unknown>[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const row: Record<string, unknown> = {};
      headers.forEach((h, idx) => {
        row[h] = cells[idx] ?? "";
      });
      if (Object.values(row).every((v) => v === undefined || String(v).trim() === "")) {
        continue;
      }
      records.push(row);
    }

    const missing = reservationImportSchemaSummary.requiredFields.filter(
      (req) => !headers.includes(req),
    );
    if (missing.length) {
      errors.push(`Missing required columns: ${missing.join(", ")}`);
    }

    return { records, errors };
  }

  private validateRecords(
    campgroundId: string,
    records: Record<string, unknown>[],
  ): { valid: ReservationImportRecord[]; errors: ReservationImportValidationError[] } {
    const valid: ReservationImportRecord[] = [];
    const errors: ReservationImportValidationError[] = [];

    records.forEach((row, idx) => {
      const parsed = reservationImportRecordSchema.safeParse({
        campgroundId,
        ...row,
      });
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          const field = typeof issue.path?.[0] === "string" ? issue.path[0] : undefined;
          errors.push({
            row: idx + 2, // account for header
            field,
            message: issue.message,
            value: field ? row[field] : undefined,
          });
        });
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
      throw Object.assign(error, { retryAfter });
    }
  }

  private normalizeIdempotencyKey(input?: string | null) {
    if (input && input.trim().length > 0) return input.trim();
    return `import-${Date.now()}`;
  }

  async startImport(request: ImportRequest) {
    if (!["csv", "json", "newbook"].includes(request.format)) {
      throw new BadRequestException("format must be csv, json, or newbook");
    }
    const key = this.normalizeIdempotencyKey(request.idempotencyKey);
    await this.idempotency.throttleScope(request.campgroundId, null, "apply");

    const idemp = await this.idempotency.start(
      key,
      { format: request.format, dryRun: request.dryRun, filename: request.filename },
      request.campgroundId,
      {
        endpoint: "reservations.import",
        requestBody: { format: request.format, dryRun: request.dryRun, filename: request.filename },
      },
    );

    if (isRecord(idemp)) {
      const status = idemp.status;
      const responseJson = idemp.responseJson;
      if (typeof status === "string" && status === "succeeded" && responseJson) {
        return responseJson;
      }
    }

    await this.enforceCapacityGuard();

    // Parse based on format
    let records: Record<string, unknown>[] = [];
    let parseErrors: string[] = [];
    let newbookResults: NewbookImportResult[] = [];

    if (request.format === "newbook") {
      // NewBook format: parse CSV and transform through adapter
      const csvContent = typeof request.payload === "string" ? request.payload : "";
      const newbookRows = parseNewbookCsv(csvContent);
      if (!newbookRows.length) {
        parseErrors.push("No valid NewBook rows found in CSV");
      } else {
        newbookResults = newbookRows.map((row) => mapNewbookToInternal(row));
        // For now, collect warnings as parse errors and extract records
        newbookResults.forEach((r, idx) => {
          r.warnings.forEach((w) => parseErrors.push(`Row ${idx + 2}: ${w}`));
        });
        // Note: NewBook records are partial - they need site/guest resolution
        // For full import, we'd need to resolve these first
        records = newbookResults.map((r) => r.record);
      }
    } else if (request.format === "csv") {
      const parsed = this.parseCsv(typeof request.payload === "string" ? request.payload : "");
      records = parsed.records;
      parseErrors = parsed.errors;
    } else {
      const rawRecords = Array.isArray(request.payload) ? request.payload : [];
      records = rawRecords.filter((row): row is Record<string, unknown> => isRecord(row));
    }

    if (!records.length) {
      await this.idempotency.fail(key);
      throw new BadRequestException("No rows to import");
    }

    const validation = this.validateRecords(request.campgroundId, records);
    const responseBase = {
      dryRun: Boolean(request.dryRun),
      parseErrors: parseErrors.map((e) => this.mask(e)),
      validationErrors: validation.errors
        .slice(0, 25)
        .map((e) => ({ ...e, value: this.mask(e.value) })),
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

    const job = await this.prisma.integrationExportJob.create({
      data: {
        id: randomUUID(),
        campgroundId: request.campgroundId,
        type: "api",
        resource: this.importResource,
        status: "queued",
        location: request.format,
        filters: toNullableJsonInput({
          filename: request.filename,
          requestedById: request.requestedById,
          totalRows: validation.valid.length,
          errorCount: validation.errors.length,
        }),
        requestedById: request.requestedById ?? null,
        lastError: validation.errors.length ? "Some rows failed validation; see status" : null,
      },
    });

    void this.jobQueue.enqueue(
      this.importQueueName,
      () =>
        this.processImportJob(job.id, request.campgroundId, validation.valid, validation.errors),
      { jobName: `${this.importQueueName}:${request.campgroundId}` },
    );

    const response = { jobId: job.id, status: "queued", ...responseBase };
    await this.idempotency.complete(key, response);
    return response;
  }

  private async processImportJob(
    jobId: string,
    campgroundId: string,
    records: ReservationImportRecord[],
    validationErrors: ReservationImportValidationError[],
  ) {
    await this.prisma.integrationExportJob.update({
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
          status: row.status,
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
        });
        created.push(row.externalId || row.guestId);
      } catch (err) {
        failed.push({
          row: failed.length + created.length + 2,
          field: "create",
          message: getErrorMessage(err, "Failed to create reservation"),
        });
      }
    }

    const status = failed.length ? "failed" : "success";
    await this.prisma.integrationExportJob.update({
      where: { id: jobId },
      data: {
        status,
        completedAt: new Date(),
        lastError: failed.length ? `${failed.length} rows failed` : null,
        filters: toNullableJsonInput({
          createdCount: created.length,
          failedCount: failed.length,
          errors: failed.slice(0, 50).map((f) => ({ ...f, value: this.mask(f.value) })),
        }),
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
      queueDepth: this.jobQueue.getQueueState(this.importQueueName)?.pending ?? 0,
    });

    return { created: created.length, failed: failed.length };
  }

  async getImportStatus(campgroundId: string, jobId: string) {
    const job = await this.prisma.integrationExportJob.findUnique({ where: { id: jobId } });
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

  private encodeToken(payload: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(payload)).toString("base64url");
  }

  private decodeToken(token?: string): Record<string, unknown> | null {
    if (!token) return null;
    try {
      const parsed: unknown = JSON.parse(Buffer.from(token, "base64url").toString());
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private redactRow(row: Record<string, unknown>, includePII: boolean) {
    if (includePII) return row;
    return {
      ...row,
      guestEmail: this.mask(row.guestEmail),
      guestPhone: this.mask(row.guestPhone),
      guestName: row.guestName ? this.mask(row.guestName) : undefined,
      notes: row.notes ? this.mask(row.notes) : undefined,
    };
  }

  private toCsv(rows: Record<string, unknown>[]) {
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
    const decoded = this.decodeToken(params.paginationToken);
    const decodedLastId =
      decoded && typeof decoded.lastId === "string" ? decoded.lastId : undefined;
    const emitted = decoded && typeof decoded.emitted === "number" ? decoded.emitted : 0;
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
      ...(decodedLastId ? { cursor: { id: decodedLastId }, skip: 1 } : {}),
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
        params.includePII ?? false,
      ),
    );

    const newEmitted = emitted + shaped.length;
    const nextToken =
      shaped.length === take && newEmitted < maxRows
        ? this.encodeToken({ lastId: rows[rows.length - 1].id, emitted: newEmitted })
        : null;

    const payload =
      (params.format ?? "json") === "csv"
        ? {
            csv: this.toCsv(shaped),
            nextToken,
            emitted: newEmitted,
            remaining: Math.max(0, maxRows - newEmitted),
          }
        : {
            rows: shaped,
            nextToken,
            emitted: newEmitted,
            remaining: Math.max(0, maxRows - newEmitted),
          };

    if (!params.paginationToken) {
      await this.audit.recordExport({
        campgroundId: params.campgroundId,
        requestedById: params.requestedById ?? "system",
        format: params.format ?? "json",
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

  async queueExport(
    campgroundId: string,
    filters?: Record<string, unknown>,
    format: "json" | "csv" = "json",
    requestedById?: string | null,
  ) {
    await this.idempotency.throttleScope(campgroundId, null, "apply");
    const job = await this.prisma.integrationExportJob.create({
      data: {
        id: randomUUID(),
        campgroundId,
        type: "api",
        resource: this.exportResource,
        status: "queued",
        location: format,
        filters: toNullableJsonInput(filters ?? null),
        requestedById: requestedById ?? null,
      },
    });
    return job;
  }
}
