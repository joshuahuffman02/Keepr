import { Module } from "@nestjs/common";
import { PromotionsService } from "./promotions.service";
import { PromotionsController } from "./promotions.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
