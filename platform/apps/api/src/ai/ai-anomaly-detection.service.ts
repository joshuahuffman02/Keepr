import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { AnomaliesService, AnomalyAlert } from "../anomalies/anomalies.service";
import { AiProviderService } from "./ai-provider.service";
import { AiAutopilotConfigService } from "./ai-autopilot-config.service";
import { EmailService } from "../email/email.service";
import { UpdateAnomalyStatusDto } from "./dto/autopilot.dto";

@Injectable()
export class AiAnomalyDetectionService {
  private readonly logger = new Logger(AiAnomalyDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anomaliesService: AnomaliesService,
    private readonly aiProvider: AiProviderService,
    private readonly configService: AiAutopilotConfigService,
    private readonly emailService: EmailService
  ) {}

  // ==================== ALERT CRUD ====================

  /**
   * Get all alerts for a campground
   */
  async getAlerts(campgroundId: string, status?: string, severity?: string) {
    const where: any = { campgroundId };
    if (status) where.status = status;
    if (severity) where.severity = severity;

    return this.prisma.aiAnomalyAlert.findMany({
      where,
      orderBy: { detectedAt: "desc" },
      take: 100,
    });
  }

  /**
   * Get a specific alert
   */
  async getAlert(id: string) {
    const alert = await this.prisma.aiAnomalyAlert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException("Alert not found");
    return alert;
  }

  /**
   * Update alert status (acknowledge, resolve, dismiss)
   */
  async updateAlertStatus(id: string, data: UpdateAnomalyStatusDto, userId?: string) {
    const alert = await this.getAlert(id);

    const updates: any = {
      status: data.status,
      acknowledgedAt: data.status === "acknowledged" ? new Date() : alert.acknowledgedAt,
      resolvedAt: data.status === "resolved" ? new Date() : alert.resolvedAt,
      acknowledgedById: userId,
    };

    if (data.dismissedReason) {
      updates.dismissedReason = data.dismissedReason;
    }

    return this.prisma.aiAnomalyAlert.update({
      where: { id },
      data: updates,
    });
  }

  // ==================== ANOMALY DETECTION ====================

