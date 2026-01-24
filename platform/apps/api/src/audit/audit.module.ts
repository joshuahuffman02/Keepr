import { Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditController } from "./audit.controller";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [PermissionsModule],
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
