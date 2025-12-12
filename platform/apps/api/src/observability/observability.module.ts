import { Global, Module } from "@nestjs/common";
import { ObservabilityController } from "./observability.controller";
import { ObservabilityService } from "./observability.service";
import { JobQueueService } from "./job-queue.service";
import { AlertingService } from "./alerting.service";
import { AlertMonitorService } from "./alert-monitor.service";
import { PrismaModule } from "../prisma/prisma.module";
import { OtaModule } from "../ota/ota.module";
import { SyntheticsService } from "./synthetics.service";

@Global()
@Module({
  imports: [PrismaModule, OtaModule],
  controllers: [ObservabilityController],
  providers: [
    ObservabilityService,
    JobQueueService,
    AlertingService,
    AlertMonitorService,
    SyntheticsService,
  ],
  exports: [ObservabilityService, JobQueueService, AlertingService],
})
export class ObservabilityModule { }

