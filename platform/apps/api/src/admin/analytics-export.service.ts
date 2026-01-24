import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { GuestAnalyticsService } from "./guest-analytics.service";
import { AnalyticsType, ExportFormat, ExportStatus, SegmentScope, Prisma } from "@prisma/client";

interface ExportRequest {
  analyticsType: AnalyticsType;
  format: ExportFormat;
  dateRange?: string;
  campgroundId?: string;
  organizationId?: string;
  segmentId?: string;
  includePII?: boolean;
  emailTo?: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

const toNumberValue = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => isRecord(item));
};

@Injectable()
export class AnalyticsExportService {
  private readonly logger = new Logger(AnalyticsExportService.name);

  constructor(
    private prisma: PrismaService,
    private guestAnalyticsService: GuestAnalyticsService,
  ) {}

  async createExport(request: ExportRequest, userId: string, userEmail: string) {
    const scope = request.campgroundId
      ? SegmentScope.campground
      : request.organizationId
        ? SegmentScope.organization
        : SegmentScope.global;
    const data: Prisma.AnalyticsExportUncheckedCreateInput = {
      id: randomUUID(),
      analyticsType: request.analyticsType,
      format: request.format,
      status: ExportStatus.pending,
      scope,
      dateRange: request.dateRange || "last_30_days",
      includePII: request.includePII || false,
      requestedBy: userId,
      requestedByEmail: userEmail,
      emailTo: request.emailTo || [],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ...(request.campgroundId ? { campgroundId: request.campgroundId } : {}),
      ...(request.organizationId ? { organizationId: request.organizationId } : {}),
      ...(request.segmentId ? { segmentId: request.segmentId } : {}),
    };

    const exportRecord = await this.prisma.analyticsExport.create({
      data,
    });

    // Process export (in production, this would be a background job)
    this.processExport(exportRecord.id).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Export processing failed: ${message}`);
    });

    return exportRecord;
  }

  async processExport(exportId: string) {
    const exportRecord = await this.prisma.analyticsExport.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord) {
      throw new NotFoundException("Export not found");
    }

    await this.prisma.analyticsExport.update({
      where: { id: exportId },
      data: {
        status: ExportStatus.processing,
        startedAt: new Date(),
      },
    });

    try {
      // Fetch the analytics data
      const data = await this.fetchAnalyticsData(
        exportRecord.analyticsType,
        exportRecord.dateRange || "last_30_days",
      );

      // Convert to requested format
      let content: string;
      let fileName: string;
      const timestamp = new Date().toISOString().split("T")[0];

      switch (exportRecord.format) {
        case ExportFormat.csv:
          content = this.convertToCsv(data, exportRecord.analyticsType);
          fileName = `analytics-${exportRecord.analyticsType}-${timestamp}.csv`;
          break;
        case ExportFormat.json:
          content = JSON.stringify(data, null, 2);
          fileName = `analytics-${exportRecord.analyticsType}-${timestamp}.json`;
          break;
        case ExportFormat.pdf:
          // PDF generation would require additional library
          content = JSON.stringify(data, null, 2);
          fileName = `analytics-${exportRecord.analyticsType}-${timestamp}.json`;
          break;
        default:
          content = JSON.stringify(data, null, 2);
          fileName = `analytics-${exportRecord.analyticsType}-${timestamp}.json`;
      }

      // In production, upload to S3 and store URL
      // For now, we'll store a data URL (small exports only)
      const base64Content = Buffer.from(content).toString("base64");
      const mimeType = exportRecord.format === ExportFormat.csv ? "text/csv" : "application/json";
      const dataUrl = `data:${mimeType};base64,${base64Content}`;

      await this.prisma.analyticsExport.update({
        where: { id: exportId },
        data: {
          status: ExportStatus.completed,
          completedAt: new Date(),
          fileName,
          fileUrl: dataUrl,
          fileSize: content.length,
          rowCount: this.countRows(data),
        },
      });

      return { success: true, fileName };
    } catch (error) {
      await this.prisma.analyticsExport.update({
        where: { id: exportId },
        data: {
          status: ExportStatus.failed,
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
      throw error;
    }
  }

  private async fetchAnalyticsData(analyticsType: AnalyticsType, dateRange: string) {
    switch (analyticsType) {
      case AnalyticsType.overview:
        return this.guestAnalyticsService.getOverview(dateRange);
      case AnalyticsType.geographic:
        return this.guestAnalyticsService.getGeographicData(dateRange);
      case AnalyticsType.demographics:
        return this.guestAnalyticsService.getDemographics(dateRange);
      case AnalyticsType.seasonal_trends:
        return this.guestAnalyticsService.getSeasonalTrends(dateRange);
      case AnalyticsType.travel_behavior:
        return this.guestAnalyticsService.getTravelBehavior(dateRange);
      case AnalyticsType.full_report:
        return this.guestAnalyticsService.getFullAnalytics(dateRange);
      default:
        return this.guestAnalyticsService.getOverview(dateRange);
    }
  }

  private convertToCsv(data: unknown, analyticsType: AnalyticsType): string {
    const rows: string[] = [];
    const record = isRecord(data) ? data : {};

    switch (analyticsType) {
      case AnalyticsType.overview:
        rows.push("Metric,Value");
        rows.push(`Total Guests,${toNumberValue(record.totalGuests)}`);
        rows.push(`New Guests This Month,${toNumberValue(record.newGuestsThisMonth)}`);
        rows.push(`New Guests Last Month,${toNumberValue(record.newGuestsLastMonth)}`);
        rows.push(`Repeat Guests,${toNumberValue(record.repeatGuests)}`);
        rows.push(`Repeat Rate,${toNumberValue(record.repeatRate)}%`);
        rows.push(`Average Party Size,${toNumberValue(record.avgPartySize)}`);
        rows.push(`Average Stay Length,${toNumberValue(record.avgStayLength)} nights`);
        rows.push(`Average Lead Time,${toNumberValue(record.avgLeadTime)} days`);
        break;

      case AnalyticsType.geographic:
        rows.push("Region Type,Region,Guest Count,Percentage");
        toRecordArray(record.byCountry).forEach((item) => {
          rows.push(
            `Country,${toStringValue(item.country)},${toNumberValue(item.count)},${toNumberValue(item.percentage)}%`,
          );
        });
        toRecordArray(record.byState).forEach((item) => {
          rows.push(
            `State/Province,${toStringValue(item.state)},${toNumberValue(item.count)},${toNumberValue(item.percentage)}%`,
          );
        });
        toRecordArray(record.topCities).forEach((item) => {
          rows.push(
            `City,${toStringValue(item.city)},${toNumberValue(item.count)},${toNumberValue(item.percentage)}%`,
          );
        });
        break;

      case AnalyticsType.demographics:
        rows.push("Category,Segment,Count,Percentage");
        toRecordArray(record.partyComposition).forEach((item) => {
          rows.push(
            `Party Composition,${toStringValue(item.type)},${toNumberValue(item.count)},${toNumberValue(item.percentage)}%`,
          );
        });
        toRecordArray(record.rigTypes).forEach((item) => {
          rows.push(
            `RV Type,${toStringValue(item.type)},${toNumberValue(item.count)},${toNumberValue(item.percentage)}%`,
          );
        });
        break;

      case AnalyticsType.seasonal_trends:
        rows.push("Month,Year,Reservations,Revenue,Avg Stay Length");
        toRecordArray(record.monthlyData).forEach((item) => {
          rows.push(
            `${toStringValue(item.month)},${toNumberValue(item.year)},${toNumberValue(item.reservations)},${toNumberValue(item.revenue)},${toNumberValue(item.avgStayLength)}`,
          );
        });
        break;

      case AnalyticsType.travel_behavior:
        rows.push("Category,Item,Count,Percentage");
        toRecordArray(record.stayReasons).forEach((item) => {
          rows.push(
            `Stay Reason,${toStringValue(item.reason)},${toNumberValue(item.count)},${toNumberValue(item.percentage)}%`,
          );
        });
        toRecordArray(record.bookingSources).forEach((item) => {
          rows.push(
            `Booking Source,${toStringValue(item.source)},${toNumberValue(item.count)},${toNumberValue(item.percentage)}%`,
          );
        });
        break;

      case AnalyticsType.full_report:
        // Full report as flattened CSV
        rows.push("Section,Metric,Value");
        if (isRecord(record.overview)) {
          rows.push(`Overview,Total Guests,${toNumberValue(record.overview.totalGuests)}`);
          rows.push(`Overview,Repeat Rate,${toNumberValue(record.overview.repeatRate)}%`);
          rows.push(`Overview,Avg Stay,${toNumberValue(record.overview.avgStayLength)} nights`);
        }
        break;

      default:
        rows.push("Data");
        rows.push(JSON.stringify(data));
    }

    return rows.join("\n");
  }

  private countRows(data: unknown): number {
    if (Array.isArray(data)) {
      return data.length;
    }

    if (!isRecord(data)) {
      return 0;
    }

    // Count nested arrays
    let count = 0;
    for (const value of Object.values(data)) {
      if (Array.isArray(value)) {
        count += value.length;
      } else {
        count += 1;
      }
    }
    return count;
  }

  async getExport(exportId: string) {
    const exportRecord = await this.prisma.analyticsExport.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord) {
      throw new NotFoundException("Export not found");
    }

    return exportRecord;
  }

  async listExports(userId: string, limit = 20) {
    return this.prisma.analyticsExport.findMany({
      where: { requestedBy: userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async downloadExport(exportId: string) {
    const exportRecord = await this.prisma.analyticsExport.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord) {
      throw new NotFoundException("Export not found");
    }

    if (exportRecord.status !== ExportStatus.completed) {
      throw new BadRequestException("Export not ready for download");
    }

    if (exportRecord.expiresAt && exportRecord.expiresAt < new Date()) {
      throw new BadRequestException("Export has expired");
    }

    return {
      fileName: exportRecord.fileName,
      fileUrl: exportRecord.fileUrl,
      format: exportRecord.format,
    };
  }
}
