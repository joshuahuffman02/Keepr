import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { ReportSubscriptionService } from "./report-subscription.service";
import { ReportSubscriptionController } from "./report-subscription.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { ObservabilityModule } from "../observability/observability.module";
import { DashboardService } from "../dashboard/dashboard.service";
import { UploadsModule } from "../uploads/uploads.module";
import { AuditModule } from "../audit/audit.module";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [PrismaModule, ObservabilityModule, UploadsModule, AuditModule, EmailModule],
  controllers: [ReportsController, ReportSubscriptionController],
  providers: [ReportsService, DashboardService, ReportSubscriptionService],
  exports: [ReportsService, ReportSubscriptionService],
})
export class ReportsModule {}
