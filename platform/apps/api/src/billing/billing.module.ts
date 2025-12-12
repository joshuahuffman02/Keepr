import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { PrismaService } from "../prisma/prisma.service";
import { BillingJobs } from "./billing.jobs";

@Module({
  imports: [],
  controllers: [BillingController],
  providers: [BillingService, BillingJobs, PrismaService],
  exports: [BillingService]
})
export class BillingModule {}
