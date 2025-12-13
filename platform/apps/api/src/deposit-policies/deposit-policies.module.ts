import { Module } from "@nestjs/common";
import { DepositPoliciesController } from "./deposit-policies.controller";
import { DepositPoliciesService } from "./deposit-policies.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [DepositPoliciesController],
  providers: [DepositPoliciesService],
  exports: [DepositPoliciesService]
})
export class DepositPoliciesModule {}

