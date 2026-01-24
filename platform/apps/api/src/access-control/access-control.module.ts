import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { AccessControlController } from "./access-control.controller";
import { AccessControlService } from "./access-control.service";
import { AccessProviderRegistry } from "./access-provider.registry";
import { BrivoAdapter, CloudKeyAdapter, KisiAdapter } from "./access-provider.adapters";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { PermissionsModule } from "../permissions/permissions.module";

@Module({
  imports: [AuthModule, AuditModule, PermissionsModule],
  controllers: [AccessControlController],
  providers: [
    AccessControlService,
    PrismaService,
    IdempotencyService,
    AccessProviderRegistry,
    KisiAdapter,
    BrivoAdapter,
    CloudKeyAdapter,
  ],
  exports: [AccessControlService, AccessProviderRegistry],
})
export class AccessControlModule {}
