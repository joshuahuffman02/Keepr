import { Module, forwardRef } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { ReservationsModule } from "../reservations/reservations.module";
import { StripeService } from "./stripe.service";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsReconciliationService } from "./reconciliation.service";
import { PaymentsScheduler } from "./payments.scheduler";
import { PermissionsModule } from "../permissions/permissions.module";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { GatewayConfigService } from "./gateway-config.service";
import { GatewayConfigController } from "./gateway-config.controller";
import { AuditModule } from "../audit/audit.module";
import { LedgerModule } from "../ledger/ledger.module";

@Module({
  imports: [forwardRef(() => ReservationsModule), PermissionsModule, AuditModule, LedgerModule, IdempotencyModule],
  controllers: [PaymentsController, GatewayConfigController],
  providers: [StripeService, PaymentsReconciliationService, PaymentsScheduler, GatewayConfigService],
  exports: [StripeService, PaymentsReconciliationService, IdempotencyModule, GatewayConfigService]
})
export class PaymentsModule { }

