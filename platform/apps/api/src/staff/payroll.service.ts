import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

type TimeEntryRecord = {
  id: string;
  userId: string;
  shiftId?: string | null;
  note?: string | null;
  clockInAt: Date;
  clockOutAt?: Date | null;
  StaffShift?: {
    role?: string | null;
    StaffRole?: { code?: string | null; hourlyRate?: unknown } | null;
  } | null;
};

type EarningCodeRecord = { roleCode?: string | null; earningCode?: string | null };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasToNumber = (value: unknown): value is { toNumber: () => number } =>
  isRecord(value) && typeof value.toNumber === "function";

const coerceNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (hasToNumber(value)) return value.toNumber();
  return 0;
};

type Provider = "onpay" | "generic" | "gusto" | "adp";
type ExportFormat = "csv" | "json";

export type ExportRow = {
  userId: string;
  shiftId?: string | null;
  timeEntryId?: string | null;
  hours: number;
  earningCode?: string | null;
  rate?: number | null;
  roleCode?: string | null;
  notes?: string | null;
};

type TimeEntryLike = { clockInAt: Date; clockOutAt?: Date | null };

export function minutesBetween(entry: TimeEntryLike): number {
  if (!entry.clockOutAt) return 0;
  return Math.max(0, Math.round((entry.clockOutAt.getTime() - entry.clockInAt.getTime()) / 60000));
}

