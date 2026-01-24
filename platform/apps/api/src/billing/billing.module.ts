import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { BillingDashboardService } from "./billing-dashboard.service";
import { BillingDashboardController } from "./billing-dashboard.controller";
import { PrismaService } from "../prisma/prisma.service";
import { BillingJobs } from "./billing.jobs";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [PermissionsModule],
  controllers: [BillingController, BillingDashboardController],
  providers: [BillingService, BillingDashboardService, BillingJobs, PrismaService],
  exports: [BillingService, BillingDashboardService],
})
export class BillingModule {}
