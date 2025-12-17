import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GuestAnalyticsService } from "./guest-analytics.service";
import { AnalyticsType, ExportFormat, ExportStatus, SegmentScope } from "@prisma/client";

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

@Injectable()
export class AnalyticsExportService {
  constructor(
    private prisma: PrismaService,
    private guestAnalyticsService: GuestAnalyticsService
  ) {}

  async createExport(
    request: ExportRequest,
    userId: string,
    userEmail: string
  ) {
    const exportRecord = await this.prisma.analyticsExport.create({
      data: {
        analyticsType: request.analyticsType,
        format: request.format,
        status: ExportStatus.pending,
        scope: request.campgroundId
          ? SegmentScope.campground
          : request.organizationId
          ? SegmentScope.organization
          : SegmentScope.global,
        campgroundId: request.campgroundId,
        organizationId: request.organizationId,
        segmentId: request.segmentId,
        dateRange: request.dateRange || "last_30_days",
        includePII: request.includePII || false,
        requestedBy: userId,
        requestedByEmail: userEmail,
        emailTo: request.emailTo || [],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Process export (in production, this would be a background job)
    this.processExport(exportRecord.id).catch((err) =>
      console.error("Export processing failed:", err)
    );

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
        exportRecord.dateRange || "last_30_days"
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
      const mimeType =
        exportRecord.format === ExportFormat.csv
          ? "text/csv"
          : "application/json";
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

  private async fetchAnalyticsData(
    analyticsType: AnalyticsType,
    dateRange: string
  ) {
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

  private convertToCsv(data: any, analyticsType: AnalyticsType): string {
    const rows: string[] = [];

    switch (analyticsType) {
      case AnalyticsType.overview:
        rows.push("Metric,Value");
        rows.push(`Total Guests,${data.totalGuests}`);
        rows.push(`New Guests This Month,${data.newGuestsThisMonth}`);
        rows.push(`New Guests Last Month,${data.newGuestsLastMonth}`);
        rows.push(`Repeat Guests,${data.repeatGuests}`);
        rows.push(`Repeat Rate,${data.repeatRate}%`);
        rows.push(`Average Party Size,${data.avgPartySize}`);
        rows.push(`Average Stay Length,${data.avgStayLength} nights`);
        rows.push(`Average Lead Time,${data.avgLeadTime} days`);
        break;

      case AnalyticsType.geographic:
        rows.push("Region Type,Region,Guest Count,Percentage");
        if (data.byCountry) {
          data.byCountry.forEach((item: any) => {
            rows.push(`Country,${item.country},${item.count},${item.percentage}%`);
          });
        }
        if (data.byState) {
          data.byState.forEach((item: any) => {
            rows.push(`State/Province,${item.state},${item.count},${item.percentage}%`);
          });
        }
        if (data.topCities) {
          data.topCities.forEach((item: any) => {
            rows.push(`City,${item.city},${item.count},${item.percentage}%`);
          });
        }
        break;

      case AnalyticsType.demographics:
        rows.push("Category,Segment,Count,Percentage");
        if (data.partyComposition) {
          data.partyComposition.forEach((item: any) => {
            rows.push(`Party Composition,${item.type},${item.count},${item.percentage}%`);
          });
        }
        if (data.rigTypes) {
          data.rigTypes.forEach((item: any) => {
            rows.push(`RV Type,${item.type},${item.count},${item.percentage}%`);
          });
        }
        break;

      case AnalyticsType.seasonal_trends:
        rows.push("Month,Year,Reservations,Revenue,Avg Stay Length");
        if (data.monthlyData) {
          data.monthlyData.forEach((item: any) => {
            rows.push(
              `${item.month},${item.year},${item.reservations},${item.revenue},${item.avgStayLength}`
            );
          });
        }
        break;

      case AnalyticsType.travel_behavior:
        rows.push("Category,Item,Count,Percentage");
        if (data.stayReasons) {
          data.stayReasons.forEach((item: any) => {
            rows.push(`Stay Reason,${item.reason},${item.count},${item.percentage}%`);
          });
        }
        if (data.bookingSources) {
          data.bookingSources.forEach((item: any) => {
            rows.push(`Booking Source,${item.source},${item.count},${item.percentage}%`);
          });
        }
        break;

      case AnalyticsType.full_report:
        // Full report as flattened CSV
        rows.push("Section,Metric,Value");
        if (data.overview) {
          rows.push(`Overview,Total Guests,${data.overview.totalGuests}`);
          rows.push(`Overview,Repeat Rate,${data.overview.repeatRate}%`);
          rows.push(`Overview,Avg Stay,${data.overview.avgStayLength} nights`);
        }
        break;

      default:
        rows.push("Data");
        rows.push(JSON.stringify(data));
    }

    return rows.join("\n");
  }

  private countRows(data: any): number {
    if (Array.isArray(data)) {
      return data.length;
    }
    // Count nested arrays
    let count = 0;
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) {
        count += data[key].length;
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
