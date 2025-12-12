import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { ReservationsModule } from "../reservations/reservations.module";
import { StripeService } from "./stripe.service";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsReconciliationService } from "./reconciliation.service";
import { PaymentsScheduler } from "./payments.scheduler";
import { PermissionsModule } from "../permissions/permissions.module";
import { IdempotencyService } from "./idempotency.service";
import { GatewayConfigService } from "./gateway-config.service";
import { GatewayConfigController } from "./gateway-config.controller";
import { AuditModule } from "../audit/audit.module";
import { LedgerModule } from "../ledger/ledger.module";

@Module({
  imports: [ReservationsModule, PermissionsModule, AuditModule, LedgerModule],
  controllers: [PaymentsController, GatewayConfigController],
  providers: [StripeService, PrismaService, PaymentsReconciliationService, PaymentsScheduler, IdempotencyService, GatewayConfigService],
  exports: [StripeService, PaymentsReconciliationService, IdempotencyService, GatewayConfigService]
})
export class PaymentsModule { }

