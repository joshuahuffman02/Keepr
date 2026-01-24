import { Module } from "@nestjs/common";
import { PricingV2Controller } from "./pricing-v2.controller";
import { PricingV2Service } from "./pricing-v2.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditModule } from "../audit/audit.module";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [PricingV2Controller],
  providers: [PricingV2Service],
  exports: [PricingV2Service],
})
export class PricingV2Module {}
