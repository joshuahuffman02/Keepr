import { Module } from "@nestjs/common";
import { GuestsService } from "./guests.service";
import { GuestsController } from "./guests.controller";
import { PrismaService } from "../prisma/prisma.service";
import { AuditModule } from "../audit/audit.module";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [GuestsController],
  providers: [GuestsService],
  exports: [GuestsService]
})
export class GuestsModule {}