export function aggregateExportRows(rows: ExportRow[]): ExportRow[] {
  const grouped = new Map<string, ExportRow>();

  for (const row of rows) {
    const key = `${row.userId}::${row.earningCode ?? "REG"}::${row.roleCode ?? ""}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.hours = Number((existing.hours + row.hours).toFixed(2));
    } else {
      grouped.set(key, { ...row, hours: Number(row.hours.toFixed(2)) });
    }
  }

  return Array.from(grouped.values());
}

export function formatOnPayCsv(rows: ExportRow[]): string {
  const header = ["EmployeeId", "EarningsCode", "Hours", "Rate", "RoleCode"];
  const lines = rows.map((row) =>
    [
      row.userId,
      row.earningCode ?? "REG",
      row.hours.toFixed(2),
      row.rate != null ? row.rate.toFixed(2) : "",
      row.roleCode ?? "",
    ].join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function formatGenericCsv(rows: ExportRow[]): string {
  const header = ["UserId", "Hours", "EarningCode", "Rate", "RoleCode", "Notes"];
  const lines = rows.map((row) =>
    [
      row.userId,
      row.hours.toFixed(2),
      row.earningCode ?? "",
      row.rate != null ? row.rate.toFixed(2) : "",
      row.roleCode ?? "",
      (row.notes ?? "").replace(/,/g, ";"),
    ].join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

/**
 * Gusto CSV format
 * See: https://support.gusto.com/article/106-1415 (Gusto time import format)
 * Columns: employee_email, date, hours, earning_type, notes
 */
export function formatGustoCsv(rows: ExportRow[]): string {
  const header = ["employee_id", "hours", "earning_type", "department"];
  const lines = rows.map((row) =>
    [
      row.userId,
      row.hours.toFixed(2),
      mapToGustoEarningType(row.earningCode),
      row.roleCode ?? "",
    ].join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function mapToGustoEarningType(earningCode?: string | null): string {
  switch (earningCode?.toUpperCase()) {
    case "OT":
    case "OVERTIME":
      return "overtime";
    case "DT":
    case "DOUBLE":
      return "double_overtime";
    case "HOL":
    case "HOLIDAY":
      return "holiday";
    case "PTO":
    case "VACATION":
      return "pto";
    case "SICK":
      return "sick";
    default:
      return "regular";
  }
}

/**
 * ADP Run CSV format
 * See: ADP Run payroll import specs
 * Columns: File Number, Earnings Code, Hours
 */
export function formatAdpCsv(rows: ExportRow[]): string {
  const header = ["File Number", "Earnings Code", "Hours", "Rate"];
  const lines = rows.map((row) =>
    [
      row.userId,
      mapToAdpEarningCode(row.earningCode),
      row.hours.toFixed(2),
      row.rate != null ? row.rate.toFixed(2) : "",
    ].join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function mapToAdpEarningCode(earningCode?: string | null): string {
  switch (earningCode?.toUpperCase()) {
    case "OT":
    case "OVERTIME":
      return "OT";
    case "DT":
    case "DOUBLE":
      return "DT";
    case "HOL":
    case "HOLIDAY":
      return "HOL";
    case "VAC":
    case "VACATION":
    case "PTO":
      return "VAC";
    case "SICK":
      return "SICK";
    default:
      return "REG";
  }
}

function getFormatterForProvider(provider: Provider): (rows: ExportRow[]) => string {
  switch (provider) {
    case "gusto":
      return formatGustoCsv;
    case "adp":
      return formatAdpCsv;
    case "onpay":
      return formatOnPayCsv;
    default:
      return formatGenericCsv;
  }
}

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  private mapEntryToRow(
    entry: TimeEntryRecord,
    earningCodes: EarningCodeRecord[],
    provider: Provider,
  ): ExportRow {
    const minutes = minutesBetween(entry);
    const hours = Number((minutes / 60).toFixed(2));
    const roleCode = entry?.StaffShift?.StaffRole?.code ?? entry?.StaffShift?.role ?? null;
    const earningCode =
      earningCodes.find((code) => code.roleCode === roleCode)?.earningCode ??
      (provider === "onpay" ? "REG" : null);

    const rateRaw = entry?.StaffShift?.StaffRole?.hourlyRate;
    const rate = rateRaw == null ? null : coerceNumber(rateRaw);

    return {
      userId: entry.userId,
      shiftId: entry.shiftId ?? null,
      timeEntryId: entry.id ?? null,
      hours,
      earningCode,
      rate,
      roleCode,
      notes: entry.note ?? null,
    };
  }

  async generateExport(params: {
    campgroundId: string;
    periodStart: Date;
    periodEnd: Date;
    requestedById: string;
    provider?: Provider;
    format?: ExportFormat;
  }) {
    const provider = params.provider ?? "onpay";
    const format = params.format ?? "csv";

    const exportRecord = await this.prisma.payrollExport.create({
      data: {
        id: randomUUID(),
        campgroundId: params.campgroundId,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        provider,
        format,
        status: "pending",
        requestedById: params.requestedById,
      },
    });

    try {
      const [entries, earningCodes] = await Promise.all([
        this.prisma.staffTimeEntry.findMany({
          where: {
            campgroundId: params.campgroundId,
            clockInAt: { gte: params.periodStart },
            clockOutAt: { lte: params.periodEnd },
            status: { in: ["approved", "submitted"] },
          },
          include: {
            StaffShift: {
              select: {
                id: true,
                role: true,
                StaffRole: { select: { code: true, hourlyRate: true } },
              },
            },
          },
        }),
        this.prisma.payrollEarningCode.findMany({
          where: { campgroundId: params.campgroundId, provider },
        }),
      ]);

      const rows = aggregateExportRows(
        entries.map((entry) => this.mapEntryToRow(entry, earningCodes, provider)),
      );

      const csv = format === "csv" ? getFormatterForProvider(provider)(rows) : undefined;

      await this.prisma.payrollExportLine.createMany({
        data: rows.map((row) => ({
          id: randomUUID(),
          exportId: exportRecord.id,
          userId: row.userId,
          shiftId: row.shiftId,
          timeEntryId: row.timeEntryId,
          hours: row.hours,
          earningCode: row.earningCode,
          rate: row.rate,
          roleCode: row.roleCode,
          notes: row.notes,
        })),
      });

      await this.prisma.payrollExport.update({
        where: { id: exportRecord.id },
        data: {
          status: "generated",
          rowCount: rows.length,
          totalHours: rows.reduce((sum, row) => sum + row.hours, 0),
          completedAt: new Date(),
        },
      });

      return {
        exportId: exportRecord.id,
        provider,
        format,
        rows,
        csv,
      };
    } catch (err) {
      const failureReason = err instanceof Error ? err.message : "Payroll export failed";
      await this.prisma.payrollExport.update({
        where: { id: exportRecord.id },
        data: { status: "failed", failureReason },
      });
      throw err;
    }
  }

  /**
   * List all payroll exports for a campground
   */
  async listExports(campgroundId: string, limit = 20) {
    const exports = await this.prisma.payrollExport.findMany({
      where: { campgroundId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        User: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    return exports.map(({ User, ...exportRecord }) => ({
      ...exportRecord,
      requestedBy: User,
    }));
  }

  /**
   * Get a single export with its lines
   */
  async getExport(exportId: string) {
    const exportRecord = await this.prisma.payrollExport.findUnique({
      where: { id: exportId },
      include: {
        User: { select: { id: true, email: true, firstName: true, lastName: true } },
        PayrollExportLine: {
          include: {
            User: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!exportRecord) return null;

    const lines = exportRecord.PayrollExportLine;

    // Regenerate CSV for download
    const rows: ExportRow[] = lines.map((line) => ({
      userId: line.userId,
      shiftId: line.shiftId,
      timeEntryId: line.timeEntryId,
      hours: line.hours,
      earningCode: line.earningCode,
      rate: line.rate == null ? null : coerceNumber(line.rate),
      roleCode: line.roleCode,
      notes: line.notes,
    }));

    const csv = getFormatterForProvider(exportRecord.provider)(rows);

    const { User, PayrollExportLine, ...rest } = exportRecord;
    return { ...rest, requestedBy: User, lines, csv };
  }

  /**
   * Preview payroll data without creating an export record
   */
  async previewExport(params: {
    campgroundId: string;
    periodStart: Date;
    periodEnd: Date;
    provider?: Provider;
  }) {
    const provider = params.provider ?? "generic";

    const [entries, earningCodes] = await Promise.all([
      this.prisma.staffTimeEntry.findMany({
        where: {
          campgroundId: params.campgroundId,
          clockInAt: { gte: params.periodStart },
          clockOutAt: { lte: params.periodEnd },
          status: { in: ["approved", "submitted"] },
        },
        include: {
          StaffShift: {
            select: {
              id: true,
              role: true,
              StaffRole: { select: { code: true, hourlyRate: true } },
            },
          },
          User_StaffTimeEntry_userIdToUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.payrollEarningCode.findMany({
        where: { campgroundId: params.campgroundId, provider },
      }),
    ]);

    const rows = aggregateExportRows(
      entries.map((entry) => this.mapEntryToRow(entry, earningCodes, provider)),
    );

    // Enrich rows with user info for preview
    const userMap = new Map(
      entries.map((entry) => [entry.userId, entry.User_StaffTimeEntry_userIdToUser]),
    );

    const enrichedRows = rows.map((row) => ({
      ...row,
      user: userMap.get(row.userId) || null,
    }));

    const csv = getFormatterForProvider(provider)(rows);

    return {
      provider,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      rowCount: rows.length,
      totalHours: rows.reduce((sum, row) => sum + row.hours, 0),
      rows: enrichedRows,
      csv,
    };
  }

  /**
   * Get or create payroll config for a campground
   */
  async getConfig(campgroundId: string) {
    const config = await this.prisma.payrollConfig.findUnique({
      where: { campgroundId },
    });

    return config || { campgroundId, provider: "generic", companyId: null };
  }

  /**
   * Update payroll config for a campground
   */
  async updateConfig(params: { campgroundId: string; provider: Provider; companyId?: string }) {
    return this.prisma.payrollConfig.upsert({
      where: { campgroundId: params.campgroundId },
      update: {
        provider: params.provider,
        companyId: params.companyId,
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        campgroundId: params.campgroundId,
        provider: params.provider,
        companyId: params.companyId,
        updatedAt: new Date(),
      },
    });
  }
}
