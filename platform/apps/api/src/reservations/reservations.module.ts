import { Module } from "@nestjs/common";
import { ReservationsService } from "./reservations.service";
import { ReservationsController } from "./reservations.controller";
import { PrismaService } from "../prisma/prisma.service";
import { PricingService } from "../pricing/pricing.service";
import { RedisService } from "../redis/redis.service";
import { LockService } from "../redis/lock.service";
import { PromotionsService } from "../promotions/promotions.service";
import { AccessControlModule } from "../access-control/access-control.module";

import { EmailModule } from "../email/email.module";
import { WaitlistModule } from "../waitlist/waitlist.module";
import { LoyaltyModule } from "../loyalty/loyalty.module";
import { SeasonalRatesModule } from "../seasonal-rates/seasonal-rates.module";
import { TaxRulesModule } from "../tax-rules/tax-rules.module";
import { GamificationModule } from "../gamification/gamification.module";
import { AuditModule } from "../audit/audit.module";
import { ReservationImportExportService } from "./reservation-import-export.service";
import { IdempotencyService } from "../payments/idempotency.service";

import { MatchScoreService } from "./match-score.service";
import { PricingV2Service } from "../pricing-v2/pricing-v2.service";
import { DepositPoliciesService } from "../deposit-policies/deposit-policies.service";
import { SignaturesModule } from "../signatures/signatures.module";

@Module({
  imports: [WaitlistModule, LoyaltyModule, SeasonalRatesModule, TaxRulesModule, GamificationModule, AuditModule, AccessControlModule, SignaturesModule],
  controllers: [ReservationsController],
  providers: [
    ReservationsService,
    ReservationImportExportService,
    PrismaService,
    PricingService,
    RedisService,
    LockService,
    PromotionsService,
    MatchScoreService,
    PricingV2Service,
    DepositPoliciesService,
    IdempotencyService
  ],
  exports: [ReservationsService, MatchScoreService]
})
export class ReservationsModule { }

