import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type Provider = "onpay" | "generic";
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

    const exportRecord = await (this.prisma as any).payrollExport.create({
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
        (this.prisma as any).staffTimeEntry.findMany({
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
        (this.prisma as any).payrollEarningCode.findMany({
          where: { campgroundId: params.campgroundId, provider }
        })
      ]);

      const rows = aggregateExportRows(
        entries.map((entry: any) => this.mapEntryToRow(entry, earningCodes, provider))
      );

      const csv =
        format === "csv"
          ? provider === "onpay"
            ? formatOnPayCsv(rows)
            : formatGenericCsv(rows)
          : undefined;

      await (this.prisma as any).payrollExportLine.createMany({
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

      await (this.prisma as any).payrollExport.update({
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
      await (this.prisma as any).payrollExport.update({
        where: { id: exportRecord.id },
        data: { status: "failed", failureReason: (err as Error).message }
      });
      throw err;
    }
  }
}
