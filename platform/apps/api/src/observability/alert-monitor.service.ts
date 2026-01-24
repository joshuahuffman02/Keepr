import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ObservabilityService } from "./observability.service";
import { AlertingService } from "./alerting.service";
import { AlertSinksService } from "./alert-sinks.service";
import { PrometheusService } from "./prometheus.service";
import { PrismaService } from "../prisma/prisma.service";
import { OtaService } from "../ota/ota.service";

type OtaAlert = {
  provider: string;
  campgroundId: string;
  ageMinutes?: number;
  webhookErrorRate?: number;
  successRate?: number;
};

type OtaAlertCollection = {
  freshnessBreaches: OtaAlert[];
  webhookBreaches: OtaAlert[];
  successBreaches: OtaAlert[];
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class AlertMonitorService {
  private readonly logger = new Logger(AlertMonitorService.name);
  private readonly commsAlertsEnabled =
    (process.env.ENABLE_COMMS_METRICS ?? process.env.comms_alerts_enabled ?? "true")
      .toString()
      .toLowerCase() === "true";
  private readonly readyAlertsEnabled =
    (process.env.ENABLE_READY_PROBE ?? process.env.ready_checks_enabled ?? "true")
      .toString()
      .toLowerCase() === "true";
  private readonly otaAlertsEnabled =
    (process.env.ENABLE_OTA_MONITORING ?? process.env.ota_alerts_enabled ?? "true")
      .toString()
      .toLowerCase() === "true";
  private readonly useNewAlertSinks =
    (process.env.USE_NEW_ALERT_SINKS ?? "true").toString().toLowerCase() === "true";

  constructor(
    private readonly observability: ObservabilityService,
    private readonly alerting: AlertingService,
    private readonly alertSinks: AlertSinksService,
    private readonly prometheus: PrometheusService,
    private readonly prisma: PrismaService,
    private readonly otaService: OtaService,
  ) {}

  @Cron("*/5 * * * *")
  async evaluate() {
    try {
      const alerts = this.observability.alerts();
      const breaches: string[] = [];

      if (alerts.domain.redeem.breach) breaches.push("redeem failure spike");
      const queueState = alerts.queues.state ?? {};
      const offlineQueued = Object.entries(queueState).some(
        ([name, state]) => name.toLowerCase().includes("offline") && (state.queued ?? 0) > 0,
      );
      if (alerts.domain.offlineBacklog.breach || offlineQueued) breaches.push("offline backlog");
      if (alerts.domain.offerLag.breach) breaches.push("offer lag high");
      if (alerts.domain.reports.breach) breaches.push("report failures");
      const hasDlq = Object.entries(queueState).some(
        ([name, state]) => name.toLowerCase().includes("dlq") && (state.queued ?? 0) > 0,
      );
      if (hasDlq) breaches.push("DLQ non-empty");
      if (alerts.queues.lagBreaches.length > 0) breaches.push("queue lag");
      if (alerts.api.breaches.p95 || alerts.api.breaches.errorRate)
        breaches.push("API perf budget");
      if (alerts.web.breaches.lcp || alerts.web.breaches.ttfb) breaches.push("Web perf budget");

      if (
        this.commsAlertsEnabled &&
        (alerts.comms.breaches.delivery ||
          alerts.comms.breaches.bounce ||
          alerts.comms.breaches.complaint)
      ) {
        breaches.push("comms delivery/bounce");
      }
      if (this.commsAlertsEnabled && alerts.comms.breaches.smsFailures) {
        breaches.push("sms failures");
      }

      if (this.readyAlertsEnabled && alerts.domain.ready.breach) {
        breaches.push("readiness failing");
      }

      if (this.otaAlertsEnabled) {
        const ota: OtaAlertCollection = this.otaService.alerts();
        // Emit into observability domain for OTA backlog visibility
        [...ota.freshnessBreaches, ...ota.webhookBreaches, ...ota.successBreaches].forEach(
          (breach) => {
            const ageSeconds =
              typeof breach.ageMinutes === "number" ? breach.ageMinutes * 60 : undefined;
            this.observability.recordOtaStatus(
              !(
                breach.webhookErrorRate ||
                breach.ageMinutes === Infinity ||
                (breach.successRate ?? 1) < 0.95
              ),
              ageSeconds,
              breach,
            );
          },
        );
        if (ota.freshnessBreaches.length > 0) breaches.push("OTA backlog/freshness");
        if (ota.webhookBreaches.length > 0) breaches.push("OTA webhook error rate");
        if (ota.successBreaches.length > 0) breaches.push("OTA success rate drop");
      }

      const failedSynthetics = Object.entries(alerts.synthetics || {}).filter(
        ([, v]) => v && !v.ok,
      );
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
      const message =
        `Alerts: ${breaches.join(", ")}\n` +
        `API p95=${alerts.api.p95}ms (budget ${alerts.targets.apiP95Ms}), errorRate=${alerts.api.errorRate.toFixed(3)}\n` +
        `Queues lag=${alerts.queues.lagBreaches.length}, depth=${alerts.queues.depthBreaches.length}\n` +
        `Comms delivery=${(alerts.comms.deliveryRate * 100).toFixed(1)}% bounce=${(alerts.comms.bounceRate * 100).toFixed(2)}% smsFail=${((alerts.comms.providers.twilio?.failureRate ?? 0) * 100).toFixed(2)}%`;

      const alertDetails = {
        breaches,
        api: alerts.api,
        comms: alerts.comms,
        queues: alerts.queues,
        reportRuns: reportSignal,
      };

      // Use new alert sinks service if enabled (provides rate limiting and extensibility)
      if (this.useNewAlertSinks) {
        await this.alertSinks.dispatch({
          title: "Observability alerts firing",
          message,
          severity: "error",
          dedupKey: "observability-breach",
          source: "alert-monitor",
          details: alertDetails,
        });
      } else {
        // Fall back to legacy alerting service
        await this.alerting.dispatch(
          "Observability alerts firing",
          message,
          "error",
          "observability-breach",
          alertDetails,
        );
      }

      // Update Prometheus metrics for alerting
      this.prometheus.incCounter("alerts_fired_total", {
        severity: "error",
        type: "observability-breach",
      });
      for (const breach of breaches) {
        this.prometheus.incCounter("alert_breaches_total", { breach });
      }
    } catch (err: unknown) {
      this.logger.error(`Alert evaluation failed: ${getErrorMessage(err)}`);
    }
  }

  private async reportWindowSignal() {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [failures, total] = await Promise.all([
      this.prisma.reportRun.count({
        where: { createdAt: { gte: since }, status: { in: ["failed", "error"] } },
      }),
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
