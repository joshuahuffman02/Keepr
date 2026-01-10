import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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
      row.roleCode ?? ""
    ].join(",")
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
      (row.notes ?? "").replace(/,/g, ";")
    ].join(",")
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
      row.roleCode ?? ""
    ].join(",")
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
      row.rate != null ? row.rate.toFixed(2) : ""
    ].join(",")
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

  private mapEntryToRow(entry: any, earningCodes: any[], provider: Provider): ExportRow {
    const minutes = minutesBetween(entry);
    const hours = Number((minutes / 60).toFixed(2));
    const roleCode = entry?.shift?.roleRef?.code ?? entry?.shift?.role ?? null;
    const earningCode =
      earningCodes.find((code) => code.roleCode === roleCode)?.earningCode ??
      (provider === "onpay" ? "REG" : null);

    const rateRaw = entry?.shift?.roleRef?.hourlyRate;
    const rate = typeof rateRaw === "object" && rateRaw !== null ? Number(rateRaw) : rateRaw ?? null;

    return {
      userId: entry.userId,
      shiftId: entry.shiftId ?? null,
      timeEntryId: entry.id ?? null,
      hours,
      earningCode,
      rate,
      roleCode,
      notes: entry.note ?? null
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
        campgroundId: params.campgroundId,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        provider,
        format,
        status: "pending",
        requestedById: params.requestedById
      }
    });

    try {
      const [entries, earningCodes] = await Promise.all([
        this.prisma.staffTimeEntry.findMany({
          where: {
            campgroundId: params.campgroundId,
            clockInAt: { gte: params.periodStart },
            clockOutAt: { lte: params.periodEnd },
            status: { in: ["approved", "submitted"] }
          },
          include: {
            shift: { select: { id: true, role: true, roleRef: true, roleId: true } }
          }
        }),
        this.prisma.payrollEarningCode.findMany({
          where: { campgroundId: params.campgroundId, provider }
        })
      ]);

      const rows = aggregateExportRows(
        entries.map((entry: any) => this.mapEntryToRow(entry, earningCodes, provider))
      );

      const csv = format === "csv" ? getFormatterForProvider(provider)(rows) : undefined;

      await this.prisma.payrollExportLine.createMany({
        data: rows.map((row) => ({
          exportId: exportRecord.id,
          userId: row.userId,
          shiftId: row.shiftId,
          timeEntryId: row.timeEntryId,
          hours: row.hours,
          earningCode: row.earningCode,
          rate: row.rate,
          roleCode: row.roleCode,
          notes: row.notes
        }))
      });

      await this.prisma.payrollExport.update({
        where: { id: exportRecord.id },
        data: {
          status: "generated",
          rowCount: rows.length,
          totalHours: rows.reduce((sum, row) => sum + row.hours, 0),
          completedAt: new Date()
        }
      });

      return {
        exportId: exportRecord.id,
        provider,
        format,
        rows,
        csv
      };
    } catch (err) {
      await this.prisma.payrollExport.update({
        where: { id: exportRecord.id },
        data: { status: "failed", failureReason: (err as Error).message }
      });
      throw err;
    }
  }

  /**
   * List all payroll exports for a campground
   */
  async listExports(campgroundId: string, limit = 20) {
    return this.prisma.payrollExport.findMany({
      where: { campgroundId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        requestedBy: { select: { id: true, email: true, firstName: true, lastName: true } }
      }
    });
  }

  /**
   * Get a single export with its lines
   */
  async getExport(exportId: string) {
    const exportRecord = await this.prisma.payrollExport.findUnique({
      where: { id: exportId },
      include: {
        requestedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        lines: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } }
          }
        }
      }
    });

    if (!exportRecord) return null;

    // Regenerate CSV for download
    const rows: ExportRow[] = exportRecord.lines.map((line: any) => ({
      userId: line.userId,
      shiftId: line.shiftId,
      timeEntryId: line.timeEntryId,
      hours: line.hours,
      earningCode: line.earningCode,
      rate: line.rate ? Number(line.rate) : null,
      roleCode: line.roleCode,
      notes: line.notes
    }));

    const csv = getFormatterForProvider(exportRecord.provider)(rows);

    return { ...exportRecord, csv };
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
          status: { in: ["approved", "submitted"] }
        },
        include: {
          shift: { select: { id: true, role: true, roleRef: true, roleId: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } }
        }
      }),
      this.prisma.payrollEarningCode.findMany({
        where: { campgroundId: params.campgroundId, provider }
      })
    ]);

    const rows = aggregateExportRows(
      entries.map((entry: any) => this.mapEntryToRow(entry, earningCodes, provider))
    );

    // Enrich rows with user info for preview
    const userMap = new Map(
      entries.map((e: any) => [e.userId, e.user])
    );

    const enrichedRows = rows.map((row) => ({
      ...row,
      user: userMap.get(row.userId) || null
    }));

    const csv = getFormatterForProvider(provider)(rows);

    return {
      provider,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      rowCount: rows.length,
      totalHours: rows.reduce((sum, row) => sum + row.hours, 0),
      rows: enrichedRows,
      csv
    };
  }

  /**
   * Get or create payroll config for a campground
   */
  async getConfig(campgroundId: string) {
    const config = await this.prisma.payrollConfig.findUnique({
      where: { campgroundId }
    });

    return config || { campgroundId, provider: "generic", companyId: null };
  }

  /**
   * Update payroll config for a campground
   */
  async updateConfig(params: {
    campgroundId: string;
    provider: Provider;
    companyId?: string;
  }) {
    return this.prisma.payrollConfig.upsert({
      where: { campgroundId: params.campgroundId },
      update: {
        provider: params.provider,
        companyId: params.companyId
      },
      create: {
        campgroundId: params.campgroundId,
        provider: params.provider,
        companyId: params.companyId
      }
    });
  }
}