  /**
   * Run all anomaly checks for a campground
   */
  async runChecks(campgroundId: string) {
    const config = await this.configService.getConfig(campgroundId);

    if (!config.anomalyDetectionEnabled) {
      this.logger.debug(`Anomaly detection disabled for campground ${campgroundId}`);
      return { checked: false, alerts: [] };
    }

    // Use existing anomaly service for statistical detection
    const anomalyAlerts = await this.anomaliesService.check({ campgroundId });

    // Filter based on sensitivity
    const filteredAlerts = this.filterBySensitivity(anomalyAlerts, config.anomalySensitivity);

    if (filteredAlerts.length === 0) {
      return { checked: true, alerts: [] };
    }

    // Process each alert
    const persistedAlerts = [];
    for (const alert of filteredAlerts) {
      try {
        // Check if similar alert already exists (within 24 hours)
        const existing = await this.prisma.aiAnomalyAlert.findFirst({
          where: {
            campgroundId,
            type: alert.type,
            status: { in: ["new", "acknowledged"] },
            detectedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });

        if (existing) {
          // Update existing alert with new values
          const updated = await this.prisma.aiAnomalyAlert.update({
            where: { id: existing.id },
            data: {
              currentValue: alert.currentValue,
              expectedValue: alert.expectedValue,
              deviation: alert.deviation,
              severity: alert.severity,
              detectedAt: new Date(),
            },
          });
          persistedAlerts.push(updated);
        } else {
          // Generate AI explanation
          const aiAnalysis = await this.generateAiExplanation(campgroundId, alert);

          // Create new alert
          const newAlert = await this.prisma.aiAnomalyAlert.create({
            data: {
              campgroundId,
              type: alert.type,
              severity: alert.severity,
              title: this.generateAlertTitle(alert),
              summary: alert.message,
              aiAnalysis: aiAnalysis?.explanation,
              suggestedAction: aiAnalysis?.suggestedAction,
              metric: alert.metric,
              currentValue: alert.currentValue,
              expectedValue: alert.expectedValue,
              deviation: alert.deviation,
              metadata: alert.metadata,
              status: "new",
              detectedAt: new Date(),
            },
          });
          persistedAlerts.push(newAlert);

          // Send realtime notification if configured
          if (config.anomalyAlertMode === "realtime" || config.anomalyAlertMode === "both") {
            await this.sendRealtimeAlert(campgroundId, newAlert);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to process alert: ${error}`);
      }
    }

    return { checked: true, alerts: persistedAlerts };
  }

  /**
   * Filter alerts based on sensitivity setting
   */
  private filterBySensitivity(alerts: AnomalyAlert[], sensitivity: string): AnomalyAlert[] {
    switch (sensitivity) {
      case "low":
        // Only critical and high severity
        return alerts.filter((a) => ["critical", "high"].includes(a.severity));
      case "medium":
        // Critical, high, and medium
        return alerts.filter((a) => ["critical", "high", "medium"].includes(a.severity));
      case "high":
        // All alerts
        return alerts;
      default:
        return alerts.filter((a) => ["critical", "high", "medium"].includes(a.severity));
    }
  }

  /**
   * Generate a human-readable title for the alert
   */
  private generateAlertTitle(alert: AnomalyAlert): string {
    const titleMap: Record<string, string> = {
      occupancy_drop: "Occupancy Drop Detected",
      occupancy_spike: "Unusual Occupancy Spike",
      revenue_drop: "Revenue Decline Alert",
      revenue_spike: "Revenue Spike Detected",
      cancellation_spike: "Increased Cancellations",
      booking_drop: "Booking Volume Decreased",
      payment_failure_spike: "Payment Issues Detected",
      lead_time_change: "Booking Lead Time Changed",
      adr_change: "Rate Anomaly Detected",
      system_error: "System Alert",
    };
    return titleMap[alert.type] || "Anomaly Detected";
  }

  /**
   * Generate AI explanation and suggested action for an anomaly
   */
  private async generateAiExplanation(
    campgroundId: string,
    alert: AnomalyAlert
  ): Promise<{ explanation: string; suggestedAction: string } | null> {
    try {
      // Get campground context
      const campground = await this.prisma.campground.findUnique({
        where: { id: campgroundId },
        select: { name: true, timezone: true },
      });

      // Get recent context
      const recentReservations = await this.prisma.reservation.count({
        where: {
          campgroundId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });

      const systemPrompt = `You are an AI analytics assistant for ${campground?.name || "a campground"}.
Analyze anomalies and provide actionable insights.
Be concise and specific. Focus on practical explanations.`;

      const userPrompt = `An anomaly has been detected:

Type: ${alert.type}
Severity: ${alert.severity}
Summary: ${alert.message}
Metric: ${alert.metric}
Current Value: ${alert.currentValue}
Expected Value: ${alert.expectedValue}
Deviation: ${alert.deviation}%
${alert.metadata ? `Additional Data: ${JSON.stringify(alert.metadata)}` : ""}

Recent Context:
- ${recentReservations} reservations created in the last 7 days

Provide:
1. A brief explanation of what might be causing this (1-2 sentences)
2. A specific action the campground staff should take

Response in JSON:
{
  "explanation": "...",
  "suggestedAction": "..."
}`;

      const response = await this.aiProvider.complete({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        maxTokens: 200,
        responseFormat: { type: "json_object" },
      });

      return JSON.parse(response.content);
    } catch (error) {
      this.logger.warn(`Failed to generate AI explanation: ${error}`);
      return null;
    }
  }

  // ==================== NOTIFICATIONS ====================

  /**
   * Send a realtime alert notification
   */
  private async sendRealtimeAlert(campgroundId: string, alert: any) {
    try {
      // Get campground owner/manager emails
      const staff = await this.prisma.campgroundMembership.findMany({
        where: {
          campgroundId,
          role: { in: ["owner", "manager"] },
        },
        include: { user: { select: { email: true, firstName: true } } },
      });

      if (staff.length === 0) {
        this.logger.debug(`No alert recipients for campground ${campgroundId}`);
        return;
      }

      const campground = await this.prisma.campground.findUnique({
        where: { id: campgroundId },
        select: { name: true },
      });

      for (const member of staff) {
        if (!member.user?.email) continue;

        const severityColors: Record<string, string> = {
          critical: "#dc2626",
          high: "#ea580c",
          medium: "#f59e0b",
          low: "#3b82f6",
        };

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: ${severityColors[alert.severity] || "#f59e0b"}; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <h1 style="color: white; margin: 0 0 8px 0; font-size: 24px;">${alert.title}</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px;">${campground?.name} • ${new Date().toLocaleDateString()}</p>
            </div>

            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0; color: #334155; line-height: 1.6;">${alert.summary}</p>

              ${alert.aiAnalysis ? `
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; font-weight: 600;">AI ANALYSIS</p>
                  <p style="margin: 0; color: #334155;">${alert.aiAnalysis}</p>
                </div>
              ` : ""}
            </div>

            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
              <tr>
                <td style="padding: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Metric</td>
                <td style="padding: 12px; color: #0f172a; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${alert.metric}</td>
              </tr>
              <tr>
                <td style="padding: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Current Value</td>
                <td style="padding: 12px; color: #0f172a; text-align: right; border-bottom: 1px solid #f1f5f9;">${alert.currentValue}</td>
              </tr>
              <tr>
                <td style="padding: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Expected Value</td>
                <td style="padding: 12px; color: #0f172a; text-align: right; border-bottom: 1px solid #f1f5f9;">${alert.expectedValue}</td>
              </tr>
              <tr>
                <td style="padding: 12px; color: #64748b;">Deviation</td>
                <td style="padding: 12px; color: ${alert.deviation < 0 ? "#dc2626" : "#16a34a"}; text-align: right; font-weight: 600;">${alert.deviation > 0 ? "+" : ""}${alert.deviation}%</td>
              </tr>
            </table>

            ${alert.suggestedAction ? `
              <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 12px; padding: 16px; margin-top: 24px;">
                <p style="margin: 0 0 4px 0; color: #065f46; font-size: 12px; font-weight: 600;">SUGGESTED ACTION</p>
                <p style="margin: 0; color: #065f46;">${alert.suggestedAction}</p>
              </div>
            ` : ""}

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                AI-Powered Anomaly Detection • Camp Everyday
              </p>
            </div>
          </div>
        `;

        await this.emailService.sendEmail({
          to: member.user.email,
          subject: `${alert.severity.toUpperCase()}: ${alert.title} - ${campground?.name}`,
          html,
          campgroundId,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send realtime alert: ${error}`);
    }
  }

  /**
   * Send anomaly digest email
   */
  async sendAnomalyDigest(campgroundId: string, period: "daily" | "weekly") {
    const config = await this.configService.getConfig(campgroundId);

    if (!config.anomalyDetectionEnabled) return { sent: false };
    if (config.anomalyAlertMode === "realtime") return { sent: false };

    // Get unresolved alerts from the period
    const since =
      period === "daily"
        ? new Date(Date.now() - 24 * 60 * 60 * 1000)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const alerts = await this.prisma.aiAnomalyAlert.findMany({
      where: {
        campgroundId,
        detectedAt: { gte: since },
        status: { in: ["new", "acknowledged"] },
      },
      orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
    });

    if (alerts.length === 0) {
      this.logger.debug(`No alerts to digest for campground ${campgroundId}`);
      return { sent: false, alertCount: 0 };
    }

    // Get recipients
    const staff = await this.prisma.campgroundMembership.findMany({
      where: {
        campgroundId,
        role: { in: ["owner", "manager"] },
      },
      include: { user: { select: { email: true, firstName: true } } },
    });

    if (staff.length === 0) return { sent: false };

    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { name: true },
    });

    // Group alerts by severity
    const critical = alerts.filter((a) => a.severity === "critical");
    const high = alerts.filter((a) => a.severity === "high");
    const medium = alerts.filter((a) => a.severity === "medium");
    const low = alerts.filter((a) => a.severity === "low");

    const periodLabel = period === "daily" ? "Daily" : "Weekly";

    const alertRowHtml = (alert: any) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #f1f5f9;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: ${
            { critical: "#fef2f2", high: "#fff7ed", medium: "#fefce8", low: "#eff6ff" }[alert.severity]
          }; color: ${
      { critical: "#dc2626", high: "#ea580c", medium: "#ca8a04", low: "#2563eb" }[alert.severity]
    };">${alert.severity.toUpperCase()}</span>
        </td>
        <td style="padding: 12px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${alert.title}</td>
        <td style="padding: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; font-size: 13px;">${alert.summary.substring(0, 60)}${alert.summary.length > 60 ? "..." : ""}</td>
      </tr>
    `;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #0f172a; margin: 0;">${periodLabel} Anomaly Report</h1>
          <p style="color: #64748b; margin-top: 8px;">${campground?.name} • ${new Date().toLocaleDateString()}</p>
        </div>

        <div style="display: flex; gap: 12px; margin-bottom: 24px;">
          ${critical.length > 0 ? `<div style="flex: 1; background: #fef2f2; border-radius: 8px; padding: 16px; text-align: center;"><p style="margin: 0; font-size: 28px; font-weight: bold; color: #dc2626;">${critical.length}</p><p style="margin: 4px 0 0 0; font-size: 12px; color: #991b1b;">Critical</p></div>` : ""}
          ${high.length > 0 ? `<div style="flex: 1; background: #fff7ed; border-radius: 8px; padding: 16px; text-align: center;"><p style="margin: 0; font-size: 28px; font-weight: bold; color: #ea580c;">${high.length}</p><p style="margin: 4px 0 0 0; font-size: 12px; color: #9a3412;">High</p></div>` : ""}
          ${medium.length > 0 ? `<div style="flex: 1; background: #fefce8; border-radius: 8px; padding: 16px; text-align: center;"><p style="margin: 0; font-size: 28px; font-weight: bold; color: #ca8a04;">${medium.length}</p><p style="margin: 4px 0 0 0; font-size: 12px; color: #854d0e;">Medium</p></div>` : ""}
          ${low.length > 0 ? `<div style="flex: 1; background: #eff6ff; border-radius: 8px; padding: 16px; text-align: center;"><p style="margin: 0; font-size: 28px; font-weight: bold; color: #2563eb;">${low.length}</p><p style="margin: 4px 0 0 0; font-size: 12px; color: #1e40af;">Low</p></div>` : ""}
        </div>

        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 12px; text-align: left; color: #64748b; font-size: 12px; font-weight: 600;">Severity</th>
              <th style="padding: 12px; text-align: left; color: #64748b; font-size: 12px; font-weight: 600;">Alert</th>
              <th style="padding: 12px; text-align: left; color: #64748b; font-size: 12px; font-weight: 600;">Summary</th>
            </tr>
          </thead>
          <tbody>
            ${alerts.map(alertRowHtml).join("")}
          </tbody>
        </table>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 12px; margin: 0;">
            Log in to your dashboard to view details and take action.
          </p>
          <p style="color: #94a3b8; font-size: 11px; margin-top: 8px;">
            AI-Powered Anomaly Detection • Camp Everyday
          </p>
        </div>
      </div>
    `;

    // Send to all recipients
    for (const member of staff) {
      if (!member.user?.email) continue;

      await this.emailService.sendEmail({
        to: member.user.email,
        subject: `${periodLabel} Anomaly Report: ${alerts.length} alert${alerts.length !== 1 ? "s" : ""} - ${campground?.name}`,
        html,
        campgroundId,
      });
    }

    return { sent: true, alertCount: alerts.length, recipientCount: staff.length };
  }

  // ==================== SCHEDULED JOBS ====================

  /**
   * Run daily anomaly checks for all campgrounds (6 AM)
   */
  @Cron("0 6 * * *")
  async runDailyChecks() {
    this.logger.log("Running daily anomaly checks...");

    const configs = await this.prisma.aiAutopilotConfig.findMany({
      where: { anomalyDetectionEnabled: true },
      select: { campgroundId: true },
    });

    let checked = 0;
    let alertsFound = 0;

    for (const config of configs) {
      try {
        const result = await this.runChecks(config.campgroundId);
        if (result.checked) {
          checked++;
          alertsFound += result.alerts.length;
        }
      } catch (error) {
        this.logger.error(`Failed to check campground ${config.campgroundId}: ${error}`);
      }
    }

    this.logger.log(`Daily checks complete: ${checked} campgrounds, ${alertsFound} alerts`);
  }

  /**
   * Send daily digests (8 AM)
   */
  @Cron("0 8 * * *")
  async sendDailyDigests() {
    this.logger.log("Sending daily anomaly digests...");

    const configs = await this.prisma.aiAutopilotConfig.findMany({
      where: {
        anomalyDetectionEnabled: true,
        anomalyDigestSchedule: "daily",
        anomalyAlertMode: { in: ["digest", "both"] },
      },
      select: { campgroundId: true, anomalyDigestTime: true },
    });

    let sent = 0;

    for (const config of configs) {
      try {
        // Check if it's the right time for this campground
        // For simplicity, we run at 8 AM server time - could be enhanced with timezone support
        const result = await this.sendAnomalyDigest(config.campgroundId, "daily");
        if (result.sent) sent++;
      } catch (error) {
        this.logger.error(`Failed to send digest for campground ${config.campgroundId}: ${error}`);
      }
    }

    this.logger.log(`Daily digests sent: ${sent}`);
  }

  /**
   * Send weekly digests (8 AM Monday)
   */
  @Cron("0 8 * * 1")
  async sendWeeklyDigests() {
    this.logger.log("Sending weekly anomaly digests...");

    const configs = await this.prisma.aiAutopilotConfig.findMany({
      where: {
        anomalyDetectionEnabled: true,
        anomalyDigestSchedule: "weekly",
        anomalyAlertMode: { in: ["digest", "both"] },
      },
      select: { campgroundId: true },
    });

    let sent = 0;

    for (const config of configs) {
      try {
        const result = await this.sendAnomalyDigest(config.campgroundId, "weekly");
        if (result.sent) sent++;
      } catch (error) {
        this.logger.error(`Failed to send weekly digest for campground ${config.campgroundId}: ${error}`);
      }
    }

    this.logger.log(`Weekly digests sent: ${sent}`);
  }
}
