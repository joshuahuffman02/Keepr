import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsController } from "./analytics.controller";
import { EnhancedAnalyticsService } from "./enhanced-analytics.service";
import { EnhancedAnalyticsController } from "./enhanced-analytics.controller";
import { AnomalyDetectionService } from "./anomaly-detection.service";
import { AuditService } from "../audit/audit.service";

@Module({
  providers: [AnalyticsService, EnhancedAnalyticsService, AnomalyDetectionService, AuditService],
  controllers: [AnalyticsController, EnhancedAnalyticsController],
  exports: [AnalyticsService, EnhancedAnalyticsService, AnomalyDetectionService],
})
export class AnalyticsModule {}
