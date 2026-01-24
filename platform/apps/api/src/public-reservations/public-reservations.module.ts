import { Module, forwardRef } from "@nestjs/common";
import { PublicReservationsController } from "./public-reservations.controller";
import { PublicReservationsService } from "./public-reservations.service";
import { PrismaModule } from "../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { PromotionsModule } from "../promotions/promotions.module";
import { AbandonedCartModule } from "../abandoned-cart/abandoned-cart.module";
import { MembershipsModule } from "../memberships/memberships.module";
import { SignaturesModule } from "../signatures/signatures.module";
import { AccessControlModule } from "../access-control/access-control.module";
import { PoliciesModule } from "../policies/policies.module";
import { PricingV2Module } from "../pricing-v2/pricing-v2.module";
import { DepositPoliciesModule } from "../deposit-policies/deposit-policies.module";
import { FormsModule } from "../forms/forms.module";
import { PaymentsModule } from "../payments/payments.module";
import { EmailModule } from "../email/email.module";
import { AiModule } from "../ai/ai.module";

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    PromotionsModule,
    AbandonedCartModule,
    MembershipsModule,
    SignaturesModule,
    PoliciesModule,
    AccessControlModule,
    PricingV2Module,
    DepositPoliciesModule,
    FormsModule,
    forwardRef(() => PaymentsModule),
    EmailModule,
    forwardRef(() => AiModule),
  ],
  controllers: [PublicReservationsController],
  providers: [PublicReservationsService],
  exports: [PublicReservationsService],
})
export class PublicReservationsModule {}
