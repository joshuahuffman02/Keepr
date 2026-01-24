import { Module } from "@nestjs/common";
import { DynamicPricingService } from "./dynamic-pricing.service";
import { DynamicPricingController } from "./dynamic-pricing.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [DynamicPricingController],
  providers: [DynamicPricingService],
  exports: [DynamicPricingService],
})
export class DynamicPricingModule {}
