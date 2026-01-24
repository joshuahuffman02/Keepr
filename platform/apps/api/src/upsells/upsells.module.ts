import { Module } from "@nestjs/common";
import { UpsellsController } from "./upsells.controller";
import { UpsellsService } from "./upsells.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditModule } from "../audit/audit.module";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [UpsellsController],
  providers: [UpsellsService],
  exports: [UpsellsService],
})
export class UpsellsModule {}
