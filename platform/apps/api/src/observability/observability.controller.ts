import { Controller, Get } from "@nestjs/common";
import { ObservabilityService } from "./observability.service";

@Controller("observability")
export class ObservabilityController {
  constructor(private readonly observability: ObservabilityService) { }

  @Get("snapshot")
  getSnapshot() {
    return this.observability.snapshot();
  }

  @Get("alerts")
  getAlerts() {
    return this.observability.alerts();
  }

  @Get("flags")
  getFlags() {
    return {
      commsAlertsEnabled: (process.env.ENABLE_COMMS_METRICS ?? process.env.comms_alerts_enabled ?? "true").toString().toLowerCase() === "true",
      readyAlertsEnabled: (process.env.ENABLE_READY_PROBE ?? process.env.ready_checks_enabled ?? "true").toString().toLowerCase() === "true",
      otaAlertsEnabled: (process.env.ENABLE_OTA_MONITORING ?? process.env.ota_alerts_enabled ?? "true").toString().toLowerCase() === "true",
      syntheticsEnabled: (process.env.SYNTHETICS_ENABLED ?? "true").toLowerCase() === "true",
    };
  }
}

