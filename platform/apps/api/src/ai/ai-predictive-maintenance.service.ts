import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OpTaskCategory } from "@prisma/client";
import type { AiMaintenanceAlert, Prisma } from "@prisma/client";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { AiAutopilotConfigService } from "./ai-autopilot-config.service";
import { randomUUID } from "crypto";

/**
 * AI Predictive Maintenance Service
 *
 * Analyzes maintenance incidents and guest complaints to:
 * - Detect patterns (e.g., "Site 47 has had 3 electrical complaints")
 * - Predict failures before they happen
 * - Suggest preventive maintenance
 */

const incidentInclude = { Site: true } satisfies Prisma.OpTaskInclude;
const complaintInclude = {
  Reservation: { include: { Site: true } },
} satisfies Prisma.CommunicationInclude;

type IncidentPayload = Prisma.OpTaskGetPayload<{ include: typeof incidentInclude }>;
type ComplaintPayload = Prisma.CommunicationGetPayload<{ include: typeof complaintInclude }>;

@Injectable()
export class AiPredictiveMaintenanceService {
  private readonly logger = new Logger(AiPredictiveMaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: AiAutopilotConfigService,
  ) {}

  // ==================== ALERTS CRUD ====================

  async getAlerts(
    campgroundId: string,
    options: {
      status?: string;
      severity?: string;
      category?: string;
      siteId?: string;
      limit?: number;
    } = {},
  ) {
    const { status, severity, category, siteId, limit = 50 } = options;

    const where: Prisma.AiMaintenanceAlertWhereInput = { campgroundId };
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (category) where.category = category;
    if (siteId) where.siteId = siteId;

    return this.prisma.aiMaintenanceAlert.findMany({
      where,
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
  }

  async getAlert(id: string) {
    const alert = await this.prisma.aiMaintenanceAlert.findUnique({
      where: { id },
    });
    if (!alert) throw new NotFoundException("Maintenance alert not found");
    return alert;
  }

  // ==================== PATTERN DETECTION ====================

  /**
   * Analyze maintenance patterns for a campground
   */
  async analyzePatterns(campgroundId: string) {
    const config = await this.configService.getConfig(campgroundId);

    if (!config.predictiveMaintenanceEnabled) {
      this.logger.debug(`Predictive maintenance disabled for campground ${campgroundId}`);
      return [];
    }

    const alerts: AiMaintenanceAlert[] = [];

    // Get incidents from last 90 days
    const past90Days = new Date();
    past90Days.setDate(past90Days.getDate() - 90);

    // Get maintenance tickets/incidents
    const incidents = await this.prisma.opTask.findMany({
      where: {
        campgroundId,
        category: {
          in: [
            OpTaskCategory.maintenance,
            OpTaskCategory.inspection,
            OpTaskCategory.housekeeping,
            OpTaskCategory.turnover,
          ],
        },
        createdAt: { gte: past90Days },
      },
      include: incidentInclude,
    });

    // Also check guest communications for complaints
    const complaints = await this.prisma.communication.findMany({
      where: {
        campgroundId,
        direction: "inbound",
        createdAt: { gte: past90Days },
        OR: [
          { body: { contains: "broken", mode: "insensitive" } },
          { body: { contains: "not working", mode: "insensitive" } },
          { body: { contains: "issue", mode: "insensitive" } },
          { body: { contains: "problem", mode: "insensitive" } },
          { body: { contains: "complaint", mode: "insensitive" } },
        ],
      },
      include: complaintInclude,
    });

    // Group by site and category
    const patterns = this.groupIncidentPatterns(incidents, complaints);

    // Generate alerts for patterns exceeding threshold
    const threshold = config.maintenanceAlertThreshold;

    for (const pattern of patterns) {
      if (pattern.count >= threshold) {
        // Check if alert already exists
        const existing = await this.prisma.aiMaintenanceAlert.findFirst({
          where: {
            campgroundId,
            siteId: pattern.siteId,
            category: pattern.category,
            status: { in: ["new", "acknowledged"] },
          },
        });

        if (existing) continue;

        const severity = this.calculateSeverity(pattern);
        const suggestedAction = this.generateSuggestedAction(pattern);

        const alert = await this.prisma.aiMaintenanceAlert.create({
          data: {
            id: randomUUID(),
            campgroundId,
            siteId: pattern.siteId,
            alertType: "pattern_detected",
            severity,
            category: pattern.category,
            title: `Recurring ${pattern.category} issues on ${pattern.siteName}`,
            summary: `${pattern.siteName} has had ${pattern.count} ${pattern.category}-related incidents in the last 90 days. This pattern suggests preventive maintenance may be needed.`,
            incidentCount: pattern.count,
            incidentIds: pattern.incidentIds,
            confidence: Math.min(0.95, 0.5 + pattern.count * 0.1),
            suggestedAction,
            estimatedCostCents: this.estimateRepairCost(pattern.category),
            updatedAt: new Date(),
          },
        });

        alerts.push(alert);
      }
    }

    this.logger.log(`Generated ${alerts.length} maintenance alerts for campground ${campgroundId}`);

    return alerts;
  }

  /**
   * Group incidents into patterns
   */
  private groupIncidentPatterns(
    incidents: IncidentPayload[],
    complaints: ComplaintPayload[],
  ): Array<{
    siteId: string;
    siteName: string;
    category: string;
    count: number;
    incidentIds: string[];
    lastOccurrence: Date;
  }> {
    const patterns: Map<
      string,
      {
        siteId: string;
        siteName: string;
        category: string;
        count: number;
        incidentIds: string[];
        lastOccurrence: Date;
      }
    > = new Map();

    // Process maintenance incidents
    for (const incident of incidents) {
      if (!incident.siteId) continue;

      const category = this.normalizeCategory(incident.category);
      const key = `${incident.siteId}:${category}`;

      if (!patterns.has(key)) {
        patterns.set(key, {
          siteId: incident.siteId,
          siteName: incident.Site?.name || "Unknown Site",
          category,
          count: 0,
          incidentIds: [],
          lastOccurrence: incident.createdAt,
        });
      }

      const pattern = patterns.get(key)!;
      pattern.count++;
      pattern.incidentIds.push(incident.id);
      if (incident.createdAt > pattern.lastOccurrence) {
        pattern.lastOccurrence = incident.createdAt;
      }
    }

    // Process complaints
    for (const complaint of complaints) {
      const siteId = complaint.Reservation?.siteId;
      if (!siteId) continue;

      const category = this.detectCategoryFromText(complaint.body || "");
      if (!category) continue;

      const key = `${siteId}:${category}`;

      if (!patterns.has(key)) {
        patterns.set(key, {
          siteId,
          siteName: complaint.Reservation?.Site?.name || "Unknown Site",
          category,
          count: 0,
          incidentIds: [],
          lastOccurrence: complaint.createdAt,
        });
      }

      const pattern = patterns.get(key)!;
      pattern.count++;
      pattern.incidentIds.push(complaint.id);
      if (complaint.createdAt > pattern.lastOccurrence) {
        pattern.lastOccurrence = complaint.createdAt;
      }
    }

    return Array.from(patterns.values());
  }

  /**
   * Normalize category names
   */
  private normalizeCategory(category: string): string {
    const lower = category.toLowerCase();

    if (lower.includes("electric") || lower.includes("power") || lower.includes("outlet")) {
      return "electrical";
    }
    if (
      lower.includes("water") ||
      lower.includes("plumb") ||
      lower.includes("drain") ||
      lower.includes("sewer")
    ) {
      return "plumbing";
    }
    if (lower.includes("hvac") || lower.includes("heat") || lower.includes("ac")) {
      return "hvac";
    }
    if (lower.includes("struct") || lower.includes("roof") || lower.includes("floor")) {
      return "structural";
    }
    if (lower.includes("ground") || lower.includes("lawn") || lower.includes("tree")) {
      return "grounds";
    }

    return "general";
  }

  /**
   * Detect category from complaint text
   */
  private detectCategoryFromText(text: string): string | null {
    const lower = text.toLowerCase();

    if (
      lower.includes("electric") ||
      lower.includes("power") ||
      lower.includes("outlet") ||
      lower.includes("plug")
    ) {
      return "electrical";
    }
    if (
      lower.includes("water") ||
      lower.includes("plumb") ||
      lower.includes("drain") ||
      lower.includes("sewer") ||
      lower.includes("toilet") ||
      lower.includes("shower")
    ) {
      return "plumbing";
    }
    if (
      lower.includes("heat") ||
      lower.includes("ac") ||
      lower.includes("air condition") ||
      lower.includes("cold") ||
      lower.includes("hot")
    ) {
      return "hvac";
    }

    return null;
  }

  /**
   * Calculate alert severity based on pattern
   */
  private calculateSeverity(pattern: { count: number; category: string }): string {
    // Critical categories
    const critical = ["electrical", "structural"];
    const high = ["plumbing", "hvac"];

    if (pattern.count >= 5) {
      return "critical";
    }

    if (critical.includes(pattern.category)) {
      return pattern.count >= 3 ? "high" : "medium";
    }

    if (high.includes(pattern.category)) {
      return pattern.count >= 4 ? "high" : "medium";
    }

    return "low";
  }

  /**
   * Generate suggested action text
   */
  private generateSuggestedAction(pattern: { category: string; count: number }): string {
    const actions: Record<string, string> = {
      electrical:
        "Schedule an electrical inspection. Check wiring, outlets, and breakers. Consider upgrading electrical panel if issues persist.",
      plumbing:
        "Have a plumber inspect the water lines, drains, and fixtures. Check for leaks or blockages.",
      hvac: "Schedule HVAC maintenance. Check filters, refrigerant levels, and thermostat calibration.",
      structural:
        "Have a contractor inspect the structure for damage or wear. Address any foundation, roofing, or framing issues.",
      grounds:
        "Review landscaping and grounds maintenance schedule. Consider drainage improvements if water pooling is an issue.",
      general:
        "Schedule a comprehensive site inspection to identify the root cause of recurring issues.",
    };

    return (
      actions[pattern.category] ||
      actions.general + ` With ${pattern.count} incidents, this site needs priority attention.`
    );
  }

  /**
   * Estimate repair costs by category
   */
  private estimateRepairCost(category: string): number {
    const estimates: Record<string, number> = {
      electrical: 50000, // $500
      plumbing: 35000, // $350
      hvac: 75000, // $750
      structural: 150000, // $1,500
      grounds: 20000, // $200
      general: 30000, // $300
    };

    return estimates[category] || estimates.general;
  }

  // ==================== ALERT ACTIONS ====================

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(id: string, userId: string) {
    return this.prisma.aiMaintenanceAlert.update({
      where: { id },
      data: {
        status: "acknowledged",
        acknowledgedAt: new Date(),
        acknowledgedById: userId,
      },
    });
  }

  /**
   * Schedule maintenance for an alert
   */
  async scheduleAlert(id: string, maintenanceTicketId: string) {
    return this.prisma.aiMaintenanceAlert.update({
      where: { id },
      data: {
        status: "scheduled",
        maintenanceTicketId,
      },
    });
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(id: string) {
    return this.prisma.aiMaintenanceAlert.update({
      where: { id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
      },
    });
  }

  /**
   * Dismiss an alert
   */
  async dismissAlert(id: string) {
    return this.prisma.aiMaintenanceAlert.update({
      where: { id },
      data: {
        status: "dismissed",
      },
    });
  }

  // ==================== SUMMARY ====================

  /**
   * Get maintenance summary for dashboard
   */
  async getMaintenanceSummary(campgroundId: string) {
    const alerts = await this.prisma.aiMaintenanceAlert.findMany({
      where: {
        campgroundId,
        status: { in: ["new", "acknowledged"] },
      },
      select: { severity: true, category: true, status: true },
    });

    const bySeverity = alerts.reduce<Record<string, number>>((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {});

    const byCategory = alerts.reduce<Record<string, number>>((acc, alert) => {
      acc[alert.category] = (acc[alert.category] || 0) + 1;
      return acc;
    }, {});

    return {
      activeAlerts: alerts.length,
      critical: bySeverity.critical || 0,
      high: bySeverity.high || 0,
      medium: bySeverity.medium || 0,
      low: bySeverity.low || 0,
      byCategory,
      requiresAttention: (bySeverity.critical || 0) + (bySeverity.high || 0),
    };
  }

  // ==================== SCHEDULED JOBS ====================

  /**
   * Daily pattern analysis (runs at 5 AM)
   */
  @Cron("0 5 * * *")
  async runDailyPatternAnalysis() {
    this.logger.log("Starting daily maintenance pattern analysis...");

    const configs = await this.prisma.aiAutopilotConfig.findMany({
      where: { predictiveMaintenanceEnabled: true },
      select: { campgroundId: true },
    });

    let analyzed = 0;
    let errors = 0;

    for (const config of configs) {
      try {
        await this.analyzePatterns(config.campgroundId);
        analyzed++;
      } catch (error) {
        this.logger.error(`Failed to analyze patterns for ${config.campgroundId}: ${error}`);
        errors++;
      }
    }

    this.logger.log(`Daily maintenance analysis complete: ${analyzed} analyzed, ${errors} errors`);
  }
}
