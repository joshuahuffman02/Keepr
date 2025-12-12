import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ObservabilityService } from "./observability.service";
import { AlertingService } from "./alerting.service";
import { PrismaService } from "../prisma/prisma.service";
import { OtaService } from "../ota/ota.service";

@Injectable()
export class AlertMonitorService {
  private readonly logger = new Logger(AlertMonitorService.name);
  private readonly commsAlertsEnabled =
    (process.env.ENABLE_COMMS_METRICS ?? process.env.comms_alerts_enabled ?? "true").toString().toLowerCase() === "true";
  private readonly readyAlertsEnabled =
    (process.env.ENABLE_READY_PROBE ?? process.env.ready_checks_enabled ?? "true").toString().toLowerCase() === "true";
  private readonly otaAlertsEnabled =
    (process.env.ENABLE_OTA_MONITORING ?? process.env.ota_alerts_enabled ?? "true").toString().toLowerCase() === "true";

  constructor(
    private readonly observability: ObservabilityService,
    private readonly alerting: AlertingService,
    private readonly prisma: PrismaService,
    private readonly otaService: OtaService
  ) { }

  @Cron("*/5 * * * *")
  async evaluate() {
    try {
      const alerts = this.observability.alerts();
      const breaches: string[] = [];

      if (alerts.domain.redeem.breach) breaches.push("redeem failure spike");
      const offlineQueued = Object.entries((alerts.queues as any).state || {}).some(
        ([name, state]) => name?.toLowerCase().includes("offline") && ((state as any)?.queued ?? 0) > 0
      );
      if (alerts.domain.offlineBacklog.breach || offlineQueued) breaches.push("offline backlog");
      if (alerts.domain.offerLag.breach) breaches.push("offer lag high");
      if (alerts.domain.reports.breach) breaches.push("report failures");
      const hasDlq = Object.entries((alerts.queues as any).state || {}).some(
        ([name, state]) => name?.toLowerCase().includes("dlq") && ((state as any)?.queued ?? 0) > 0
      );
      if (hasDlq) breaches.push("DLQ non-empty");
      if (alerts.queues.lagBreaches.length > 0) breaches.push("queue lag");
      if (alerts.api.breaches.p95 || alerts.api.breaches.errorRate) breaches.push("API perf budget");
      if (alerts.web.breaches.lcp || alerts.web.breaches.ttfb) breaches.push("Web perf budget");

      if (this.commsAlertsEnabled && (alerts.comms.breaches.delivery || alerts.comms.breaches.bounce || alerts.comms.breaches.complaint)) {
        breaches.push("comms delivery/bounce");
      }
      if (this.commsAlertsEnabled && alerts.comms.breaches.smsFailures) {
        breaches.push("sms failures");
      }

      if (this.readyAlertsEnabled && alerts.domain.ready.breach) {
        breaches.push("readiness failing");
      }

      if (this.otaAlertsEnabled) {
        const ota = this.otaService.alerts?.() ?? { freshnessBreaches: [], webhookBreaches: [], successBreaches: [] };
        // Emit into observability domain for OTA backlog visibility
        [...(ota.freshnessBreaches || []), ...(ota.webhookBreaches || []), ...(ota.successBreaches || [])].forEach((b: any) => {
          const ageSeconds = typeof b.ageMinutes === "number" ? b.ageMinutes * 60 : undefined;
          this.observability.recordOtaStatus(!(b.webhookErrorRate || b.ageMinutes === Infinity || (b.successRate ?? 1) < 0.95), ageSeconds, b);
        });
        if ((ota as any).freshnessBreaches?.length) breaches.push("OTA backlog/freshness");
        if ((ota as any).webhookBreaches?.length) breaches.push("OTA webhook error rate");
        if ((ota as any).successBreaches?.length) breaches.push("OTA success rate drop");
      }

      const failedSynthetics = Object.entries(alerts.synthetics || {}).filter(([, v]) => v && !v.ok);
      if (failedSynthetics.length > 0) {
        breaches.push(`synthetics failing (${failedSynthetics.map(([k]) => k).join(", ")})`);
      }

      // Include report failure rate from persisted runs (1h window)
      const reportSignal = await this.reportWindowSignal();
      if (reportSignal.breach && !breaches.includes("report failures")) {
        breaches.push("report failures");
      }

      if (breaches.length === 0) {
        return;
      }

      this.logger.warn(`Alert breaches detected: ${breaches.join(", ")}`);
      const message = `Alerts: ${breaches.join(", ")}\n` +
        `API p95=${alerts.api.p95}ms (budget ${alerts.targets.apiP95Ms}), errorRate=${alerts.api.errorRate.toFixed(3)}\n` +
        `Queues lag=${alerts.queues.lagBreaches.length}, depth=${alerts.queues.depthBreaches.length}\n` +
        `Comms delivery=${(alerts.comms.deliveryRate * 100).toFixed(1)}% bounce=${(alerts.comms.bounceRate * 100).toFixed(2)}% smsFail=${((alerts.comms.providers.twilio?.failureRate ?? 0) * 100).toFixed(2)}%`;

      await this.alerting.dispatch("Observability alerts firing", message, "error", "observability-breach", {
        breaches,
        api: alerts.api,
        comms: alerts.comms,
        queues: alerts.queues,
        reportRuns: reportSignal,
      });
    } catch (err) {
      this.logger.error(`Alert evaluation failed: ${(err as any)?.message ?? err}`);
    }
  }

  private async reportWindowSignal() {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [failures, total] = await Promise.all([
      this.prisma.reportRun.count({ where: { createdAt: { gte: since }, status: { in: ["failed", "error"] as any } } }),
      this.prisma.reportRun.count({ where: { createdAt: { gte: since } } }),
    ]);
    const rate = total === 0 ? 0 : failures / total;
    return {
      failures,
      total,
      rate,
      breach: failures > 0 && rate > 0.05,
    };
  }
}
