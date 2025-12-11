import { Module } from "@nestjs/common";
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

@Module({
  imports: [StoredValueModule],
  controllers: [PosController, TillController],
  providers: [PosService, PrismaService, IdempotencyService, StoredValueService, StripeService, TillService, AuditService],
  exports: [PosService, TillService]
})
export class PosModule {}
