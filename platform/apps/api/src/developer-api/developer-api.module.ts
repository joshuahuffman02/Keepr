import { Module } from "@nestjs/common";
import { ApiAuthController } from "./api-auth.controller";
import { DeveloperAdminController } from "./developer-admin.controller";
import { WebhookAdminController } from "./webhook-admin.controller";
import { PublicReservationsController } from "./public-reservations.controller";
import { PublicGuestsController } from "./public-guests.controller";
import { PublicSitesController } from "./public-sites.controller";
import { ApiAuthService } from "./api-auth.service";
import { WebhookService } from "./webhook.service";
import { PublicApiService } from "./public-api.service";
import { ApiUsageService } from "./api-usage.service";
import { PrismaService } from "../prisma/prisma.service";
import { GuestsService } from "../guests/guests.service";
import { ApiTokenGuard } from "./guards/api-token.guard";
import { ApiScopeGuard } from "./guards/api-scope.guard";
import { AuditModule } from "../audit/audit.module";
import { PricingV2Module } from "../pricing-v2/pricing-v2.module";
import { DepositPoliciesModule } from "../deposit-policies/deposit-policies.module";

@Module({
  imports: [AuditModule, PricingV2Module, DepositPoliciesModule],
  controllers: [
    ApiAuthController,
    DeveloperAdminController,
    WebhookAdminController,
    PublicReservationsController,
    PublicGuestsController,
    PublicSitesController,
  ],
  providers: [
    ApiAuthService,
    WebhookService,
    PublicApiService,
    ApiUsageService,
    PrismaService,
    GuestsService,
    ApiTokenGuard,
    ApiScopeGuard,
  ],
  exports: [WebhookService, ApiAuthService, ApiUsageService],
})
export class DeveloperApiModule {}
