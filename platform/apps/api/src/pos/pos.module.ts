import { Module, forwardRef } from "@nestjs/common";
import { PosController } from "./pos.controller";
import { PosService } from "./pos.service";
import { PrismaService } from "../prisma/prisma.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { StoredValueService } from "../stored-value/stored-value.service";
import { StoredValueModule } from "../stored-value/stored-value.module";
import { StripeService } from "../payments/stripe.service";
import { TillService } from "./till.service";
import { TillController } from "./till.controller";
import { AuditService } from "../audit/audit.service";
import { PosProviderController } from "./pos-provider.controller";
import { PosProviderService } from "./pos-provider.service";
import { PosProviderRegistry } from "./pos-provider.registry";
import { CloverAdapter, SquareAdapter, ToastAdapter } from "./pos-provider.adapters";
import { EmailService } from "../email/email.service";
import { InventoryModule } from "../inventory/inventory.module";

@Module({
  imports: [StoredValueModule, forwardRef(() => InventoryModule)],
  controllers: [PosController, TillController, PosProviderController],
  providers: [
    PosService,
    PrismaService,
    IdempotencyService,
    StoredValueService,
    StripeService,
    TillService,
    AuditService,
    PosProviderService,
    PosProviderRegistry,
    CloverAdapter,
    SquareAdapter,
    ToastAdapter,
    EmailService
  ],
  exports: [PosService, TillService, PosProviderService]
})
export class PosModule {}
