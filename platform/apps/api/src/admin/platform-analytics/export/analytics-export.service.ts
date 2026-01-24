import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { PlatformAnalyticsService, AnalyticsQueryParams } from "../platform-analytics.service";

export interface ExportOptions {
  format: "json" | "markdown";
  modules?: string[]; // Which modules to include, or all if not specified
  dateRange?: AnalyticsQueryParams;
  includeAiSummary?: boolean;
}

export interface ExportResult {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  format: "json" | "markdown";
  createdAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
}

@Injectable()
export class AnalyticsExportService {
  private readonly logger = new Logger(AnalyticsExportService.name);
  private exports: Map<
    string,
    {
      status: ExportResult["status"];
      format: ExportOptions["format"];
      data?: string;
      createdAt: Date;
    }
  > = new Map();

  constructor(
    private prisma: PrismaService,
    private analyticsService: PlatformAnalyticsService,
  ) {}

  /**
   * Create a new export job
   */
  async createExport(options: ExportOptions): Promise<ExportResult> {
    const id = this.generateId();

    this.exports.set(id, {
      status: "processing",
      format: options.format,
      createdAt: new Date(),
    });

    // Process export asynchronously
    this.processExport(id, options).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Export failed: ${message}`);
      const exp = this.exports.get(id);
      if (exp) {
        exp.status = "failed";
      }
    });

    return {
      id,
      status: "processing",
      format: options.format,
      createdAt: new Date(),
    };
  }

  /**
   * Get export status
   */
  async getExportStatus(id: string): Promise<ExportResult | null> {
    const exp = this.exports.get(id);
    if (!exp) return null;

    return {
      id,
      status: exp.status,
      format: exp.format,
      createdAt: exp.createdAt,
      downloadUrl:
        exp.status === "completed" ? `/admin/platform-analytics/export/${id}/download` : undefined,
    };
  }

  /**
   * Get export data for download
   */
  async getExportData(id: string): Promise<{ format: string; data: string } | null> {
    const exp = this.exports.get(id);
    if (!exp || exp.status !== "completed" || !exp.data) return null;

    return {
      format: exp.format,
      data: exp.data,
    };
  }

  /**
   * Process the export
   */
  private async processExport(id: string, options: ExportOptions): Promise<void> {
    const exp = this.exports.get(id);
    if (!exp) return;

    try {
      // Get full analytics data
      const data = await this.analyticsService.getFullAnalytics(options.dateRange || {});

      if (options.format === "json") {
        exp.data = this.generateJsonExport(data, options);
      } else {
        exp.data = this.generateMarkdownExport(data, options);
      }

      exp.status = "completed";
    } catch (error) {
      exp.status = "failed";
      throw error;
    }
  }

  /**
   * Generate JSON export
   */
  private generateJsonExport(
    data: Awaited<ReturnType<PlatformAnalyticsService["getFullAnalytics"]>>,
    options: ExportOptions,
  ): string {
    const {
      exportedAt: _ignoredExportedAt,
      platform: _ignoredPlatform,
      version: _ignoredVersion,
      ...metadata
    } = data.metadata ?? {};
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        platform: "Campreserv",
        version: "1.0",
        format: "json",
        ...metadata,
      },
      summary: this.generateSummary(data),
      modules: data.modules,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Generate Markdown export
   */
  private generateMarkdownExport(
    data: Awaited<ReturnType<PlatformAnalyticsService["getFullAnalytics"]>>,
    options: ExportOptions,
  ): string {
    const lines: string[] = [];

    // Header
    lines.push("# Campreserv Platform Analytics Report");
    lines.push("");
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(
      `**Date Range:** ${data.metadata?.dateRange?.start} to ${data.metadata?.dateRange?.end}`,
    );
    lines.push("");

    // Executive Summary
    lines.push("## Executive Summary");
    lines.push("");
    const summary = this.generateSummary(data);
    lines.push(`- **Total Revenue:** $${summary.totalRevenue.toLocaleString()}`);
    lines.push(`- **Total Reservations:** ${summary.totalReservations.toLocaleString()}`);
    lines.push(`- **Average Order Value:** $${summary.averageOrderValue.toFixed(2)}`);
    lines.push(
      `- **YoY Growth:** ${summary.yoyGrowth !== null ? `${summary.yoyGrowth.toFixed(1)}%` : "N/A"}`,
    );
    lines.push("");

    // Revenue Intelligence
    if (data.modules?.revenue) {
      lines.push("## Revenue Intelligence");
      lines.push("");
      lines.push("### Revenue by Accommodation Type");
      lines.push("");
      lines.push("| Type | Revenue | Reservations | % of Total | ADR |");
      lines.push("|------|---------|--------------|------------|-----|");

      for (const item of data.modules.revenue.byAccommodationType || []) {
        lines.push(
          `| ${item.type} | $${item.revenue.toLocaleString()} | ${item.reservations} | ${item.percentage.toFixed(1)}% | $${item.adr.toFixed(2)} |`,
        );
      }
      lines.push("");
    }

    // Guest Journey
    if (data.modules?.guestJourney) {
      lines.push("## Guest Journey Analytics");
      lines.push("");
      const gj = data.modules.guestJourney.overview;
      if (gj) {
        lines.push(`- **Total Active Guests:** ${gj.totalGuests}`);
        lines.push(`- **New Guests:** ${gj.newGuests}`);
        lines.push(`- **Returning Guests:** ${gj.returningGuests}`);
        lines.push(`- **Return Rate:** ${gj.returnRate.toFixed(1)}%`);
        lines.push("");
      }

      if (data.modules.guestJourney.accommodationProgression) {
        lines.push("### Accommodation Progression");
        lines.push("");
        lines.push(
          `- **Upgrade Rate:** ${data.modules.guestJourney.accommodationProgression.upgradeRate.toFixed(1)}%`,
        );
        lines.push(
          `- **Downgrade Rate:** ${data.modules.guestJourney.accommodationProgression.downgradeRate.toFixed(1)}%`,
        );
        lines.push("");
      }
    }

    // Accommodation Mix
    if (data.modules?.accommodations) {
      lines.push("## Accommodation Mix");
      lines.push("");
      lines.push("### Site Type Distribution");
      lines.push("");
      lines.push("| Type | Sites | Reservations | Revenue | Occupancy | Revenue Share |");
      lines.push("|------|-------|--------------|---------|-----------|---------------|");

      for (const item of data.modules.accommodations.typeDistribution || []) {
        lines.push(
          `| ${item.type} | ${item.siteCount} | ${item.reservations} | $${item.revenue.toLocaleString()} | ${item.occupancyRate.toFixed(1)}% | ${item.revenueShare.toFixed(1)}% |`,
        );
      }
      lines.push("");
    }

    // Geographic Intelligence
    if (data.modules?.geographic) {
      lines.push("## Geographic Intelligence");
      lines.push("");
      const geo = data.modules.geographic.overview;
      if (geo) {
        lines.push(`- **Top Origin State:** ${geo.topOriginState}`);
        lines.push(`- **Average Travel Distance:** ${geo.averageTravelDistance.toFixed(0)} miles`);
        lines.push(`- **Unique States:** ${geo.uniqueStates}`);
        lines.push(`- **International Guests:** ${geo.internationalPercentage.toFixed(1)}%`);
        lines.push("");
      }
    }

    // Booking Behavior
    if (data.modules?.booking) {
      lines.push("## Booking Behavior");
      lines.push("");
      const book = data.modules.booking.overview;
      if (book) {
        lines.push(`- **Average Lead Time:** ${book.averageLeadTime.toFixed(0)} days`);
        lines.push(`- **Cancellation Rate:** ${book.cancellationRate.toFixed(1)}%`);
        lines.push(`- **Last-Minute Bookings:** ${book.lastMinutePercentage.toFixed(1)}%`);
        lines.push("");
      }
    }

    // Length of Stay
    if (data.modules?.los) {
      lines.push("## Length of Stay Analysis");
      lines.push("");
      const los = data.modules.los.overview;
      if (los) {
        lines.push(`- **Average LOS:** ${los.averageLos.toFixed(1)} nights`);
        lines.push(`- **Median LOS:** ${los.medianLos} nights`);
        lines.push(`- **Weekly Stays (7+ nights):** ${los.weeklyStayPercentage.toFixed(1)}%`);
        lines.push(`- **Monthly Stays (28+ nights):** ${los.monthlyStayPercentage.toFixed(1)}%`);
        lines.push("");
      }
    }

    // Footer
    lines.push("---");
    lines.push("");
    lines.push("*Report generated by Campreserv Analytics Platform*");
    lines.push("");
    lines.push("This report is optimized for both human reading and AI analysis.");

    return lines.join("\n");
  }

  /**
   * Generate summary from analytics data
   */
  private generateSummary(
    data: Awaited<ReturnType<PlatformAnalyticsService["getFullAnalytics"]>>,
  ): {
    totalRevenue: number;
    totalReservations: number;
    averageOrderValue: number;
    yoyGrowth: number | null;
  } {
    const revenue = data.modules?.revenue?.overview || {};

    return {
      totalRevenue: revenue.totalRevenue || 0,
      totalReservations: revenue.totalReservations || 0,
      averageOrderValue: revenue.averageOrderValue || 0,
      yoyGrowth: revenue.yoyGrowth ?? null,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
