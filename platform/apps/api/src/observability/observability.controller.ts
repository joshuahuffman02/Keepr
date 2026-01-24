import { Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { ObservabilityService } from "./observability.service";
import { PrometheusService } from "./prometheus.service";
import { SyntheticChecksService } from "./synthetic-checks.service";
import { AlertSinksService } from "./alert-sinks.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { PlatformRole } from "@prisma/client";

@Controller("observability")
export class ObservabilityController {
  constructor(
    private readonly observability: ObservabilityService,
    private readonly prometheus: PrometheusService,
    private readonly syntheticChecks: SyntheticChecksService,
    private readonly alertSinks: AlertSinksService,
  ) {}

  /**
   * Prometheus metrics endpoint
   * Exposed without auth for scraping by Prometheus
   */
  @Get("metrics")
  getMetrics(@Res() res: Response) {
    const metrics = this.prometheus.getMetrics();
    res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(metrics);
  }

  /**
   * Prometheus metrics as JSON (for debugging)
   */
  @Get("metrics/json")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.platform_admin)
  getMetricsJson() {
    return this.prometheus.getMetricsJson();
  }

  @Get("snapshot")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.platform_admin)
  getSnapshot() {
    return this.observability.snapshot();
  }

  @Get("alerts")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.platform_admin)
  getAlerts() {
    return this.observability.alerts();
  }

  @Get("flags")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.platform_admin)
  getFlags() {
    return {
      commsAlertsEnabled:
        (process.env.ENABLE_COMMS_METRICS ?? process.env.comms_alerts_enabled ?? "true")
          .toString()
          .toLowerCase() === "true",
      readyAlertsEnabled:
        (process.env.ENABLE_READY_PROBE ?? process.env.ready_checks_enabled ?? "true")
          .toString()
          .toLowerCase() === "true",
      otaAlertsEnabled:
        (process.env.ENABLE_OTA_MONITORING ?? process.env.ota_alerts_enabled ?? "true")
          .toString()
          .toLowerCase() === "true",
      syntheticsEnabled: (process.env.SYNTHETICS_ENABLED ?? "true").toLowerCase() === "true",
      prometheusEnabled: (process.env.PROMETHEUS_ENABLED ?? "true").toLowerCase() === "true",
      alertSinksEnabled: (process.env.ALERT_SINKS_ENABLED ?? "true").toLowerCase() === "true",
    };
  }

  /**
   * Get current status of all synthetic checks
   */
  @Get("synthetics")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.platform_admin)
  getSyntheticStatus() {
    return {
      current: this.syntheticChecks.getCurrentStatus(),
      statistics: this.syntheticChecks.getStatistics(),
    };
  }

  /**
   * Get synthetic check history
   */
  @Get("synthetics/history")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.platform_admin)
  getSyntheticHistory() {
    return this.syntheticChecks.getAllHistory();
  }

  /**
   * Get synthetic check history for a specific check
   */
  @Get("synthetics/:name/history")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.platform_admin)
  getSyntheticCheckHistory(@Param("name") name: string) {
    return this.syntheticChecks.getHistory(name);
  }

  /**
   * Manually trigger a synthetic check
   */
  @Post("synthetics/:name/run")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.platform_admin)
  async runSyntheticCheck(@Param("name") name: string) {
    return this.syntheticChecks.runCheck(name);
  }

  /**
   * Manually trigger all synthetic checks
   */
  @Post("synthetics/run")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.platform_admin)
  async runAllSyntheticChecks() {
    return this.syntheticChecks.runAllChecks();
  }

  /**
   * Get configured alert sinks
   */
  @Get("sinks")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.platform_admin)
  getAlertSinks() {
    const sinks = this.alertSinks.getSinks();
    return sinks.map((sink) => ({
      name: sink.name,
      configured: sink.isConfigured(),
    }));
  }

  /**
   * Send a test alert to all configured sinks
   */
  @Post("sinks/test")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.platform_admin)
  async testAlertSinks() {
    return this.alertSinks.dispatch({
      title: "Test Alert",
      message: "This is a test alert from the observability controller.",
      severity: "info",
      dedupKey: `test-alert-${Date.now()}`,
      source: "observability-controller",
      details: {
        timestamp: new Date().toISOString(),
        type: "test",
      },
    });
  }
}
