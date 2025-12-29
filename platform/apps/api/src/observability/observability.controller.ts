import { Controller, Get, UseGuards } from "@nestjs/common";
import { ObservabilityService } from "./observability.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { PlatformRole } from "@prisma/client";

@Controller("observability")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformRole.platform_admin)
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

