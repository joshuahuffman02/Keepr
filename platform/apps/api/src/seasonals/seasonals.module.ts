import { Module } from "@nestjs/common";
import { SeasonalsController } from "./seasonals.controller";
import { SeasonalsService } from "./seasonals.service";
import { SeasonalPricingService } from "./seasonal-pricing.service";
import { PrismaModule } from "../prisma/prisma.module";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [SeasonalsController],
  providers: [SeasonalsService, SeasonalPricingService],
  exports: [SeasonalsService, SeasonalPricingService],
})
export class SeasonalsModule {}
