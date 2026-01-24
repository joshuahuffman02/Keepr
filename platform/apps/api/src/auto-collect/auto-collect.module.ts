import { Module } from "@nestjs/common";
import { AutoCollectService } from "./auto-collect.service";
import { PrismaService } from "../prisma/prisma.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { StripeService } from "../payments/stripe.service";

@Module({
  providers: [AutoCollectService, IdempotencyService, StripeService],
  exports: [AutoCollectService],
})
export class AutoCollectModule {}
