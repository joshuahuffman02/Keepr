import { Global, Module, OnModuleInit } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { ObservabilityController } from "./observability.controller";
import { ObservabilityService } from "./observability.service";
import { JobQueueService } from "./job-queue.service";
import { AlertingService } from "./alerting.service";
import { AlertMonitorService } from "./alert-monitor.service";
import { AlertSinksService } from "./alert-sinks.service";
import { PrometheusService } from "./prometheus.service";
import { SyntheticChecksService } from "./synthetic-checks.service";
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
    AlertSinksService,
    PrometheusService,
    SyntheticChecksService,
    SyntheticsService,
  ],
  exports: [
    ObservabilityService,
    JobQueueService,
    AlertingService,
    AlertSinksService,
    PrometheusService,
    SyntheticChecksService,
  ],
})
export class ObservabilityModule implements OnModuleInit {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly syntheticChecks: SyntheticChecksService
  ) {}

  async onModuleInit() {
    // Initialize synthetic checks with optional dependencies
    // These are injected lazily to avoid circular dependency issues
    try {
      const prisma = await this.moduleRef.get("PrismaService", { strict: false });
      const redis = await this.moduleRef.get("RedisService", { strict: false });
      const stripe = await this.moduleRef.get("StripeService", { strict: false });
      const email = await this.moduleRef.get("EmailService", { strict: false });

      this.syntheticChecks.initDependencies({
        prisma,
        redis,
        stripe,
        email,
      });
    } catch {
      // Services may not be available - synthetic checks will skip those
    }
  }
}

