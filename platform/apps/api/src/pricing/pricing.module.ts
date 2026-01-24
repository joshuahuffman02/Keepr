import { Module } from "@nestjs/common";
import { PricingService } from "./pricing.service";
import { PricingController } from "./pricing.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [PrismaModule, PermissionsModule],
  providers: [PricingService],
  controllers: [PricingController],
})
export class PricingModule {}
